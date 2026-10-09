import { z } from "zod";
import { designSchema } from "./design";
import { text3dProjectSchema } from "./text3d-project";
import { buttonStateSchema } from "./button";
import {
  currencies,
  countries,
  currencyForCountry,
  minorAmount,
  majorAmount,
} from "./billing";
const priceAmount = z.number().finite().min(0).max(1000000);
export const regionalPricesSchema = z
  .array(
    z.object({
      country: z
        .string()
        .refine(
          (v) => !v || countries.some((c) => c.code === v),
          "Choose a supported country.",
        ),
      currency: z
        .string()
        .refine((v) => currencies.includes(v), "Choose a supported currency."),
      price: priceAmount,
      yearly_price: priceAmount,
      active: z.boolean(),
      gateways: z.array(z.enum(["stripe", "razorpay"])).min(1),
    }),
  )
  .max(150)
  .superRefine((rows, ctx) => {
    const keys = new Set<string>();
    rows.forEach((r, i) => {
      const key = r.country || r.currency;
      if (keys.has(key))
        ctx.addIssue({
          code: "custom",
          path: [i],
          message: "Duplicate country or currency price.",
        });
      keys.add(key);
      if (r.country && currencyForCountry(r.country) !== r.currency)
        ctx.addIssue({
          code: "custom",
          path: [i, "currency"],
          message: "Currency must match the country.",
        });
      for (const field of ["price", "yearly_price"] as const)
        if (
          Math.abs(
            majorAmount(minorAmount(r[field], r.currency), r.currency) -
              r[field],
          ) > 1e-8
        )
          ctx.addIssue({
            code: "custom",
            path: [i, field],
            message: "Too many decimal places for this currency.",
          });
    });
  });
const color = z.string().regex(/^#[a-f0-9]{3,8}$/i);
const fill = z
  .object({
    type: z.enum([
      "solid",
      "gradient",
      "radial",
      "alternating",
      "pattern",
      "image",
      "transparent",
    ]),
    color: color,
    opacity: z.number().min(0).max(1),
    angle: z.number().min(-360).max(360),
    stops: z
      .array(z.object({ color, pos: z.number().min(0).max(100) }))
      .min(2)
      .max(12),
    colors: z.array(color).max(16).optional(),
    patternBase64: z.string().max(3000000).nullable().optional(),
  })
  .passthrough();
export const editorSchema = z
  .object({
    text: z.string(),
    fontFamily: z
      .string()
      .max(80)
      .regex(/^[\w ,'-]+$/),
    fontBase64: z
      .string()
      .max(4_100_000)
      .regex(
        /^data:(?:font\/(?:ttf|otf|woff2?)|application\/(?:font-sfnt|vnd\.ms-opentype|x-font-(?:ttf|otf)|font-woff));base64,/,
      )
      .optional(),
    fontAssetId: z.string().uuid().optional(),
    letterSpacing: z.number().min(-30).max(100),
    lineHeight: z.number().min(0.5).max(3),
    align: z.enum(["left", "center", "right"]),
    isBold: z.boolean(),
    isItalic: z.boolean(),
    isUnderline: z.boolean(),
    rotation: z.number().min(-180).max(180),
    curve: z.number().min(-100).max(100),
    zigzag: z.number().min(-100).max(100),
    wave: z.number().min(0).max(100).default(0),
    animation: z.object({
      id: z.string().max(40),
      speed: z.number().min(0.1).max(3),
    }),
    fill,
    layers: z
      .array(
        fill.extend({
          id: z.number(),
          layerType: z.enum([
            "3d",
            "stroke",
            "outer_wrap",
            "shadow",
            "inner_shadow",
          ]),
          enabled: z.boolean(),
          size: z.number().min(0).max(80),
          width: z.number().min(0).max(30),
        }),
      )
      .max(12),
    bg: fill,
  })
  .passthrough();
export const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const faqSchema = z
  .array(
    z.object({
      question: z.string().min(1).max(300),
      answer: z.string().min(1).max(4000),
      active: z.boolean(),
    }),
  )
  .max(40);
export const collectionContentSchema = z.record(
  slugSchema,
  z.object({
    title: z.string().max(200),
    description: z.string().max(2000),
    seo_title: z.string().max(200),
    seo_description: z.string().max(500),
    footer_title: z.string().max(200).default(""),
    footer_description: z.string().max(5000).default(""),
    faq: faqSchema,
    faq_enabled: z.boolean(),
    how_to_enabled: z.boolean(),
    how_to: z
      .array(
        z.object({
          title: z.string().min(1).max(120),
          description: z.string().min(1).max(2000),
        }),
      )
      .max(20),
  }),
);
export const metadataSchema = z
  .object({
    source_kind: z.enum(["3d-text", "ai", "text"]).optional(),
    featured: z.boolean().optional(),
    faq: faqSchema.optional(),
    faq_enabled: z.boolean().optional(),
    ai: z
      .object({
        asset_path: z
          .string()
          .regex(/^\/ai\/[a-zA-Z0-9_/-]+$/)
          .refine((s) => !s.endsWith("/"), "Remove the trailing slash."),
        characters: z
          .string()
          .min(1)
          .max(36)
          .regex(/^[A-Z0-9]+$/),
      })
      .optional(),
  })
  .passthrough();
export const styleSchema = z
  .object({
    id: z.string().optional(),
    slug: slugSchema,
    kind: slugSchema.refine(
      (value) => !["blog", "prompt"].includes(value),
      "Blog and prompt collections are unavailable.",
    ),
    title: z.string().min(1).max(160),
    description: z.string().max(1000).default(""),
    seo_title: z.string().max(200).default(""),
    seo_description: z.string().max(500).default(""),
    seo_keywords: z.array(z.string().max(80)).max(30).default([]),
    image_url: z
      .string()
      .max(2000)
      .refine((v) => !v || /^\/(?!\/)/.test(v) || /^https:\/\//.test(v))
      .default(""),
    image_alt: z.string().max(200).default(""),
    style_category: z.string().max(80).default(""),
    tags: z.array(z.string().max(80)).max(30).default([]),
    metadata: metadataSchema.default({}),
    content_json: z.union([
      editorSchema,
      designSchema,
      text3dProjectSchema,
      buttonStateSchema,
    ]),
    is_free: z.boolean().default(true),
    is_premium: z.boolean().default(false),
    is_active: z.boolean().default(true),
    is_locked: z.boolean().default(false),
    badge: z.string().max(12).default(""),
    status: z.enum(["pending", "approved", "rejected"]).default("approved"),
  })
  .superRefine((value, ctx) => {
    const validContent =
      value.kind === "design"
        ? designSchema.safeParse(value.content_json).success
        : value.kind === "3d"
          ? text3dProjectSchema.safeParse(value.content_json).success
          : value.kind === "button"
            ? buttonStateSchema.safeParse(value.content_json).success
            : editorSchema.safeParse(value.content_json).success;
    if (!validContent)
      ctx.addIssue({
        code: "custom",
        path: ["content_json"],
        message:
          value.kind === "3d"
            ? "This collection requires valid 3D project JSON."
            : value.kind === "button"
              ? "This collection requires valid button JSON."
              : "This collection requires text editor JSON.",
      });
  });
