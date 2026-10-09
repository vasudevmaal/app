"use client";

import { useEffect, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import type { FontAssetSummary } from "@/lib/font-library";
import { useApp } from "./providers";

function formatSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.ceil(size / 1024)} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function FontLibraryManager() {
  const { toast } = useApp();
  const [fonts, setFonts] = useState<FontAssetSummary[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/font-library")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setFonts(data);
      })
      .catch((error) => toast(error.message, true));
  }, []);
  useEffect(() => {
    for (const font of fonts) {
      const face = new FontFace(
        font.name,
        `url(/api/font-library?id=${encodeURIComponent(font.id)})`,
      );
      document.fonts.add(face);
      face.load().catch(() => {});
    }
  }, [fonts]);

  return (
    <section className="font-library-manager">
      <div className="font-library-upload">
        <label className="field">
          <span>Font family name</span>
          <input
            value={name}
            maxLength={80}
            placeholder="Example: EXC Display"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="upload-area">
          <Upload size={18} />
          <span>{busy ? "Uploading font..." : "Add font"}</span>
          <small>TTF, OTF, WOFF or WOFF2 · max 3 MB</small>
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try {
                const form = new FormData();
                form.set("file", file);
                if (name.trim()) form.set("name", name.trim());
                const response = await fetch("/api/font-library", {
                  method: "POST",
                  body: form,
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setFonts((current) => [...current, data]);
                setName("");
                toast("Font added to the 3D Text editor.");
              } catch (error) {
                toast((error as Error).message, true);
              } finally {
                setBusy(false);
                event.target.value = "";
              }
            }}
          />
        </label>
      </div>
      <div className="preset-manager-grid">
        {fonts.map((font) => (
          <article
            className="preset-manager-item font-library-item"
            key={font.id}
          >
            <div
              className="font-preview"
              style={{
                fontFamily: `'${font.name.replaceAll("'", "\\'")}', sans-serif`,
              }}
            >
              Aa 123
            </div>
            <strong>{font.name}</strong>
            <small>
              {font.mime.split("/").pop()?.toUpperCase()} ·{" "}
              {formatSize(font.size)}
            </small>
            <button
              className="icon-button danger"
              title={`Remove ${font.name}`}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const response = await fetch(
                    `/api/font-library?id=${encodeURIComponent(font.id)}`,
                    { method: "DELETE" },
                  );
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error);
                  setFonts((current) =>
                    current.filter((item) => item.id !== font.id),
                  );
                  toast("Font removed.");
                } catch (error) {
                  toast((error as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </div>
      {!fonts.length && (
        <div className="empty compact">
          <p>No custom fonts have been added yet.</p>
        </div>
      )}
    </section>
  );
}
