import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStyle } from "@/lib/data";
import { VisualDetail } from "@/components/visual-detail";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const style = await getStyle("visual", slug);
  if (!style) notFound();
  const title = style?.seo_title || style?.title || slug.replaceAll("-", " ");
  const description = style?.seo_description || style?.description || "Visual asset by EXCPIX.";
  return { title, description, alternates: { canonical: `/visual/${encodeURIComponent(slug)}` }, openGraph: { title, description, images: [style?.image_url || `/visual/${slug}/image.png`] } };
}

export default async function VisualPage({ params }: Props) {
  const { slug } = await params;
  const style = await getStyle("visual", slug);
  if (!style) notFound();
  return <VisualDetail slug={slug} style={style} />;
}
