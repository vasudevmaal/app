import { getStyles, getSettings } from "@/lib/data";
import { query } from "@/lib/db";
import { collectionPath } from "@/lib/routes";
export const dynamic = "force-dynamic";
export default async function sitemap() {
  const base = process.env.APP_URL || "http://localhost:3000";
  const [styles, settings, pages] = await Promise.all([
    getStyles(undefined, undefined, 10000),
    getSettings(),
    query<{ slug: string; updated_at: string }>(
      "SELECT slug,updated_at FROM pages WHERE is_active=true",
    ),
  ]);
  return [
    { url: base, changeFrequency: "daily" as const, priority: 1 },
    { url: base + "/faq", changeFrequency: "monthly" as const, priority: 0.5 },
    {
      url: base + "/3d-studio/3d-text",
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    ...settings.categories
      .filter((c) => !["blog", "prompt"].includes(c.id))
      .map((c) => ({
        url: base + "/" + c.id,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ...styles.map((s) => ({
      url: base + "/" + collectionPath(s.kind) + "/" + s.slug,
      lastModified: new Date(s.updated_at),
      priority: 0.7,
    })),
    ...pages.map((p) => ({
      url: base + "/p/" + p.slug,
      lastModified: new Date(p.updated_at),
      priority: 0.4,
    })),
  ];
}
