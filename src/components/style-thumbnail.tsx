"use client";
import { useMemo, useState } from "react";
import type { Style } from "@/lib/types";
import { glyphMap } from "@/lib/content";
import { Preview } from "./preview";

export function StyleThumbnail({ style }: { style: Style }) {
  const src = style.image_url ||
    (style.kind === "3d" && style.slug === "3d-text"
      ? "/images/tools/3d-text.png"
      : `/previews/${style.slug}.png`);
  const [failed, setFailed] = useState("");
  const glyphs = useMemo(
    () =>
      style.kind === "ai" ||
      (style.kind === "text" && style.metadata.source_kind === "ai")
        ? glyphMap(style)
        : undefined,
    [style],
  );
  if (style.kind === "button" && (!style.image_url || failed === src)) {
    const button = style.content_json as unknown as {
      text?: string;
      fillStart?: string;
      fillEnd?: string;
      textColor?: string;
      radius?: number;
    };
    return (
      <div
        className="button-thumbnail"
        style={{
          background: `linear-gradient(135deg, ${button.fillStart || "#f47757"}, ${button.fillEnd || "#c94d38"})`,
          color: button.textColor || "#fff",
          borderRadius: button.radius ?? 10,
          minHeight: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 18,
          fontWeight: 700,
          textAlign: "center",
          boxShadow: "0 10px 24px #0002",
        }}
      >
        {button.text || style.title}
      </div>
    );
  }
  if (failed !== src)
    return (
      <img
        src={src}
        alt={style.image_alt || style.title}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(src)}
      />
    );
  return <Preview state={style.content_json} glyphs={glyphs} />;
}
