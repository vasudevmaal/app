import { z } from "zod";
import type { Style } from "./types";
import { gradientStopSchema } from "./creative-library";

const color = z.string().regex(/^#[a-f\d]{3,8}$/i);
const number = z.number().finite();
export const designAssetUrl = z
  .string()
  .max(6000000)
  .refine(
    (value) =>
      /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value) ||
      (/^\/(?!\/)[^?#\\]+\.(png|jpe?g|webp|svg)$/i.test(value) &&
        !decodeURIComponent(value).split("/").includes("..")),
    "Use an uploaded image or a local image URL.",
  );
const gradient = z.object({
  type: z.enum(["linear", "radial"]).default("linear"),
  color1: color.default("#b05cff"),
  color2: color.default("#52a8ff"),
  angle: number.min(-360).max(360).default(180),
  stops: z.array(gradientStopSchema).min(2).max(12).optional(),
});
export const designElementSchema = z.object({
  id: z.string().max(150).default(""),
  type: z.enum(["text", "imageText", "svg", "image", "qr"]),
  x: number.min(-20000).max(20000).default(100),
  y: number.min(-20000).max(20000).default(100),
  w: number.min(0).max(16384).default(400),
  h: number.min(0).max(16384).default(100),
  rotation: number.min(-360).max(360).default(0),
  text: z.string().max(2000).default(""),
  styleId: z.string().max(150).optional(),
  fontFamily: z
    .string()
    .max(100)
    .regex(/^[\w ,'-]+$/)
    .default("Orbitron"),
  fontSize: number.min(1).max(2000).default(64),
  color: color.default("#242628"),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  uppercase: z.boolean().default(false),
  align: z.enum(["left", "center", "right"]).default("left"),
  lineHeight: number.min(0.5).max(4).default(1.2),
  letterSpacing: number.min(-30).max(100).default(0),
  strokeWidth: number.min(0).max(50).default(0),
  strokeColor: color.default("#000000"),
  opacity: number.min(0).max(1).default(1),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  zIndex: number.default(0),
  svgStr: z.string().max(100000).optional(),
  src: designAssetUrl.optional(),
  assetId: z.string().max(150).optional(),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  shadowBlur: number.min(0).max(100).default(0),
  shadowColor: color.default("#000000"),
  shadowEnabled: z.boolean().default(false),
  shadowX: number.min(-100).max(100).default(0),
  shadowY: number.min(-100).max(100).default(0),
  shadowOpacity: number.min(0).max(1).default(0.6),
  borderEnabled: z.boolean().default(false),
  borderWidth: number.min(0).max(100).default(5),
  borderColor: color.default("#ffffff"),
  radius: number.min(0).max(50).default(0),
  crop: z
    .object({
      top: number.min(0).max(45).default(0),
      right: number.min(0).max(45).default(0),
      bottom: number.min(0).max(45).default(0),
      left: number.min(0).max(45).default(0),
    })
    .prefault({}),
  filters: z
    .object({
      brightness: number.min(0).max(200).default(100),
      contrast: number.min(0).max(200).default(100),
      saturation: number.min(0).max(200).default(100),
      grayscale: number.min(0).max(100).default(0),
      sepia: number.min(0).max(100).default(0),
      blur: number.min(0).max(20).default(0),
      hue: number.min(0).max(360).default(0),
      pixelate: number.min(0).max(50).default(0),
    })
    .prefault({}),
  fillType: z.enum(["solid", "gradient", "radial"]).default("solid"),
  gradient: gradient.optional(),
  groupId: z.string().max(150).optional(),
  fontData: z
    .string()
    .max(7000000)
    .regex(/^data:font\/[\w-]+;base64,[a-z\d+/=]+$/i)
    .optional(),
});
export const designSchema = z
  .object({
    id: z.string().max(150).default(""),
    name: z.string().max(160).default("Untitled Design"),
    canvasW: number.int().min(64).max(8192),
    canvasH: number.int().min(64).max(8192),
    bg: z.object({
      type: z
        .enum(["solid", "gradient", "transparent", "image", "pattern"])
        .default("solid"),
      color: color.default("#ffffff"),
      gradState: gradient.optional(),
      src: designAssetUrl.optional(),
      opacity: number.min(0).max(1).default(1),
      imageMode: z
        .enum(["original", "cover", "contain", "stretch"])
        .default("cover"),
      patternSize: number.min(5).max(400).default(100),
      patternBgType: z
        .enum(["transparent", "solid", "gradient", "image"])
        .default("transparent"),
      patternBgImage: designAssetUrl.optional(),
    }),
    gradState: gradient.optional(),
    elements: z.array(designElementSchema).max(150),
  })
  .superRefine((value, ctx) => {
    const ids = value.elements.map((e) => e.id).filter(Boolean);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Each layer must have a unique ID.",
      });
    if (
      value.elements.some((e) => e.type === "imageText" && e.text.length > 160)
    )
      ctx.addIssue({
        code: "custom",
        message: "Styled text supports up to 160 characters.",
      });
  });
export type DesignDocument = z.infer<typeof designSchema>;
export type DesignElement = z.infer<typeof designElementSchema>;
export type DesignAsset = {
  id: string;
  name: string;
  category: string;
  svg: string;
};
export type DesignBackground = {
  id: string;
  name: string;
  kind: "image" | "pattern";
  original_url: string;
  preview_url: string;
  render_url: string;
};
export function readDesign(style: Style): DesignDocument {
  const raw = style.content_json as unknown as Record<string, unknown>;
  const saved = raw.canvasW ? raw : style.metadata.design;
  if (saved) {
    const doc = designSchema.parse(saved);
    return {
      ...doc,
      name: doc.name || style.title,
      elements: doc.elements.map((e, i) => ({
        ...e,
        id: e.id || `element-${i}`,
      })),
    };
  }
  const state = style.content_json;
  return designSchema.parse({
    name: style.title,
    canvasW: 1200,
    canvasH: 800,
    bg: {
      type: state.bg?.type === "transparent" ? "transparent" : "solid",
      color: state.bg?.color || "#ffffff",
    },
    elements: [
      {
        id: "initial-text",
        type: "imageText",
        text: state.text || style.title,
        styleId: style.id,
        x: 120,
        y: 160,
        w: 960,
        h: 480,
        align: "center",
      },
    ],
  });
}
