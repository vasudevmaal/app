"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, Textbox, FabricImage, FabricObject } from "fabric";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Download,
  Save,
  Type,
  Shapes,
  ImagePlus,
  Palette,
  LayoutTemplate,
  FolderOpen,
  Layers,
  SlidersHorizontal,
  Scan,
  ZoomIn,
  ZoomOut,
  Plus,
  Minus,
  X,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  LockKeyhole,
  LockKeyholeOpen,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Upload,
  FileJson,
  Check,
  LoaderCircle,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  Search,
  QrCode,
  Maximize2,
  MousePointer2,
  Group,
  Ungroup,
  FlipHorizontal,
  FlipVertical,
} from "lucide-react";
import { api, saveBlob } from "@/lib/client";
import { useApp } from "@/components/providers";
import { Preview } from "@/components/preview";
import { glyphMap } from "@/lib/content";
import {
  designSchema,
  readDesign,
  type DesignDocument,
  type DesignElement,
  type DesignAsset,
  type DesignBackground,
} from "@/lib/design";
import type { Style } from "@/lib/types";
import {
  applyBackground,
  makeObject,
  snapshot,
  newElement,
  svgSource,
  loadImage,
  lockObject,
  type DesignObject,
} from "./engine";
import { imageEffects } from "./image-effects";
import css from "./editor.module.css";
import { PresetPicker, GradientStops, usePresets } from "@/components/presets";
import { FontPickerPopup } from "@/components/font-picker-popup";
import { fonts } from "@/lib/editor-fonts";
import {
  ImageControls,
  ShadowControls,
  PaintControls,
  BackgroundControls,
} from "./properties";

type Library = {
  assets: DesignAsset[];
  letters: Style[];
  templates: Style[];
  backgrounds: DesignBackground[];
};
type Project = {
  id: string;
  title: string;
  style_id: string;
  content_json: DesignDocument;
  updated_at: string;
};
type Panel =
  | "text"
  | "elements"
  | "images"
  | "uploads"
  | "background"
  | "templates"
  | "projects"
  | "canvas"
  | "layers"
  | "properties"
  | "qr";
const tabs: { id: Panel; label: string; icon: typeof Type }[] = [
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "text", label: "Text", icon: Type },
  { id: "elements", label: "Elements", icon: Shapes },
  { id: "images", label: "Images", icon: ImagePlus },
  { id: "uploads", label: "Upload image", icon: Upload },
  { id: "qr", label: "QR code", icon: QrCode },
  { id: "background", label: "Background", icon: Palette },
  { id: "canvas", label: "Canvas", icon: Scan },
  { id: "layers", label: "Layers", icon: Layers },
  { id: "projects", label: "Projects", icon: FolderOpen },
];
const initialGradient = {
  type: "linear" as const,
  color1: "#b05cff",
  color2: "#52a8ff",
  angle: 180,
};
const clone = <T,>(value: T): T => structuredClone(value);
function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={css.icon}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function NumberField({
  label,
  value,
  onChange,
  min = -20000,
  max = 20000,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(Math.round(value * 100) / 100));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(Math.round(value * 100) / 100));
  }, [value]);
  return (
    <label className={css.field}>
      <span>{label}</span>
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          const n = draft.trim() === "" ? value : Number(draft);
          const next = Math.max(
            min,
            Math.min(max, Number.isFinite(n) ? n : value),
          );
          setDraft(String(next));
          onChange(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && n >= min && n <= max) onChange(n);
        }}
      />
    </label>
  );
}
function StyleTile({ style, onClick }: { style: Style; onClick: () => void }) {
  return (
    <button className={css.styleTile} title={style.title} onClick={onClick}>
      {style.image_url ? (
        <img
          src={style.image_url}
          alt={style.image_alt || style.title}
          loading="lazy"
        />
      ) : style.kind === "design" && !(style.content_json as any).fill ? (
        <img src={`/previews/${style.slug}.png`} alt={style.title} />
      ) : (
        <Preview
          state={style.content_json}
          glyphs={style.kind === "ai" ? glyphMap(style) : undefined}
        />
      )}
      <span>{style.title}</span>
      {(style.is_premium || !style.is_free) && <LockKeyhole size={12} />}
    </button>
  );
}
export function DesignEditor({
  style,
  initial,
  library,
}: {
  style: Style;
  initial: DesignDocument;
  library: Library;
}) {
  const { user, toast } = useApp();
  const router = useRouter();
  const previousDraft = useRef<string | null>(null);
  const uploadUnderlay = useRef(false);
  const initialSnapshot = useRef("");
  const presets = usePresets();
  const [imageCategory, setImageCategory] = useState("all"),
    [checkedLayers, setCheckedLayers] = useState<string[]>([]),
    [canvasSelectionIds, setCanvasSelectionIds] = useState<string[]>([]),
    [guides, setGuides] = useState({ x: false, y: false });
  const pendingEdits = useRef<{ id: string; data: DesignElement } | null>(null);
  const canvasEl = useRef<HTMLCanvasElement>(null),
    canvas = useRef<Canvas | null>(null),
    viewport = useRef<HTMLDivElement>(null),
    docRef = useRef(clone(initial));
  const history = useRef<string[]>([]),
    cursor = useRef(-1),
    restoring = useRef(false),
    mounted = useRef(true),
    replaceVersion = useRef(0),
    pendingReplacement = useRef<Promise<void> | null>(null);
  const fitRef = useRef(() => {}),
    commitRef = useRef(() => {}),
    saveRef = useRef(() => {}),
    historyRef = useRef((n: number) => {}),
    deleteRef = useRef(() => {}),
    duplicateRef = useRef(() => {});
  const libraryStyles = useRef([
    style,
    ...library.letters,
    ...library.templates,
  ]);
  const [doc, setDoc] = useState(initial),
    [panel, setPanel] = useState<Panel | null>(null),
    [selected, setSelected] = useState<DesignElement | null>(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState(""),
    [textKind, setTextKind] = useState("all"),
    [assetKind, setAssetKind] = useState("all");
  const [uploads, setUploads] = useState<{ name: string; src: string }[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [projectId, setProjectId] = useState(""),
    [saved, setSaved] = useState("");
  const [download, setDownload] = useState(false),
    [format, setFormat] = useState("png"),
    [quality, setQuality] = useState(1280),
    [qr, setQr] = useState("https://excpix.com"),
    [qrColor, setQrColor] = useState("#242628");
  const [size, setSize] = useState({ w: initial.canvasW, h: initial.canvasH });
  const [confirm, setConfirm] = useState<{
    title: string;
    run: () => void;
  } | null>(null);
  const imageInput = useRef<HTMLInputElement>(null),
    jsonInput = useRef<HTMLInputElement>(null),
    bgInput = useRef<HTMLInputElement>(null),
    fontInput = useRef<HTMLInputElement>(null),
    modalRef = useRef<HTMLDialogElement>(null);
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const paid =
    !!user &&
    (["owner", "admin"].includes(user.role) ||
      (user.plan !== "free" &&
        !!user.plan_expires &&
        new Date(user.plan_expires) > new Date()));
  const locked = style.is_locked;
  const active = () =>
    canvas.current?.getActiveObject() as DesignObject | undefined;
  function message(error: unknown) {
    const text =
      error instanceof Error
        ? error.message
        : "Unable to complete this action.";
    setError(text);
    toast(text, true);
  }
  async function task(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      message(e);
    } finally {
      if (mounted.current) setBusy("");
    }
  }
  function syncSelection() {
    const c = canvas.current;
    const objects = (c?.getActiveObjects() || []) as DesignObject[];
    const ids = objects
      .map((object) => object.designData?.id)
      .filter((id): id is string => !!id);
    setCanvasSelectionIds(ids);
    const object = objects.length === 1 ? objects[0] : undefined;
    setSelected(
      object?.designData
        ? snapshot(c!, docRef.current).elements.find(
            (e) => e.id === object.designData!.id,
          ) || null
        : null,
    );
  }
  function commit() {
    if (!canvas.current || restoring.current) return;
    const next = snapshot(canvas.current, docRef.current);
    docRef.current = next;
    setDoc(next);
    syncSelection();
    const serialized = JSON.stringify(next);
    if (history.current[cursor.current] !== serialized) {
      history.current = history.current.slice(0, cursor.current + 1);
      history.current.push(serialized);
      if (history.current.length > 60) history.current.shift();
      cursor.current = history.current.length - 1;
    }
    setRevision((v) => v + 1);
  }
  commitRef.current = commit;
  async function restore(next: DesignDocument, reset = false) {
    const c = canvas.current;
    if (!c) return;
    // Resolve assets before touching the current document, so a failed import is non-destructive.
    const objects = await Promise.all(
      next.elements
        .filter((e) => e.w > 0 && e.h > 0)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((e) => makeObject(e, libraryStyles.current)),
    );
    if (locked) objects.forEach((object) => lockObject(object, true));
    restoring.current = true;
    try {
      await applyBackground(c, next);
      c.discardActiveObject();
      c.remove(...c.getObjects());
      c.add(...objects);
      docRef.current = clone(next);
      setDoc(clone(next));
      setSelected(null);
      setCanvasSelectionIds([]);
      setSize({ w: next.canvasW, h: next.canvasH });
      if (reset) {
        history.current = [];
        cursor.current = -1;
      }
      fitRef.current();
    } finally {
      restoring.current = false;
    }
    if (reset) commit();
    else setRevision((v) => v + 1);
  }
  useEffect(() => {
    if (!matchMedia("(max-width: 760px)").matches) setPanel("text");
  }, []);
  useEffect(() => {
    mounted.current = true;
    try {
      previousDraft.current = localStorage.getItem(`excpix-design:${style.id}`);
    } catch {}
    const c = new Canvas(canvasEl.current!, {
      selection: true,
      selectionKey: ["ctrlKey", "metaKey"],
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      renderOnAddRemove: false,
    });
    canvas.current = c;
    const fit = () => {
      if (!viewport.current || !canvas.current) return;
      const { width, height } = viewport.current.getBoundingClientRect(),
        d = docRef.current;
      const value = Math.max(
        0.015,
        Math.min((width - 48) / d.canvasW, (height - 48) / d.canvasH, 1),
      );
      c.setDimensions({
        width: Math.max(1, Math.round(d.canvasW * value)),
        height: Math.max(1, Math.round(d.canvasH * value)),
      });
      c.setZoom(value);
      setZoom(value);
      c.requestRenderAll();
    };
    fitRef.current = fit;
    c.on("selection:created", syncSelection);
    c.on("selection:updated", syncSelection);
    c.on("selection:cleared", syncSelection);
    const dragPositions = new Map<
      FabricObject,
      { left: number; top: number }
    >();
    const cropFrames = new WeakMap<DesignObject, number>();
    const refreshImageCrop = (object: DesignObject) => {
      if (!object.imageSource || object.designData?.type !== "image") return;
      const next = snapshot(c, docRef.current).elements.find(
        (element) => element.id === object.designData?.id,
      );
      if (!next) return;
      const cropped = imageEffects(object.imageSource, next, 1200);
      const image = object as FabricImage & DesignObject;
      image.setElement(cropped, { width: cropped.width, height: cropped.height });
      image.set({
        left: next.x,
        top: next.y,
        angle: next.rotation,
        scaleX: Math.max(1, next.w) / cropped.width,
        scaleY: Math.max(1, next.h) / cropped.height,
      });
      object.designData = next;
      object.setCoords();
    };
    c.on("object:scaling", ({ target }) => {
      const object = target as DesignObject | undefined;
      if (!object?.imageSource || cropFrames.has(object)) return;
      cropFrames.set(
        object,
        requestAnimationFrame(() => {
          cropFrames.delete(object);
          if (!mounted.current || !c.getObjects().includes(object)) return;
          refreshImageCrop(object);
          c.requestRenderAll();
        }),
      );
    });
    c.on("mouse:down", () => {
      dragPositions.clear();
      for (const o of c.getObjects())
        dragPositions.set(o, { left: o.left, top: o.top });
    });
    c.on("object:moving", ({ target }) => {
      const object = target as DesignObject,
        d = docRef.current,
        center = object.getCenterPoint(),
        threshold = 6 / c.getZoom();
      const sx = Math.abs(center.x - d.canvasW / 2) < threshold,
        sy = Math.abs(center.y - d.canvasH / 2) < threshold;
      if (sx) object.left += d.canvasW / 2 - center.x;
      if (sy) object.top += d.canvasH / 2 - center.y;
      setGuides({ x: sx, y: sy });
      const prior = dragPositions.get(object);
      if (prior && object.designData?.groupId) {
        const dx = object.left - prior.left,
          dy = object.top - prior.top;
        for (const other of c.getObjects() as DesignObject[])
          if (
            other !== object &&
            other.designData?.groupId === object.designData.groupId &&
            !other.designData.locked
          ) {
            other.set({ left: other.left + dx, top: other.top + dy });
            other.setCoords();
          }
      }
      dragPositions.set(object, { left: object.left, top: object.top });
    });
    c.on("object:modified", ({ target }) => {
      setGuides({ x: false, y: false });
      const modified = target as DesignObject | undefined;
      if (modified?.designData?.type === "image") {
        const frame = cropFrames.get(modified);
        if (frame) cancelAnimationFrame(frame);
        cropFrames.delete(modified);
        refreshImageCrop(modified);
        c.requestRenderAll();
      }
      commitRef.current();
    });
    c.on("mouse:up", () => setGuides({ x: false, y: false }));
    c.on("text:editing:exited", () => commitRef.current());
    c.on("mouse:dblclick", () => {
      const selectedObject = c.getActiveObject() as DesignObject | undefined;
      if (selectedObject?.designData)
        setPanel("properties");
    });
    const observer = new ResizeObserver(fit);
    if (viewport.current) observer.observe(viewport.current);
    void restore(initial, true)
      .then(() => {
        if (mounted.current) {
          setReady(true);
          setSaved(JSON.stringify(docRef.current));
          initialSnapshot.current = JSON.stringify(docRef.current);
        }
      })
      .catch((e) => {
        if (mounted.current) {
          message(e);
          setReady(true);
        }
      });
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"]',
        ) ||
        (c.getActiveObject() instanceof Textbox &&
          (c.getActiveObject() as Textbox).isEditing)
      )
        return;
      if (e.key === "Escape") {
        c.discardActiveObject();
        c.requestRenderAll();
        setPanel(null);
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        ["z", "y", "s", "d"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        const key = e.key.toLowerCase();
        if (key === "s") saveRef.current();
        else if (key === "d") duplicateRef.current();
        else historyRef.current(key === "y" || e.shiftKey ? 1 : -1);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteRef.current();
      }
      const object = c.getActiveObject();
      if (
        object &&
        !object.lockMovementX &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        object.set({
          left:
            object.left +
            (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0),
          top:
            object.top +
            (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0),
        });
        object.setCoords();
        c.requestRenderAll();
        commitRef.current();
      }
    };
    const media = matchMedia("(prefers-color-scheme: dark)");
    const theme = () => {
      try {
        const preference = localStorage.getItem("excpix-theme") || "system";
        document.documentElement.dataset.theme =
          preference === "system"
            ? media.matches
              ? "dark"
              : "light"
            : preference;
      } catch {}
    };
    theme();
    media.addEventListener("change", theme);
    document.addEventListener("keydown", key);
    return () => {
      mounted.current = false;
      observer.disconnect();
      document.removeEventListener("keydown", key);
      media.removeEventListener("change", theme);
      canvas.current = null;
      void c.dispose();
    };
  }, []);
  useEffect(() => {
    if (
      !ready ||
      !revision ||
      JSON.stringify(docRef.current) === initialSnapshot.current
    )
      return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `excpix-design:${style.id}`,
          JSON.stringify(docRef.current),
        );
      } catch {
        /* Large image projects can exceed browser storage; cloud and JSON saves remain available. */
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [revision, ready, style.id]);
  useEffect(() => {
    if (panel === "projects" && user)
      void task("Loading projects", async () =>
        setProjects(await api<Project[]>("design/projects")),
      );
  }, [panel, user]);
  useEffect(() => {
    if (download && !modalRef.current?.open) modalRef.current?.showModal();
    else if (!download && modalRef.current?.open) modalRef.current.close();
  }, [download]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(docRef.current) !== saved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);
  async function goHistory(delta: number) {
    if (busy || restoring.current) return;
    const next = cursor.current + delta;
    if (next < 0 || next >= history.current.length) return;
    await task("Restoring design", async () => {
      await pendingReplacement.current;
      await restore(JSON.parse(history.current[next]));
      cursor.current = next;
      setRevision((v) => v + 1);
    });
  }
  historyRef.current = (n) => {
    void goHistory(n);
  };
  async function insert(element: DesignElement, centered = false) {
    if (locked) return;
    await task("Adding element", async () => {
      const object = await makeObject(element, libraryStyles.current);
      if (centered) {
        object.set({
          left: (docRef.current.canvasW - object.getScaledWidth()) / 2,
          top: (docRef.current.canvasH - object.getScaledHeight()) / 2,
        });
        object.setCoords();
      }
      canvas.current!.add(object);
      canvas.current!.setActiveObject(object);
      canvas.current!.requestRenderAll();
      commit();
      setPanel(matchMedia("(max-width: 760px)").matches ? null : "properties");
    });
  }
  function patchElement(patch: Partial<DesignElement>) {
    const object = active(),
      c = canvas.current;
    if (!object?.designData || !c || locked || object.designData.locked) return;
    const latest = snapshot(c, docRef.current).elements.find(
      (e) => e.id === object.designData!.id,
    )!;
    const next = {
      ...(pendingEdits.current?.id === latest.id
        ? pendingEdits.current.data
        : latest),
      ...patch,
    };
    pendingEdits.current = { id: latest.id, data: next };
    setSelected(next);
    object.designData = next;
    const version = ++replaceVersion.current;
    pendingReplacement.current = (async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 45));
        if (version !== replaceVersion.current || !mounted.current) return;
        const replacement = await makeObject(next, libraryStyles.current);
        if (
          version !== replaceVersion.current ||
          !mounted.current ||
          !c.getObjects().includes(object)
        )
          return;
        const index = c.getObjects().indexOf(object);
        restoring.current = true;
        c.remove(object);
        c.insertAt(index, replacement);
        c.setActiveObject(replacement);
        restoring.current = false;
        pendingEdits.current = null;
        c.requestRenderAll();
        commit();
      } catch (e) {
        if (version !== replaceVersion.current) return;
        pendingEdits.current = null;
        object.designData = latest;
        syncSelection();
        message(e);
      }
    })();
  }
  function remove() {
    const c = canvas.current,
      object = active();
    if (!c || !object || object.designData?.locked || locked) return;
    c.remove(object);
    c.discardActiveObject();
    c.requestRenderAll();
    commit();
  }
  function groupLayers(clear = false) {
    const c = canvas.current;
    if (!c || locked) return;
    const activeIds = (c.getActiveObjects() as DesignObject[])
      .map((object) => object.designData?.id)
      .filter((id): id is string => !!id);
    const ids = new Set(
      checkedLayers.length >= 2
        ? checkedLayers
        : activeIds.length >= 2
          ? activeIds
          : checkedLayers.length
            ? checkedLayers
            : selected
              ? [selected.id]
              : [],
    );
    if (!clear && ids.size < 2) return;
    const groups = new Set(
      docRef.current.elements
        .filter((e) => ids.has(e.id))
        .map((e) => e.groupId)
        .filter(Boolean),
    );
    const id = crypto.randomUUID();
    for (const object of c.getObjects() as DesignObject[]) {
      if (
        object.designData &&
        (ids.has(object.designData.id) ||
          (clear &&
            object.designData.groupId &&
            groups.has(object.designData.groupId)))
      )
        object.designData.groupId = clear ? undefined : id;
    }
    commit();
    c.discardActiveObject();
    c.requestRenderAll();
    setCheckedLayers([]);
    setCanvasSelectionIds([]);
    setSelected(null);
  }
  async function resizeCanvas(w: number, h: number) {
    await task("Resizing canvas", async () => {
      const next = { ...docRef.current, canvasW: w, canvasH: h };
      await applyBackground(canvas.current!, next);
      docRef.current = next;
      setSize({ w, h });
      fitRef.current();
      commit();
    });
  }
  function downloadJSON() {
    void task("Saving JSON", async () => {
      await pendingReplacement.current;
      commit();
      saveBlob(
        new Blob([JSON.stringify(docRef.current, null, 2)], {
          type: "application/json",
        }),
        "excpix-design.json",
      );
    });
  }
  deleteRef.current = remove;
  async function duplicate() {
    const object = active();
    if (!object?.designData || locked) return;
    const element = snapshot(canvas.current!, docRef.current).elements.find(
      (e) => e.id === object.designData!.id,
    )!;
    await insert({
      ...element,
      id: crypto.randomUUID(),
      x: element.x + 24,
      y: element.y + 24,
      locked: false,
      groupId: undefined,
    });
  }
  duplicateRef.current = () => {
    void duplicate();
  };
  function reorder(delta: number) {
    const c = canvas.current,
      object = active();
    if (!c || !object || locked || object.designData?.locked) return;
    c.moveObjectTo(
      object,
      Math.max(
        0,
        Math.min(
          c.getObjects().length - 1,
          c.getObjects().indexOf(object) + delta,
        ),
      ),
    );
    c.requestRenderAll();
    commit();
  }
  function selectLayer(id: string) {
    const c = canvas.current,
      object = c
        ?.getObjects()
        .find((o) => (o as DesignObject).designData?.id === id);
    if (c && object) {
      c.setActiveObject(object);
      c.requestRenderAll();
      syncSelection();
    }
  }
  function layerAction(id: string, field: "locked" | "visible") {
    if (locked) return;
    const c = canvas.current,
      object = c
        ?.getObjects()
        .find((o) => (o as DesignObject).designData?.id === id) as DesignObject;
    if (!object || !c) return;
    if (field === "locked") lockObject(object, !object.designData!.locked);
    else object.set("visible", !object.visible);
    c.requestRenderAll();
    commit();
  }
  async function background(bg: DesignDocument["bg"]) {
    if (locked) return;
    await task("Updating background", async () => {
      const next = { ...docRef.current, bg };
      await applyBackground(canvas.current!, next);
      docRef.current = next;
      commit();
    });
  }
  function previewBackground(bg: DesignDocument["bg"]) {
    if (locked || !canvas.current) return;
    const next = { ...docRef.current, bg };
    void applyBackground(canvas.current, next);
    docRef.current = next;
    setDoc(clone(next));
    setRevision((v) => v + 1);
  }
  async function saveProject() {
    await task("Saving project", async () => {
      if (!user)
        throw new Error(
          "Sign in to save your project. You can also download the JSON.",
        );
      await pendingReplacement.current;
      commit();
      const result = await api<{ id: string }>("design/projects", {
        id: projectId || undefined,
        style_id: style.id,
        content_json: docRef.current,
      });
      setProjectId(result.id);
      setSaved(JSON.stringify(docRef.current));
      toast("Project saved.");
    });
  }
  saveRef.current = () => {
    void saveProject();
  };
  async function readUpload(file: File) {
    if (file.size > 8000000)
      throw new Error("Choose an image smaller than 8 MB.");
    if (
      !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(
        file.type,
      )
    )
      throw new Error("Choose PNG, JPEG, WebP or SVG.");
    let source: string;
    if (file.type === "image/svg+xml") source = svgSource(await file.text());
    else
      source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read this image."));
        reader.readAsDataURL(file);
      });
    const image = await loadImage(source),
      ratio = Math.min(1, 2400 / Math.max(image.width, image.height));
    const bitmap = document.createElement("canvas");
    bitmap.width = Math.max(1, Math.round(image.width * ratio));
    bitmap.height = Math.max(1, Math.round(image.height * ratio));
    bitmap
      .getContext("2d")!
      .drawImage(image, 0, 0, bitmap.width, bitmap.height);
    return {
      src: bitmap.toDataURL("image/png"),
      w: bitmap.width,
      h: bitmap.height,
    };
  }
  async function upload(files: FileList | null, isBackground = false) {
    if (!files?.length) return;
    await task("Uploading image", async () => {
      for (const file of [...files].slice(0, 10)) {
        const image = await readUpload(file);
        if (isBackground) {
          const next: DesignDocument = {
            ...docRef.current,
            bg: {
              ...docRef.current.bg,
              type:
                docRef.current.bg.type === "pattern"
                  ? ("pattern" as const)
                  : ("image" as const),
              src: image.src,
            },
          };
          if (uploadUnderlay.current) {
            next.bg = { ...docRef.current.bg, patternBgImage: image.src };
          }
          await applyBackground(canvas.current!, next);
          docRef.current = next;
          commit();
        } else {
          setUploads((old) => [...old, { name: file.name, src: image.src }]);
          const scale = Math.min(
            (docRef.current.canvasW * 0.65) / image.w,
            (docRef.current.canvasH * 0.65) / image.h,
            1,
          );
          const object = await makeObject(
            newElement("image", docRef.current, {
              src: image.src,
              w: image.w * scale,
              h: image.h * scale,
            }),
            libraryStyles.current,
          );
          canvas.current!.add(object);
          canvas.current!.setActiveObject(object);
          commit();
        }
      }
      canvas.current!.requestRenderAll();
      uploadUnderlay.current = false;
    });
  }
  async function addImage(src: string) {
    await task("Adding image", async () => {
      const image = await loadImage(src);
      const scale = Math.min(
        (docRef.current.canvasW * 0.65) / image.width,
        (docRef.current.canvasH * 0.65) / image.height,
        1,
      );
      await insert(
        newElement("image", docRef.current, {
          src,
          w: image.width * scale,
          h: image.height * scale,
        }),
      );
    });
  }
  function askReplace(title: string, fn: () => Promise<void>) {
    setConfirm({
      title,
      run: () => {
        setConfirm(null);
        void task("Opening design", fn);
      },
    });
  }
  async function importJSON(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 12000000) throw new Error("JSON file is too large.");
      const next = designSchema.parse(JSON.parse(await file.text()));
      askReplace("Open this JSON project?", async () => {
        await restore(
          {
            ...next,
            elements: next.elements.map((e) => ({
              ...e,
              id: e.id || crypto.randomUUID(),
            })),
          },
          true,
        );
        setProjectId("");
      });
    } catch (e) {
      message(e);
    }
  }
  async function exportDesign() {
    await task("Preparing download", async () => {
      await pendingReplacement.current;
      commit();
      const d = clone(docRef.current),
        element = document.createElement("canvas");
      const output = new Canvas(element, {
        width: d.canvasW,
        height: d.canvasH,
        enableRetinaScaling: false,
        renderOnAddRemove: false,
      });
      try {
        await applyBackground(output, d);
        for (const e of d.elements)
          if (e.visible && e.w > 0 && e.h > 0)
            output.add(
              await makeObject(
                e,
                libraryStyles.current,
                Math.min(quality, 4096),
              ),
            );
        const bitmap = output.toCanvasElement(
          quality / Math.max(d.canvasW, d.canvasH),
        );
        const response = await fetch("/api/design/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            style_id: style.id,
            content_json: d,
            quality,
            format,
            image: bitmap.toDataURL("image/png"),
          }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Download failed.");
        }
        saveBlob(
          await response.blob(),
          `${d.name.replace(/[^a-z0-9 _-]/gi, "").trim() || "excpix-design"}.${format === "jpeg" ? "jpg" : format}`,
        );
        setDownload(false);
        toast("Your design is ready.");
      } finally {
        await output.dispose();
      }
    });
  }
  function changeZoom(value: number) {
    const c = canvas.current;
    if (!c) return;
    value = Math.max(0.015, Math.min(2, value));
    c.setDimensions({
      width: Math.round(docRef.current.canvasW * value),
      height: Math.round(docRef.current.canvasH * value),
    });
    c.setZoom(value);
    c.requestRenderAll();
    setZoom(value);
  }
  const dirty = JSON.stringify(doc) !== saved,
    disabled = !ready || !!busy || locked;
  const groupSelectionIds =
    checkedLayers.length > 0
      ? checkedLayers
      : canvasSelectionIds.length > 0
        ? canvasSelectionIds
        : selected
          ? [selected.id]
          : [];
  const canUngroup = groupSelectionIds.some(
    (id) => doc.elements.find((element) => element.id === id)?.groupId,
  );
  const properties = selected ? (
    <fieldset disabled={disabled || selected.locked} className={css.properties}>
      {(selected.type === "text" || selected.type === "imageText") && (
        <div className={css.panelHeading}>
          <h2>
            {selected.type === "imageText"
              ? "Styled text"
              : "Text"}
          </h2>
          {selected.locked && <span>Locked</span>}
        </div>
      )}
      {(selected.type === "text" || selected.type === "imageText") && (
        <label className={css.field}>
          <span>Text</span>
          <textarea
            aria-label="Edit text"
            rows={3}
            maxLength={selected.type === "imageText" ? 160 : 2000}
            value={selected.text}
            onChange={(e) => patchElement({ text: e.target.value })}
          />
        </label>
      )}
      {selected.type === "text" && (
        <>
          <label className={css.field}>
            <span>Font</span>
            <div className={css.fontFavoriteRow}>
              <FontPickerPopup
                fontName={selected.fontFamily.split(",")[0].trim()}
                options={[
                  ...new Set([
                    ...fonts,
                    ...customFonts,
                    selected.fontFamily.split(",")[0].trim(),
                  ]),
                ]}
                previewText={selected.text}
                onSelect={(font) => patchElement({ fontFamily: font })}
                onUpload={() => fontInput.current?.click()}
              />
            </div>
          </label>
          <div className={css.row}>
            <NumberField
              label="Font size"
              value={selected.fontSize}
              min={1}
              max={2000}
              onChange={(v) => patchElement({ fontSize: v })}
            />
            <label className={css.field}>
              <span>Color</span>
              <input
                type="color"
                aria-label="Text color"
                value={selected.color}
                onChange={(e) => patchElement({ color: e.target.value })}
              />
            </label>
          </div>
          <div className={css.tools}>
            <IconButton
              label="Bold"
              active={selected.bold}
              onClick={() => patchElement({ bold: !selected.bold })}
            >
              <Bold size={17} />
            </IconButton>
            <IconButton
              label="Italic"
              active={selected.italic}
              onClick={() => patchElement({ italic: !selected.italic })}
            >
              <Italic size={17} />
            </IconButton>
            <IconButton
              label="Underline"
              active={selected.underline}
              onClick={() => patchElement({ underline: !selected.underline })}
            >
              <Underline size={17} />
            </IconButton>
            {(["left", "center", "right"] as const).map((align, i) => {
              const Icon = [AlignLeft, AlignCenter, AlignRight][i];
              return (
                <IconButton
                  key={align}
                  label={`Align ${align}`}
                  active={selected.align === align}
                  onClick={() => patchElement({ align })}
                >
                  <Icon size={17} />
                </IconButton>
              );
            })}
          </div>
        </>
      )}
      {["text", "imageText"].includes(selected.type) && (
        <div className={css.pair}>
          <NumberField
            label="Line height"
            value={selected.lineHeight}
            min={0.5}
            max={4}
            step={0.1}
            onChange={(v) => patchElement({ lineHeight: v })}
          />
          <NumberField
            label="Spacing"
            value={selected.letterSpacing}
            min={-30}
            max={100}
            step={0.5}
            onChange={(v) => patchElement({ letterSpacing: v })}
          />
        </div>
      )}
      {selected.type === "svg" && (
        <PaintControls
          element={selected}
          onChange={patchElement}
          showSolidColorPicker
        />
      )}
      {selected.type === "text" && (
        <>
          <details className={css.collapsibleProperty}>
            <summary>Shadow</summary>
            <ShadowControls element={selected} onChange={patchElement} />
          </details>
          <details className={css.collapsibleProperty}>
            <summary>Stroke</summary>
            <div className={css.pair}>
              <NumberField
                label="Stroke"
                value={selected.strokeWidth}
                min={0}
                max={50}
                onChange={(v) => patchElement({ strokeWidth: v })}
              />
              <label className={css.field}>
                <span>Stroke color</span>
                <input
                  type="color"
                  aria-label="Stroke color"
                  value={selected.strokeColor}
                  onChange={(e) =>
                    patchElement({ strokeColor: e.target.value })
                  }
                />
              </label>
            </div>
          </details>
        </>
      )}
      <NumberField
        label="Rotation"
        value={selected.rotation}
        min={-360}
        max={360}
        onChange={(v) => patchElement({ rotation: v })}
      />
      <label className={css.field}>
        <span>
          Opacity <output>{Math.round(selected.opacity * 100)}%</output>
        </span>
        <input
          aria-label="Opacity"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={selected.opacity}
          onChange={(e) => patchElement({ opacity: Number(e.target.value) })}
        />
      </label>
      {selected.type === "text" && (
        <PaintControls element={selected} onChange={patchElement} />
      )}
      {selected.type === "image" && (
        <ImageControls element={selected} onChange={patchElement} />
      )}
    </fieldset>
  ) : (
    <div className={css.noSelection}>
      <MousePointer2 size={26} />
      <h3>No selection</h3>
      <span>
        {doc.canvasW} x {doc.canvasH} px
      </span>
    </div>
  );
  function panelContent() {
    if (panel === "properties") return properties;
    if (panel === "text")
      return (
        <>
          <button
            className={css.primary}
            disabled={disabled}
            onClick={() =>
              void insert(newElement("text", docRef.current), true)
            }
          >
            <Plus size={17} />
            Add text
          </button>
          <div className={css.segmented}>
            {["all", "3d-text", "ai"].map((k) => (
              <button
                key={k}
                aria-pressed={textKind === k}
                onClick={() => setTextKind(k)}
              >
                {k === "all" ? "All" : k === "ai" ? "AI" : "3D Text"}
              </button>
            ))}
          </div>
          <div className={css.tiles}>
            {library.letters
              .filter(
                (s) =>
                  (textKind === "all" || s.kind === textKind) &&
                  s.title.toLowerCase().includes(query.toLowerCase()),
              )
              .map((s) => (
                <StyleTile
                  key={s.id}
                  style={s}
                  onClick={() => {
                    if ((s.is_premium || !s.is_free) && !paid) {
                      toast("This text style requires a paid plan.", true);
                      return;
                    }
                    void insert(
                      newElement("imageText", docRef.current, {
                        styleId: s.id,
                        text: "EXCPIX",
                        w: doc.canvasW * 0.7,
                        h: doc.canvasH * 0.28,
                      }),
                    );
                  }}
                />
              ))}
          </div>
        </>
      );
    if (panel === "elements")
      return (
        <>
          <label className={css.field}>
            <span>Category</span>
            <select
              value={assetKind}
              onChange={(e) => setAssetKind(e.target.value)}
            >
              <option value="all">All elements</option>
              {[...new Set(library.assets.map((a) => a.category))].map(
                (cat) => (
                  <option key={cat}>{cat}</option>
                ),
              )}
            </select>
          </label>
          <div className={css.assets}>
            {library.assets
              .filter(
                (a) =>
                  (assetKind === "all" || a.category === assetKind) &&
                  a.name.toLowerCase().includes(query.toLowerCase()),
              )
              .map((a) => (
                <button
                  key={a.id}
                  disabled={disabled}
                  title={a.name}
                  onClick={() =>
                    void insert(
                      newElement("svg", docRef.current, {
                        svgStr: a.svg,
                        assetId: a.id,
                        w: 160,
                        h: 160,
                        color: "#000000",
                      }),
                    )
                  }
                >
                  <AssetIcon asset={a} />
                  <span>{a.name}</span>
                </button>
              ))}
          </div>
        </>
      );
    if (panel === "images")
      return (
        <>
          <label className={css.field}>
            <span>Category</span>
            <select
              value={imageCategory}
              onChange={(e) => setImageCategory(e.target.value)}
            >
              <option value="all">All images</option>
              {[
                ...new Set(
                  presets
                    .filter((p) => p.type === "image")
                    .map((p) => p.category),
                ),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className={css.tiles}>
            {presets
              .filter(
                (p) =>
                  p.type === "image" &&
                  (imageCategory === "all" || p.category === imageCategory) &&
                  p.name.toLowerCase().includes(query.toLowerCase()),
              )
              .map((p) => (
                <button
                  key={p.id}
                  className={css.styleTile}
                  title={p.name}
                  onClick={() => void addImage(p.url)}
                >
                  <img src={p.preview || p.url} alt={p.name} />
                  <span>{p.name}</span>
                </button>
              ))}
          </div>
        </>
      );
    if (panel === "uploads")
      return (
        <>
          <button
            className={css.primary}
            disabled={disabled}
            onClick={() => imageInput.current?.click()}
          >
            <Upload size={17} />
            Upload images
          </button>
          <div className={css.tiles}>
            {uploads.map((im, i) => (
              <div className={css.uploadTile} key={`${im.name}-${i}`}>
                <button
                  className={css.styleTile}
                  onClick={() => void addImage(im.src)}
                >
                  <img src={im.src} alt={im.name} />
                  <span>{im.name}</span>
                </button>
                <IconButton
                  label={`Remove ${im.name} from uploads`}
                  onClick={() =>
                    setUploads((items) => items.filter((_, index) => index !== i))
                  }
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        </>
      );
    if (panel === "background")
      return (
        <BackgroundControls
          bg={doc.bg}
          assets={library.backgrounds}
          onChange={(value) => void background(value)}
          onAngleChange={previewBackground}
          onAngleCommit={commit}
          onUpload={(underlay = false) => {
            uploadUnderlay.current = underlay;
            bgInput.current?.click();
          }}
          disabled={disabled}
        />
      );
    if (panel === "templates")
      return (
        <div className={css.tiles}>
          {library.templates
            .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
            .map((s) => (
              <StyleTile
                key={s.id}
                style={s}
                onClick={() =>
                  askReplace(`Open ${s.title}?`, async () => {
                    router.push(`/design/${s.slug}`);
                  })
                }
              />
            ))}
        </div>
      );
    if (panel === "projects")
      return (
        <>
          <div className={css.jsonActions}>
            <button
              className={css.secondary}
              aria-label="Download project JSON"
              title="Download project JSON"
              disabled={!ready || !!busy}
              onClick={downloadJSON}
            >
              <FileJson size={16} />
              <Download size={15} />
              JSON
            </button>
            <button
              className={css.secondary}
              aria-label="Upload project JSON"
              title="Upload project JSON"
              disabled={disabled}
              onClick={() => jsonInput.current?.click()}
            >
              <FileJson size={16} />
              <Upload size={15} />
              JSON
            </button>
          </div>
          <button
            className={css.primary}
            disabled={!ready || !!busy}
            onClick={() => void saveProject()}
          >
            <Save size={17} />
            Save to my projects
          </button>
          {!user && (
            <Link href="/login" className={css.signIn}>
              Sign in
            </Link>
          )}
          <button
            className={css.secondary}
            onClick={() => {
              const draft =
                previousDraft.current ||
                localStorage.getItem(`excpix-design:${style.id}`);
              if (!draft) {
                toast("No local draft saved.");
                return;
              }
              try {
                const parsed = designSchema.parse(JSON.parse(draft));
                askReplace("Restore the local draft?", async () =>
                  restore(parsed, true),
                );
              } catch (e) {
                message(e);
              }
            }}
          >
            <RotateCcw size={16} />
            Restore local draft
          </button>
          <div className={css.projectList}>
            {projects.map((p) => (
              <div key={p.id}>
                <button
                  onClick={() =>
                    askReplace(`Open ${p.title}?`, async () => {
                      await restore(designSchema.parse(p.content_json), true);
                      setProjectId(p.id);
                      setSaved(JSON.stringify(docRef.current));
                    })
                  }
                >
                  <FolderOpen size={18} />
                  <span>
                    <strong>{p.title}</strong>
                    <small>{new Date(p.updated_at).toLocaleDateString()}</small>
                  </span>
                </button>
                <IconButton
                  label={`Delete ${p.title}`}
                  onClick={() =>
                    setConfirm({
                      title: `Delete ${p.title}?`,
                      run: () => {
                        setConfirm(null);
                        void task("Deleting project", async () => {
                          await api("design/projects", { id: p.id }, "DELETE");
                          setProjects((list) =>
                            list.filter((x) => x.id !== p.id),
                          );
                          if (projectId === p.id) setProjectId("");
                        });
                      },
                    })
                  }
                >
                  <Trash2 size={16} />
                </IconButton>
              </div>
            ))}
          </div>
        </>
      );
    if (panel === "canvas")
      return (
        <>
          <div className={css.pair}>
            <NumberField
              label="Canvas width"
              min={64}
              max={8192}
              value={size.w}
              onChange={(v) => setSize((s) => ({ ...s, w: Math.round(v) }))}
            />
            <NumberField
              label="Canvas height"
              min={64}
              max={8192}
              value={size.h}
              onChange={(v) => setSize((s) => ({ ...s, h: Math.round(v) }))}
            />
          </div>
          <button
            className={css.primary}
            disabled={disabled}
            onClick={() => void resizeCanvas(size.w, size.h)}
          >
            <Check size={17} />
            Apply size
          </button>
          <div className={css.presets}>
            {[
              ["Square", 1080, 1080],
              ["Landscape", 1200, 800],
              ["Story", 1080, 1920],
              ["Banner", 1920, 640],
            ].map(([name, w, h]) => (
              <button
                key={name}
                onClick={() => void resizeCanvas(Number(w), Number(h))}
              >
                <Scan size={17} />
                <span>
                  {name}
                  <small>
                    {w} x {h}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </>
      );
    if (panel === "layers")
      return (
        <div className={css.layerList}>
          {[...doc.elements].reverse().map((e, i) => (
            <div key={e.id} data-selected={selected?.id === e.id}>
              <input
                type="checkbox"
                aria-label={`Select layer ${doc.elements.length - i} for grouping`}
                checked={checkedLayers.includes(e.id)}
                onChange={(v) =>
                  setCheckedLayers((old) =>
                    v.target.checked
                      ? [...old, e.id]
                      : old.filter((id) => id !== e.id),
                  )
                }
              />
              <button onClick={() => selectLayer(e.id)}>
                <span>{doc.elements.length - i}</span>
                <strong>{e.text || e.type}</strong>
                {e.groupId && <Group size={12} />}
              </button>
              <IconButton
                label={`${e.visible ? "Hide" : "Show"} layer ${doc.elements.length - i}`}
                onClick={() => layerAction(e.id, "visible")}
              >
                {e.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </IconButton>
              <IconButton
                label={`${e.locked ? "Unlock" : "Lock"} layer ${doc.elements.length - i}`}
                onClick={() => layerAction(e.id, "locked")}
              >
                {e.locked ? (
                  <LockKeyhole size={15} />
                ) : (
                  <LockKeyholeOpen size={15} />
                )}
              </IconButton>
            </div>
          ))}
          {!doc.elements.length && <p>No layers</p>}
        </div>
      );
    if (panel === "qr")
      return (
        <>
          <label className={css.field}>
            <span>URL or text</span>
            <textarea
              rows={4}
              value={qr}
              maxLength={1200}
              onChange={(e) => setQr(e.target.value)}
            />
          </label>
          <label className={css.field}>
            <span>Color</span>
            <input
              type="color"
              aria-label="QR color"
              value={qrColor}
              onChange={(e) => setQrColor(e.target.value)}
            />
          </label>
          <button
            className={css.primary}
            disabled={disabled || !qr.trim()}
            onClick={() =>
              void task("Creating QR code", async () => {
                const QR = await import("qrcode");
                const src = await QR.toDataURL(qr, {
                  width: 512,
                  margin: 2,
                  errorCorrectionLevel: "H",
                  color: { dark: qrColor, light: "#ffffff" },
                });
                await insert(
                  newElement("qr", docRef.current, { src, w: 220, h: 220 }),
                );
              })
            }
          >
            <Plus size={17} />
            Add QR code
          </button>
        </>
      );
  }
  return (
    <main
      className={css.editor}
      data-design-editor="true"
      aria-label={`${style.title} design editor`}
    >
      <header className={css.header}>
        <Link
          href={style.kind === "visual" ? "/visual" : "/design"}
          className={css.back}
          aria-label={style.kind === "visual" ? "Back to visual" : "Back to designs"}
        >
          <ArrowLeft size={18} />
        </Link>
        <Link href="/design" className={css.brand}>
          EXCPIX
        </Link>
        <div className={css.title}>
          <h1>{style.title}</h1>
          <input
            aria-label="Project name"
            value={doc.name}
            maxLength={160}
            disabled={!ready}
            onChange={(e) => {
              docRef.current = { ...docRef.current, name: e.target.value };
              setDoc(docRef.current);
            }}
            onBlur={commit}
          />
        </div>
        <span className={css.saveStatus}>
          {dirty ? (
            "Unsaved changes"
          ) : (
            <>
              <Check size={13} />
              Saved
            </>
          )}
        </span>
        <div className={css.headerActions}>
          <IconButton
            label="Undo"
            disabled={!ready || !!busy || cursor.current <= 0}
            onClick={() => void goHistory(-1)}
          >
            <Undo2 size={18} />
          </IconButton>
          <IconButton
            label="Redo"
            disabled={
              !ready || !!busy || cursor.current >= history.current.length - 1
            }
            onClick={() => void goHistory(1)}
          >
            <Redo2 size={18} />
          </IconButton>
          <button
            className={css.save}
            disabled={!ready || !!busy}
            onClick={() => void saveProject()}
            title="Save project"
            aria-label="Save project"
          >
            <Save size={16} />
            <span>Save</span>
          </button>
          <button
            className={css.primary}
            disabled={!ready || !!busy}
            onClick={() => setDownload(true)}
            aria-label="Download design"
          >
            <Download size={16} />
            <span>Download</span>
          </button>
        </div>
      </header>
      <div className={css.toolbar}>
        <span className={css.breadcrumb}>
          Design <span>/</span> {doc.canvasW} x {doc.canvasH}
        </span>
        <div className={css.tools}>
          <IconButton
            label="Group selected layers"
            disabled={disabled || groupSelectionIds.length < 2}
            onClick={() => groupLayers()}
          >
            <Group size={17} />
          </IconButton>
          <IconButton
            label="Ungroup selected layers"
            disabled={disabled || !canUngroup}
            onClick={() => groupLayers(true)}
          >
            <Ungroup size={17} />
          </IconButton>
        </div>
        {canvasSelectionIds.length > 1 ? (
          null
        ) : selected ? (
          <div className={css.tools}>
            <IconButton
              label="Duplicate selected element"
              disabled={disabled || !selected}
              onClick={() => void duplicate()}
            >
              <Copy size={16} />
            </IconButton>
            <IconButton
              label="Bring forward"
              disabled={disabled || !selected}
              onClick={() => reorder(1)}
            >
              <ArrowUp size={16} />
            </IconButton>
            <IconButton
              label="Send backward"
              disabled={disabled || !selected}
              onClick={() => reorder(-1)}
            >
              <ArrowDown size={16} />
            </IconButton>
            <IconButton
              label="Delete selected element"
              disabled={disabled || !selected || selected.locked}
              onClick={remove}
            >
              <Trash2 size={16} />
            </IconButton>
            <span className={css.divider} />
            <IconButton
              label="Flip horizontally"
              disabled={disabled || selected.locked}
              onClick={() => patchElement({ flipX: !selected.flipX })}
            >
              <FlipHorizontal size={17} />
            </IconButton>
            <IconButton
              label="Flip vertically"
              disabled={disabled || selected.locked}
              onClick={() => patchElement({ flipY: !selected.flipY })}
            >
              <FlipVertical size={17} />
            </IconButton>
            <IconButton
              label="Center on canvas"
              disabled={disabled || selected.locked}
              onClick={() =>
                patchElement({
                  x: (doc.canvasW - selected.w) / 2,
                  y: (doc.canvasH - selected.h) / 2,
                })
              }
            >
              <Scan size={17} />
            </IconButton>
            <IconButton
              label="Reset rotation"
              disabled={disabled || selected.locked}
              onClick={() => patchElement({ rotation: 0 })}
            >
              <RotateCcw size={17} />
            </IconButton>
            <IconButton
              label="Edit selected element"
              onClick={() => setPanel("properties")}
            >
              <SlidersHorizontal size={17} />
            </IconButton>
            {selected.type === "text" && (
              <>
                <select
                  aria-label="Quick font"
                  value={selected.fontFamily.split(",")[0].trim()}
                  onChange={(e) => patchElement({ fontFamily: e.target.value })}
                >
                  {[...new Set([...fonts, selected.fontFamily])].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                <input
                  aria-label="Quick text color"
                  type="color"
                  value={selected.color}
                  onChange={(e) => patchElement({ color: e.target.value })}
                />
                <IconButton
                  label="Quick bold"
                  active={selected.bold}
                  onClick={() => patchElement({ bold: !selected.bold })}
                >
                  <Bold size={16} />
                </IconButton>
              </>
            )}
          </div>
        ) : null}
        <span className={css.layerCount}>{doc.elements.length} layers</span>
      </div>
      <div className={css.workspace} data-panel={!!panel}>
        <nav className={css.rail} aria-label="Design tools">
          {tabs.map((t) => (
            <button
              key={t.id}
              aria-label={t.label}
              aria-pressed={panel === t.id}
              onClick={() => {
                setPanel(panel === t.id ? null : t.id);
                setQuery("");
              }}
            >
              <t.icon size={20} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        {panel && (
          <aside
            className={css.panel}
            aria-label={`${panel === "properties" ? "Edit element" : tabs.find((t) => t.id === panel)?.label} panel`}
          >
            <div className={css.panelHeader}>
              <h2>
                {panel === "properties"
                  ? "Edit element"
                  : tabs.find((t) => t.id === panel)?.label}
              </h2>
              <IconButton label="Close panel" onClick={() => setPanel(null)}>
                <X size={17} />
              </IconButton>
            </div>
            {["text", "elements", "images", "templates"].includes(panel) && (
              <label className={css.search}>
                <Search size={15} />
                <input
                  placeholder="Search"
                  aria-label={`Search ${panel}`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            )}
            <div className={css.panelBody}>{panelContent()}</div>
          </aside>
        )}
        <section className={css.stage}>
          <div ref={viewport} className={css.viewport}>
            <div className={css.canvasFrame}>
              <canvas ref={canvasEl} />
              {guides.x && <span className={css.guideX} />}{" "}
              {guides.y && <span className={css.guideY} />}
            </div>
          </div>
          {(!ready || !!busy) && (
            <div className={css.loading} role="status">
              <LoaderCircle size={17} className="spin" />
              {busy || "Loading design"}
            </div>
          )}
          {error && (
            <div className={css.error} role="alert">
              <span>{error}</span>
              <IconButton label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </IconButton>
            </div>
          )}
          <div className={css.statusbar}>
            <span>
              {locked ? (
                <>
                  <LockKeyhole size={13} />
                  Locked design
                </>
              ) : selected?.type === "imageText" ? (
                "Styled text"
              ) : (
                selected?.type || "Canvas"
              )}
            </span>
            <div className={css.tools}>
              <IconButton
                label="Zoom out"
                onClick={() => changeZoom(zoom * 0.8)}
              >
                <Minus size={16} />
              </IconButton>
              <input
                aria-label="Zoom"
                type="range"
                min={2}
                max={200}
                value={Math.round(zoom * 100)}
                onChange={(e) => changeZoom(Number(e.target.value) / 100)}
              />
              <output>{Math.round(zoom * 100)}%</output>
              <IconButton
                label="Zoom in"
                onClick={() => changeZoom(zoom * 1.25)}
              >
                <Plus size={16} />
              </IconButton>
              <IconButton label="Fit canvas" onClick={() => fitRef.current()}>
                <Maximize2 size={16} />
              </IconButton>
            </div>
          </div>
        </section>
      </div>
      <input
        hidden
        ref={imageInput}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={bgInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(e) => {
          void upload(e.target.files, true);
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={jsonInput}
        type="file"
        accept="application/json,.json"
        onChange={(e) => {
          void importJSON(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={fontInput}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file)
            void task("Loading font", async () => {
              if (file.size > 5000000)
                throw new Error("Choose a font smaller than 5 MB.");
              const name = `CustomFont${Date.now()}`,
                font = new FontFace(name, await file.arrayBuffer());
              await font.load();
              document.fonts.add(font);
              setCustomFonts((old) => [...old, name]);
              const fontData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () =>
                  resolve(
                    String(reader.result).replace(
                      /^data:[^;]+;/,
                      "data:font/woff2;",
                    ),
                  );
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              patchElement({ fontFamily: name, fontData });
            });
        }}
      />
      <dialog
        ref={modalRef}
        className={css.dialog}
        onCancel={() => setDownload(false)}
        onClose={() => setDownload(false)}
      >
        <div className={css.panelHeader}>
          <h2>Download design</h2>
          <IconButton label="Close download" onClick={() => setDownload(false)}>
            <X size={18} />
          </IconButton>
        </div>
        <label className={css.field}>
          <span>Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            {["png", "jpeg", "webp", "pdf"].map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className={css.field}>
          <span>Resolution</span>
          <select
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          >
            <option value={1280}>1280 px</option>
            <option value={4096} disabled={!paid}>
              4K{!paid ? " - Paid" : ""}
            </option>
            <option value={8192} disabled={!paid}>
              8K{!paid ? " - Paid" : ""}
            </option>
          </select>
        </label>
        <p>
          {Math.round(
            (doc.canvasW * quality) / Math.max(doc.canvasW, doc.canvasH),
          )}{" "}
          x{" "}
          {Math.round(
            (doc.canvasH * quality) / Math.max(doc.canvasW, doc.canvasH),
          )}{" "}
          px{!paid ? " · Watermark included" : ""}
        </p>
        {error && (
          <p role="alert" className={css.dialogError}>
            {error}
          </p>
        )}
        <button
          className={css.primary}
          disabled={!!busy}
          onClick={() => void exportDesign()}
        >
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Download size={17} />
          )}{" "}
          {busy || "Download"}
        </button>
      </dialog>
      {confirm && (
        <Confirm
          title={confirm.title}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm.run}
        />
      )}
    </main>
  );
}
function AssetIcon({ asset }: { asset: DesignAsset }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    try {
      setSrc(svgSource(asset.svg));
    } catch {}
  }, [asset.svg]);
  return src ? <img src={src} alt="" /> : <Shapes size={25} />;
}
function Confirm({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className={css.dialog} onCancel={onCancel}>
      <h2>{title}</h2>
      <div className={css.confirmActions}>
        <button className={css.secondary} onClick={onCancel}>
          Cancel
        </button>
        <button className={css.primary} onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </dialog>
  );
}
