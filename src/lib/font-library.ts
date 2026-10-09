import { z } from "zod";

export const fontFamilySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\w '-]+$/, "Use letters, numbers, spaces, apostrophes or hyphens.");

export const fontAssetSummarySchema = z.object({
  id: z.string().uuid(),
  name: fontFamilySchema,
  mime: z.enum([
    "font/ttf",
    "font/otf",
    "font/woff",
    "font/woff2",
    "application/font-sfnt",
    "application/vnd.ms-opentype",
    "application/x-font-ttf",
    "application/x-font-otf",
    "application/font-woff",
  ]),
  size: z.number().int().positive().max(3_000_000),
  created_at: z.string(),
});

export type FontAssetSummary = z.infer<typeof fontAssetSummarySchema>;

export const fontExtensions = ["ttf", "otf", "woff", "woff2"] as const;

export function fontMime(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!fontExtensions.includes(extension as (typeof fontExtensions)[number]))
    throw new Error("Use a TTF, OTF, WOFF or WOFF2 font.");
  const fallback: Record<string, string> = {
    ttf: "font/ttf",
    otf: "font/otf",
    woff: "font/woff",
    woff2: "font/woff2",
  };
  return fallback[extension!];
}
