import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStyle } from "@/lib/data";
import { designLibrary } from "@/lib/design-data";
import { designSchema } from "@/lib/design";
import { DesignEditor } from "@/components/design/editor";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const style = await getStyle("visual", slug);
  return {
    title: style ? `Edit ${style.title}` : "Edit visual",
    robots: { index: false, follow: false },
  };
}

export default async function VisualEditPage({ params }: Props) {
  const { slug } = await params;
  const style = await getStyle("visual", slug);
  if (!style) notFound();
  const image = style.image_url || `/visual/${slug}/image.png`;
  const initial = designSchema.parse({
    name: style.title,
    canvasW: 1024,
    canvasH: 1536,
    bg: { type: "solid", color: "#ffffff" },
    elements: [
      {
        id: "visual-image",
        type: "image",
        src: image,
        x: 0,
        y: 0,
        w: 1024,
        h: 1536,
        zIndex: 0,
      },
    ],
  });
  return (
    <DesignEditor
      key={style.id}
      style={style}
      initial={initial}
      library={await designLibrary()}
    />
  );
}
