import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { fontFamilySchema, fontMime } from "@/lib/font-library";
import { isAllowedRequestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

type FontRow = {
  id: string;
  name: string;
  mime: string;
  data_base64: string;
  size: number;
  created_at: string;
};

async function ensureFontTable() {
  await query(
    "CREATE TABLE IF NOT EXISTS font_assets(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,mime TEXT NOT NULL,data_base64 TEXT NOT NULL,size INTEGER NOT NULL CHECK(size>0 AND size<=3000000),created_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
}

function allowedOrigin(req: NextRequest) {
  return isAllowedRequestOrigin(
    req.headers.get("origin"),
    req.url,
    process.env.APP_URL,
    req.headers.get("host"),
  );
}

export async function GET(req: NextRequest) {
  await ensureFontTable();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    const rows = await query<Omit<FontRow, "data_base64">>(
      "SELECT id,name,mime,size,created_at FROM font_assets ORDER BY created_at,name",
    );
    return NextResponse.json(rows);
  }
  const font = await one<FontRow>("SELECT * FROM font_assets WHERE id=$1", [
    id,
  ]);
  if (!font)
    return NextResponse.json({ error: "Font not found." }, { status: 404 });
  return new Response(Buffer.from(font.data_base64, "base64"), {
    headers: {
      "Content-Type": font.mime,
      "Content-Length": String(font.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(req: NextRequest) {
  if (!allowedOrigin(req))
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  if ((await currentUser())?.role !== "owner")
    return NextResponse.json(
      { error: "Owner access required." },
      { status: 403 },
    );
  try {
    await ensureFontTable();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose a font file.");
    if (!file.size || file.size > 3_000_000)
      throw new Error("Font must be under 3 MB.");
    const mime = fontMime(file);
    const fallbackName = file.name.replace(/\.[^.]+$/, "");
    const name = fontFamilySchema.parse(form.get("name") || fallbackName);
    const bytes = Buffer.from(await file.arrayBuffer());
    const { GlobalFonts } = await import("@napi-rs/canvas");
    const validationKey = GlobalFonts.register(
      bytes,
      `EXCPIX upload check ${randomUUID()}`,
    );
    if (!validationKey)
      throw new Error("This font file is invalid or unsupported.");
    GlobalFonts.remove(validationKey);
    const count = await one<{ count: number }>(
      "SELECT count(*)::int count FROM font_assets",
    );
    if ((count?.count || 0) >= 50)
      throw new Error("Font library supports up to 50 fonts.");
    const duplicate = await one<{ id: string }>(
      "SELECT id FROM font_assets WHERE lower(name)=lower($1)",
      [name],
    );
    if (duplicate) throw new Error("A font with this name already exists.");
    const row = await one<Omit<FontRow, "data_base64">>(
      "INSERT INTO font_assets(id,name,mime,data_base64,size) VALUES($1,$2,$3,$4,$5) RETURNING id,name,mime,size,created_at",
      [randomUUID(), name, mime, bytes.toString("base64"), file.size],
    );
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Font upload failed." },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!allowedOrigin(req))
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  if ((await currentUser())?.role !== "owner")
    return NextResponse.json(
      { error: "Owner access required." },
      { status: 403 },
    );
  await ensureFontTable();
  const id = req.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json(
      { error: "Font ID is required." },
      { status: 400 },
    );
  await query("DELETE FROM font_assets WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
