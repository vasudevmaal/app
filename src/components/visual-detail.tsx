"use client";

import Link from "next/link";
import { Download, Edit3, Image as ImageIcon } from "lucide-react";
import type { Style } from "@/lib/types";
import { useApp } from "./providers";
import { saveBlob } from "@/lib/client";

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function VisualDetail({ slug, style }: { slug: string; style?: Style | null }) {
  const { user, toast } = useApp();
  const title = style?.title || titleFromSlug(slug);
  const image = style?.image_url || `/visual/${slug}/image.png`;
  const editHref = `/visual/${encodeURIComponent(slug)}/edit`;
  const paid = !!user && (["owner", "admin"].includes(user.role) || (user.plan !== "free" && !!user.plan_expires && new Date(user.plan_expires) > new Date()));
  async function downloadImage() {
    if (!style) return;
    if ((style.is_premium || !style.is_free) && !paid) {
      toast("This visual requires a paid plan.", true);
      return;
    }
    try {
      const response = await fetch("/api/visual-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style_id: style.id }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Download failed.");
      saveBlob(await response.blob(), `excpix-${slug}.png`);
      toast("Your download is ready.");
    } catch (error) {
      toast((error as Error).message, true);
    }
  }

  return (
    <main className="visual-detail main-width">
      <div className="breadcrumb">
        <Link href="/">Home</Link><span>/</span><Link href="/visual">Visual</Link><span>/</span><span>{title}</span>
      </div>
      <div className="visual-detail-grid">
        <section className="visual-detail-preview" aria-label={`${title} preview`}>
          <img src={image} alt={style?.image_alt || title} />
          <span className="visual-preview-watermark" aria-hidden="true">
            {Array.from({ length: 96 }, (_, index) => (
              <span key={index}>EXCPIX.COM</span>
            ))}
          </span>
        </section>
        <aside className="visual-detail-info">
          <span className="eyebrow">Visual asset</span>
          <h1>{title}</h1>
          <div className="visual-detail-actions">
            <button
              className="button accent"
              onClick={downloadImage}
            >
              <Download size={16} />Download image
            </button>
            <Link className="button" href={editHref}><Edit3 size={16} />Edit in design</Link>
          </div>
          {style?.style_category && (
            <div className="visual-detail-category">
              <Link href={"/search/" + encodeURIComponent(style.style_category.toLowerCase())}>
                {style.style_category}
              </Link>
            </div>
          )}
          <div className="visual-about" id="visual-about">
            <h2>About this image</h2>
            <p>
              {style?.description ||
                "A beautifully painted girl image in a soft watercolor style, ready to download or edit in design."}
            </p>
          </div>
          {!style && <div className="visual-detail-note"><ImageIcon size={16} />Add the image at <code>public{image}</code> to make this visual available.</div>}
        </aside>
      </div>
    </main>
  );
}
