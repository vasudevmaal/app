"use client";
import { useEffect, useState, useRef } from "react";
import { Upload, Download, Check } from "lucide-react";
import { api } from "@/lib/client";
import { useApp } from "./providers";
type Asset = {
  id: string;
  name: string;
  kind: string;
  preview_url: string;
  original_url: string;
  render_url: string;
  width: number;
  height: number;
};
export function BackgroundLibrary({
  manage = false,
  kind = "image",
  selected,
  onSelect,
  embedded = false,
}: {
  manage?: boolean;
  kind?: string;
  selected?: string;
  onSelect?: (url: string) => void;
  embedded?: boolean;
}) {
  const { toast } = useApp();
  const [assets, setAssets] = useState<Asset[]>([]),
    [category, setCategory] = useState(kind),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    api(manage ? "admin/backgrounds" : "backgrounds")
      .then((data) => {
        if (active) setAssets(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [manage]);
  const activeCategory = embedded ? kind : manage ? category : kind;
  const visible = assets.filter((a) => a.kind === activeCategory);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (files.length > 50) {
      toast("Select up to 50 images per batch.", true);
      return;
    }
    setBusy(true);
    setError("");
    const failed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setProgress(`Uploading ${i + 1} of ${files.length}`);
      try {
        const form = new FormData();
        form.set("file", files[i]);
        form.set("kind", activeCategory);
        const response = await fetch("/api/admin/backgrounds", {
          method: "POST",
          body: form,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Upload failed.");
        setAssets((old) => [data, ...old]);
      } catch (e) {
        failed.push(`${files[i].name}: ${(e as Error).message}`);
      }
    }
    setProgress(
      `${files.length - failed.length} uploaded${failed.length ? `, ${failed.length} failed` : ""}`,
    );
    setError(failed.join("\n"));
    setBusy(false);
    if (input.current) input.current.value = "";
  }
  return (
    <section className={manage ? "background-manager" : "background-picker"}>
      {manage && (
        <>
          {!embedded && (
            <div className="section-title">
              <h2>Background library</h2>
              <div className="segmented">
                {["image", "pattern"].map((c) => (
                  <button
                    key={c}
                    disabled={busy}
                    className={category === c ? "active" : ""}
                    onClick={() => setCategory(c)}
                  >
                    {c === "image" ? "Images" : "Patterns"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="upload-area">
            <Upload size={24} />
            <strong>
              {busy
                ? progress
                : `Upload ${activeCategory === "pattern" ? "patterns" : "backgrounds"}`}
            </strong>
            <small>
              PNG, JPEG, WebP, SVG · WebP preview · 10 MB each · up to 50 files
            </small>
            <input
              ref={input}
              type="file"
              multiple
              disabled={busy}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => upload(e.target.files)}
            />
          </label>
        </>
      )}
      {progress && <p role="status">{progress}</p>}
      {error && (
        <p className="form-error asset-errors" role="alert">
          {error}
        </p>
      )}
      {!!visible.length && (
        <div className="background-grid">
          {visible.map((asset) => (
            <div key={asset.id} className="background-item">
              {manage ? (
                <img
                  src={asset.preview_url}
                  alt={asset.name}
                  loading="lazy"
                  width="250"
                  height={Math.round((asset.height * 250) / asset.width)}
                />
              ) : (
                <button
                  type="button"
                  title={asset.name}
                  className={selected === asset.render_url ? "selected" : ""}
                  onClick={() =>
                    onSelect?.(asset.render_url || asset.original_url)
                  }
                >
                  <img
                    src={asset.preview_url}
                    alt={asset.name}
                    loading="lazy"
                    width="250"
                    height={Math.round((asset.height * 250) / asset.width)}
                  />
                  {selected === asset.render_url && <Check size={16} />}
                </button>
              )}
              {manage && (
                <div>
                  <span>{asset.name}</span>
                  <small>
                    {asset.width} x {asset.height}
                  </small>
                  <a
                    className="icon-button"
                    href={asset.original_url}
                    download
                    title="Download original"
                  >
                    <Download size={16} />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {manage && !visible.length && (
        <p className="muted">
          No {activeCategory === "image" ? "background images" : "patterns"}{" "}
          yet.
        </p>
      )}
    </section>
  );
}
