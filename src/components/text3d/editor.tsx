"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Type,
  Palette,
  Image as ImageIcon,
  LayoutGrid,
  Download,
  Upload,
  Undo2,
  Redo2,
  RotateCcw,
  Scan,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  ChevronRight,
  LoaderCircle,
  X,
  Check,
  Save,
  Heart,
  LockKeyhole,
} from "lucide-react";
import {
  defaultText3D,
  text3dFonts,
  text3dPresets,
  applyText3DPreset,
  type Text3DState,
} from "@/lib/text3d";
import type { Text3DScene, ExportFormat } from "./scene";
import { useApp } from "@/components/providers";
import { api } from "@/lib/client";
import { isExportLocked } from "@/lib/export-access";
import { text3dProjectSchema, type Text3DProject } from "@/lib/text3d-project";
import { PresetPicker } from "@/components/presets";
import css from "./editor.module.css";

const tabs = [
  { id: "text", name: "Text", icon: Type },
  { id: "shape", name: "Shape", icon: Box },
  { id: "material", name: "Material", icon: Palette },
  { id: "scene", name: "Scene", icon: ImageIcon },
  { id: "premade", name: "Premade", icon: LayoutGrid },
  { id: "export", name: "Export", icon: Download },
] as const;
type Tab = (typeof tabs)[number]["id"];

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-field">
      <span>
        {label}
        <output>{Number(value.toFixed(2))}</output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
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
        aria-label={label}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <code>{value.toUpperCase()}</code>
    </label>
  );
}
function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
function saveBlob(url: string, name: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
}

export function Text3DEditor({
  initialProject,
  title = "3D Text Generator",
  description = "Custom 3D lettering, made your way.",
  styleId,
}: {
  initialProject?: Text3DProject;
  title?: string;
  description?: string;
  styleId?: string;
} = {}) {
  const { user, toast } = useApp();
  const paid =
    !!user &&
    (["owner", "admin"].includes(user.role) ||
      (user.plan !== "free" &&
        !!user.plan_expires &&
        new Date(user.plan_expires) > new Date()));
  const resetState = initialProject?.state ?? defaultText3D;
  const [history, setHistory] = useState<{
    past: Text3DState[];
    current: Text3DState;
    future: Text3DState[];
  }>({
    past: [],
    current: structuredClone(resetState),
    future: [],
  });
  const state = history.current;
  const [tab, setTab] = useState<Tab>("text");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(true);
  const [hasText, setHasText] = useState(false);
  const [error, setError] = useState("");
  const [fatal, setFatal] = useState(false);
  const [message, setMessage] = useState("");
  const [rotating, setRotating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [projectId, setProjectId] = useState<string>();
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [resolution, setResolution] = useState(1024);
  const [aspect, setAspect] = useState("preview");
  const [transparent, setTransparent] = useState(false);
  const [customFonts, setCustomFonts] = useState<
    { id: string; name: string }[]
  >([]);
  const [textureTarget, setTextureTarget] = useState<
    | "front"
    | "side"
    | "edge"
    | "front-pattern"
    | "side-pattern"
    | "edge-pattern"
  >("front");
  const [activePreset, setActivePreset] = useState<number | null>(0);
  const [retry, setRetry] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const engine = useRef<Text3DScene | null>(null);
  const fontInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const thumbnailHost = useRef<HTMLDivElement>(null);
  const edit = useRef({ key: "", time: 0 });

  function patch(values: Partial<Text3DState>, group = true) {
    setPending(true);
    setError("");
    setMessage("");
    setActivePreset(null);
    const key = Object.keys(values).join(",");
    const time = Date.now();
    const merge =
      group && edit.current.key === key && time - edit.current.time < 600;
    edit.current = { key, time };
    setHistory((h) => ({
      past: merge ? h.past : [...h.past, h.current].slice(-60),
      current: { ...h.current, ...values },
      future: [],
    }));
  }
  function undo() {
    edit.current.key = "";
    setPending(true);
    setError("");
    setActivePreset(null);
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            current: h.past.at(-1)!,
            future: [h.current, ...h.future],
          }
        : h,
    );
  }
  function redo() {
    edit.current.key = "";
    setPending(true);
    setError("");
    setActivePreset(null);
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.current],
            current: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
  }

  useEffect(() => {
    let cancelled = false;
    let instance: Text3DScene | undefined;
    setReady(false);
    setFatal(false);
    setPending(true);
    setError("");
    import("./scene")
      .then(({ Text3DScene }) => {
        if (cancelled || !viewport.current) return;
        instance = new Text3DScene(viewport.current, () => {
          setFatal(true);
          setReady(false);
          setPending(false);
          setError(
            "The 3D preview was interrupted. Reload the preview to continue.",
          );
        });
        engine.current = instance;
        try {
          let project = initialProject;
          let savedId: string | undefined;
          if (!project) {
            const incoming = sessionStorage.getItem(
              "excpix-text3d-project-load",
            );
            const draft = localStorage.getItem("excpix-text3d-draft");
            const restored = incoming || draft;
            const parsed = restored ? JSON.parse(restored) : null;
            const saved =
              parsed?.tool === "3d-text" ? { project: parsed } : parsed;
            if (saved) {
              project = text3dProjectSchema.parse(saved.project);
              savedId = saved.id;
            }
            if (incoming)
              sessionStorage.removeItem("excpix-text3d-project-load");
          }
          if (project) {
            if (project.fontData) {
              instance.restoreFont(project.state.font, project.fontData);
              setCustomFonts([
                {
                  id: project.state.font,
                  name: project.fontName || "Custom font",
                },
              ]);
            }
            setHistory({ past: [], current: project.state, future: [] });
            setProjectId(savedId);
            setActivePreset(null);
          }
        } catch {
          toast("The saved draft could not be restored.", true);
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "The 3D preview could not start. Enable WebGL in your browser and retry.",
          );
          setFatal(true);
          setPending(false);
        }
      });
    return () => {
      cancelled = true;
      instance?.dispose();
      engine.current = null;
    };
  }, [retry]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const applied = await engine.current?.update(state);
        if (cancelled || !applied) return;
        setHasText(!!engine.current?.hasText);
        setError("");
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Unable to update the preview.",
          );
      } finally {
        if (!cancelled) setPending(false);
      }
    }, 140);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [state, ready]);

  useEffect(() => {
    if (engine.current) engine.current.controls.autoRotate = rotating;
  }, [rotating, ready]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  function projectData(): Text3DProject {
    return text3dProjectSchema.parse({
      tool: "3d-text",
      version: 1,
      state,
      ...(state.font.startsWith("custom-")
        ? {
            fontData: engine.current?.getFontData(state.font),
            fontName: customFonts.find((font) => font.id === state.font)?.name,
          }
        : {}),
    });
  }
  useEffect(() => {
    if (!ready || pending || error) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "excpix-text3d-draft",
          JSON.stringify({ id: projectId, project: projectData() }),
        );
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [state, ready, pending, error, projectId]);

  const thumbnailKey = JSON.stringify([
    state.text,
    state.font,
    state.size,
    state.spacing,
    state.lineHeight,
    state.layout,
    state.radius,
    state.curve,
  ]);
  useEffect(() => {
    if (!ready || tab !== "premade" || !thumbnailHost.current) return;
    let cancelled = false;
    let renderer: Text3DScene | undefined;
    const urls: string[] = [];
    setThumbnails([]);
    const timer = setTimeout(async () => {
      try {
        const { Text3DScene } = await import("./scene");
        if (cancelled || !thumbnailHost.current || !engine.current) return;
        renderer = new Text3DScene(thumbnailHost.current, () => {});
        renderer.copyFonts(engine.current);
        renderer.renderer.setAnimationLoop(null);
        for (let index = 0; index < text3dPresets.length; index++) {
          if (cancelled) break;
          await renderer.update(applyText3DPreset(state, index));
          if (!renderer.hasText || cancelled) break;
          const blob = await renderer.export("png", 320, 5 / 3, false);
          if (cancelled) break;
          urls.push(URL.createObjectURL(blob));
          setThumbnails([...urls]);
        }
      } catch {
        /* The main preview reports font and WebGL errors. */
      } finally {
        renderer?.dispose();
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      renderer?.dispose();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [ready, tab, thumbnailKey]);

  async function saveProject() {
    if (!user) {
      try {
        localStorage.setItem(
          "excpix-text3d-draft",
          JSON.stringify({ id: projectId, project: projectData() }),
        );
      } catch {}
      window.location.href = "/login";
      return;
    }
    if (!engine.current || pending || !hasText || error) return;
    setSaving(true);
    try {
      const project = projectData();
      const thumbnail = await engine.current.export("png", 480, 1.65, false);
      project.thumbnail = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(thumbnail);
      });
      const result = await api<{ id: string }>("projects", {
        id: projectId,
        title: state.text.trim() || "3D Text",
        content_json: project,
      });
      setProjectId(result.id);
      toast("Project saved to your workspace.");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Could not save this project.",
        true,
      );
    } finally {
      setSaving(false);
    }
  }
  async function toggleFavorite() {
    if (!styleId) return;
    if (!user) {
      window.location.href = "/login";
      return;
    }
    try {
      await api(
        "favorites",
        { style_id: styleId },
        favorite ? "DELETE" : "POST",
      );
      setFavorite((value) => !value);
      toast(favorite ? "Removed from favorites." : "Saved to your collection.");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Could not update favorites.",
        true,
      );
    }
  }
  async function loadProject(file: File) {
    try {
      if (file.size > 16_000_000)
        throw new Error("Project must be under 16 MB.");
      const project = text3dProjectSchema.parse(JSON.parse(await file.text()));
      if (project.fontData) {
        engine.current?.restoreFont(project.state.font, project.fontData);
        setCustomFonts((fonts) => [
          ...fonts.filter((font) => font.id !== project.state.font),
          { id: project.state.font, name: project.fontName || "Custom font" },
        ]);
      }
      setProjectId(undefined);
      patch(project.state, false);
      toast("Project loaded.");
    } catch (e) {
      toast(
        e instanceof Error && !("issues" in e)
          ? e.message
          : "Invalid 3D text project JSON.",
        true,
      );
    }
  }

  async function uploadFont(file: File) {
    if (!engine.current) return;
    setUploading(true);
    setError("");
    try {
      const id = await engine.current.uploadFont(file);
      setCustomFonts((fonts) => [
        ...fonts,
        { id, name: file.name.replace(/\.[^.]+$/, "") },
      ]);
      patch({ font: id }, false);
    } catch (e) {
      setMessage("");
      setError(e instanceof Error ? e.message : "Could not read this font.");
    } finally {
      setUploading(false);
    }
  }
  async function uploadTexture(file: File) {
    setUploading(true);
    setError("");
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        throw new Error("Choose a PNG, JPEG or WebP image.");
      if (file.size > 8 * 1024 * 1024)
        throw new Error("Image must be smaller than 8 MB.");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const texture = canvas.toDataURL("image/png");
      const channel = textureTarget.replace("-pattern", "") as
        "front" | "side" | "edge";
      patch(
        channel === "front"
          ? { texture, fill: "image" }
          : channel === "side"
            ? { sideTexture: texture, sideFill: "image" }
            : { edgeTexture: texture, edgeFill: "image" },
        false,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this image.");
    } finally {
      setUploading(false);
    }
  }
  async function download() {
    if (isExportLocked("3d", paid, format, resolution)) {
      toast("This export requires a paid plan.", true);
      return;
    }
    if (!engine.current || pending || exporting || !hasText || error) return;
    setExporting(true);
    setMessage("");
    const wasRotating = engine.current.controls.autoRotate;
    engine.current.controls.autoRotate = false;
    try {
      const blob = await engine.current.export(
        format,
        resolution,
        aspect === "preview" ? null : Number(aspect),
        transparent,
      );
      const name =
        state.text
          .trim()
          .replace(/[^a-z0-9_-]+/gi, "-")
          .slice(0, 50) || "3d-text";
      const url = URL.createObjectURL(blob);
      saveBlob(url, `${name}.${format}`);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage(`${format.toUpperCase()} download ready.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed. Try again.");
    } finally {
      if (engine.current) engine.current.controls.autoRotate = wasRotating;
      setExporting(false);
    }
  }
  const locked = !ready || exporting || uploading || saving;
  const range = (
    key: keyof Text3DState,
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <Slider
      label={label}
      value={state[key] as number}
      min={min}
      max={max}
      step={step}
      onChange={(value) => patch({ [key]: value })}
    />
  );
  const color = (key: keyof Text3DState, label: string) => (
    <Color
      label={label}
      value={state[key] as string}
      onChange={(value) =>
        patch({
          [key]: value,
          ...(key === "front"
            ? { frontOpacity: 1 }
            : key === "side"
              ? { sideOpacity: 1 }
              : key === "edge"
                ? { edgeOpacity: 1 }
                : {}),
        })
      }
    />
  );
  const materialChannel = (kind: "side" | "edge", label: string) => {
    const fillKey = kind === "side" ? "sideFill" : "edgeFill";
    const endKey = kind === "side" ? "sideGradientEnd" : "edgeGradientEnd";
    const angleKey =
      kind === "side" ? "sideGradientAngle" : "edgeGradientAngle";
    const textureKey = kind === "side" ? "sideTexture" : "edgeTexture";
    const strengthKey =
      kind === "side" ? "sideTextureStrength" : "edgeTextureStrength";
    const patternModeKey =
      kind === "side" ? "sidePatternMode" : "edgePatternMode";
    const patternSizeKey =
      kind === "side" ? "sidePatternSize" : "edgePatternSize";
    const fill = state[fillKey];
    const texture = state[textureKey];
    return (
      <div className={css.materialChannel}>
        <Field label={`${label} fill`}>
          <select
            value={fill}
            onChange={(e) =>
              patch({
                [fillKey]: e.target.value as Text3DState[typeof fillKey],
              })
            }
          >
            <option value="solid">Solid</option>
            <option value="gradient">Gradient</option>
            <option value="image">Image texture</option>
          </select>
        </Field>
        {fill !== "image" &&
          color(kind, fill === "gradient" ? `${label} start` : label)}
        {fill === "solid" && (
          <PresetPicker
            type="color"
            expanded
            label={`${label} solid presets`}
            onTransparent={() =>
              patch({ [kind === "side" ? "sideOpacity" : "edgeOpacity"]: 0 })
            }
            onSelect={(preset) =>
              patch({
                [kind === "side" ? "side" : "edge"]: preset.color,
                [kind === "side" ? "sideOpacity" : "edgeOpacity"]: 1,
              })
            }
          />
        )}
        {fill === "gradient" && (
          <>
            <PresetPicker
              type="gradient"
              expanded
              label={`${label} gradient presets`}
              onSelect={(preset) =>
                patch({
                  [fillKey]:
                    preset.gradientType === "radial" ? "gradient" : "gradient",
                  [kind === "side" ? "side" : "edge"]: preset.stops[0]?.color,
                  [endKey]: preset.stops[preset.stops.length - 1]?.color,
                  [angleKey]: preset.angle,
                  [kind === "side" ? "sideOpacity" : "edgeOpacity"]: 1,
                })
              }
            />
            {color(endKey, `${label} end`)}
            {range(angleKey, `${label} angle`, 0, 360)}
          </>
        )}
        {fill === "image" && (
          <>
            <label className="color-field">
              <span>Pattern image</span>
              <input
                type="checkbox"
                checked={state[patternModeKey]}
                onChange={(e) => patch({ [patternModeKey]: e.target.checked })}
              />
            </label>
            {state[patternModeKey] &&
              range(patternSizeKey, "Pattern size", 10, 200, 1)}
            {range(strengthKey, "Image strength", 0, 1, 0.01)}
            <button
              className={css.upload}
              onClick={() => {
                setTextureTarget(
                  (state[patternModeKey]
                    ? `${kind}-pattern`
                    : kind) as typeof textureTarget,
                );
                imageInput.current?.click();
              }}
            >
              <Upload size={16} />
              {state[patternModeKey]
                ? texture
                  ? "Replace pattern image"
                  : "Upload pattern image"
                : texture
                  ? `Replace ${label.toLowerCase()} texture`
                  : `Upload ${label.toLowerCase()} texture`}
            </button>
            {texture && (
              <div className={css.texture}>
                <img
                  src={texture}
                  alt={`Current ${label.toLowerCase()} texture`}
                />
                <IconButton
                  label={`Remove ${label.toLowerCase()} texture`}
                  onClick={() =>
                    patch({
                      [textureKey]: "",
                      [fillKey]: "solid",
                    })
                  }
                >
                  <X size={16} />
                </IconButton>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <main className="editor-page main-width">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight size={13} />
        <Link href="/3d-studio">3D Studio</Link>
        <ChevronRight size={13} />
        <span>{title}</span>
      </div>
      <div className="editor-title">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      <div className={"editor-workspace " + css.workspace}>
        <section className="preview-pane" aria-label="3D text preview">
          <div className="preview-toolbar">
            <span>
              <span className="status-dot" />
              Live preview
            </span>
            <div>
              <IconButton
                label="Undo"
                disabled={!history.past.length || locked}
                onClick={undo}
              >
                <Undo2 size={17} />
              </IconButton>
              <IconButton
                label="Redo"
                disabled={!history.future.length || locked}
                onClick={redo}
              >
                <Redo2 size={17} />
              </IconButton>
              <IconButton
                label="Reset text style"
                disabled={locked}
                onClick={() => {
                  patch(structuredClone(resetState), false);
                  setActivePreset(0);
                  setRotating(false);
                  engine.current?.view(false);
                }}
              >
                <RotateCcw size={17} />
              </IconButton>
              <span className="toolbar-divider" />
              <IconButton
                label={favorite ? "Remove from favorites" : "Save to favorites"}
                onClick={() => void toggleFavorite()}
              >
                <Heart size={17} fill={favorite ? "currentColor" : "none"} />
              </IconButton>
            </div>
          </div>
          <div className="editor-canvas checkerboard">
            <div className={css.canvas} ref={viewport} />
            {(pending || uploading || exporting) && !fatal && (
              <div role="status" className={css.processing}>
                <LoaderCircle size={16} className="spin" />
                {exporting
                  ? "Exporting..."
                  : uploading
                    ? "Loading file..."
                    : "Updating..."}
              </div>
            )}
            {!pending && !hasText && !error && (
              <div className={css.empty}>Enter your text</div>
            )}
            {fatal && (
              <div className={css.failure}>
                <p>{error}</p>
                <button
                  className="button"
                  onClick={() => {
                    setCustomFonts([]);
                    if (state.font.startsWith("custom-"))
                      patch({ font: defaultText3D.font });
                    setRetry((n) => n + 1);
                  }}
                >
                  Reload preview
                </button>
              </div>
            )}
          </div>
          <div className={"preview-bottom " + css.bottom}>
            <div className={css.views} role="group" aria-label="Camera view">
              <button
                disabled={locked}
                onClick={() => {
                  setRotating(false);
                  engine.current?.view(true);
                }}
              >
                Front
              </button>
              <button
                disabled={locked}
                onClick={() => {
                  setRotating(false);
                  engine.current?.view(false);
                }}
              >
                Perspective
              </button>
            </div>
            <div>
              <IconButton
                label={rotating ? "Pause rotation" : "Rotate preview"}
                aria-pressed={rotating}
                disabled={locked}
                onClick={() => setRotating(!rotating)}
              >
                {rotating ? <Pause size={16} /> : <Play size={16} />}
              </IconButton>
              <IconButton
                label="Zoom out"
                disabled={locked}
                onClick={() => engine.current?.zoom(1.2)}
              >
                <ZoomOut size={17} />
              </IconButton>
              <IconButton
                label="Zoom in"
                disabled={locked}
                onClick={() => engine.current?.zoom(0.8)}
              >
                <ZoomIn size={17} />
              </IconButton>
              <IconButton
                label="Fit text"
                disabled={locked}
                onClick={() => engine.current?.fit()}
              >
                <Scan size={17} />
              </IconButton>
            </div>
          </div>
        </section>
        <section className="controls-pane" aria-label="3D text settings">
          <div
            className="editor-tabs"
            role="tablist"
            aria-label="Editor panels"
          >
            {tabs.map((item, index) => (
              <button
                key={item.id}
                className={tab === item.id ? "active" : ""}
                id={`tab-${item.id}`}
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                title={item.name}
                onClick={() => setTab(item.id)}
                onKeyDown={(e) => {
                  const next =
                    e.key === "ArrowRight"
                      ? (index + 1) % tabs.length
                      : e.key === "ArrowLeft"
                        ? (index + tabs.length - 1) % tabs.length
                        : e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? tabs.length - 1
                            : -1;
                  if (next !== -1) {
                    e.preventDefault();
                    setTab(tabs[next].id);
                    document.getElementById(`tab-${tabs[next].id}`)?.focus();
                  }
                }}
              >
                <item.icon size={18} />
                <span>{item.name}</span>
              </button>
            ))}
          </div>
          <div
            className="editor-controls"
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
          >
            {tab !== "text" && (
              <div className="panel-heading">
                <h2>{tabs.find((item) => item.id === tab)?.name}</h2>
              </div>
            )}
            <fieldset disabled={locked}>
              {tab === "text" && (
                <>
                  <Field
                    label={
                      <span className={css.textFieldLabel}>
                        <span>Your text</span>
                        <small className={css.characterCount}>
                          {state.text.length}/100
                        </small>
                      </span>
                    }
                  >
                    <textarea
                      className="editor-textarea"
                      aria-label="Your text"
                      rows={3}
                      maxLength={100}
                      value={state.text}
                      onChange={(e) => patch({ text: e.target.value })}
                    />
                  </Field>
                  <Field label="Font family">
                    <select
                      value={state.font}
                      onChange={(e) => patch({ font: e.target.value })}
                    >
                      {[...text3dFonts, ...customFonts].map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    className={css.upload}
                    onClick={() => fontInput.current?.click()}
                  >
                    <Upload size={16} />
                    Upload font <small>TTF / OTF / JSON</small>
                  </button>
                  <input
                    className={css.file}
                    ref={fontInput}
                    aria-label="Upload font file"
                    type="file"
                    accept=".ttf,.otf,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void uploadFont(file);
                    }}
                  />
                  <div className={css.divider} />
                  <div className="two-fields">
                    {range("size", "Font size", 10, 100)}
                    {range("spacing", "Letter spacing", 0, 20, 0.5)}
                    {range("lineHeight", "Line height", 0.8, 2.5, 0.1)}
                    {range("curve", "Curve", -100, 100)}
                  </div>
                </>
              )}
              {tab === "shape" && (
                <>
                  {range("depth", "Depth", 0, 60)}
                  {range("bevel", "Bevel size", 0, 3, 0.1)}
                  {range("bevelThickness", "Bevel thickness", 0, 10, 0.1)}
                  <div className={css.divider} />
                  <h3>Rotation</h3>
                  {range("rotationX", "X rotation", -180, 180)}
                  {range("rotationY", "Y rotation", -180, 180)}
                  {range("rotationZ", "Z rotation", -180, 180)}
                </>
              )}
              {tab === "material" && (
                <>
                  <Field label="Fill">
                    <select
                      value={state.fill}
                      onChange={(e) =>
                        patch({ fill: e.target.value as Text3DState["fill"] })
                      }
                    >
                      <option value="solid">Solid</option>
                      <option value="gradient">Gradient</option>
                      <option value="image">Image texture</option>
                    </select>
                  </Field>
                  {state.fill !== "image" &&
                    color(
                      "front",
                      state.fill === "gradient"
                        ? "Gradient start"
                        : "Front color",
                    )}
                  {state.fill === "solid" && (
                    <PresetPicker
                      type="color"
                      expanded
                      label="Solid presets"
                      onTransparent={() => patch({ frontOpacity: 0 })}
                      onSelect={(preset) =>
                        patch({ front: preset.color, frontOpacity: 1 })
                      }
                    />
                  )}
                  {state.fill === "gradient" && (
                    <>
                      <PresetPicker
                        type="gradient"
                        expanded
                        label="Gradient presets"
                        onSelect={(preset) =>
                          patch({
                            fill:
                              preset.gradientType === "radial"
                                ? "gradient"
                                : "gradient",
                            front: preset.stops[0]?.color || state.front,
                            gradientEnd:
                              preset.stops[preset.stops.length - 1]?.color ||
                              state.gradientEnd,
                            gradientAngle: preset.angle,
                            frontOpacity: 1,
                          })
                        }
                      />
                      {color("gradientEnd", "Gradient end")}
                      {range("gradientAngle", "Gradient angle", 0, 360)}
                    </>
                  )}
                  {state.fill === "image" && (
                    <>
                      <label className="color-field">
                        <span>Pattern image</span>
                        <input
                          type="checkbox"
                          checked={state.patternMode}
                          onChange={(e) =>
                            patch({ patternMode: e.target.checked })
                          }
                        />
                      </label>
                      {state.patternMode &&
                        range("patternSize", "Pattern size", 10, 200, 1)}
                      {range("textureStrength", "Image strength", 0, 1, 0.01)}
                      <button
                        className={css.upload}
                        onClick={() => {
                          setTextureTarget(
                            state.patternMode ? "front-pattern" : "front",
                          );
                          imageInput.current?.click();
                        }}
                      >
                        <Upload size={16} />
                        {state.patternMode
                          ? state.texture
                            ? "Replace pattern image"
                            : "Upload pattern image"
                          : state.texture
                            ? "Replace texture"
                            : "Upload texture"}
                      </button>
                      {state.texture && (
                        <div className={css.texture}>
                          <img src={state.texture} alt="Current text texture" />
                          <IconButton
                            label="Remove texture"
                            onClick={() =>
                              patch({
                                texture: "",
                                fill: "solid",
                              })
                            }
                          >
                            <X size={16} />
                          </IconButton>
                        </div>
                      )}
                    </>
                  )}
                  <input
                    className={css.file}
                    ref={imageInput}
                    aria-label="Upload texture file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void uploadTexture(file);
                    }}
                  />
                  {materialChannel("side", "Side")}
                  {materialChannel("edge", "Bevel")}
                  <div className={css.divider} />
                  <Field label="Finish">
                    <select
                      value={state.finish}
                      onChange={(e) => {
                        const finish = e.target.value as Text3DState["finish"];
                        patch({
                          finish,
                          metalness: ["metal", "chrome"].includes(finish)
                            ? 1
                            : finish === "iridescent"
                              ? 0.7
                              : finish === "glass"
                                ? 0
                                : finish === "satin"
                                  ? 0.25
                                  : 0.1,
                          roughness:
                            finish === "matte"
                              ? 0.8
                              : finish === "chrome"
                                ? 0.06
                                : finish === "satin"
                                  ? 0.45
                                  : finish === "plastic"
                                    ? 0.28
                                    : finish === "iridescent"
                                      ? 0.18
                                      : finish === "glass"
                                        ? 0.08
                                        : 0.2,
                          transmission: finish === "glass" ? 0.92 : 0,
                        });
                      }}
                    >
                      <option value="matte">Matte</option>
                      <option value="glossy">Glossy</option>
                      <option value="metal">Metal</option>
                      <option value="glass">Glass</option>
                      <option value="satin">Satin</option>
                      <option value="chrome">Chrome</option>
                      <option value="plastic">Plastic</option>
                      <option value="iridescent">Iridescent</option>
                    </select>
                  </Field>
                  {range("metalness", "Metalness", 0, 1, 0.05)}
                  {range("roughness", "Roughness", 0.05, 1, 0.05)}
                  {state.finish === "glass" &&
                    range("transmission", "Transmission", 0, 1, 0.05)}
                </>
              )}
              {tab === "scene" && (
                <>
                  <Field label="Background">
                    <select
                      value={state.background}
                      onChange={(e) =>
                        patch({
                          background: e.target
                            .value as Text3DState["background"],
                        })
                      }
                    >
                      <option value="solid">Solid</option>
                      <option value="gradient">Gradient</option>
                      <option value="transparent">Transparent</option>
                    </select>
                  </Field>
                  {state.background !== "transparent" &&
                    color("backgroundColor", "Background color")}
                  {state.background === "gradient" &&
                    color("backgroundEnd", "Background end")}
                  <div className={css.divider} />
                  {range("light", "Light intensity", 0.1, 3, 0.1)}
                </>
              )}
              {tab === "premade" && (
                <div className={css.presets}>
                  {text3dPresets.map((preset, index) => (
                    <button
                      key={preset.name}
                      className={css.preset}
                      aria-pressed={activePreset === index}
                      onClick={() => {
                        patch(applyText3DPreset(state, index), false);
                        setActivePreset(index);
                      }}
                    >
                      {thumbnails[index] ? (
                        <img
                          src={thumbnails[index]}
                          alt=""
                          width={300}
                          height={180}
                          loading="lazy"
                        />
                      ) : (
                        <div className={css.presetLoading}>
                          {state.text.trim() ? (
                            <LoaderCircle size={18} className="spin" />
                          ) : (
                            <Type size={22} />
                          )}
                        </div>
                      )}
                      <span>
                        {preset.name}
                        {activePreset === index && <Check size={14} />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {tab === "export" && (
                <>
                  <span className="field-label">File format</span>
                  <div
                    className="segmented wide"
                    role="group"
                    aria-label="File format"
                  >
                    {(["png", "obj", "stl", "glb"] as ExportFormat[]).map(
                      (value) => (
                        <button
                          key={value}
                          className={format === value ? "active" : ""}
                          aria-pressed={format === value}
                          disabled={isExportLocked(
                            "3d",
                            paid,
                            value,
                            value === "png" ? resolution : 0,
                          )}
                          onClick={() => setFormat(value)}
                        >
                          {value.toUpperCase()}
                          {!paid && value !== "png" && (
                            <LockKeyhole size={12} />
                          )}
                        </button>
                      ),
                    )}
                  </div>
                  {format === "png" ? (
                    <>
                      <Field label="Aspect ratio">
                        <select
                          value={aspect}
                          onChange={(e) => setAspect(e.target.value)}
                        >
                          <option value="preview">Match preview</option>
                          <option value="1">Square (1:1)</option>
                          <option value={16 / 9}>Landscape (16:9)</option>
                          <option value={9 / 16}>Portrait (9:16)</option>
                        </select>
                      </Field>
                      <span className="field-label">Export quality</span>
                      <div
                        className={`quality-grid ${css.quality}`}
                        role="group"
                        aria-label="Export quality"
                      >
                        {[
                          { value: 1024, name: "Standard" },
                          { value: 2048, name: "2K" },
                          { value: 4096, name: "4K" },
                          { value: 8192, name: "8K" },
                        ].map((quality) => (
                          <button
                            key={quality.value}
                            className={
                              resolution === quality.value ? "active" : ""
                            }
                            aria-pressed={resolution === quality.value}
                            disabled={isExportLocked(
                              "3d",
                              paid,
                              "png",
                              quality.value,
                            )}
                            onClick={() => setResolution(quality.value)}
                          >
                            <strong>
                              {quality.name}{" "}
                              {isExportLocked(
                                "3d",
                                paid,
                                "png",
                                quality.value,
                              ) && <LockKeyhole size={12} />}
                            </strong>
                            <small>{quality.value}px</small>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className={css.formatNote}>
                      {format === "glb"
                        ? "Model with colors, materials and embedded textures."
                        : format === "stl"
                          ? "Geometry only. Colors and textures are not included."
                          : "Geometry and UV coordinates. Choose GLB to include materials and textures."}
                    </p>
                  )}
                  <button
                    className="button accent full"
                    disabled={
                      pending ||
                      !hasText ||
                      !!error ||
                      isExportLocked("3d", paid, format, resolution)
                    }
                    onClick={() => void download()}
                  >
                    <Download size={17} />
                    Download {format.toUpperCase()}
                  </button>
                  <div className="control-divider" />
                  <span className="field-label">Project data</span>
                  <div className="two-fields project-data-actions">
                    <button
                      className="button"
                      onClick={() => {
                        try {
                          const blob = new Blob(
                            [JSON.stringify(projectData(), null, 2)],
                            { type: "application/json" },
                          );
                          const url = URL.createObjectURL(blob);
                          saveBlob(url, "3d-text-project.json");
                          setTimeout(() => URL.revokeObjectURL(url), 30000);
                        } catch {
                          toast("Project is not ready to save.", true);
                        }
                      }}
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
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void loadProject(file);
                        }}
                      />
                    </label>
                  </div>
                  <button
                    className="button full project-save-button"
                    disabled={pending || !hasText || !!error}
                    onClick={() => void saveProject()}
                  >
                    <Save size={15} />
                    {saving ? "Saving..." : "Save to my project"}
                  </button>
                </>
              )}
            </fieldset>
          </div>
          {tab !== "export" && (
            <div className="controls-bottom">
              <button
                className="text-button"
                disabled={locked || pending || !hasText || !!error}
                onClick={() => void saveProject()}
              >
                <Save size={15} />
                {saving ? "Saving..." : "Save"}
              </button>
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
      {!!error && !fatal && (
        <div className={css.error} role="alert">
          {error}
          <IconButton
            label="Dismiss error"
            onClick={() => {
              setError("");
              setPending(true);
              setHistory((h) => ({ ...h, current: { ...h.current } }));
            }}
          >
            <X size={16} />
          </IconButton>
        </div>
      )}
      {message && (
        <div className={css.success} role="status">
          <Check size={16} />
          {message}
        </div>
      )}
      <div
        className={css.thumbnailHost}
        ref={thumbnailHost}
        aria-hidden="true"
      />
    </main>
  );
}
