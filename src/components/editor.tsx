"use client";
import { useState, useEffect, useRef, ChangeEvent } from "react";
import Link from "next/link";
import { isExportLocked } from "@/lib/export-access";
import {
  Type,
  PaintBucket,
  Layers,
  ImageIcon,
  Film,
  Download,
  Undo2,
  Redo2,
  RotateCcw,
  Save,
  Upload,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Box,
  Square,
  Cloud,
  Moon,
  LockKeyhole,
  ChevronRight,
  Check,
  Copy,
  Send,
  Link as LinkIcon,
  Globe,
  BriefcaseBusiness,
  MessageCircle,
  AtSign,
  Pin,
  Share2,
  Play,
  Pause,
  Eye,
  EyeOff,
  Heart,
} from "lucide-react";
import type { Style, EditorState, Fill, Layer } from "@/lib/types";
import { defaultState, baseFill } from "@/lib/defaults";
import { fonts } from "@/lib/editor-fonts";

function layerLabel(type: string) {
  if (type === "3d") return "3D";
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
import { animations } from "@/lib/original-renderer";
import { Preview } from "./preview";
import { BackgroundLibrary } from "./background-library";
import { PresetPicker, GradientStops } from "./presets";
import { StyleCard } from "./gallery";
import { useApp } from "./providers";
import { collectionPath } from "@/lib/routes";
import { api, saveBlob } from "@/lib/client";
import { editorSchema } from "@/lib/validation";
import type { FontAssetSummary } from "@/lib/font-library";
import { FontPickerPopup } from "@/components/font-picker-popup";
export { fonts };
export function Range({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <label className="range-field">
      <span>
        {label}
        <output>
          {Number(value.toFixed(2))}
          {unit}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
async function readFile(file: File) {
  if (file.size > 2_000_000) throw new Error("Choose an image under 2 MB.");
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (
    !isSvg &&
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("Use PNG, JPEG, WebP, GIF or SVG.");
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
export function FillBuilder({
  value,
  onChange,
  background = false,
  showPresets = true,
  allowExtruded = false,
  hideOpacity = false,
}: {
  value: Fill;
  onChange: (f: Fill) => void;
  background?: boolean;
  showPresets?: boolean;
  allowExtruded?: boolean;
  hideOpacity?: boolean;
}) {
  const { toast } = useApp();
  const update = (v: Partial<Fill>) => onChange({ ...value, ...v });
  return (
    <div className="fill-builder">
      <label className="field">
        <span>{background ? "Background type" : "Fill type"}</span>
        <select
          value={value.type}
          onChange={(e) =>
            update({
              type: e.target.value,
              ...(e.target.value === "radial" && value.scope === "extruded"
                ? { scope: "text" }
                : {}),
            })
          }
        >
          {(background
            ? ["solid", "gradient", "radial", "image", "pattern", "transparent"]
            : ["solid", "gradient", "radial", "pattern", "alternating"]
          ).map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </label>
      {showPresets &&
        !background &&
        ["solid", "gradient", "radial", "pattern", "image"].includes(
          value.type,
        ) && (
          <PresetPicker
            type={
              value.type === "solid"
                ? "color"
                : ["gradient", "radial"].includes(value.type)
                  ? "gradient"
                  : "image"
            }
            onTransparent={() => update({ opacity: 0 })}
            onSelect={(p) =>
              update(
                p.type === "color"
                  ? { color: p.color, opacity: 1 }
                  : p.type === "gradient"
                    ? {
                        opacity: 1,
                        type:
                          p.gradientType === "radial" ? "radial" : "gradient",
                        stops: p.stops,
                        angle: p.angle,
                        angleGrad: p.angle,
                      }
                    : {
                        opacity: 1,
                        [value.type === "image" ? "base64" : "patternBase64"]:
                          p.url,
                      },
              )
            }
          />
        )}
      {value.type !== "transparent" && !hideOpacity && (
        <Range
          label="Opacity"
          value={value.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => update({ opacity: v })}
        />
      )}
      {value.type === "solid" && (
        <label className="color-field">
          <span>Color</span>
          <input
            aria-label="Fill color"
            type="color"
            value={value.color}
            onChange={(e) => update({ color: e.target.value })}
          />
          <code>{value.color.toUpperCase()}</code>
        </label>
      )}
      {["gradient", "radial"].includes(value.type) && (
        <>
          {!background && (
            <label className="field">
              <span>Apply to</span>
              <select
                value={value.scope || "text"}
                onChange={(e) => update({ scope: e.target.value })}
              >
                <option value="text">Whole text</option>
                <option value="letter">Each letter</option>
                <option value="word">Each word</option>
                {allowExtruded && value.type === "gradient" && (
                  <option value="extruded">Extruded 3D Depth</option>
                )}
              </select>
            </label>
          )}
          {value.type !== "radial" && value.scope !== "extruded" && (
            <Range
              label="Angle"
              value={(value.angleGrad as number) ?? value.angle}
              max={360}
              unit="°"
              onChange={(v) => update({ angle: v, angleGrad: v })}
            />
          )}
          <div className="color-stops">
            {value.stops.map((stop, i) => (
              <div className="color-stop" key={i}>
                <input
                  aria-label={"Stop " + (i + 1) + " color"}
                  type="color"
                  value={stop.color}
                  onChange={(e) =>
                    update({
                      stops: value.stops.map((s, j) =>
                        i === j ? { ...s, color: e.target.value } : s,
                      ),
                    })
                  }
                />
                <input
                  aria-label={"Stop " + (i + 1) + " position"}
                  type="range"
                  min={0}
                  max={100}
                  value={stop.pos}
                  onChange={(e) =>
                    update({
                      stops: value.stops.map((s, j) =>
                        i === j ? { ...s, pos: +e.target.value } : s,
                      ),
                    })
                  }
                />
                <span>{stop.pos}%</span>
                <button
                  className="icon-button"
                  title="Remove color stop"
                  disabled={value.stops.length <= 2}
                  onClick={() =>
                    update({ stops: value.stops.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="button dashed"
            disabled={value.stops.length >= 12}
            onClick={() =>
              update({ stops: [...value.stops, { color: "#ffffff", pos: 50 }] })
            }
          >
            <Plus size={15} />
            Add color stop
          </button>
        </>
      )}
      {value.type === "alternating" && (
        <>
          <div className="two-fields">
            <label className="field">
              <span>Mode</span>
              <select
                value={value.altMode || "solid"}
                onChange={(e) => update({ altMode: e.target.value })}
              >
                <option value="solid">Solid</option>
                <option value="gradient">Gradient</option>
                <option value="radial">Radial</option>
                <option value="image">Image</option>
              </select>
            </label>
            <label className="field">
              <span>Apply to</span>
              <select
                value={value.altScope || "letter"}
                onChange={(e) => update({ altScope: e.target.value })}
              >
                <option value="letter">Each letter</option>
                <option value="word">Each word</option>
              </select>
            </label>
          </div>
          {["gradient", "radial"].includes(value.altMode || "") ? (
            <>
              {showPresets && (
                <PresetPicker
                  type="gradient"
                  onSelect={(p) =>
                    update({
                      altMode:
                        p.gradientType === "radial" ? "radial" : "gradient",
                      altGradients: [
                        ...(value.altGradients || []),
                        {
                          c1: p.stops[0].color,
                          c2: p.stops[p.stops.length - 1].color,
                          angle: p.angle,
                        },
                      ].slice(-16),
                    })
                  }
                />
              )}
              {(value.altGradients || []).map((g, i) => (
                <div className="color-stop" key={i}>
                  {(["c1", "c2"] as const).map((k) => (
                    <input
                      key={k}
                      type="color"
                      aria-label={"Gradient " + k}
                      value={g[k]}
                      onChange={(e) =>
                        update({
                          altGradients: value.altGradients!.map((v, j) =>
                            i === j ? { ...v, [k]: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  ))}
                  <input
                    type="range"
                    aria-label="Gradient angle"
                    value={g.angle}
                    min={0}
                    max={360}
                    step={1}
                    onChange={(e) =>
                      update({
                        altGradients: value.altGradients!.map((v, j) =>
                          i === j ? { ...v, angle: +e.target.value } : v,
                        ),
                      })
                    }
                  />
                  <button
                    className="icon-button"
                    title="Remove alternating gradient"
                    disabled={(value.altGradients?.length || 0) <= 1}
                    onClick={() =>
                      update({
                        altGradients: value.altGradients!.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button
                className="button dashed"
                disabled={(value.altGradients?.length || 0) >= 16}
                onClick={() =>
                  update({
                    altGradients: [
                      ...(value.altGradients || []),
                      { c1: "#ffffff", c2: "#ff6688", angle: 90 },
                    ],
                  })
                }
              >
                <Plus size={15} />
                Add gradient
              </button>
            </>
          ) : value.altMode === "image" ? (
            <>
              <div className="alternating-images">
                {((value.altImages as { base64: string }[]) || []).map(
                  (im, i) => (
                    <div key={i}>
                      <img src={im.base64} alt={`Alternating image ${i + 1}`} />
                      <button
                        className="icon-button"
                        title={`Remove image ${i + 1}`}
                        onClick={() =>
                          update({
                            altImages: value.altImages!.filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ),
                )}
              </div>
              <label className="upload-area">
                <Upload />
                <span>Add letter image</span>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                  onChange={async (e) => {
                    try {
                      const files = [...(e.target.files || [])];
                      if (files.length)
                        update({
                          altImages: [
                            ...(value.altImages || []),
                            ...(await Promise.all(
                              files.map(async (f) => ({
                                base64: await readFile(f),
                              })),
                            )),
                          ].slice(0, 16),
                        });
                      e.target.value = "";
                    } catch (e) {
                      toast((e as Error).message, true);
                    }
                  }}
                />
              </label>
            </>
          ) : (
            <div className="swatches">
              {(value.colors || []).map((c, i) => (
                <div className="alternating-color" key={i}>
                  <input
                    type="color"
                    aria-label={"Letter color " + (i + 1)}
                    value={c}
                    onChange={(e) =>
                      update({
                        colors: value.colors!.map((v, j) =>
                          i === j ? e.target.value : v,
                        ),
                      })
                    }
                  />
                  <button
                    className="icon-button"
                    title={`Remove color ${i + 1}`}
                    disabled={(value.colors?.length || 0) <= 1}
                    onClick={() =>
                      update({
                        colors: value.colors!.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                title="Add letter color"
                className="icon-button"
                disabled={(value.colors?.length || 0) >= 16}
                onClick={() =>
                  update({ colors: [...(value.colors || []), "#ffffff"] })
                }
              >
                <Plus size={18} />
              </button>
            </div>
          )}
        </>
      )}
      {["pattern", "image"].includes(value.type) && (
        <>
          {background && (
            <BackgroundLibrary
              kind={value.type}
              selected={String(
                value.type === "image"
                  ? value.base64 || ""
                  : value.patternBase64 || "",
              )}
              onSelect={(url) =>
                update({
                  [value.type === "image" ? "base64" : "patternBase64"]: url,
                })
              }
            />
          )}
          <label className="upload-area">
            <Upload size={22} />
            <span>
              {value.patternBase64 || value.base64
                ? "Replace image"
                : "Choose image"}
            </span>
            <small>PNG, JPEG, WebP, SVG · up to 2 MB</small>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0];
                  if (f)
                    update({
                      [value.type === "image" ? "base64" : "patternBase64"]:
                        await readFile(f),
                    });
                } catch (e) {
                  toast((e as Error).message, true);
                }
              }}
            />
          </label>
          {value.type === "pattern" ? (
            <>
              <Range
                label="Pattern scale"
                value={value.patternSize || 100}
                min={10}
                max={300}
                onChange={(v) => update({ patternSize: v })}
              />
              <label className="field">
                <span>Pattern background</span>
                <select
                  value={value.patternBgType || "none"}
                  onChange={(e) => update({ patternBgType: e.target.value })}
                >
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="gradient">Gradient</option>
                  <option value="radial">Radial</option>
                </select>
              </label>
              {value.patternBgType === "solid" && (
                <input
                  type="color"
                  aria-label="Pattern background color"
                  value={value.patternBgColor || "#ffffff"}
                  onChange={(e) => update({ patternBgColor: e.target.value })}
                />
              )}
              {["gradient", "radial"].includes(value.patternBgType || "") && (
                <>
                  {showPresets && (
                    <PresetPicker
                      type="gradient"
                      onSelect={(p) =>
                        update({
                          patternBgType:
                            p.gradientType === "radial" ? "radial" : "gradient",
                          patternBgStops: p.stops,
                          patternBgAngle: p.angle,
                        })
                      }
                    />
                  )}
                  <GradientStops
                    stops={
                      value.patternBgStops || [
                        { color: "#ffffff", pos: 0 },
                        { color: "#000000", pos: 100 },
                      ]
                    }
                    onChange={(patternBgStops) => update({ patternBgStops })}
                  />
                  <Range
                    label="Pattern background angle"
                    value={value.patternBgAngle || 90}
                    min={0}
                    max={360}
                    onChange={(patternBgAngle) => update({ patternBgAngle })}
                  />
                </>
              )}
            </>
          ) : (
            <label className="field">
              <span>Image sizing</span>
              <select
                value={String(value.imageMode || "cover")}
                onChange={(e) => update({ imageMode: e.target.value })}
              >
                {["cover", "contain", "stretch", "original"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
    </div>
  );
}
export function BackgroundQuickChoices({
  value,
  onChange,
}: {
  value: Fill;
  onChange: (value: Fill) => void;
}) {
  const update = (change: Partial<Fill>) => onChange({ ...value, ...change });
  return (
    <div className="background-quick-choices">
      <PresetPicker
        type="color"
        expanded
        label="Quick colors"
        leading={
          <button
            type="button"
            className="checkerboard"
            title="Transparent background"
            aria-label="Transparent background"
            onClick={() => update({ type: "transparent" })}
          />
        }
        onSelect={(preset) => update({ type: "solid", color: preset.color })}
      />
      <PresetPicker
        type="gradient"
        expanded
        label="Gradients"
        onSelect={(preset) =>
          update({
            type: preset.gradientType === "radial" ? "radial" : "gradient",
            stops: preset.stops,
            angle: preset.angle,
            angleGrad: preset.angle,
          })
        }
      />
      <PresetPicker
        type="image"
        expanded
        label="Images"
        onSelect={(preset) => update({ type: "image", base64: preset.url })}
      />
    </div>
  );
}
const tabs = [
  { id: "text", label: "Text", icon: Type },
  { id: "fill", label: "Fill", icon: PaintBucket },
  { id: "layers", label: "Layers", icon: Layers },
  { id: "background", label: "Background", icon: ImageIcon },
  { id: "animate", label: "Animate", icon: Film },
  { id: "export", label: "Export", icon: Download },
];
export function Editor({ style }: { style: Style }) {
  const { user, settings, toast } = useApp();
  const [state, setState] = useState<EditorState>({
      ...defaultState,
      ...style.content_json,
      wave: style.content_json.wave || 0,
    }),
    [tab, setTab] = useState("text"),
    [history, setHistory] = useState<EditorState[]>([]),
    [future, setFuture] = useState<EditorState[]>([]),
    [playing, setPlaying] = useState(true),
    [quality, setQuality] = useState(1280),
    [ratio, setRatio] = useState("original"),
    [format, setFormat] = useState("png"),
    [busy, setBusy] = useState(false),
    [favorite, setFavorite] = useState(false),
    [localFonts, setLocalFonts] = useState<{ name: string; dataUrl: string }[]>(
      [],
    ),
    [libraryFonts, setLibraryFonts] = useState<FontAssetSummary[]>([]),
    [openLayerId, setOpenLayerId] = useState<number | null>(null),
    [restored, setRestored] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const fontFileInput = useRef<HTMLInputElement>(null);
  const paid =
    !!user &&
    (["owner", "admin"].includes(user.role) ||
      (user.plan !== "free" &&
        !!user.plan_expires &&
        new Date(user.plan_expires) > new Date()));
  const locked = style.is_locked;
  const patch = (change: Partial<EditorState>) => {
    if (locked) return;
    setHistory((h) => [...h.slice(-29), state]);
    setFuture([]);
    setState((s) => ({ ...s, ...change }));
  };
  useEffect(() => {
    let active = true;
    fetch("/api/font-library")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!active) return;
        setLibraryFonts(data);
        const saved = data.find(
          (font: FontAssetSummary) => font.name === state.fontFamily,
        );
        if (saved && !state.fontAssetId && !state.fontBase64)
          setState((current) => ({ ...current, fontAssetId: saved.id }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const source = state.fontBase64
      ? state.fontBase64
      : state.fontAssetId
        ? `/api/font-library?id=${encodeURIComponent(state.fontAssetId)}`
        : "";
    if (!source) return;
    let active = true;
    const family = state.fontFamily;
    fetch(source)
      .then((response) => {
        if (!response.ok) throw new Error("Font could not be loaded.");
        return response.arrayBuffer();
      })
      .then((buffer) => new FontFace(family, buffer).load())
      .then((face) => {
        if (!active) return;
        document.fonts.add(face);
        setState((current) =>
          current.fontFamily === family ? { ...current } : current,
        );
      })
      .catch((error) => active && toast(error.message, true));
    return () => {
      active = false;
    };
  }, [state.fontFamily, state.fontBase64, state.fontAssetId]);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem("excpix-project-load");
    } catch {}
    if (saved && !locked) {
      try {
        setState(editorSchema.parse(JSON.parse(saved)) as EditorState);
        sessionStorage.removeItem("excpix-project-load");
      } catch {}
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("excpix-draft-" + style.id, JSON.stringify(state));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [state, restored, style.id]);
  async function saveProject() {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    try {
      await api("projects", {
        title: state.text || style.title,
        style_id: style.id,
        content_json: state,
      });
      toast("Project saved to your workspace.");
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  async function toggleFavorite() {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    try {
      await api(
        "favorites",
        { style_id: style.id },
        favorite ? "DELETE" : "POST",
      );
      setFavorite(!favorite);
      toast(favorite ? "Removed from favorites." : "Saved to your collection.");
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  async function download() {
    if (isExportLocked(style.kind, paid, format, quality)) {
      toast("This export requires a paid plan.", true);
      return;
    }
    setBusy(true);
    try {
      const preview = previewRef.current?.querySelector("canvas");
      const r = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style_id: style.id,
          quality: format === "svg" ? 1280 : quality,
          ratio,
          format,
          previewAspect:
            (format === "gif" || format === "svg") && preview?.height
              ? preview.width / preview.height
              : undefined,
          content_json: state,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      saveBlob(await r.blob(), style.slug + "." + format);
      toast("Your download is ready.");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const layerPatch = (id: number, update: Partial<Layer>) =>
    patch({
      layers: state.layers.map((l) => (l.id === id ? { ...l, ...update } : l)),
    });
  const fontOptions = [
    ...new Set([
      ...fonts,
      ...libraryFonts.map((font) => font.name),
      ...localFonts.map((font) => font.name),
    ]),
  ];
  if (!fontOptions.includes(state.fontFamily))
    fontOptions.push(state.fontFamily);
  return (
    <main className="editor-page main-width">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight size={13} />
        <Link href={"/" + collectionPath(style.kind)}>
          {style.kind === "3d-text"
            ? "3D Text"
            : style.kind === "ai"
              ? "AI Design"
              : style.kind === "3d"
                ? "3D"
                : style.kind}
        </Link>
        <ChevronRight size={13} />
        <span>{style.title}</span>
      </div>
      <div className="editor-title">
        <div>
          <h1>
            {style.title}
            {style.is_premium && <span className="pro-label">PRO</span>}
          </h1>
          <p>{style.description}</p>
        </div>
      </div>
      <div className="editor-workspace">
        <section className="preview-pane">
          <div className="preview-toolbar">
            <span>
              <span className="status-dot" />
              Live preview
            </span>
            <div>
              <button
                className="icon-button"
                title="Undo"
                disabled={!history.length || locked}
                onClick={() => {
                  setFuture((f) => [state, ...f]);
                  setState(history[history.length - 1]);
                  setHistory((h) => h.slice(0, -1));
                }}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-button"
                title="Redo"
                disabled={!future.length || locked}
                onClick={() => {
                  setHistory((h) => [...h, state]);
                  setState(future[0]);
                  setFuture((f) => f.slice(1));
                }}
              >
                <Redo2 size={17} />
              </button>
              <button
                className="icon-button"
                title="Reset style"
                disabled={locked}
                onClick={() =>
                  patch({ ...defaultState, ...style.content_json })
                }
              >
                <RotateCcw size={17} />
              </button>
              <span className="toolbar-divider" />
              <button
                className={
                  "icon-button editor-favorite " + (favorite ? "saved" : "")
                }
                title={favorite ? "Remove from favorites" : "Save to favorites"}
                onClick={toggleFavorite}
              >
                <Heart size={17} fill={favorite ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
          <div className="editor-canvas checkerboard" ref={previewRef}>
            <Preview
              state={state}
              animated={playing}
              glyphs={
                style.metadata.glyphs as Record<string, string> | undefined
              }
            />
            {style.is_premium && !paid && (
              <Link href="/pricing" className="preview-lock">
                <LockKeyhole size={15} />
                Pro style · upgrade to download
              </Link>
            )}
          </div>
          <div className="preview-bottom">
            <span>
              {state.bg.type === "transparent"
                ? "Transparent background"
                : state.fontFamily}
            </span>
            <div>
              <button
                className="icon-button"
                title={playing ? "Pause animation" : "Play animation"}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <span>
                {state.animation.id === "none"
                  ? "Static"
                  : state.animation.id.replaceAll("_", " ")}
              </span>
            </div>
            <span>
              {style.kind === "3d-text" ? "PNG / GIF / SVG" : "PNG / GIF"}
            </span>
          </div>
        </section>
        <section className="controls-pane">
          <nav className="editor-tabs" aria-label="Editor panels">
            {tabs.map((t) => (
              <button
                key={t.id}
                title={t.label}
                className={tab === t.id ? "active" : ""}
                onClick={() => setTab(t.id)}
              >
                <t.icon size={19} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="editor-controls">
            {(tab !== "text" || locked) && (
              <div className="panel-heading">
                {tab !== "text" && (
                  <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
                )}
                {locked && (
                  <span className="muted">
                    <LockKeyhole size={14} />
                    Locked style
                  </span>
                )}
              </div>
            )}
            <fieldset disabled={locked && tab !== "export"}>
              {tab === "text" && (
                <>
                  <label className="field">
                    <span>Your text</span>
                    <textarea
                      className="editor-textarea"
                      rows={3}
                      value={state.text}
                      onChange={(e) => patch({ text: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Font family</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      {style.kind !== "ai" && (
                        <FontPickerPopup
                          fontName={state.fontFamily}
                          options={fontOptions}
                          previewText={state.text.split("\n")[0]}
                          libraryFonts={libraryFonts}
                          onSelect={(fontFamily) => {
                            const local = localFonts.find(
                              (font) => font.name === fontFamily,
                            );
                            const library = libraryFonts.find(
                              (font) => font.name === fontFamily,
                            );
                            patch({
                              fontFamily,
                              fontBase64: local?.dataUrl,
                              fontAssetId: library?.id,
                            });
                          }}
                          onUpload={() => fontFileInput.current?.click()}
                        />
                      )}
                      {style.kind === "ai" && (
                        <select
                          value={state.fontFamily}
                          onChange={(e) => {
                            const fontFamily = e.target.value;
                            const local = localFonts.find(
                              (font) => font.name === fontFamily,
                            );
                            const library = libraryFonts.find(
                              (font) => font.name === fontFamily,
                            );
                            patch({
                              fontFamily,
                              fontBase64: local?.dataUrl,
                              fontAssetId: library?.id,
                            });
                          }}
                        >
                          {fontOptions.map((f) => (
                            <option key={f}>{f}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </label>
                  <label
                    className="text-upload"
                    style={{ display: style.kind === "ai" ? undefined : "none" }}
                  >
                    {style.kind === "ai" && (
                      <>
                        <Upload size={14} />
                        Upload font
                        <small>TTF / OTF / WOFF / WOFF2</small>
                      </>
                    )}
                    <input
                      ref={fontFileInput}
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          if (file.size > 3000000)
                            throw new Error("Font must be under 3 MB.");
                          const name = file.name
                            .replace(/\.[^.]+$/, "")
                            .replace(/[^\w -]/g, "");
                          if (!name) throw new Error("Invalid font name.");
                          const dataUrl = await new Promise<string>(
                            (resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = () =>
                                resolve(String(reader.result));
                              reader.onerror = () => reject(reader.error);
                              reader.readAsDataURL(file);
                            },
                          );
                          const font = new FontFace(
                            name,
                            await file.arrayBuffer(),
                          );
                          await font.load();
                          document.fonts.add(font);
                          setLocalFonts((current) => [
                            ...current.filter((item) => item.name !== name),
                            { name, dataUrl },
                          ]);
                          patch({
                            fontFamily: name,
                            fontBase64: dataUrl,
                            fontAssetId: undefined,
                          });
                          toast(
                            "Font loaded. PNG and GIF downloads will use this font.",
                          );
                        } catch (e) {
                          toast((e as Error).message, true);
                        }
                      }}
                    />
                  </label>
                  <div className="format-row">
                    <div className="segmented">
                      {[
                        { key: "isBold", icon: Bold, label: "Bold" },
                        { key: "isItalic", icon: Italic, label: "Italic" },
                        {
                          key: "isUnderline",
                          icon: Underline,
                          label: "Underline",
                        },
                      ].map(({ key, icon: Icon, label }) => (
                        <button
                          key={key}
                          title={label}
                          className={
                            state[key as keyof EditorState] ? "active" : ""
                          }
                          onClick={() =>
                            patch({ [key]: !state[key as keyof EditorState] })
                          }
                        >
                          <Icon size={17} />
                        </button>
                      ))}
                    </div>
                    <div className="segmented">
                      {[
                        { value: "left", icon: AlignLeft },
                        { value: "center", icon: AlignCenter },
                        { value: "right", icon: AlignRight },
                      ].map(({ value, icon: Icon }) => (
                        <button
                          key={value}
                          title={"Align " + value}
                          className={state.align === value ? "active" : ""}
                          onClick={() => patch({ align: value })}
                        >
                          <Icon size={17} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="control-divider" />
                  <div className="text-transform-grid">
                    <Range
                      label="Letter spacing"
                      value={state.letterSpacing}
                      min={-20}
                      max={60}
                      onChange={(v) => patch({ letterSpacing: v })}
                    />
                    <Range
                      label="Line height"
                      value={state.lineHeight}
                      min={0.5}
                      max={2.5}
                      step={0.05}
                      onChange={(v) => patch({ lineHeight: v })}
                    />
                    <Range
                      label="Rotation"
                      value={state.rotation}
                      min={-180}
                      max={180}
                      unit="°"
                      onChange={(v) => patch({ rotation: v })}
                    />
                    <Range
                      label="Curve"
                      value={state.curve}
                      min={-100}
                      max={100}
                      onChange={(v) => patch({ curve: v })}
                    />
                    <Range
                      label="Zigzag"
                      value={state.zigzag}
                      min={-100}
                      max={100}
                      onChange={(v) => patch({ zigzag: v })}
                    />
                    <Range
                      label="Wave"
                      value={state.wave}
                      onChange={(v) => patch({ wave: v })}
                    />
                  </div>
                </>
              )}
              {tab === "fill" && (
                <FillBuilder
                  value={state.fill}
                  showPresets={false}
                  onChange={(fill) => patch({ fill })}
                />
              )}
              {tab === "layers" && (
                <>
                  <div className="layer-add">
                    {[
                      { type: "3d", icon: Box },
                      { type: "stroke", icon: Square },
                      { type: "outer_wrap", icon: Layers },
                      { type: "shadow", icon: Cloud },
                      { type: "inner_shadow", icon: Moon },
                    ].map((l) => (
                      <button
                        className="button"
                        key={l.type}
                        title={"Add " + layerLabel(l.type)}
                        disabled={state.layers.length >= 12}
                        onClick={() => {
                          const id = Date.now();
                          setOpenLayerId(id);
                          patch({
                            layers: [
                              ...state.layers,
                              {
                                ...baseFill,
                                id,
                                layerType: l.type,
                                enabled: true,
                                size: l.type === "inner_shadow" ? 0 : 15,
                                width:
                                  l.type === "stroke" || l.type === "outer_wrap"
                                    ? 5
                                    : 0,
                                angle: 110,
                                color: "#a74432",
                                blur: 10,
                                offsetX: l.type === "inner_shadow" ? 5 : 8,
                                offsetY: l.type === "inner_shadow" ? 5 : 8,
                              },
                            ],
                          });
                        }}
                      >
                        <l.icon size={16} />
                        <span>{layerLabel(l.type)}</span>
                      </button>
                    ))}
                  </div>
                  {state.layers.length === 0 && (
                    <p className="muted">No layers yet.</p>
                  )}
                  {state.layers.map((l, i) => (
                    <details
                      className="layer-item"
                      key={l.id}
                      open={l.id === openLayerId || i === 0}
                    >
                      <summary>
                        <Layers size={15} />
                        {layerLabel(l.layerType)}
                        <div className="layer-meta">
                          <div className="layer-actions">
                            <button
                              title="Toggle layer"
                              className="icon-button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                layerPatch(l.id, { enabled: !l.enabled });
                              }}
                            >
                              {l.enabled ? (
                                <Eye size={16} />
                              ) : (
                                <EyeOff size={16} />
                              )}
                            </button>
                            <button
                              title="Move up"
                              className="icon-button"
                              disabled={!i}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const ls = [...state.layers];
                                [ls[i], ls[i - 1]] = [ls[i - 1], ls[i]];
                                patch({ layers: ls });
                              }}
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              title="Move down"
                              className="icon-button"
                              disabled={i === state.layers.length - 1}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const ls = [...state.layers];
                                [ls[i], ls[i + 1]] = [ls[i + 1], ls[i]];
                                patch({ layers: ls });
                              }}
                            >
                              <ArrowDown size={16} />
                            </button>
                            <button
                              title="Delete layer"
                              className="icon-button danger"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                patch({
                                  layers: state.layers.filter(
                                    (x) => x.id !== l.id,
                                  ),
                                });
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <span className="layer-number">#{i + 1}</span>
                        </div>
                      </summary>
                      {l.layerType === "3d" && (
                        <div className="layer-control-pair">
                          <Range
                            label="Depth"
                            value={l.size}
                            max={80}
                            onChange={(v) => layerPatch(l.id, { size: v })}
                          />
                          <Range
                            label="Depth angle"
                            value={l.angle}
                            max={360}
                            onChange={(v) => layerPatch(l.id, { angle: v })}
                          />
                        </div>
                      )}
                      {!(
                        ["stroke", "outer_wrap", "3d"].includes(l.layerType) ||
                        l.layerType.includes("shadow")
                      ) && (
                        <Range
                          label="Size"
                          value={l.size}
                          max={80}
                          onChange={(v) => layerPatch(l.id, { size: v })}
                        />
                      )}
                      {!["3d", "stroke", "outer_wrap"].includes(l.layerType) &&
                        !l.layerType.includes("shadow") && (
                          <Range
                            label="Stroke width"
                            value={l.width}
                            max={30}
                            onChange={(v) => layerPatch(l.id, { width: v })}
                          />
                        )}
                      {["3d", "stroke", "outer_wrap"].includes(l.layerType) && (
                        <div className="layer-control-pair">
                          <Range
                            label="Stroke width"
                            value={l.width}
                            max={30}
                            onChange={(v) => layerPatch(l.id, { width: v })}
                          />
                          <Range
                            label="Opacity"
                            value={l.opacity}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={(v) => layerPatch(l.id, { opacity: v })}
                          />
                        </div>
                      )}
                      {l.layerType.includes("shadow") && (
                        <>
                          <div className="layer-control-pair">
                            <Range
                              label="Size"
                              value={l.size}
                              max={80}
                              onChange={(v) => layerPatch(l.id, { size: v })}
                            />
                            <Range
                              label="Blur"
                              value={l.blur || 0}
                              max={50}
                              onChange={(v) => layerPatch(l.id, { blur: v })}
                            />
                          </div>
                          <div className="layer-control-pair">
                            <Range
                              label="X offset"
                              value={l.offsetX || 0}
                              min={-80}
                              max={80}
                              onChange={(v) => layerPatch(l.id, { offsetX: v })}
                            />
                            <Range
                              label="Y offset"
                              value={l.offsetY || 0}
                              min={-80}
                              max={80}
                              onChange={(v) => layerPatch(l.id, { offsetY: v })}
                            />
                          </div>
                        </>
                      )}
                      <FillBuilder
                        value={l}
                        showPresets={false}
                        allowExtruded={l.layerType === "3d"}
                        hideOpacity={["3d", "stroke", "outer_wrap"].includes(
                          l.layerType,
                        )}
                        onChange={(f) => layerPatch(l.id, f)}
                      />
                    </details>
                  ))}
                </>
              )}
              {tab === "background" && (
                <>
                  <FillBuilder
                    value={state.bg}
                    background
                    onChange={(bg) => patch({ bg })}
                  />
                  <div className="control-divider" />
                  <BackgroundQuickChoices
                    value={state.bg}
                    onChange={(bg) => patch({ bg })}
                  />
                </>
              )}
              {tab === "animate" && (
                <>
                  <Range
                    label="Speed"
                    value={state.animation.speed}
                    min={0.1}
                    max={3}
                    step={0.1}
                    unit="×"
                    onChange={(v) =>
                      patch({ animation: { ...state.animation, speed: v } })
                    }
                  />
                  <div className="animations-grid">
                    {animations.map(
                      (a: { id: string; n: string }, i: number) => (
                        <button
                          key={a.id}
                          className={
                            state.animation.id === a.id ? "active" : ""
                          }
                          onClick={() => {
                            if (i > 10 && !paid) {
                              toast("This animation is included in Pro.");
                              return;
                            }
                            setPlaying(a.id !== "none");
                            setFormat(
                              format === "svg"
                                ? "svg"
                                : a.id === "none"
                                  ? "png"
                                  : "gif",
                            );
                            if (
                              format !== "svg" &&
                              a.id !== "none" &&
                              quality > 1920
                            )
                              setQuality(768);
                            patch({
                              animation: { ...state.animation, id: a.id },
                            });
                          }}
                        >
                          {i > 10 && !paid ? (
                            <LockKeyhole size={15} />
                          ) : (
                            <Film size={15} />
                          )}
                          <span>{a.n}</span>
                        </button>
                      ),
                    )}
                  </div>
                </>
              )}
              {tab === "export" && (
                <>
                  <span className="field-label">File format</span>
                  <div className="segmented wide">
                    {(style.kind === "3d-text"
                      ? ["png", "gif", "svg"]
                      : ["png", "gif"]
                    ).map((f) => (
                      <button
                        key={f}
                        className={format === f ? "active" : ""}
                        disabled={isExportLocked(
                          style.kind,
                          paid,
                          f,
                          f === "gif" ? 768 : 1280,
                        )}
                        onClick={() => {
                          setFormat(f);
                          setQuality(f === "gif" ? 768 : 1280);
                        }}
                      >
                        {f.toUpperCase()}
                        {!paid &&
                          (f === "svg" ||
                            (f === "gif" && style.kind !== "3d-text")) && (
                            <LockKeyhole size={12} />
                          )}
                      </button>
                    ))}
                  </div>
                  <label className="field">
                    <span>Aspect ratio</span>
                    <select
                      value={ratio}
                      onChange={(e) => setRatio(e.target.value)}
                    >
                      {["original", "1:1", "16:9", "9:16", "2:1", "1:2"].map(
                        (r) => (
                          <option key={r}>{r}</option>
                        ),
                      )}
                    </select>
                  </label>
                  {format !== "svg" && (
                    <>
                      <span className="field-label">Export quality</span>
                      <div className="quality-grid">
                        {(format === "gif"
                          ? [
                              { v: 768, n: "Small" },
                              { v: 960, n: "Medium" },
                              { v: 1280, n: "Large" },
                              { v: 1920, n: "HD" },
                            ]
                          : [
                              { v: 1280, n: "Standard" },
                              { v: 3840, n: "4K" },
                              { v: 7680, n: "8K" },
                              { v: 8192, n: "MAX" },
                            ]
                        ).map((q) => (
                          <button
                            className={quality === q.v ? "active" : ""}
                            key={q.v}
                            disabled={isExportLocked(
                              style.kind,
                              paid,
                              format,
                              q.v,
                            )}
                            onClick={() => setQuality(q.v)}
                          >
                            <strong>
                              {q.n}{" "}
                              {isExportLocked(
                                style.kind,
                                paid,
                                format,
                                q.v,
                              ) && <LockKeyhole size={12} />}
                            </strong>
                            <small>{q.v}px</small>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <button
                    className="button accent full"
                    disabled={
                      busy || isExportLocked(style.kind, paid, format, quality)
                    }
                    onClick={download}
                  >
                    <Download size={17} />
                    {busy
                      ? "Rendering your download..."
                      : "Download " + format.toUpperCase()}
                  </button>
                  <div className="control-divider" />
                  <span className="field-label">Project data</span>
                  <div className="two-fields project-data-actions">
                    <button
                      className="button"
                      onClick={() =>
                        saveBlob(
                          new Blob([JSON.stringify(state, null, 2)], {
                            type: "application/json",
                          }),
                          style.slug + ".json",
                        )
                      }
                    >
                      <Download size={15} />
                      Save JSON
                    </button>
                    <label className="button file-button">
                      <Upload size={15} />
                      Load JSON
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={async (e) => {
                          try {
                            const f = e.target.files?.[0];
                            if (f) {
                              if (f.size > 8000000)
                                throw new Error("Project must be under 8 MB.");
                              patch(
                                editorSchema.parse(
                                  JSON.parse(await f.text()),
                                ) as EditorState,
                              );
                              toast("Project loaded.");
                            }
                          } catch {
                            toast("Invalid project JSON.", true);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <button
                    className="button full project-save-button"
                    onClick={saveProject}
                  >
                    <Save size={15} />
                    Save to my project
                  </button>
                </>
              )}
            </fieldset>
          </div>
          {tab !== "export" && (
            <div className="controls-bottom">
              <span>
                {style.is_premium
                  ? "Pro collection"
                  : "Make something original."}
              </span>
              <button
                className="button accent"
                onClick={() => setTab("export")}
              >
                <Download size={16} />
                Export
              </button>
            </div>
          )}
        </section>
      </div>
      <ShareButtons style={style} />
    </main>
  );
}
export function ShareButtons({ style }: { style: Style }) {
  const { toast } = useApp();
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);
  const u = encodeURIComponent(url),
    t = encodeURIComponent(style.title + " - " + style.description),
    image = encodeURIComponent(
      style.image_url
        ? new URL(style.image_url, url || "http://localhost").href
        : new URL("/previews/" + style.slug + ".png", url || "http://localhost")
            .href,
    );
  const shares = [
    {
      name: "Pinterest",
      icon: Pin,
      href: `https://pinterest.com/pin/create/button/?url=${u}&media=${image}&description=${t}`,
    },
    {
      name: "Facebook",
      icon: Globe,
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?text=${t}%20${u}`,
    },
    {
      name: "Reddit",
      icon: AtSign,
      href: `https://www.reddit.com/submit?url=${u}&title=${t}`,
    },
    {
      name: "X",
      icon: XIcon,
      href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
    },
    {
      name: "LinkedIn",
      icon: BriefcaseBusiness,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    },
    {
      name: "Telegram",
      icon: Send,
      href: `https://t.me/share/url?url=${u}&text=${t}`,
    },
  ];
  return (
    <section className="share-row">
      <span>
        <Share2 size={16} />
        Share this style
      </span>
      <div>
        {shares.map((s) => (
          <a
            href={s.href}
            key={s.name}
            target="_blank"
            rel="noopener noreferrer"
            title={"Share on " + s.name}
          >
            <s.icon size={17} />
            <span>{s.name}</span>
          </a>
        ))}
        <button
          title="Copy link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast("Link copied.");
            } catch {
              toast("Could not access clipboard.", true);
            }
          }}
        >
          <LinkIcon size={17} />
          <span>Copy link</span>
        </button>
      </div>
    </section>
  );
}
function XIcon({ size = 17 }: { size?: number }) {
  return (
    <span style={{ fontSize: size, fontWeight: 600, lineHeight: 1 }}>X</span>
  );
}
