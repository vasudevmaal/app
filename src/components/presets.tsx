"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Plus, Trash2, Upload, Save } from "lucide-react";
import { api } from "@/lib/client";
import {
  creativePresetSchema,
  defaultPresets,
  gradientCss,
  type CreativePreset,
} from "@/lib/creative-library";
import type { Stop } from "@/lib/types";
import { useApp } from "./providers";
import { BackgroundLibrary } from "./background-library";
import { FontLibraryManager } from "./font-library";
export function usePresets() {
  const [presets, setPresets] = useState(defaultPresets);
  useEffect(() => {
    let alive = true;
    api<CreativePreset[]>("creative-library")
      .then((data) => {
        if (alive) setPresets(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return presets;
}
export function PresetPicker({
  type,
  onSelect,
  expanded = false,
  label,
  leading,
  onTransparent,
}: {
  type: "color" | "gradient" | "image";
  onSelect: (p: CreativePreset) => void;
  expanded?: boolean;
  label?: string;
  leading?: ReactNode;
  onTransparent?: () => void;
}) {
  const presets = usePresets().filter((p) => p.type === type);
  const swatches = (
    <div className="preset-swatches">
      {leading}
      {onTransparent && (
        <button
          type="button"
          title="Transparent"
          aria-label="Transparent"
          className="preset-transparent"
          onClick={onTransparent}
        />
      )}
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          title={p.name}
          aria-label={p.name}
          onClick={() => onSelect(p)}
          style={{
            background:
              p.type === "color"
                ? p.color
                : p.type === "gradient"
                  ? gradientCss(p)
                  : undefined,
          }}
        >
          {p.type === "image" && (
            <img src={p.preview || p.url} alt={p.name} loading="lazy" />
          )}
        </button>
      ))}
    </div>
  );
  if (expanded)
    return (
      <div className="preset-group">
        {label && <span className="field-label">{label}</span>}
        {swatches}
      </div>
    );
  return (
    <details className="preset-picker">
      <summary>Presets</summary>
      {swatches}
    </details>
  );
}
export function GradientStops({
  stops,
  onChange,
}: {
  stops: Stop[];
  onChange: (v: Stop[]) => void;
}) {
  return (
    <div className="gradient-stops-editor">
      {stops.map((s, i) => (
        <div className="color-stop" key={i}>
          <input
            aria-label={`Color stop ${i + 1}`}
            type="color"
            value={s.color}
            onChange={(e) =>
              onChange(
                stops.map((x, j) =>
                  j === i ? { ...x, color: e.target.value } : x,
                ),
              )
            }
          />
          <input
            aria-label={`Color position ${i + 1}`}
            type="range"
            min={0}
            max={100}
            value={s.pos}
            onChange={(e) =>
              onChange(
                stops.map((x, j) =>
                  j === i ? { ...x, pos: Number(e.target.value) } : x,
                ),
              )
            }
          />
          <output>{s.pos}%</output>
          <button
            type="button"
            className="icon-button"
            title="Remove color"
            disabled={stops.length <= 2}
            onClick={() => onChange(stops.filter((_, j) => i !== j))}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button dashed"
        disabled={stops.length >= 12}
        onClick={() => onChange([...stops, { color: "#ffffff", pos: 50 }])}
      >
        <Plus size={15} />
        Add color
      </button>
    </div>
  );
}
export function PresetManager() {
  const { toast } = useApp();
  const [rows, setRows] = useState<CreativePreset[]>([]),
    [kind, setKind] = useState<
      "color" | "gradient" | "background" | "pattern" | "image" | "font"
    >("color"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<CreativePreset[]>("creative-library")
      .then(setRows)
      .catch((e) => toast(e.message, true));
  }, []);
  const change = (id: string, patch: Partial<CreativePreset>) =>
    setRows((old) => old.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const assetKind =
    kind === "background" ? "image" : kind === "pattern" ? "pattern" : null;
  const presetKind = assetKind ? null : kind;
  return (
    <section className="preset-manager">
      <div className="section-title">
        <h2>Creative library</h2>
        <div className="segmented">
          {(
            [
              "color",
              "gradient",
              "background",
              "pattern",
              "image",
              "font",
            ] as const
          ).map((t) => (
            <button
              className={t === kind ? "active" : ""}
              key={t}
              onClick={() => setKind(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {kind === "font" ? (
        <FontLibraryManager />
      ) : assetKind ? (
        <BackgroundLibrary manage embedded kind={assetKind} />
      ) : (
        <>
          <div className="preset-manager-grid">
            {rows
              .filter((r) => r.type === presetKind)
              .map((p) => (
                <article className="preset-manager-item" key={p.id}>
                  <div
                    className="preset-preview"
                    style={{
                      background:
                        p.type === "color"
                          ? p.color
                          : p.type === "gradient"
                            ? gradientCss(p)
                            : undefined,
                    }}
                  >
                    {p.type === "image" && p.url && (
                      <img src={p.preview || p.url} alt={p.name} />
                    )}
                  </div>
                  <label className="field">
                    <span>Name</span>
                    <input
                      value={p.name}
                      maxLength={100}
                      onChange={(e) => change(p.id, { name: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Category</span>
                    <input
                      value={p.category}
                      maxLength={80}
                      onChange={(e) =>
                        change(p.id, { category: e.target.value })
                      }
                    />
                  </label>
                  {p.type === "color" && (
                    <input
                      type="color"
                      aria-label="Preset color"
                      value={p.color}
                      onChange={(e) => change(p.id, { color: e.target.value })}
                    />
                  )}{" "}
                  {p.type === "gradient" && (
                    <>
                      <label className="field">
                        <span>Gradient type</span>
                        <select
                          value={p.gradientType}
                          onChange={(e) =>
                            change(p.id, {
                              gradientType: e.target.value as
                                "linear" | "radial",
                            })
                          }
                        >
                          <option value="linear">Linear</option>
                          <option value="radial">Radial</option>
                        </select>
                      </label>
                      <GradientStops
                        stops={p.stops}
                        onChange={(stops) => change(p.id, { stops })}
                      />
                      <label className="field">
                        <span>Angle</span>
                        <input
                          aria-label="Preset angle"
                          type="range"
                          min={0}
                          max={360}
                          value={p.angle}
                          onChange={(e) =>
                            change(p.id, { angle: Number(e.target.value) })
                          }
                        />
                      </label>
                    </>
                  )}
                  {p.type === "image" && (
                    <label className="upload-area">
                      <Upload size={18} />
                      <span>Upload image</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        disabled={busy}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setBusy(true);
                          try {
                            const form = new FormData();
                            form.set("file", file);
                            form.set("kind", "image");
                            const response = await fetch(
                              "/api/admin/backgrounds",
                              {
                                method: "POST",
                                body: form,
                              },
                            );
                            const asset = await response.json();
                            if (!response.ok) throw new Error(asset.error);
                            change(p.id, {
                              url: asset.render_url || asset.original_url,
                              preview: asset.preview_url,
                            });
                          } catch (e) {
                            toast((e as Error).message, true);
                          } finally {
                            setBusy(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  )}
                  <button
                    className="icon-button danger"
                    title={`Remove ${p.name}`}
                    onClick={() =>
                      setRows((old) => old.filter((x) => x.id !== p.id))
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </article>
              ))}
          </div>
          <div className="preset-manager-actions">
            <button
              className="button"
              onClick={() =>
                setRows((old) => [
                  ...old,
                  creativePresetSchema.parse({
                    id: crypto.randomUUID(),
                    type: presetKind,
                    name: `New ${presetKind}`,
                  }),
                ])
              }
            >
              <Plus size={16} />
              Add {presetKind}
            </button>
            <button
              className="button accent"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("creative-library", rows);
                  toast("Creative library saved.");
                } catch (e) {
                  toast((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Save size={16} />
              Save library
            </button>
          </div>
        </>
      )}
    </section>
  );
}
