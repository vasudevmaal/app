import type { Style, Settings } from "./types";

export type FAQ = { question: string; answer: string; active: boolean };
export type ContentStep = { title: string; description: string };
export type CollectionContent = {
  title: string;
  description: string;
  seo_title: string;
  seo_description: string;
  footer_title: string;
  footer_description: string;
  faq: FAQ[];
  faq_enabled: boolean;
  how_to: ContentStep[];
  how_to_enabled: boolean;
};
export type ContentMetadata = {
  source_kind?: string;
  featured?: boolean;
  faq?: FAQ[];
  faq_enabled?: boolean;
  ai?: { asset_path: string; characters: string };
};

export const defaultSteps: ContentStep[] = [
  {
    title: "Add your text",
    description: "Enter your words and choose a font.",
  },
  {
    title: "Edit layers",
    description: "Adjust depth, outlines, shadows and colors.",
  },
  {
    title: "Choose a background",
    description: "Use a color, image or transparent background.",
  },
  { title: "Animate", description: "Choose an effect and adjust its speed." },
  {
    title: "Download",
    description:
      "Save a PNG or animated GIF in the quality and format you need, without a watermark or daily download limit.",
  },
];
export const defaultFAQs: FAQ[] = [
  {
    question: "Can I download a style for free?",
    answer:
      "Yes. Downloads are available without a watermark or daily limit. An account is needed to save projects and favorites.",
    active: true,
  },
  {
    question: "What is included in a paid plan?",
    answer:
      "Paid plans include premium styles and additional creative workspace features. Exports do not add a watermark or daily download limit.",
    active: true,
  },
  {
    question: "Can I export an animated GIF?",
    answer:
      "Supported 3D Text animations can be exported as GIFs. GIF sizes are separate from 4K and 8K PNG sizes.",
    active: true,
  },
];
export function collectionContent(
  settings: Settings,
  kind: string,
): CollectionContent {
  const saved = (
    settings.collection_content as
      Record<string, Partial<CollectionContent>> | undefined
  )?.[kind];
  return {
    title:
      kind === "home"
        ? "Good design starts with a little inspiration."
        : kind === "faq"
          ? "Help & frequently asked questions"
          : kind === "3d"
            ? "3D Studio"
            : settings.categories.find((c) => c.id === kind)?.name || kind,
    description:
      kind === "home"
        ? "Discover text styles, expressive lettering and fresh ideas. Make them yours."
        : "Find your next signature style.",
    seo_title: "",
    seo_description: "",
    footer_title: "",
    footer_description: "",
    faq: kind === "faq" ? defaultFAQs : [],
    faq_enabled: kind === "faq",
    how_to: kind === "3d-text" ? defaultSteps : [],
    how_to_enabled: kind === "3d-text" || kind === "3d",
    ...saved,
  };
}
export function visibleFAQs(
  style: Style | undefined,
  content: CollectionContent,
): FAQ[] {
  const meta = style?.metadata as ContentMetadata | undefined;
  if (
    meta?.faq_enabled === false ||
    (meta?.faq_enabled === undefined && !content.faq_enabled)
  )
    return [];
  return (meta?.faq ?? content.faq).filter(
    (item) => item.active && item.question.trim() && item.answer.trim(),
  );
}
export function glyphMap(style: Style): Record<string, string> {
  const config = (style.metadata as ContentMetadata).ai;
  const root = config?.asset_path || `/ai/imgs7727/${style.slug}`;
  const chars = config?.characters || "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
  return Object.fromEntries(
    [...new Set(chars.toUpperCase().replace(/[^A-Z0-9]/g, ""))].map((c) => [
      c,
      `${root}/${c}.webp`,
    ]),
  );
}
export function selectRelated(
  style: Style,
  candidates: Style[],
  count = 30,
  random = Math.random,
): Style[] {
  const kinds = ["3d-text", "ai", "design", "3d"].includes(style.kind)
    ? ["3d-text", "ai", "design", "3d"]
    : [style.kind];
  const available = candidates.filter(
    (s) =>
      s.id !== style.id &&
      kinds.includes(s.kind) &&
      s.is_active &&
      s.status === "approved",
  );
  const tags = new Set(style.tags.map((t) => t.toLowerCase()));
  const score = (s: Style) =>
    (style.style_category && s.style_category === style.style_category
      ? 10
      : 0) + s.tags.filter((t) => tags.has(t.toLowerCase())).length;
  const related = available
    .filter((s) => score(s) > 0)
    .sort(
      (a, b) =>
        score(b) - score(a) ||
        Number(!!b.metadata.featured) - Number(!!a.metadata.featured),
    );
  const remaining = available
    .filter((s) => score(s) === 0)
    .map((s) => ({ s, order: random() }))
    .sort(
      (a, b) =>
        Number(!!b.s.metadata.featured) - Number(!!a.s.metadata.featured) ||
        a.order - b.order,
    )
    .map(({ s }) => s);
  return [...related, ...remaining].slice(0, Math.max(0, Math.min(60, count)));
}
