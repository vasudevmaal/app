import { NextRequest, NextResponse } from "next/server";
import { one, query } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { isAllowedRequestOrigin } from "@/lib/origin";
import { creativeLibrarySchema, defaultPresets } from "@/lib/creative-library";
export const dynamic = "force-dynamic";
export async function GET() {
  const saved = await one<{ value: unknown }>(
    "SELECT value FROM settings WHERE key='creative-library'",
  );
  return NextResponse.json(saved?.value ?? defaultPresets);
}
export async function POST(req: NextRequest) {
  if (
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
  if ((await currentUser())?.role !== "owner")
    return NextResponse.json(
      { error: "Owner access required." },
      { status: 403 },
    );
  try {
    const text = await req.text();
    if (text.length > 1000000) throw new Error("Library is too large.");
    const value = creativeLibrarySchema.parse(JSON.parse(text));
    await query(
      "INSERT INTO settings(key,value) VALUES('creative-library',$1) ON CONFLICT(key) DO UPDATE SET value=$1",
      [JSON.stringify(value)],
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Check preset names, colors, gradients and image uploads." },
      { status: 400 },
    );
  }
}
