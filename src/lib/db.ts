import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID, scryptSync, randomBytes } from "node:crypto";
import { schema } from "./schema";
import {
  catalogSeeds,
  defaultState,
  defaultSettings,
  defaultPlans,
} from "./defaults";
import { defaultButtonState } from "./button";
import { calendar2027Style } from "./design-seeds";
import { migrateVisualCatalog } from "./visual-seeds";
import { migrateSvgCatalog } from "./svg-seeds";
interface DB {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}
const globalDb = globalThis as unknown as {
  excpixDB?: Promise<DB>;
  excpixVisualCatalog?: Promise<void>;
  excpixSvgCatalogRemoval?: Promise<void>;
  excpixYoutubeButtonCatalog?: Promise<void>;
};
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
async function ensureYoutubeButton(db: DB) {
  const youtubeButtonExists = await db.query(
    "SELECT id FROM styles WHERE kind=$1 AND slug=$2",
    ["button", "youtube-button-maker"],
  );
  if (!youtubeButtonExists.rows.length) {
    const youtubeButtonState = {
      ...defaultButtonState,
      text: "SUBSCRIBE",
      fontSize: 20,
      fontWeight: 800,
      paddingX: 36,
      paddingY: 15,
      radius: 30,
      fillType: "gradient" as const,
      fillStart: "#ff2020",
      fillEnd: "#c90000",
      fillAngle: 135,
      borderColor: "#b50000",
      shadowColor: "#8d0000",
      shadowOpacity: 0.3,
      shadowBlur: 18,
      shadowY: 7,
      hoverFill: "#a90000",
      hoverLift: 3,
    };
    await db.query(
      "INSERT INTO styles(id,slug,kind,title,description,seo_title,seo_description,seo_keywords,image_alt,style_category,tags,content_json,is_free,is_premium,badge,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
      [
        randomUUID(),
        "youtube-button-maker",
        "button",
        "YouTube Button Maker",
        "Create a bold YouTube subscribe button with editable text, colors, shape, shadow and hover motion.",
        "YouTube Button Maker | EXCPIX",
        "Design and download a custom YouTube subscribe button with live preview, gradient colors, hover effects and export options.",
        JSON.stringify(["youtube button", "subscribe button", "cta", "button maker"]),
        "Red YouTube subscribe button preview",
        "button",
        JSON.stringify(["youtube", "subscribe", "button", "cta"]),
        JSON.stringify(youtubeButtonState),
        true,
        false,
        "NEW",
        JSON.stringify({ preview_background: youtubeButtonState.background }),
      ],
    );
  }
  await db.query(
    "UPDATE styles SET image_url=$1 WHERE kind=$2 AND slug=$3 AND (image_url IS NULL OR image_url='')",
    ["/images/button/youtube-button-maker.png", "button", "youtube-button-maker"],
  );
}
async function initialize(): Promise<DB> {
  let db: DB;
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = {
      query: async <T>(s: string, p?: unknown[]) => ({
        rows: (await pool.query(s, p)).rows as T[],
      }),
      exec: async (s) => pool.query(s),
    };
  } else {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.DEMO_MODE !== "true"
    )
      throw new Error("DATABASE_URL is required in production.");
    const dataDir =
      process.env.EXCPIX_DATA_DIR || path.join(process.cwd(), ".data/postgres");
    await mkdir(dataDir, { recursive: true });
    db = new PGlite(dataDir) as DB;
  }
  await db.exec(schema);
  await db.query(
    "INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT DO NOTHING",
    ["site", JSON.stringify(defaultSettings)],
  );
  for (const plan of defaultPlans)
    await db.query(
      "INSERT INTO plans(id,data) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [plan.id, JSON.stringify(plan)],
    );
  for (const id of [
    "stripe",
    "razorpay",
    "cashfree",
    "phonepe",
    "paypal",
    "google",
    "turnstile",
  ])
    await db.query(
      "INSERT INTO gateways(id) VALUES($1) ON CONFLICT DO NOTHING",
      [id],
    );
  const existing = await db.query("SELECT id FROM users WHERE role=$1", [
    "owner",
  ]);
  if (!existing.rows.length) {
    const password =
      process.env.OWNER_PASSWORD ||
      (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true"
        ? "12345678"
        : null);
    if (password)
      await db.query(
        "INSERT INTO users(id,name,username,email,password_hash,role,plan) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          randomUUID(),
          "EXCPIX Owner",
          "owner",
          process.env.OWNER_EMAIL || "owner@excpix.com",
          hashPassword(password),
          "owner",
          "studio",
        ],
      );
  }
  const count = await db.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM styles",
  );
  if (!count.rows[0].count) {
    for (const row of catalogSeeds) {
      const [
        slug,
        title,
        kind,
        text,
        font,
        top,
        bottom,
        depth,
        bg,
        badge,
        category,
      ] = row;
      const s = structuredClone(defaultState);
      s.text = text;
      s.fontFamily = font;
      s.fill.stops = [
        { color: top, pos: 0 },
        { color: bottom, pos: 100 },
      ];
      s.layers[0].color = depth;
      s.bg.color = bg;
      s.rotation = font === "Pacifico" ? -8 : -4;
      if (slug === "candy-colors") {
        s.fill.type = "alternating";
        s.layers[0].type = "alternating";
        s.layers[0].colors = ["#b7831b", "#18927a", "#463067", "#b23b57"];
      }
      await db.query(
        "INSERT INTO styles(id,slug,kind,title,description,seo_title,seo_description,seo_keywords,image_alt,style_category,tags,content_json,is_free,is_premium,badge,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
        [
          randomUUID(),
          slug,
          kind,
          title,
          `Make your words your own with ${title.toLowerCase()} lettering.`,
          `${title} - ${kind === "ai" ? "AI Design" : "3D Text Maker"} | EXCPIX`,
          `Create ${title.toLowerCase()} text with custom colors, layers and backgrounds.`,
          JSON.stringify([category, "3d", "text", title]),
          `${title} lettering preview`,
          category,
          JSON.stringify([category, "3d", "text"]),
          JSON.stringify(s),
          badge !== "PRO",
          badge === "PRO",
          badge,
          JSON.stringify({
            preview_background: bg,
          }),
        ],
      );
    }
  }
  const buttonExists = await db.query(
    "SELECT id FROM styles WHERE kind=$1 AND slug=$2",
    ["button", "primary-cta"],
  );
  if (!buttonExists.rows.length) {
    await db.query(
      "INSERT INTO styles(id,slug,kind,title,description,seo_title,seo_description,seo_keywords,image_alt,style_category,tags,content_json,is_free,is_premium,badge,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
      [
        randomUUID(),
        "primary-cta",
        "button",
        "Primary CTA Button",
        "Create a polished call-to-action button with editable shape, color, shadow and motion.",
        "Primary CTA Button Generator | EXCPIX",
        "Design and download a custom CTA button with live preview, gradients, hover states and animation.",
        JSON.stringify(["button", "cta", "ui", "web"]),
        "Primary call-to-action button preview",
        "button",
        JSON.stringify(["button", "cta", "ui"]),
        JSON.stringify(defaultButtonState),
        true,
        false,
        "NEW",
        JSON.stringify({ preview_background: defaultButtonState.background }),
      ],
    );
  }
  const calendarExists = await db.query(
    "SELECT id FROM styles WHERE kind=$1 AND slug=$2",
    ["design", calendar2027Style.slug],
  );
  if (!calendarExists.rows.length) {
    const c = calendar2027Style;
    await db.query(
      "INSERT INTO styles(id,slug,kind,title,description,seo_title,seo_description,seo_keywords,image_url,image_alt,style_category,tags,content_json,is_free,is_premium,badge,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)",
      [
        randomUUID(),
        c.slug,
        "design",
        c.title,
        c.description,
        c.seo_title,
        c.seo_description,
        JSON.stringify(c.seo_keywords),
        `/previews/${c.slug}.svg`,
        c.image_alt,
        c.style_category,
        JSON.stringify(c.tags),
        JSON.stringify(c.content_json),
        true,
        false,
        "NEW",
        JSON.stringify(c.metadata),
      ],
    );
  }
  await db.query(
    "UPDATE styles SET content_json=$1,metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb WHERE kind='design' AND slug=$3 AND COALESCE(metadata->>'layout_revision','')<>$4",
    [
      JSON.stringify(calendar2027Style.content_json),
      JSON.stringify({ layout_revision: "calendar-grid-v2" }),
      calendar2027Style.slug,
      "calendar-grid-v2",
    ],
  );
  for (const [slug, title, content] of [
    [
      "about",
      "About EXCPIX",
      "EXCPIX is a creative workspace for expressive typography, 3D text and design. Make your own styles, keep your favorites and share your creations.",
    ],
    [
      "privacy-policy",
      "Privacy Policy",
      "This development policy is a draft and must be reviewed before launch.\n\nWe store account details, saved projects, downloads and payment references to provide the service. Payment card details are handled by your selected payment provider.\n\nContact us to request an export or deletion of your account data.",
    ],
    [
      "return-policy",
      "Refund Policy",
      "This development policy is a draft and must be reviewed before launch.\n\nPlease contact support with your payment reference to request a review. Refund eligibility and processing time will be published before paid subscriptions launch.",
    ],
    [
      "terms",
      "Terms of Service",
      "Draft for owner review. Only upload content and fonts that you have permission to use. Do not misuse the service or share another person's private information.",
    ],
  ])
    await db.query(
      "INSERT INTO pages(slug,title,content) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [slug, title, content],
    );
  await db.query(
    "UPDATE pages SET route_prefix='direct' WHERE slug IN ('about','terms','privacy-policy','return-policy')",
  );
  return db;
}
export async function database() {
  const db = await (globalDb.excpixDB ??= initialize().catch((e) => {
    globalDb.excpixDB = undefined;
    throw e;
  }));
  await (globalDb.excpixYoutubeButtonCatalog ??= ensureYoutubeButton(db).catch((e) => {
    globalDb.excpixYoutubeButtonCatalog = undefined;
    throw e;
  }));
  await (globalDb.excpixVisualCatalog ??= migrateVisualCatalog(db, defaultState).catch((e) => {
    globalDb.excpixVisualCatalog = undefined;
    throw e;
  }));
  await (globalDb.excpixSvgCatalogRemoval ??= migrateSvgCatalog(db).catch((e) => {
    globalDb.excpixSvgCatalogRemoval = undefined;
    throw e;
  }));
  return db;
}
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
) {
  return (await (await database()).query<T>(sql, params)).rows;
}
export async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
) {
  return (await query<T>(sql, params))[0] ?? null;
}
