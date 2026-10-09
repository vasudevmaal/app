"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronRight,
  Download,
  Film,
  Heart,
  ImageIcon,
  Italic,
  LockKeyhole,
  Layers,
  PaintBucket,
  Pause,
  PenLine,
  Play,
  Redo2,
  RotateCcw,
  Search,
  Save,
  Star,
  Shapes,
  Square,
  Sun,
  Type,
  Underline,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import type { Style } from "@/lib/types";
import type { FontAssetSummary } from "@/lib/font-library";
import {
  buttonIcons,
  buttonStateSchema,
  defaultButtonState,
  type ButtonState,
} from "@/lib/button";
import { api, saveBlob } from "@/lib/client";
import { fonts, Range, ShareButtons } from "@/components/editor";
import { GradientStops, PresetPicker } from "@/components/presets";
import { useApp } from "@/components/providers";
import { ButtonPreview } from "./preview";
import css from "./editor.module.css";
import { PaintPicker } from "./color-picker";

const tabs = [
  { id: "text", label: "Text", icon: Type },
  { id: "layers", label: "Layers", icon: Layers },
  { id: "icons", label: "Icons", icon: Shapes },
  { id: "background", label: "Background", icon: ImageIcon },
  { id: "animate", label: "Animate", icon: Film },
  { id: "export", label: "Export", icon: Download },
] as const;
type Tab = (typeof tabs)[number]["id"];
type Format = "png" | "gif" | "svg";

const wholeAnimations = [
  ["none", "None"],
  ["pulse", "Pulse"],
  ["breathe", "Breathe"],
  ["heartbeat", "Heartbeat"],
  ["float", "Float"],
  ["bounce", "Bounce"],
  ["swing", "Swing"],
  ["shake", "Shake"],
  ["wobble", "Wobble"],
  ["jump", "Jump"],
  ["wave", "Wave"],
  ["ripple", "Ripple"],
  ["flip_x", "Flip X"],
  ["flip_y", "Flip Y"],
  ["squeeze", "Squeeze"],
  ["spin", "Spin"],
  ["roll", "Roll"],
  ["glitch", "Glitch"],
  ["hue_rotate", "Hue Rotate"],
  ["disco", "Disco"],
  ["neon_flicker", "Neon Flicker"],
  ["zoom_in", "Zoom In"],
] as const;
const textAnimations = [
  ["none", "None"],
  ["wave", "Wave"],
  ["float", "Float"],
  ["bounce", "Bounce"],
  ["swing", "Swing"],
  ["shake", "Shake"],
  ["letter_spin", "Letter Spin"],
  ["letter_swing", "Letter Swing"],
  ["letter_bounce", "Letter Bounce"],
  ["letter_scale", "Letter Scale"],
  ["letter_shake", "Letter Shake"],
  ["letter_orbit", "Letter Orbit"],
] as const;

function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="color-field">
      <span>{label}</span>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <code>{value.toUpperCase()}</code>
    </label>
  );
}
function fileData(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
}

export function ButtonEditor({
  style,
  initialState,
}: {
  style: Style;
  initialState: ButtonState;
}) {
  const { user, toast } = useApp();
  const [state, setState] = useState(() =>
    buttonStateSchema.parse({
      ...defaultButtonState,
      ...initialState,
      iconSize: initialState.fontSize ?? defaultButtonState.fontSize,
      wholeAnimation: initialState.wholeAnimation ?? initialState.animation,
      textAnimation: initialState.textAnimation ?? "none",
      backgroundType:
        initialState.backgroundType ??
        (initialState.backgroundTransparent === false
          ? "solid"
          : "transparent"),
    }),
  );
  const [tab, setTab] = useState<Tab>("text");
  const [history, setHistory] = useState<ButtonState[]>([]);
  const [future, setFuture] = useState<ButtonState[]>([]);
  const [playing, setPlaying] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [quality, setQuality] = useState(1280);
  const [format, setFormat] = useState<Format>("png");
  const [ratio, setRatio] = useState("original");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [libraryFonts, setLibraryFonts] = useState<FontAssetSummary[]>([]);
  const [localFonts, setLocalFonts] = useState<
    { name: string; dataUrl: string }[]
  >([]);
  const [fontRevision, setFontRevision] = useState(0);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [favoriteFonts, setFavoriteFonts] = useState<string[]>([]);
  const [showFavoriteFonts, setShowFavoriteFonts] = useState(false);
  const [loginRequiredOpen, setLoginRequiredOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState("");
  const [fontPreviewsLoading, setFontPreviewsLoading] = useState(false);
  const [animationTab, setAnimationTab] = useState<"button" | "text">("button");
  const previewRef = useRef<HTMLDivElement>(null);
  const fontDialogRef = useRef<HTMLDialogElement>(null);
  const fontFileRef = useRef<HTMLInputElement>(null);
  const locked = style.is_locked;
  const wholeAnimation = state.wholeAnimation ?? state.animation;
  const textAnimation = state.textAnimation ?? "none";
  const patch = (values: Partial<ButtonState>) => {
    if (locked) return;
    setHistory((h) => [...h.slice(-29), state]);
    setFuture([]);
    setState((current) => ({ ...current, ...values }));
    setMessage("");
  };
  useEffect(() => {
    let active = true;
    fetch("/api/font-library")
      .then(async (response) => {
        if (!response.ok) throw new Error("Font library unavailable.");
        const data: FontAssetSummary[] = await response.json();
        if (!active) return;
        setLibraryFonts(data);
        setState((current) => {
          const saved = data.find((font) => font.name === current.fontFamily);
          return saved && !current.fontBase64 && !current.fontAssetId
            ? { ...current, fontAssetId: saved.id }
            : current;
        });
      })
      .catch(() => {});
    if (user)
      fetch("/api/favorites")
        .then((r) => r.json())
        .then((data) => {
          if (active && Array.isArray(data))
            setFavorite(data.some((item) => item.id === style.id));
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [style.id, user]);
  useEffect(() => {
    const source =
      state.fontBase64 ||
      (state.fontAssetId
        ? `/api/font-library?id=${encodeURIComponent(state.fontAssetId)}`
        : "");
    if (!source) return;
    let active = true;
    fetch(source)
      .then(async (r) => {
        if (!r.ok) throw new Error("Font could not be loaded.");
        const face = await new FontFace(
          state.fontFamily,
          await r.arrayBuffer(),
        ).load();
        if (active) {
          document.fonts.add(face);
          setFontRevision((v) => v + 1);
        }
      })
      .catch((error) => {
        if (active) toast(error.message, true);
      });
    return () => {
      active = false;
    };
  }, [state.fontFamily, state.fontAssetId, state.fontBase64, toast]);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `excpix-button-${style.slug}`,
          JSON.stringify(state),
        );
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [state, style.slug]);
  const fontOptions = [
    ...new Set([
      ...fonts,
      ...libraryFonts.map((f) => f.name),
      ...localFonts.map((f) => f.name),
      state.fontFamily,
    ]),
  ];
  useEffect(() => {
    if (!fontPickerOpen) return;
    let active = true;
    setFontPreviewsLoading(true);
    Promise.all(
      fontOptions.map(async (family) => {
        try {
          const local = localFonts.find((font) => font.name === family);
          const library = libraryFonts.find((font) => font.name === family);
          if (local || !library) {
            await document.fonts.load(`700 24px "${family}"`);
            return;
          }
          const loaded = Array.from(document.fonts).some(
            (face) =>
              face.family.replace(/["']/g, "") === family &&
              face.status === "loaded",
          );
          if (!loaded) {
            const response = await fetch(
              `/api/font-library?id=${encodeURIComponent(library.id)}`,
            );
            if (!response.ok) return;
            const face = await new FontFace(
              family,
              await response.arrayBuffer(),
            ).load();
            document.fonts.add(face);
          }
        } catch {}
      }),
    ).finally(() => {
      if (active) setFontPreviewsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fontPickerOpen]);
  useEffect(() => {
    if (!fontPickerOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      const dialog = fontDialogRef.current;
      if (!dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    return () =>
      document.removeEventListener("pointerdown", dismissOutside, true);
  }, [fontPickerOpen]);
  async function uploadFont(file: File) {
    try {
      if (file.size > 3000000) throw new Error("Font must be under 3 MB.");
      if (!/\.(ttf|otf|woff2?)$/i.test(file.name))
        throw new Error("Use TTF, OTF, WOFF or WOFF2.");
      const name = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^\w -]/g, "")
        .slice(0, 80);
      if (!name) throw new Error("Invalid font name.");
      const face = await new FontFace(name, await file.arrayBuffer()).load();
      document.fonts.add(face);
      const dataUrl = await fileData(file);
      setLocalFonts((current) => [
        ...current.filter((f) => f.name !== name),
        { name, dataUrl },
      ]);
      patch({ fontFamily: name, fontBase64: dataUrl, fontAssetId: undefined });
      fontDialogRef.current?.close();
      toast("Font loaded.");
    } catch (error) {
      toast((error as Error).message, true);
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
    } catch (error) {
      toast((error as Error).message, true);
    }
  }
  function toggleFontFavorite(font: string) {
    if (!user) {
      setLoginRequiredOpen(true);
      return;
    }
    const isFavorite = favoriteFonts.includes(font);
    void api(
      "font-favorites",
      { font_name: font },
      isFavorite ? "DELETE" : "POST",
    )
      .then(() => {
        setFavoriteFonts((current) =>
          isFavorite
            ? current.filter((item) => item !== font)
            : current.includes(font)
              ? current
              : [...current, font],
        );
        toast(isFavorite ? "Removed from favorite fonts." : "Font saved to favorites.");
      })
      .catch((error) => toast((error as Error).message, true));
  }
  async function download() {
    setBusy(true);
    try {
      const canvas = previewRef.current?.querySelector("canvas");
      const response = await fetch("/api/button-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style_id: style.id,
          content_json: state,
          format,
          ratio,
          quality: format === "svg" ? 1280 : quality,
          previewAspect: canvas?.height ? canvas.width / canvas.height : 2,
        }),
      });
      if (!response.ok)
        throw new Error((await response.json()).error || "Download failed.");
      saveBlob(await response.blob(), `${style.slug}.${format}`);
      setMessage("Your download is ready.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function saveDraft() {
    try {
      localStorage.setItem(
        `excpix-button-${style.slug}`,
        JSON.stringify(state),
      );
      toast("Button saved on this device.");
    } catch {
      toast("Could not save on this device. Use Save JSON instead.", true);
    }
  }
  const range = (
    key: keyof ButtonState,
    label: string,
    min: number,
    max: number,
    step = 1,
    unit = "",
  ) => (
    <Range
      label={label}
      value={Number(state[key])}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={(value) =>
        patch(
          key === "fontSize"
            ? { fontSize: value, iconSize: value }
            : { [key]: value },
        )
      }
    />
  );
  const textPaintPicker = (
    <PaintPicker
      label="Text color"
      value={{
        type: state.textFillType,
        color: state.textColor,
        stops: state.textStops,
        angle: state.textAngle,
        opacity: state.textOpacity,
      }}
      onChange={(paint) =>
        patch({
          textFillType: paint.type,
          textColor: paint.color,
          textStops: paint.stops,
          textAngle: paint.angle,
          textOpacity: paint.opacity,
        })
      }
    />
  );

  return (
    <main className="editor-page main-width">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight size={13} />
        <Link href="/button">Button</Link>
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
      <div className={`editor-workspace ${css.workspace}`}>
        <section className="preview-pane" aria-label="Button preview">
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
                onClick={() => patch(buttonStateSchema.parse(initialState))}
              >
                <RotateCcw size={17} />
              </button>
              <span className="toolbar-divider" />
              <button
                className={`icon-button editor-favorite ${favorite ? "saved" : ""}`}
                title={favorite ? "Remove from favorites" : "Save to favorites"}
                onClick={() => void toggleFavorite()}
              >
                <Heart size={17} fill={favorite ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
          <div className="editor-canvas checkerboard" ref={previewRef}>
            <ButtonPreview
              fontRevision={fontRevision}
              state={state}
              playing={playing}
            />
          </div>
          <div className="preview-bottom">
            <span>
              {state.backgroundTransparent
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
                {wholeAnimation === "none" && textAnimation === "none"
                  ? "Static"
                  : `${wholeAnimation === "none" ? "" : wholeAnimation}${wholeAnimation !== "none" && textAnimation !== "none" ? " + " : ""}${textAnimation === "none" ? "" : textAnimation}`}
              </span>
            </div>
            <span>PNG / GIF / SVG</span>
          </div>
        </section>
        <section className="controls-pane" aria-label="Button settings">
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
            {tab !== "text" && (
              <div className="panel-heading">
                <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
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
                      maxLength={2000}
                      value={state.text}
                      onChange={(e) => patch({ text: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Font family</span>
                    <button
                      type="button"
                      className={css.fontPickerTrigger}
                      onClick={() => {
                        if (user) {
                          void api<string[]>("font-favorites")
                            .then(setFavoriteFonts)
                            .catch((error) =>
                              toast((error as Error).message, true),
                            );
                        } else {
                          setFavoriteFonts([]);
                        }
                        setLoginRequiredOpen(false);
                        fontDialogRef.current?.showModal();
                        setFontPickerOpen(true);
                      }}
                    >
                      <span>{state.fontFamily}</span>
                      <Type size={16} aria-hidden="true" />
                    </button>
                  </label>
                  <div className="format-row">
                    <div className="segmented">
                      <button
                        title="Bold"
                        aria-pressed={state.fontWeight >= 700}
                        className={state.fontWeight >= 700 ? "active" : ""}
                        onClick={() =>
                          patch({
                            fontWeight: state.fontWeight >= 700 ? 400 : 700,
                          })
                        }
                      >
                        <Bold size={17} />
                      </button>
                      <button
                        title="Italic"
                        aria-pressed={state.isItalic}
                        className={state.isItalic ? "active" : ""}
                        onClick={() => patch({ isItalic: !state.isItalic })}
                      >
                        <Italic size={17} />
                      </button>
                      <button
                        title="Underline"
                        aria-pressed={state.isUnderline}
                        className={state.isUnderline ? "active" : ""}
                        onClick={() =>
                          patch({ isUnderline: !state.isUnderline })
                        }
                      >
                        <Underline size={17} />
                      </button>
                    </div>
                    <div className="segmented">
                      {(
                        [
                          ["left", AlignLeft],
                          ["center", AlignCenter],
                          ["right", AlignRight],
                        ] as const
                      ).map(([align, Icon]) => (
                        <button
                          key={align}
                          title={`Align ${align}`}
                          aria-pressed={state.align === align}
                          className={state.align === align ? "active" : ""}
                          onClick={() => patch({ align })}
                        >
                          <Icon size={17} />
                        </button>
                      ))}
                    </div>
                  </div>
                  {textPaintPicker}
                  <div className="control-divider" />
                  <div className="text-transform-grid">
                    {range("fontSize", "Font size", 10, 120)}
                    {range("fontWeight", "Font weight", 300, 900, 100)}
                    {range("letterSpacing", "Letter spacing", -20, 60, 0.1)}
                    {range("lineHeight", "Line height", 0.5, 2.5, 0.05)}
                    {range("rotation", "Rotation", -180, 180, 1, "°")}
                    {range("curve", "Curve", -100, 100)}
                    {range("zigzag", "Zigzag", -100, 100)}
                    {range("wave", "Wave", 0, 100)}
                  </div>
                </>
              )}
              {tab === "layers" && (
                <>
                  <details className="layer-item">
                    <summary>
                      <PaintBucket size={15} />
                      Fill
                    </summary>
                    <PaintPicker
                      label="Button fill"
                      value={{
                        type: state.fillType,
                        color: state.fillStart,
                        stops: state.fillStops,
                        angle: state.fillAngle,
                        opacity: state.fillOpacity,
                      }}
                      onChange={(paint) =>
                        patch({
                          fillType: paint.type,
                          fillStart: paint.color,
                          fillStops: paint.stops,
                          fillEnd: paint.stops[paint.stops.length - 1].color,
                          fillAngle: paint.angle,
                          fillOpacity: paint.opacity,
                        })
                      }
                    />
                    {textPaintPicker}
                  </details>
                </>
              )}
              {tab === "icons" && (
                <>
                  <span className="field-label">Icon settings</span>
                  {state.icon !== "none" && (
                    <div className={css.iconSettings}>
                      <label className="field">
                        <span>Icon position</span>
                        <select
                          value={state.iconPosition}
                          onChange={(e) =>
                            patch({
                              iconPosition: e.target
                                .value as ButtonState["iconPosition"],
                            })
                          }
                        >
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </label>
                      {range("iconGap", "Icon gap", 0, 40)}
                      <Color
                        label="Icon color"
                        value={state.iconColor}
                        onChange={(iconColor) => patch({ iconColor })}
                      />
                    </div>
                  )}
                  <span className="field-label">Choose icon</span>
                  <div
                    className={css.iconPicker}
                    role="radiogroup"
                    aria-label="Choose icon"
                  >
                    {buttonIcons.map(({ value, label, glyph }) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={state.icon === value}
                        aria-label={label}
                        className={
                          state.icon === value
                            ? css.iconChoiceActive
                            : css.iconChoice
                        }
                        onClick={() => patch({ icon: value })}
                      >
                        <span aria-hidden="true">{glyph}</span>
                        <small>{label}</small>
                      </button>
                    ))}
                  </div>
                  <label className="button dashed file-button">
                    <Upload size={14} />
                    Upload your own icon
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        try {
                          const iconDataUrl = await fileData(file);
                          patch({ icon: "custom", iconDataUrl });
                        } catch {
                          toast("Icon could not be read.", true);
                        }
                      }}
                    />
                  </label>
                </>
              )}
              {tab === "layers" && (
                <>
                  <details className="layer-item">
                    <summary>
                      <Square size={15} />
                      Shape
                    </summary>
                    <div className="layer-control-pair">
                      {range("paddingX", "Padding X", 0, 100)}
                      {range("paddingY", "Padding Y", 0, 60)}
                    </div>
                    {range("radius", "Corner radius", 0, 100)}
                  </details>
                  <details className="layer-item">
                    <summary>
                      <PenLine size={15} />
                      Stroke
                    </summary>
                    {range("borderWidth", "Stroke width", 0, 20)}
                    <Color
                      label="Stroke color"
                      value={state.borderColor}
                      onChange={(borderColor) => patch({ borderColor })}
                    />
                  </details>
                  <details className="layer-item">
                    <summary>
                      <Sun size={15} />
                      Shadow
                    </summary>
                    <label className="color-field">
                      <span>Enable shadow</span>
                      <input
                        type="checkbox"
                        checked={state.shadowEnabled}
                        onChange={(e) =>
                          patch({ shadowEnabled: e.target.checked })
                        }
                      />
                    </label>
                    {range("shadowBlur", "Blur", 0, 80)}
                    <div className="layer-control-pair">
                      {range("shadowX", "X offset", -50, 50)}
                      {range("shadowY", "Y offset", -50, 50)}
                    </div>
                    {range("shadowOpacity", "Opacity", 0, 1, 0.01)}
                    <Color
                      label="Shadow color"
                      value={state.shadowColor}
                      onChange={(shadowColor) => patch({ shadowColor })}
                    />
                  </details>
                </>
              )}
              {tab === "background" && (
                <>
                  <button
                    type="button"
                    className="button subtle full"
                    onClick={() =>
                      patch({
                        backgroundType: "transparent",
                        backgroundTransparent: true,
                      })
                    }
                  >
                    Transparent
                  </button>
                  <PaintPicker
                    label="Background colors"
                    inline
                    compact
                    value={{
                      type:
                        state.backgroundType === "radial"
                          ? "radial"
                          : state.backgroundType === "gradient"
                            ? "gradient"
                            : "solid",
                      color: state.background,
                      stops: state.backgroundStops || [
                        { color: state.background, pos: 0 },
                        {
                          color: state.backgroundEnd || "#d6e9ef",
                          pos: 100,
                        },
                      ],
                      angle: state.backgroundAngle ?? 135,
                      opacity: state.backgroundOpacity ?? 1,
                    }}
                    onChange={(paint) =>
                      patch({
                        backgroundType: paint.type,
                        backgroundTransparent: false,
                        background: paint.color,
                        backgroundEnd:
                          paint.stops[paint.stops.length - 1]?.color ||
                          state.backgroundEnd,
                        backgroundStops: paint.stops,
                        backgroundAngle: paint.angle,
                        backgroundOpacity: paint.opacity,
                      })
                    }
                  />
                  <div className={css.legacyBackgroundControls}>
                    <label className="field">
                      <span>Background type</span>
                      <select
                        value={
                          state.backgroundType ??
                          (state.backgroundTransparent
                            ? "transparent"
                            : "solid")
                        }
                        onChange={(e) => {
                          const backgroundType = e.target.value as NonNullable<
                            ButtonState["backgroundType"]
                          >;
                          patch({
                            backgroundType,
                            backgroundTransparent:
                              backgroundType === "transparent",
                          });
                        }}
                      >
                        <option value="transparent">Transparent</option>
                        <option value="solid">Solid</option>
                        <option value="gradient">Gradient</option>
                        <option value="radial">Radial</option>
                      </select>
                    </label>
                    {(state.backgroundType ??
                      (state.backgroundTransparent
                        ? "transparent"
                        : "solid")) === "solid" && (
                      <Color
                        label="Background color"
                        value={state.background}
                        onChange={(background) => patch({ background })}
                      />
                    )}
                    {(state.backgroundType === "gradient" ||
                      state.backgroundType === "radial") && (
                      <>
                        <GradientStops
                          stops={
                            state.backgroundStops || [
                              { color: state.background, pos: 0 },
                              {
                                color: state.backgroundEnd || "#d6e9ef",
                                pos: 100,
                              },
                            ]
                          }
                          onChange={(backgroundStops) =>
                            patch({
                              backgroundStops,
                              background:
                                backgroundStops[0]?.color || state.background,
                              backgroundEnd:
                                backgroundStops[backgroundStops.length - 1]
                                  ?.color || state.backgroundEnd,
                            })
                          }
                        />
                        {state.backgroundType === "gradient" &&
                          range(
                            "backgroundAngle",
                            "Gradient angle",
                            0,
                            360,
                            1,
                            "°",
                          )}
                        <PresetPicker
                          type="gradient"
                          expanded
                          label="Background presets"
                          onSelect={(preset) =>
                            patch({
                              backgroundType:
                                preset.gradientType === "radial"
                                  ? "radial"
                                  : "gradient",
                              backgroundTransparent: false,
                              backgroundStops: preset.stops,
                              background:
                                preset.stops[0]?.color || state.background,
                              backgroundEnd:
                                preset.stops[preset.stops.length - 1]?.color ||
                                state.backgroundEnd,
                              backgroundAngle: preset.angle,
                            })
                          }
                        />
                      </>
                    )}
                    {(state.backgroundType ??
                      (state.backgroundTransparent
                        ? "transparent"
                        : "solid")) === "solid" && (
                      <PresetPicker
                        type="color"
                        expanded
                        label="Background colors"
                        onSelect={(preset) =>
                          patch({
                            backgroundType: "solid",
                            backgroundTransparent: false,
                            background: preset.color,
                          })
                        }
                      />
                    )}
                  </div>
                </>
              )}
              {tab === "animate" && (
                <>
                  {range("animationSpeed", "Speed", 0.2, 4, 0.1, "×")}
                  <div className="control-divider" />
                  <div className="segmented wide">
                    <button
                      type="button"
                      className={animationTab === "button" ? "active" : ""}
                      onClick={() => setAnimationTab("button")}
                    >
                      <Film size={15} />
                      Button Animation
                    </button>
                    <button
                      type="button"
                      className={animationTab === "text" ? "active" : ""}
                      onClick={() => setAnimationTab("text")}
                    >
                      <Type size={15} />
                      Text Animation
                    </button>
                  </div>
                  {animationTab === "button" ? (
                    <>
                      <span className="field-label">
                        Whole button animation
                      </span>
                      <div className="animations-grid">
                        {wholeAnimations.map(([animation, label]) => (
                          <button
                            type="button"
                            key={animation}
                            className={
                              wholeAnimation === animation ? "active" : ""
                            }
                            onClick={() => {
                              patch({ wholeAnimation: animation, animation });
                              setPlaying(
                                animation !== "none" ||
                                  textAnimation !== "none",
                              );
                              if (format !== "svg") {
                                setFormat(
                                  animation === "none" &&
                                    textAnimation === "none"
                                    ? "png"
                                    : "gif",
                                );
                                setQuality(
                                  animation === "none" &&
                                    textAnimation === "none"
                                    ? 1280
                                    : 768,
                                );
                              }
                            }}
                          >
                            <Film size={15} />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="field-label">Text animation</span>
                      <div className="animations-grid">
                        {textAnimations.map(([animation, label]) => (
                          <button
                            type="button"
                            key={animation}
                            className={
                              textAnimation === animation ? "active" : ""
                            }
                            onClick={() => {
                              patch({ textAnimation: animation });
                              setPlaying(
                                wholeAnimation !== "none" ||
                                  animation !== "none",
                              );
                              if (format !== "svg") {
                                setFormat(
                                  wholeAnimation === "none" &&
                                    animation === "none"
                                    ? "png"
                                    : "gif",
                                );
                                setQuality(
                                  wholeAnimation === "none" &&
                                    animation === "none"
                                    ? 1280
                                    : 768,
                                );
                              }
                            }}
                          >
                            <Type size={15} />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
              {tab === "export" && (
                <>
                  <span className="field-label">File format</span>
                  <div className="segmented wide">
                    {(["png", "gif", "svg"] as const).map((f) => (
                      <button
                        key={f}
                        className={format === f ? "active" : ""}
                        onClick={() => {
                          setFormat(f);
                          setQuality(f === "gif" ? 768 : 1280);
                        }}
                      >
                        {f.toUpperCase()}
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
                            key={q.v}
                            className={quality === q.v ? "active" : ""}
                            onClick={() => setQuality(q.v)}
                          >
                            <strong>{q.n}</strong>
                            <small>{q.v}px</small>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <button
                    className="button accent full"
                    disabled={busy}
                    onClick={() => void download()}
                  >
                    <Download size={17} />
                    {busy
                      ? "Rendering your download..."
                      : `Download ${format.toUpperCase()}`}
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
                          `${style.slug}.json`,
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
                        accept=".json,application/json"
                        disabled={locked}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          try {
                            if (file.size > 8000000)
                              throw new Error("Project must be under 8 MB.");
                            patch(
                              buttonStateSchema.parse(
                                JSON.parse(await file.text()),
                              ),
                            );
                            toast("Project loaded.");
                          } catch {
                            toast("Invalid button project JSON.", true);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <button
                    className="button full project-save-button"
                    onClick={saveDraft}
                  >
                    <Save size={15} />
                    Save on this device
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
      <dialog
        ref={fontDialogRef}
        className={css.fontDialog}
        aria-label="Choose a font"
        onClose={() => setFontPickerOpen(false)}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const { clientX, clientY } = event;
          if (
            clientX < rect.left ||
            clientX > rect.right ||
            clientY < rect.top ||
            clientY > rect.bottom
          )
            fontDialogRef.current?.close();
        }}
      >
        <header className={css.fontDialogHeader}>
          <div>
            <h2>Choose a font</h2>
            <p>Preview each style with your text.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close font picker"
            onClick={() => fontDialogRef.current?.close()}
          >
            <X size={18} />
          </button>
        </header>
        <div className={css.fontDialogActions}>
          <label className={css.fontSearch}>
            <Search size={15} />
            <input
              type="search"
              aria-label="Search fonts"
              placeholder="Search fonts"
              value={fontSearch}
              onChange={(event) => setFontSearch(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={`button small ${showFavoriteFonts ? "selected" : ""}`}
            aria-pressed={showFavoriteFonts}
            onClick={() => {
              if (!user) {
                setLoginRequiredOpen(true);
                return;
              }
              setShowFavoriteFonts((value) => !value);
            }}
          >
            <Star
              size={14}
              fill={showFavoriteFonts ? "currentColor" : "none"}
            />
            Favorites
          </button>
          <button
            type="button"
            className="button small"
            onClick={() => fontFileRef.current?.click()}
          >
            <Upload size={14} /> Upload font
          </button>
          <input
            ref={fontFileRef}
            className={css.fontFile}
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            aria-label="Upload font file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void uploadFont(file);
            }}
          />
        </div>
        {fontPreviewsLoading && (
          <p className={css.fontLoading} role="status">
            Loading font previews...
          </p>
        )}
        <div className={css.fontGrid}>
          {fontOptions
            .filter((font) => {
              const matchesFavorites =
                !showFavoriteFonts || favoriteFonts.includes(font);
              const matchesSearch = font
                .toLowerCase()
                .includes(fontSearch.trim().toLowerCase());
              return matchesFavorites && matchesSearch;
            })
            .map((font) => (
              <div
                key={font}
                className={`${css.fontCard} ${state.fontFamily === font ? css.fontCardActive : ""}`}
              >
                <button
                  type="button"
                  className={css.fontChoice}
                  aria-label={`Use ${font} font`}
                  aria-pressed={state.fontFamily === font}
                  onClick={() => {
                    patch({
                      fontFamily: font,
                      fontBase64: localFonts.find((item) => item.name === font)
                        ?.dataUrl,
                      fontAssetId: libraryFonts.find(
                        (item) => item.name === font,
                      )?.id,
                    });
                    fontDialogRef.current?.close();
                  }}
                >
                  <span style={{ fontFamily: `"${font}", sans-serif` }}>
                    {state.text.split("\n")[0].slice(0, 22) || "Aa Bb 123"}
                  </span>
                  <small>{font}</small>
                </button>
                <button
                  type="button"
                  className={css.fontFavorite}
                  aria-label={`${favoriteFonts.includes(font) ? "Remove" : "Add"} ${font} ${favoriteFonts.includes(font) ? "from" : "to"} favorites`}
                  aria-pressed={favoriteFonts.includes(font)}
                  title={
                    favoriteFonts.includes(font)
                      ? "Remove favorite"
                      : "Add favorite"
                  }
                  onClick={() => toggleFontFavorite(font)}
                >
                  <Star
                    size={15}
                    fill={
                      favoriteFonts.includes(font) ? "currentColor" : "none"
                    }
                  />
                </button>
              </div>
            ))}
          {fontOptions.filter((font) => {
            const matchesFavorites =
              !showFavoriteFonts || favoriteFonts.includes(font);
            return (
              matchesFavorites &&
              font.toLowerCase().includes(fontSearch.trim().toLowerCase())
            );
          }).length === 0 && (
            <p className={css.fontEmpty}>
              {showFavoriteFonts && favoriteFonts.length === 0
                ? "No favorite fonts yet."
                : "No matching fonts."}
            </p>
          )}
        </div>
        {loginRequiredOpen && (
          <div
            className={css.loginRequiredOverlay}
            onClick={(event) => {
              if (event.target === event.currentTarget)
                setLoginRequiredOpen(false);
            }}
          >
            <section
              className={css.loginRequiredPopup}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="font-login-required-title"
              aria-describedby="font-login-required-description"
            >
              <span className={css.loginRequiredIcon}>
                <LockKeyhole size={19} />
              </span>
              <h3 id="font-login-required-title">Login required</h3>
              <p id="font-login-required-description">
                Sign in to save and access your favorite fonts.
              </p>
              <button
                type="button"
                className="button accent"
                onClick={() => setLoginRequiredOpen(false)}
              >
                Got it
              </button>
            </section>
          </div>
        )}
      </dialog>
      {message && (
        <p className={css.message} role="status">
          {message}
        </p>
      )}
      <ShareButtons style={style} />
    </main>
  );
}
