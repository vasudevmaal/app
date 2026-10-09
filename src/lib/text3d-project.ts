import { z } from "zod";

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const number = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
const image = z
  .string()
  .max(12_000_000)
  .refine(
    (value) =>
      value === "" || /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value),
  );
export const text3dStateSchema = z.object({
  text: z.string().max(100),
  font: z.string().max(100),
  size: number(10, 100),
  depth: number(0, 60),
  bevel: number(0, 3),
  bevelThickness: number(0, 10),
  spacing: number(0, 20),
  lineHeight: number(0.8, 2.5),
  layout: z.enum(["straight", "arc"]),
  radius: number(60, 600),
  curve: number(-100, 100).default(0),
  fill: z.enum(["solid", "gradient", "image"]),
  sideFill: z.enum(["solid", "gradient", "image"]).default("solid"),
  edgeFill: z.enum(["solid", "gradient", "image"]).default("solid"),
  front: color,
  frontOpacity: number(0, 1).default(1),
  side: color,
  sideOpacity: number(0, 1).default(1),
  edge: color,
  edgeOpacity: number(0, 1).default(1),
  gradientEnd: color,
  gradientAngle: number(0, 360),
  texture: image,
  textureStrength: number(0, 1).default(1),
  patternMode: z.boolean().default(true),
  patternSize: number(10, 200).default(33),
  sideGradientEnd: color.default("#c6533d"),
  edgeGradientEnd: color.default("#ffd2c2"),
  sideGradientAngle: number(0, 360).default(90),
  edgeGradientAngle: number(0, 360).default(90),
  sideTexture: image.default(""),
  sideTextureStrength: number(0, 1).default(1),
  sidePatternMode: z.boolean().default(true),
  sidePatternSize: number(10, 200).default(33),
  edgeTexture: image.default(""),
  edgeTextureStrength: number(0, 1).default(1),
  edgePatternMode: z.boolean().default(true),
  edgePatternSize: number(10, 200).default(33),
  finish: z.enum([
    "matte",
    "glossy",
    "metal",
    "glass",
    "satin",
    "chrome",
    "plastic",
    "iridescent",
  ]),
  metalness: number(0, 1),
  roughness: number(0.05, 1),
  transmission: number(0, 1),
  light: number(0.1, 3),
  background: z.enum(["solid", "transparent", "gradient"]),
  backgroundColor: color,
  backgroundEnd: color,
  rotationX: number(-180, 180),
  rotationY: number(-180, 180),
  rotationZ: number(-180, 180),
});
export const text3dProjectSchema = z
  .object({
    tool: z.literal("3d-text"),
    version: z.literal(1),
    state: text3dStateSchema,
    fontName: z.string().max(200).optional(),
    fontData: z
      .object({
        glyphs: z.record(
          z.string().max(8),
          z
            .object({
              ha: z.number().finite(),
              o: z.string().max(100_000).optional(),
            })
            .passthrough(),
        ),
        resolution: number(1, 100_000),
        boundingBox: z
          .object({ yMin: z.number().finite(), yMax: z.number().finite() })
          .passthrough(),
      })
      .passthrough()
      .optional(),
    thumbnail: image.optional(),
  })
  .refine(
    (project) =>
      !project.state.font.startsWith("custom-") || !!project.fontData,
    { message: "The custom font is missing from this project." },
  );
export type Text3DProject = z.infer<typeof text3dProjectSchema>;
