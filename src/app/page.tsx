import { getStyles, getSettings } from "@/lib/data";
import { Gallery } from "@/components/gallery";
import { collectionContent, visibleFAQs } from "@/lib/content";
import { FAQSection } from "@/components/content-sections";
import type { Metadata } from "next";
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings(),
    content = collectionContent(settings, "home");
  return {
    title: {
      absolute:
        content.seo_title || settings.site_name + " - Creative Text & Design",
    },
    description: content.seo_description || settings.description,
    alternates: { canonical: "/" },
  };
}
export default async function Home() {
  const content = collectionContent(await getSettings(), "home");
  const styles = await getStyles(undefined, undefined, 10000);
  const collectionCounts: Record<string, number> = {};
  for (const style of styles)
    collectionCounts[style.kind] = (collectionCounts[style.kind] || 0) + 1;
  return (
    <>
      <Gallery
        styles={styles.filter((style) => style.kind !== "visual")}
        collectionCounts={collectionCounts}
      />
      <div className="main-width">
        <FAQSection items={visibleFAQs(undefined, content)} />
      </div>
    </>
  );
}
