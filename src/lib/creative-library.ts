import { z } from "zod";
export const gradientStopSchema = z.object({
  color: z.string().regex(/^#[a-f\d]{6}$/i),
  pos: z.number().min(0).max(100),
});
export const creativePresetSchema = z.object({
  id: z.string().min(1).max(150),
  name: z.string().min(1).max(100),
  type: z.enum(["color", "gradient", "image"]),
  category: z.string().max(80).default("General"),
  color: z
    .string()
    .regex(/^#[a-f\d]{6}$/i)
    .default("#000000"),
  stops: z
    .array(gradientStopSchema)
    .min(2)
    .max(12)
    .default([
      { color: "#000000", pos: 0 },
      { color: "#ffffff", pos: 100 },
    ]),
  angle: z.number().min(0).max(360).default(90),
  gradientType: z.enum(["linear", "radial"]).default("linear"),
  url: z
    .string()
    .max(1000)
    .regex(/^$|^\/(?!\/)[\w./%-]+$/)
    .default(""),
  preview: z
    .string()
    .max(1000)
    .regex(/^$|^\/(?!\/)[\w./%-]+$/)
    .default(""),
});
export const creativeLibrarySchema = z
  .array(creativePresetSchema)
  .max(500)
  .superRefine((rows, ctx) => {
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      ctx.addIssue({ code: "custom", message: "Preset IDs must be unique." });
    if (rows.some((r) => r.type === "image" && !r.url))
      ctx.addIssue({
        code: "custom",
        message: "Upload an image for every image preset.",
      });
  });
export type CreativePreset = z.infer<typeof creativePresetSchema>;
const gradients = [
  ["Sunset", "#ff6b6b", "#ffd166"],
  ["Ocean", "#00b4d8", "#023e8a"],
  ["Forest", "#b7e4c7", "#1b4332"],
  ["Berry", "#f72585", "#7209b7"],
  ["Gold", "#fff3b0", "#c88b18"],
  ["Aurora", "#80ffdb", "#5390d9"],
  ["Coral", "#ffadad", "#ff6392"],
  ["Chrome", "#f8f9fa", "#495057"],
  ["Neon", "#faff00", "#00e5ff"],
  ["Dusk", "#ff9a9e", "#4a4e69"],
];
export const defaultPresets: CreativePreset[] = [
  ...gradients.map(([name, c1, c2], i) =>
    creativePresetSchema.parse({
      id: `gradient-${i}`,
      type: "gradient",
      name,
      stops: [
        { color: c1, pos: 0 },
        { color: c2, pos: 100 },
      ],
      angle: 90,
    }),
  ),
  ...[
    "#000000",
    "#ffffff",
    "#ed674a",
    "#258361",
    "#00b4d8",
    "#ffd166",
    "#f72585",
    "#7209b7",
  ].map((color, i) =>
    creativePresetSchema.parse({
      id: `color-${i}`,
      name: color,
      type: "color",
      color,
    }),
  ),
];
export function gradientCss(
  p: Pick<CreativePreset, "stops" | "angle" | "gradientType">,
) {
  return `${p.gradientType === "radial" ? "radial-gradient(circle," : "linear-gradient(" + p.angle + "deg,"}${[
    ...p.stops,
  ]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => s.color + " " + s.pos + "%")
    .join(",")})`;
}
