import { NextRequest, NextResponse } from "next/server";
import { text3dProjectSchema } from "@/lib/text3d-project";
import { buttonStateSchema } from "@/lib/button";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { z } from "zod";
import { one, query, hashPassword } from "@/lib/db";
import {
  currentUser,
  createSession,
  checkPassword,
  tokenHash,
  hasPermission,
  isPaid,
  encrypt,
  decrypt,
  rateLimit,
} from "@/lib/auth";
import { getSettings, getStyles, getPlans } from "@/lib/data";
import { styleSchema, editorSchema, slugSchema } from "@/lib/validation";
import { checkout, webhook } from "@/lib/payments";
import { isAllowedRequestOrigin } from "@/lib/origin";
import { isDeepStrictEqual } from "node:util";
import { glyphMap } from "@/lib/content";
import { reserveDownload } from "@/lib/downloads";
import { collectionContentSchema } from "@/lib/validation";
import { regionalPricesSchema } from "@/lib/validation";
import {
  countries,
  currencies,
  majorAmount,
  currencyDigits,
} from "@/lib/billing";
import type { User, Style, Plan } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });
function titleToSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
type Ctx = { params: Promise<{ path: string[] }> };
async function audit(u: User, action: string, detail: string) {
  await query(
    "INSERT INTO audit(id,actor_id,actor_name,action,detail) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), u.id, u.name, action, detail],
  );
}
async function verifyTurnstile(token: string | undefined, ip: string | null) {
  const config = await one<{ enabled: boolean; secret: string }>(
    "SELECT enabled,secret FROM gateways WHERE id='turnstile'",
  );
  if (!config?.enabled) return;
  if (!token) throw new Error("Please complete the bot check.");
  const result = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: decrypt(config.secret),
        response: token,
        remoteip: ip || "",
      }),
      signal: AbortSignal.timeout(8000),
    },
  );
  const data = (await result.json()) as { success?: boolean };
  if (!result.ok || !data.success)
    throw new Error("Bot check failed. Please try again.");
}
async function handle(req: NextRequest, ctx: Ctx) {
  try {
    const parts = (await ctx.params).path;
    const route = parts.join("/");
    const method = req.method;
    const user = await currentUser();
    const guestKey = tokenHash(
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "local-connection",
    );
    if (
      method !== "GET" &&
      !route.startsWith("webhooks/") &&
      !isAllowedRequestOrigin(
        req.headers.get("origin"),
        req.url,
        process.env.APP_URL,
        req.headers.get("host"),
      )
    )
      return json({ error: "Invalid request origin" }, 403);
    if (route.startsWith("webhooks/") && method === "POST") {
      const raw = await req.text();
      await webhook(
        parts[1],
        raw,
        req.headers.get("stripe-signature") ||
          req.headers.get("x-razorpay-signature") ||
          "",
      );
      return json({ received: true });
    }
    const requireUser = () => {
      if (!user) throw new Error("Sign in to continue.");
      return user;
    };
    const permit = (permission: string) => {
      const u = requireUser();
      if (!hasPermission(u, permission))
        throw new Error("You do not have permission for this action.");
      return u;
    };
    const body = async () => {
      if (Number(req.headers.get("content-length") || 0) > 12000000)
        throw new Error("Request too large.");
      return req.json();
    };
    if (route === "auth/me") return json({ user });
    if (["auth/login", "auth/register"].includes(route) && method === "POST") {
      const data = z
        .object({
          email: z
            .email()
            .max(200)
            .transform((x) => x.toLowerCase()),
          password: z.string().min(8).max(128),
          name: z.string().min(2).max(60).optional(),
          turnstile_token: z.string().max(4096).optional(),
        })
        .parse(await body());
      await verifyTurnstile(
        data.turnstile_token,
        req.headers.get("cf-connecting-ip") ||
          req.headers.get("x-forwarded-for"),
      );
      await rateLimit("login:" + data.email, 12);
      if (route === "auth/register") {
        if (!data.name) throw new Error("Enter your name.");
        const id = randomUUID(),
          username =
            data.email.split("@")[0].replace(/[^a-z0-9]/g, "") +
            "-" +
            id.slice(0, 5);
        await query(
          "INSERT INTO users(id,name,username,email,password_hash) VALUES($1,$2,$3,$4,$5)",
          [id, data.name, username, data.email, hashPassword(data.password)],
        );
        await createSession(id);
        return json({ ok: true });
      }
      const found = await one<
        User & { password_hash: string; active: boolean }
      >("SELECT * FROM users WHERE email=$1", [data.email]);
      if (
        !found?.active ||
        !found.password_hash ||
        !checkPassword(data.password, found.password_hash)
      )
        return json({ error: "Email or password is incorrect." }, 401);
      await createSession(found.id);
      return json({ ok: true });
    }
    if (route === "auth/logout" && method === "POST") {
      const c = await cookies(),
        token = c.get("excpix_session")?.value;
      if (token)
        await query("DELETE FROM sessions WHERE token=$1", [tokenHash(token)]);
      c.delete("excpix_session");
      return json({ ok: true });
    }
    if (route === "styles" && method === "GET")
      return json(
        await getStyles(
          req.nextUrl.searchParams.get("kind") || undefined,
          req.nextUrl.searchParams.get("term") || undefined,
          200,
        ),
      );
    if (route === "favorites") {
      const u = requireUser();
      if (method === "GET")
        return json(
          await query<Style>(
            "SELECT s.* FROM styles s JOIN favorites f ON f.style_id=s.id WHERE f.user_id=$1 AND s.is_active=true AND s.kind NOT IN ('blog','prompt')",
            [u.id],
          ),
        );
      const { style_id } = z
        .object({ style_id: z.string() })
        .parse(await body());
      if (method === "DELETE")
        await query("DELETE FROM favorites WHERE user_id=$1 AND style_id=$2", [
          u.id,
          style_id,
        ]);
      else
        await query(
          "INSERT INTO favorites(user_id,style_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [u.id, style_id],
        );
      return json({ ok: true });
    }
    if (route === "font-favorites") {
      await query(
        "CREATE TABLE IF NOT EXISTS font_favorites(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,font_name TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(user_id,font_name))",
      );
      const u = requireUser();
      if (method === "GET")
        return json(
          (
            await query<{ font_name: string }>(
              "SELECT font_name FROM font_favorites WHERE user_id=$1 ORDER BY created_at DESC",
              [u.id],
            )
          ).map((row) => row.font_name),
        );
      const { font_name } = z
        .object({ font_name: z.string().trim().min(1).max(100) })
        .parse(await body());
      if (method === "DELETE")
        await query(
          "DELETE FROM font_favorites WHERE user_id=$1 AND font_name=$2",
          [u.id, font_name],
        );
      else if (method === "POST")
        await query(
          "INSERT INTO font_favorites(user_id,font_name) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [u.id, font_name],
        );
      else return json({ error: "Method not allowed" }, 405);
      return json({ ok: true });
    }
    if (route === "projects") {
      const u = requireUser();
      if (method === "GET")
        return json(
          await query(
            "SELECT p.*,s.kind,s.slug,s.metadata FROM projects p LEFT JOIN styles s ON s.id=p.style_id WHERE p.user_id=$1 AND (s.kind NOT IN ('blog','prompt') OR p.content_json->>'tool'='3d-text') ORDER BY p.updated_at DESC",
            [u.id],
          ),
        );
      const d = await body();
      if (method === "DELETE") {
        await query("DELETE FROM projects WHERE id=$1 AND user_id=$2", [
          d.id,
          u.id,
        ]);
        return json({ ok: true });
      }
      const isText3D = d.content_json?.tool === "3d-text";
      const s = isText3D ? text3dProjectSchema.parse(d.content_json) : editorSchema.parse(d.content_json);
      const id = d.id || randomUUID();
      await query(
        "INSERT INTO projects(id,user_id,title,style_id,content_json) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET title=$3,content_json=$5,updated_at=now() WHERE projects.user_id=$2",
        [
          id,
          u.id,
          String(d.title || (isText3D ? d.content_json.state.text : d.content_json.text) || "Untitled").slice(0, 120),
          isText3D ? "" : d.style_id || "",
          JSON.stringify(s),
        ],
      );
      return json({ id });
    }
    if (route === "submissions" && method === "POST") {
      const u = requireUser(),
        d = styleSchema.parse(await body());
      if (!["owner", "admin"].includes(u.role))
        throw new Error("Permission denied.");
      const id = randomUUID();
      await query(
        "INSERT INTO styles(id,slug,kind,title,description,style_category,content_json,submitted_by,metadata,status,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',false)",
        [
          id,
          d.slug + "-" + id.slice(0, 6),
          d.kind,
          d.title,
          d.description,
          d.style_category,
          JSON.stringify(d.content_json),
          u.id,
          JSON.stringify({
            ...d.metadata,
            source_kind: d.kind === "ai" ? "ai" : "3d-text",
          }),
        ],
      );
      await audit(u, "style.submitted", d.title);
      return json({ id });
    }
    if (route === "account" && method === "GET") {
      const u = requireUser();
      const [downloads, payments, submissions, projects, favorites, quota] =
        await Promise.all([
          query(
            "SELECT d.*,s.title FROM downloads d LEFT JOIN styles s ON s.id=d.style_id WHERE d.user_id=$1 ORDER BY d.created_at DESC LIMIT 50",
            [u.id],
          ),
          query(
            "SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC",
            [u.id],
          ),
          query(
            "SELECT id,title,status,created_at FROM styles WHERE submitted_by=$1 AND kind NOT IN ('blog','prompt')",
            [u.id],
          ),
          query(
            "SELECT p.*,s.kind,s.slug,s.metadata FROM projects p LEFT JOIN styles s ON s.id=p.style_id WHERE p.user_id=$1 AND (s.kind NOT IN ('blog','prompt') OR p.content_json->>'tool'='3d-text') ORDER BY p.updated_at DESC",
            [u.id],
          ),
          query<Style>(
            "SELECT s.* FROM styles s JOIN favorites f ON f.style_id=s.id WHERE f.user_id=$1 AND s.kind NOT IN ('blog','prompt')",
            [u.id],
          ),
          one<{ count: number }>(
            "SELECT count(*)::int count FROM downloads WHERE user_id=$1 AND created_at>=date_trunc('day',now())",
            [u.id],
          ),
        ]);
      return json({
        downloads,
        payments,
        submissions,
        projects,
        favorites,
        used: quota?.count || 0,
        user: u,
      });
    }
    if (route === "account/password" && method === "POST") {
      const u = requireUser(),
        d = z
          .object({ current: z.string(), password: z.string().min(8).max(128) })
          .parse(await body());
      const r = await one<{ password_hash: string }>(
        "SELECT password_hash FROM users WHERE id=$1",
        [u.id],
      );
      if (!r?.password_hash || !checkPassword(d.current, r.password_hash))
        throw new Error("Current password is incorrect.");
      await query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        hashPassword(d.password),
        u.id,
      ]);
      await query("DELETE FROM sessions WHERE user_id=$1", [u.id]);
      await createSession(u.id);
      return json({ ok: true });
    }
    if (route === "contact" && method === "POST") {
      const d = z
        .object({
          name: z.string().min(2).max(80),
          email: z.email(),
          subject: z.string().min(3).max(150),
          message: z.string().min(10).max(5000),
        })
        .parse(await body());
      await rateLimit("contact:" + d.email, 5);
      await query(
        "INSERT INTO tickets(id,user_id,name,email,subject,message) VALUES($1,$2,$3,$4,$5,$6)",
        [randomUUID(), user?.id || null, d.name, d.email, d.subject, d.message],
      );
      return json({ ok: true });
    }
    if (route === "gateways" && method === "GET")
      return json(
        await query(
          "SELECT id,public_key,mode FROM gateways WHERE enabled=true AND id IN ('stripe','razorpay')",
        ),
      );
    if (route === "checkout" && method === "POST") {
      const u = requireUser();
      await rateLimit("checkout:" + u.id, 10);
      const d = z
        .object({
          provider: z.enum(["stripe", "razorpay"]),
          plan: z.string(),
          period: z.enum(["monthly", "yearly"]),
          coupon: z.string().max(40).default(""),
          country: z
            .string()
            .refine(
              (v) => countries.some((c) => c.code === v),
              "Choose a billing country.",
            ),
        })
        .parse(await body());
      const plan = (await getPlans()).find(
        (p) => p.id === d.plan && p.active && p.id !== "free",
      );
      if (!plan) throw new Error("Plan is unavailable.");
      if (!(await getSettings()).billing_periods.includes(d.period))
        throw new Error("This billing period is unavailable.");
      return json(
        await checkout(
          u,
          d.provider,
          plan,
          d.period,
          d.coupon,
          d.country,
          new URL(req.url).origin,
        ),
      );
    }
    if (parts[0] === "receipt" && method === "GET") {
      const u = requireUser();
      const p = await one<{
        id: string;
        user_id: string;
        plan_id: string;
        amount: number;
        currency: string;
        provider: string;
        paid_at: string;
        period: string;
        status: string;
      }>("SELECT * FROM payments WHERE id=$1", [parts[1]]);
      if (
        !p ||
        (p.user_id !== u.id && !hasPermission(u, "payments")) ||
        p.status !== "paid"
      )
        return json({ error: "Receipt not found" }, 404);
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const pdf = await PDFDocument.create(),
        page = pdf.addPage([595, 842]),
        font = await pdf.embedFont(StandardFonts.Helvetica);
      const lines = [
        "EXCPIX",
        "PAYMENT RECEIPT",
        "",
        `Receipt: ${p.id}`,
        `Plan: ${p.plan_id} (${p.period})`,
        `Amount paid: ${p.currency} ${majorAmount(p.amount, p.currency).toFixed(currencyDigits(p.currency))}`,
        `Provider: ${p.provider}`,
        `Paid at: ${new Date(p.paid_at).toISOString()}`,
        "",
        "Thank you for creating with EXCPIX.",
      ];
      lines.forEach((s, i) =>
        page.drawText(s, {
          x: 48,
          y: 770 - i * 32,
          size: i === 0 ? 26 : 12,
          font,
          color: rgb(0.12, 0.13, 0.15),
        }),
      );
      return new Response(Buffer.from(await pdf.save()), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="excpix-receipt-${p.id}.pdf"`,
        },
      });
    }
    if (route === "button-export" && method === "POST") {
      const d = z.object({
        style_id: z.string(),
        quality: z.number().int().min(256).max(8192),
        ratio: z.enum(["original", "1:1", "16:9", "9:16", "2:1", "1:2"]),
        format: z.enum(["png", "gif", "svg"]),
        previewAspect: z.number().min(0.05).max(20).optional(),
        content_json: buttonStateSchema,
      }).parse(await body());
      const style = await one<Style>(
        "SELECT * FROM styles WHERE id=$1 AND kind='button' AND is_active=true AND status='approved'", [d.style_id],
      );
      if (!style) throw new Error("Style is unavailable.");
      if (style.is_locked && !isDeepStrictEqual(d.content_json, buttonStateSchema.parse(style.content_json)))
        throw new Error("This style is locked.");
      if (d.format === "gif" && d.quality > 1920) throw new Error("GIF exports support up to 1920px.");
      const reservation = await reserveDownload(user, style, d.quality, d.format, guestKey, d.content_json.text);
      try {
        const state = structuredClone(d.content_json);
        if (state.fontAssetId && !state.fontBase64) {
          const font = await one<{ name: string; mime: string; data_base64: string }>(
            "SELECT name,mime,data_base64 FROM font_assets WHERE id=$1", [state.fontAssetId],
          );
          if (!font || font.name !== state.fontFamily) throw new Error("The selected font is no longer available.");
          state.fontBase64 = `data:${font.mime};base64,${font.data_base64}`;
        }
        const { renderButtonExport } = await import("@/lib/button-export.mjs");
        const data = await renderButtonExport(state, d.quality, d.ratio, d.format, d.previewAspect);
        await reservation.complete();
        return new Response(new Uint8Array(data), { headers: {
          "Content-Type": d.format === "svg" ? "image/svg+xml" : d.format === "gif" ? "image/gif" : "image/png",
          "Content-Disposition": `attachment; filename="${style.slug}.${d.format}"`,
        } });
      } catch (error) { await reservation.cancel(); throw error; }
    }
    if (route === "export" && method === "POST") {
      const u = user;
      const d = z
        .object({
          style_id: z.string(),
          quality: z.number().int().min(256).max(8192),
          ratio: z.enum(["original", "1:1", "16:9", "9:16", "2:1", "1:2"]),
          format: z.enum(["png", "gif", "svg"]),
          previewAspect: z.number().min(0.05).max(20).optional(),
          content_json: editorSchema,
        })
        .parse(await body());
      const style = await one<Style>(
        "SELECT * FROM styles WHERE id=$1 AND kind NOT IN ('blog','prompt') AND is_active=true AND status='approved'",
        [d.style_id],
      );
      if (!style) throw new Error("Style is unavailable.");
      if (d.format === "svg" && style.kind !== "3d-text")
        throw new Error("SVG downloads are available for 3D Text only.");
      if (d.format === "gif" && d.quality > 1920)
        throw new Error(
          "GIF exports support up to 1920px. Use PNG for 4K, 8K or MAX.",
        );
      if (
        style.is_locked &&
        !isDeepStrictEqual(
          d.content_json,
          editorSchema.parse(style.content_json),
        )
      )
        throw new Error("This style is locked.");
      const reservation = await reserveDownload(
        u,
        style,
        d.quality,
        d.format,
        guestKey,
        d.content_json.text,
      );
      try {
        const { renderExport } = await import("@/lib/export");
        const { renderLetters, renderLettersGif } =
          await import("@/lib/local-media.mjs");
        const exportState = structuredClone(d.content_json);
        if (exportState.fontAssetId && !exportState.fontBase64) {
          const font = await one<{
            name: string;
            mime: string;
            data_base64: string;
          }>("SELECT name,mime,data_base64 FROM font_assets WHERE id=$1", [
            exportState.fontAssetId,
          ]);
          if (!font || font.name !== exportState.fontFamily)
            throw new Error("The selected font is no longer available.");
          exportState.fontBase64 = `data:${font.mime};base64,${font.data_base64}`;
        }
        const data = d.format === "svg"
          ? await (await import("@/lib/svg-export.mjs")).renderSvg(exportState, d.quality, d.ratio, d.previewAspect)
          : style.kind === "ai" ||
          (style.kind === "text" && style.metadata.source_kind === "ai")
            ? d.format === "gif"
              ? await renderLettersGif(
                  exportState,
                  glyphMap(style),
                  d.quality,
                  d.ratio,
                  reservation.watermark,
                  { previewAspect: d.previewAspect },
                )
              : await renderLetters(
                  exportState,
                  glyphMap(style),
                  d.quality,
                  d.ratio,
                  reservation.watermark,
                )
            : await renderExport(
                exportState as never,
                d.quality,
                d.ratio,
                d.format,
                reservation.watermark,
                { previewAspect: d.previewAspect },
              );
        await reservation.complete();
        return new Response(new Uint8Array(data), {
          headers: {
            "Content-Type": d.format === "svg" ? "image/svg+xml" : d.format === "png" ? "image/png" : "image/gif",
            "Content-Disposition": `attachment; filename="${style.slug}.${d.format}"`,
          },
        });
      } catch (e) {
        await reservation.cancel();
        throw e;
      }
    }
    if (route === "visual-download" && method === "POST") {
      const data = z.object({ style_id: z.string() }).parse(await body());
      const style = await one<Style>(
        "SELECT * FROM styles WHERE id=$1 AND kind='visual' AND is_active=true AND status='approved'",
        [data.style_id],
      );
      if (!style) throw new Error("Visual is unavailable.");
      const reservation = await reserveDownload(user, style, 8192, "png", guestKey);
      try {
        const sourceUrl = style.image_url || `/visual/${style.slug}/image.png`;
        const source = await fetch(new URL(sourceUrl, req.url));
        if (!source.ok) throw new Error("Visual image is unavailable.");
        const bytes = await source.arrayBuffer();
        await reservation.complete();
        return new Response(bytes, {
          headers: {
            "Content-Type": source.headers.get("content-type") || "image/png",
            "Content-Disposition": `attachment; filename="excpix-${style.slug}.png"`,
          },
        });
      } catch (e) {
        await reservation.cancel();
        throw e;
      }
    }
    if (route === "backgrounds" && method === "GET")
      return json(
        await query("SELECT * FROM background_assets ORDER BY created_at DESC"),
      );
    if (parts[0] === "admin") {
      const section = parts[1];
      const permission = (
        {
          overview: "analytics",
          styles: "content",
          backgrounds: "owner",
          pages: "pages",
          settings: "settings",
          users: "users",
          "user-downloads": "users",
          plans: "plans",
          gateways: "owner",
          coupons: "coupons",
          payments: "payments",
          audit: "audit",
          tickets: "support",
          system: "system",
        } as Record<string, string>
      )[section];
      if (!permission) return json({ error: "Not found" }, 404);
      const u = permit(permission);
      if (section === "backgrounds") {
        if (method === "GET")
          return json(
            await query(
              "SELECT * FROM background_assets ORDER BY created_at DESC",
            ),
          );
        if (method !== "POST")
          return json({ error: "Method not allowed" }, 405);
        await rateLimit("background-upload:" + u.id, 200);
        if (Number(req.headers.get("content-length") || 0) > 11_000_000)
          return json({ error: "File exceeds 10 MB." }, 413);
        const form = await req.formData(),
          file = form.get("file"),
          kind = z.enum(["image", "pattern"]).parse(form.get("kind"));
        if (!(file instanceof File))
          throw new Error("Choose an image to upload.");
        const { uploadBackground } = await import("@/lib/background-assets");
        const asset = await uploadBackground(file, kind);
        await audit(u, "background.uploaded", asset.name);
        return json(asset);
      }
      if (method === "GET") {
        if (section === "pages")
          await query(
            "ALTER TABLE pages ADD COLUMN IF NOT EXISTS route_prefix TEXT NOT NULL DEFAULT 'p'",
            [],
          );
        if (section === "overview") {
          const counts = await one(
            "SELECT (SELECT count(*)::int FROM users) users,(SELECT count(*)::int FROM styles) styles,(SELECT count(*)::int FROM downloads) downloads,(SELECT count(*)::int FROM styles WHERE status='pending') pending,(SELECT coalesce(sum(amount),0)::int FROM payments WHERE status='paid') revenue",
          );
          const since = new Date(
            Date.now() - 14 * 24 * 60 * 60 * 1000,
          ).toISOString();
          const daily = await query(
            "SELECT to_char(created_at,'YYYY-MM-DD') AS day,count(*)::int downloads FROM downloads WHERE created_at>$1 GROUP BY 1 ORDER BY 1",
            [since],
          );
          return json({
            counts,
            revenue_by_currency: await query(
              "SELECT currency,sum(amount)::text amount FROM payments WHERE status='paid' GROUP BY currency ORDER BY currency",
            ),
            daily,
            activity: await query(
              "SELECT * FROM audit WHERE $1='owner' OR actor_id NOT IN (SELECT id FROM users WHERE role='owner') ORDER BY created_at DESC LIMIT 8",
              [u.role],
            ),
          });
        }
        if (section === "styles") {
          const requestedLimit = Number(
            req.nextUrl.searchParams.get("limit") || 50,
          );
          const limit = [50, 100, 1000].includes(requestedLimit)
            ? requestedLimit
            : 50;
          const offset = Math.max(
            0,
            Number(req.nextUrl.searchParams.get("offset") || 0),
          );
          const kind = req.nextUrl.searchParams.get("kind") || "";
          const status = req.nextUrl.searchParams.get("status") || "";
          const term = (req.nextUrl.searchParams.get("term") || "")
            .trim()
            .toLowerCase()
            .slice(0, 120);
          const where: string[] = ["kind NOT IN ('blog','prompt')"];
          const values: unknown[] = [];
          if (kind && kind !== "all") {
            values.push(kind);
            where.push(`kind=$${values.length}`);
          }
          if (status && status !== "all") {
            values.push(status);
            where.push(`status=$${values.length}`);
          }
          if (term) {
            values.push(`%${term}%`);
            const p = `$${values.length}`;
            where.push(
              `(lower(title) LIKE ${p} OR lower(slug) LIKE ${p} OR lower(description) LIKE ${p} OR lower(style_category) LIKE ${p})`,
            );
          }
          const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
          const total = await one<{ count: number }>(
            `SELECT count(*)::int count FROM styles${whereSql}`,
            values,
          );
          const items = await query(
            `SELECT * FROM styles${whereSql} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, limit, offset],
          );
          return json({ items, total: total?.count || 0, limit, offset });
        }
        if (section === "settings") return json(await getSettings());
        if (section === "pages")
          return json(await query("SELECT * FROM pages ORDER BY title"));
        if (section === "plans") return json(await getPlans());
        if (section === "users")
          return json(
            await query(
              "SELECT id,name,username,email,role,plan,plan_expires,permissions,active,created_at FROM users WHERE role<>'owner' OR id=$1 ORDER BY created_at DESC",
              [u.id],
            ),
          );
        if (section === "user-downloads") {
          const userId = req.nextUrl.searchParams.get("user_id");
          const rows = await query<{ user_name: string; item_name: string }>(
            "SELECT COALESCE(u.name,'Guest') AS user_name,COALESCE(NULLIF(d.download_text,''),NULLIF(s.content_json->>'text',''),s.title,'Deleted item') AS item_name FROM downloads d LEFT JOIN users u ON u.id=d.user_id LEFT JOIN styles s ON s.id=d.style_id WHERE ($1::text IS NULL OR d.user_id=$1) ORDER BY d.created_at DESC",
            [userId || null],
          );
          return json(rows);
        }
        if (section === "gateways")
          return json(
            await query(
              "SELECT id,enabled,public_key,mode,(secret<>'') secret_configured,(webhook_secret<>'') webhook_configured FROM gateways ORDER BY id",
            ),
          );
        if (section === "coupons")
          return json(await query("SELECT * FROM coupons"));
        if (section === "payments")
          return json(
            await query(
              "SELECT p.*,u.email FROM payments p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC",
            ),
          );
        if (section === "audit")
          return json(
            await query(
              "SELECT * FROM audit WHERE $1='owner' OR actor_id NOT IN (SELECT id FROM users WHERE role='owner') ORDER BY created_at DESC LIMIT 200",
              [u.role],
            ),
          );
        if (section === "tickets")
          return json(
            await query("SELECT * FROM tickets ORDER BY created_at DESC"),
          );
        if (section === "system")
          return json({
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            total_memory: os.totalmem(),
            free_memory: os.freemem(),
            load: os.loadavg(),
            cpus: os.cpus().length,
            database: process.env.DATABASE_URL
              ? "PostgreSQL"
              : "Embedded PostgreSQL (development)",
            node: process.version,
            storage: await one(
              "SELECT pg_database_size(current_database())::text bytes",
            ),
            encryption_configured: !!process.env.ENCRYPTION_KEY,
          });
      }
      const d = await body();
      if (section === "pages")
        await query(
          "ALTER TABLE pages ADD COLUMN IF NOT EXISTS route_prefix TEXT NOT NULL DEFAULT 'p'",
          [],
        );
      if (section === "styles") {
        if (!d.slug && typeof d.title === "string") d.slug = titleToSlug(d.title);
        if (method === "DELETE") {
          const { id } = z.object({ id: z.string().uuid() }).parse(d);
          const removed = await one<{ title: string }>(
            "DELETE FROM styles WHERE id=$1 RETURNING title",
            [id],
          );
          if (!removed) return json({ error: "Content not found." }, 404);
          await audit(u, "style.deleted", removed.title);
          return json({ ok: true });
        }
        const s = styleSchema.parse(d);
        const existing = s.id
          ? await one<{ submitted_by: string; role: string }>(
              "SELECT s.submitted_by,u.role FROM styles s LEFT JOIN users u ON u.id=s.submitted_by WHERE s.id=$1",
              [s.id],
            )
          : null;
        if (
          (existing?.submitted_by && existing.role !== "owner") ||
          (!s.id &&
            u.role !== "owner" &&
            ["3d-text", "ai", "text"].includes(s.kind))
        ) {
          s.metadata = {
            ...s.metadata,
            source_kind:
              s.kind === "ai" ? "ai" : s.metadata.source_kind || "3d-text",
          };
          s.kind = "text";
        }
        const id = s.id || randomUUID();
        const { id: _, ...values } = s;
        const keys = Object.keys(values);
        await query(
          `INSERT INTO styles(id,${keys.join(",")}) VALUES($1,${keys.map((_, i) => "$" + (i + 2)).join(",")}) ON CONFLICT(id) DO UPDATE SET ${keys.map((k, i) => k + "=$" + (i + 2)).join(",")},updated_at=now()`,
          [
            id,
            ...Object.values(values).map((v) =>
              typeof v === "object" ? JSON.stringify(v) : v,
            ),
          ],
        );
        await audit(u, "style.saved", s.title);
        if (!s.id)
          await query("UPDATE styles SET submitted_by=$1 WHERE id=$2", [
            u.id,
            id,
          ]);
        return json({ id });
      }
      if (section === "pages") {
        const s = z
          .object({
            slug: slugSchema,
            title: z.string().min(1).max(150),
            content: z.string().max(50000),
            seo_title: z.string().max(200).default(""),
            seo_description: z.string().max(500).default(""),
            route_prefix: z.enum(["p", "direct"]).default("p"),
            is_active: z.boolean(),
          })
          .parse(d);
        await query(
          "INSERT INTO pages(slug,title,content,seo_title,seo_description,route_prefix,is_active) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(slug) DO UPDATE SET title=$2,content=$3,seo_title=$4,seo_description=$5,route_prefix=$6,is_active=$7,updated_at=now()",
          Object.values(s),
        );
      }
      if (section === "settings") {
        const previous = await getSettings();
        const allowed = Object.keys(previous);
        const clean = Object.fromEntries(
          Object.entries(d).filter(([k]) => allowed.includes(k)),
        );
        if (clean.header_links) {
          z.array(
            z.object({
              label: z.string().min(1).max(40),
              href: z.string().regex(/^\/(?!\/)/),
            }),
          )
            .max(16)
            .parse(clean.header_links);
        }
        if (clean.free_download_limit !== undefined)
          z.number().int().min(0).max(10000).parse(clean.free_download_limit);
        if (clean.billing_periods !== undefined)
          z.array(z.enum(["monthly", "yearly"]))
            .min(1)
            .max(2)
            .refine((v) => new Set(v).size === v.length)
            .parse(clean.billing_periods);
        if (clean.related_count !== undefined)
          z.number().int().min(0).max(60).parse(clean.related_count);
        if (clean.home_style_count !== undefined)
          z.number().int().min(1).max(120).parse(clean.home_style_count);
        if (clean.announcement !== undefined)
          z.string().max(500).parse(clean.announcement);
        if (clean.announcement_link_text !== undefined)
          z.string().max(80).parse(clean.announcement_link_text);
        if (clean.announcement_url !== undefined)
          z.string()
            .max(2000)
            .refine(
              (value) =>
                !value ||
                (/^\/(?!\/)/.test(value) && !/[\\\s]/.test(value)) ||
                (() => {
                  try {
                    const url = new URL(value);
                    return (
                      url.protocol === "https:" &&
                      !url.username &&
                      !url.password
                    );
                  } catch {
                    return false;
                  }
                })(),
              "Use an internal path or an HTTPS link.",
            )
            .parse(clean.announcement_url);
        if (clean.ad_client !== undefined) {
          const publisher = String(clean.ad_client)
            .trim()
            .replace(/^pub-/i, "ca-pub-");
          if (publisher && !/^ca-pub-\d+$/.test(publisher))
            throw new Error(
              "AdSense publisher ID must look like ca-pub-123456789.",
            );
          clean.ad_client = publisher;
        }
        if (clean.ad_slots !== undefined) {
          clean.ad_slots = z
            .array(
              z.object({
                position: z.enum([
                  "home-bottom",
                  "editor-bottom",
                  "related-bottom",
                ]),
                slot: z
                  .string()
                  .trim()
                  .regex(/^\d*$/, "Ad slot ID must contain numbers only.")
                  .max(30),
                enabled: z.boolean(),
                manual_enabled: z.boolean().default(false),
                manual_html: z.string().max(100000).default(""),
                manual_css: z.string().max(50000).default(""),
                manual_js: z.string().max(50000).default(""),
              }),
            )
            .max(20)
            .parse(clean.ad_slots);
        }
        if (clean.footer_description !== undefined)
          z.string().max(500).parse(clean.footer_description);
        if (clean.footer_copyright !== undefined)
          z.string().max(200).parse(clean.footer_copyright);
        if (clean.footer_tagline !== undefined)
          z.string().max(200).parse(clean.footer_tagline);
        if (clean.footer_columns !== undefined)
          z.array(
            z.object({
              title: z.string().max(80),
              links: z.array(
                z.object({ label: z.string().max(80), href: z.string().max(2000) }),
              ).max(20),
            }),
          ).max(6).parse(clean.footer_columns);
        if (clean.collection_content !== undefined)
          clean.collection_content = collectionContentSchema.parse(
            clean.collection_content,
          );
        if (clean.categories !== undefined)
          z.array(z.object({ id: slugSchema, name: z.string().min(1).max(60) }))
            .min(1)
            .max(20)
            .refine(
              (items) => new Set(items.map((c) => c.id)).size === items.length,
              "Collection identifiers must be unique.",
            )
            .parse(clean.categories);
        await query("UPDATE settings SET value=$1 WHERE key='site'", [
          JSON.stringify({ ...previous, ...clean }),
        ]);
      }
      if (section === "plans") {
        const p = z
          .object({
            id: slugSchema,
            name: z.string().min(1).max(50),
            price: z.number().min(0),
            yearly_price: z.number().min(0),
            currency: z
              .string()
              .refine(
                (v) => currencies.includes(v),
                "Choose a supported currency.",
              ),
            regional_prices: regionalPricesSchema.optional(),
            download_limit: z.number().int().min(0).max(100000),
            max_quality: z.number().int().min(256).max(8192),
            features: z.array(z.string().max(100)).max(20),
            active: z.boolean(),
          })
          .parse(d);
        await query(
          "INSERT INTO plans(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2",
          [p.id, JSON.stringify(p)],
        );
      }
      if (section === "users") {
        if (u.role !== "owner")
          throw new Error(
            "Only the owner can change roles and account access.",
          );
        if (method === "DELETE") {
          const targetId = z.object({ id: z.string() }).parse(d).id;
          const target = await one<{ role: string; name: string }>(
            "SELECT role,name FROM users WHERE id=$1",
            [targetId],
          );
          if (!target || target.role === "owner")
            throw new Error("The owner account cannot be deleted.");
          await query("DELETE FROM users WHERE id=$1", [targetId]);
          await audit(u, "user.deleted", target.name);
          return json({ ok: true });
        }
        const s = z
          .object({
            id: z.string(),
            role: z.enum(["user", "admin", "moderator", "support"]),
            plan: z.enum(["free", "pro", "studio"]),
            subscription_period: z.enum(["1-month", "1-year"]),
            active: z.boolean(),
            permissions: z.array(
              z.enum([
                "analytics",
                "content",
                "pages",
                "settings",
                "users",
                "plans",
                "coupons",
                "payments",
                "audit",
                "support",
                "system",
              ]),
            ),
          })
          .parse(d);
        const target = await one<{ role: string }>(
          "SELECT role FROM users WHERE id=$1",
          [s.id],
        );
        if (!target || target.role === "owner")
          throw new Error("The owner account cannot be modified here.");
        const planExpires =
          s.plan === "free"
            ? null
            : new Date(
                Date.now() +
                  (s.subscription_period === "1-year"
                    ? 365
                    : 30) *
                    24 *
                    60 *
                    60 *
                    1000,
              ).toISOString();
        await query(
          "UPDATE users SET role=$1,plan=$2,plan_expires=$3,active=$4,permissions=$5 WHERE id=$6",
          [
            s.role,
            s.plan,
            planExpires,
            s.active,
            JSON.stringify(s.permissions),
            s.id,
          ],
        );
        await query("DELETE FROM sessions WHERE user_id=$1", [s.id]);
      }
      if (section === "gateways") {
        const s = z
          .object({
            id: z.enum([
              "stripe",
              "razorpay",
              "cashfree",
              "phonepe",
              "paypal",
              "google",
              "turnstile",
            ]),
            enabled: z.boolean(),
            public_key: z.string().max(500),
            secret: z.string().max(2000).optional(),
            webhook_secret: z.string().max(2000).optional(),
            mode: z.enum(["test", "live"]),
          })
          .parse(d);
        if (
          s.enabled &&
          !["stripe", "razorpay", "google", "turnstile"].includes(s.id)
        )
          throw new Error(
            "This provider needs an adapter before it can be enabled.",
          );
        await query(
          "UPDATE gateways SET enabled=$1,public_key=$2,mode=$3,secret=CASE WHEN $4='' THEN secret ELSE $4 END,webhook_secret=CASE WHEN $5='' THEN webhook_secret ELSE $5 END,updated_at=now() WHERE id=$6",
          [
            s.enabled,
            s.public_key,
            s.mode,
            s.secret ? encrypt(s.secret) : "",
            s.webhook_secret ? encrypt(s.webhook_secret) : "",
            s.id,
          ],
        );
      }
      if (section === "coupons") {
        const s = z
          .object({
            code: z
              .string()
              .min(2)
              .max(40)
              .transform((s) => s.toUpperCase()),
            percent: z.number().int().min(1).max(99),
            expires: z.string().nullable(),
            active: z.boolean(),
          })
          .parse(d);
        await query(
          "INSERT INTO coupons(code,percent,expires,active) VALUES($1,$2,$3,$4) ON CONFLICT(code) DO UPDATE SET percent=$2,expires=$3,active=$4",
          [s.code, s.percent, s.expires || null, s.active],
        );
      }
      if (section === "tickets") {
        const s = z
          .object({
            id: z.string(),
            status: z.enum(["open", "resolved"]),
            reply: z.string().max(5000),
          })
          .parse(d);
        await query("UPDATE tickets SET status=$1,reply=$2 WHERE id=$3", [
          s.status,
          s.reply,
          s.id,
        ]);
      }
      await audit(
        u,
        section + ".updated",
        String(d.title || d.id || d.code || "Configuration"),
      );
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        {
          error: e.issues
            .map((i) => i.path.join(".") + ": " + i.message)
            .join("; "),
        },
        400,
      );
    const message = e instanceof Error ? e.message : "Something went wrong.";
    if (/unique constraint/i.test(message))
      return json(
        { error: "This email, slug or username is already in use." },
        409,
      );
    if (/permission|owner account|Only the owner/.test(message))
      return json({ error: message }, 403);
    if (message === "Sign in to continue.")
      return json({ error: message }, 401);
    console.error("[EXCPIX]", message);
    return json(
      {
        error: /SELECT|INSERT|syntax|relation|column/i.test(message)
          ? "Unable to complete this request."
          : message,
      },
      400,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
