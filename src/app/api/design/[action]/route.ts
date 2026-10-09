import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentUser, isPaid, tokenHash, rateLimit } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { designSchema, readDesign } from "@/lib/design";
import { isAllowedRequestOrigin } from "@/lib/origin";
import { reserveDownload } from "@/lib/downloads";
import type { Style } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
async function handle(req: NextRequest, { params }: Context) {
  try {
    const { action } = await params,
      user = await currentUser();
    if (
      req.method !== "GET" &&
      !isAllowedRequestOrigin(
        req.headers.get("origin"),
        req.url,
        process.env.APP_URL,
        req.headers.get("host"),
      )
    )
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 },
      );
    if (action === "projects" && req.method === "GET") {
      if (!user)
        return NextResponse.json(
          { error: "Sign in to open your projects." },
          { status: 401 },
        );
      return NextResponse.json(
        await query(
          "SELECT id,title,style_id,content_json,updated_at FROM design_projects WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100",
          [user.id],
        ),
      );
    }
    if (Number(req.headers.get("content-length") || 0) > 28000000)
      throw new Error("Project is too large. Use smaller uploaded images.");
    const raw = await req.text();
    if (raw.length > 28000000) throw new Error("Project is too large.");
    const body = JSON.parse(raw);
    if (action === "projects" && req.method === "DELETE") {
      if (!user)
        return NextResponse.json(
          { error: "Sign in to continue." },
          { status: 401 },
        );
      const { id } = z.object({ id: z.string().max(150) }).parse(body);
      await query("DELETE FROM design_projects WHERE id=$1 AND user_id=$2", [
        id,
        user.id,
      ]);
      return NextResponse.json({ ok: true });
    }
    if (!["projects", "export"].includes(action) || req.method !== "POST")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = z
      .object({
        style_id: z.string(),
        content_json: designSchema,
        id: z.string().max(150).optional(),
      })
      .parse(body);
    const style = await one<Style>(
      "SELECT * FROM styles WHERE id=$1 AND kind='design' AND is_active=true AND status='approved'",
      [data.style_id],
    );
    if (!style) throw new Error("This design is unavailable.");
    if (action === "projects") {
      if (!user)
        return NextResponse.json(
          { error: "Sign in to save your project." },
          { status: 401 },
        );
      const id = data.id || randomUUID();
      const saved = await query(
        "INSERT INTO design_projects(id,user_id,style_id,title,content_json) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET title=$4,content_json=$5,updated_at=now() WHERE design_projects.user_id=$2 RETURNING id",
        [
          id,
          user.id,
          style.id,
          data.content_json.name,
          JSON.stringify(data.content_json),
        ],
      );
      if (!saved.length)
        return NextResponse.json(
          { error: "Project not found." },
          { status: 404 },
        );
      return NextResponse.json({ id });
    }
    const output = z
      .object({
        quality: z.number().int().min(256).max(8192),
        format: z.enum(["png", "jpeg", "webp", "pdf"]),
        image: z
          .string()
          .max(24000000)
          .regex(/^data:image\/png;base64,[a-z\d+/=]+$/i),
      })
      .parse(body);
    if (
      style.is_locked &&
      JSON.stringify(data.content_json.elements) !==
        JSON.stringify(readDesign(style).elements)
    )
      throw new Error("This design is locked.");
    const ids = [
      ...new Set(
        data.content_json.elements
          .filter((e) => e.type === "imageText")
          .map((e) => e.styleId),
      ),
    ];
    for (const id of ids) {
      const linked = await one<Style>(
        "SELECT * FROM styles WHERE (id=$1 OR slug=$1) AND (kind IN ('3d-text','ai') OR id=$2) AND is_active=true AND status='approved'",
        [id, style.id],
      );
      if (!linked)
        throw new Error("A text style used in this design is unavailable.");
      if ((linked.is_premium || !linked.is_free) && !isPaid(user))
        throw new Error("A text style in this design requires a paid plan.");
    }
    const guest = tokenHash(
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "local-connection",
    );
    await rateLimit(`design-export:${user?.id || guest}`, 40);
    const reservation = await reserveDownload(
      user,
      style,
      output.quality,
      output.format,
      guest,
    );
    try {
      const { createCanvas, loadImage } = await import("@napi-rs/canvas");
      const buffer = Buffer.from(output.image.split(",")[1], "base64");
      if (
        buffer.length < 24 ||
        buffer.readUInt32BE(16) > 8192 ||
        buffer.readUInt32BE(20) > 8192
      )
        throw new Error("Image dimensions are too large.");
      const source = await loadImage(buffer),
        ratio = data.content_json.canvasW / data.content_json.canvasH;
      const width =
          ratio >= 1 ? output.quality : Math.round(output.quality * ratio),
        height =
          ratio >= 1 ? Math.round(output.quality / ratio) : output.quality;
      if (Math.abs(source.width / source.height - ratio) > 0.02)
        throw new Error("Export dimensions do not match the canvas.");
      const canvas = createCanvas(width, height),
        ctx = canvas.getContext("2d");
      if (output.format === "jpeg" || output.format === "pdf") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(source, 0, 0, width, height);
      if (reservation.watermark) {
        const size = Math.max(16, width * 0.022);
        ctx.font = `600 ${size}px sans-serif`;
        ctx.textAlign = "right";
        ctx.lineWidth = Math.max(2, size * 0.12);
        ctx.strokeStyle = "rgba(255,255,255,.8)";
        ctx.fillStyle = "rgba(25,25,25,.65)";
        ctx.strokeText(reservation.watermark, width - size, height - size);
        ctx.fillText(reservation.watermark, width - size, height - size);
      }
      let bytes: Uint8Array;
      if (output.format === "pdf") {
        const { PDFDocument } = await import("pdf-lib");
        const pdf = await PDFDocument.create();
        const image = await pdf.embedPng(await canvas.encode("png"));
        pdf
          .addPage([width, height])
          .drawImage(image, { x: 0, y: 0, width, height });
        bytes = await pdf.save();
      } else
        bytes =
          output.format === "png"
            ? await canvas.encode("png")
            : await canvas.encode(output.format);
      await reservation.complete();
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type":
            output.format === "pdf"
              ? "application/pdf"
              : `image/${output.format}`,
          "Content-Disposition": `attachment; filename="${style.slug}.${output.format === "jpeg" ? "jpg" : output.format}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (error) {
      await reservation.cancel();
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Invalid design data. Check dimensions, layers and images."
            : error instanceof Error
              ? error.message
              : "Unable to complete this request.",
      },
      { status: 400 },
    );
  }
}
export { handle as GET, handle as POST, handle as DELETE };
