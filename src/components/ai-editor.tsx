"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Download,
  Film,
  ImageIcon,
  LockKeyhole,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Type,
  Undo2,
  Heart,
  Upload,
} from "lucide-react";
import type { Style, EditorState } from "@/lib/types";
import { glyphMap } from "@/lib/content";
import { defaultState } from "@/lib/defaults";
import { animations } from "@/lib/original-renderer";
import { editorSchema } from "@/lib/validation";
import { api, saveBlob } from "@/lib/client";
import { useApp } from "./providers";
import { Preview } from "./preview";
import { BackgroundQuickChoices, FillBuilder, ShareButtons } from "./editor";

function Range({
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

const aiTabs = [
  { id: "text", label: "Text", icon: Type },
  { id: "background", label: "Background", icon: ImageIcon },
  { id: "animate", label: "Animate", icon: Film },
  { id: "export", label: "Export", icon: Download },
];

export function AIEditor({ style }: { style: Style }) {
  const { user, settings, toast } = useApp();
  const initial = useMemo(
    () => ({ ...defaultState, ...style.content_json }),
    [style],
  );
  const [state, setState] = useState<EditorState>(initial);
  const [tab, setTab] = useState("text"),
    [history, setHistory] = useState<EditorState[]>([]),
    [future, setFuture] = useState<EditorState[]>([]),
    [playing, setPlaying] = useState(true);
  const [quality, setQuality] = useState(1280),
    [ratio, setRatio] = useState("original"),
    [format, setFormat] = useState("png"),
    [busy, setBusy] = useState(false),
    [favorite, setFavorite] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const glyphs = useMemo(() => glyphMap(style), [style]);
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
    if (locked) return;
    try {
      const saved = sessionStorage.getItem("excpix-project-load");
      if (saved) {
        setState(editorSchema.parse(JSON.parse(saved)) as EditorState);
        sessionStorage.removeItem("excpix-project-load");
      }
    } catch {}
  }, [style.id, locked]);
  async function download() {
    setBusy(true);
    try {
      const preview = previewRef.current?.querySelector("canvas");
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style_id: style.id,
          content_json: state,
          quality,
          ratio,
          format,
          previewAspect:
            format === "gif" && preview?.height
              ? preview.width / preview.height
              : undefined,
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      saveBlob(await response.blob(), style.slug + "." + format);
      toast("Your download is ready.");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
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
  return (
    <main className="editor-page main-width">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight size={13} />
        <Link href="/ai">AI Design</Link>
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
      <div className="editor-workspace ai-workspace">
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
                title="Reset lettering"
                disabled={locked}
                onClick={() => patch(initial)}
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
            <Preview state={state} glyphs={glyphs} animated={playing} />
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
                : style.style_category}
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
            <span>PNG / GIF</span>
          </div>
        </section>
        <section className="controls-pane">
          <nav
            className="editor-tabs ai-editor-tabs"
            aria-label="AI editor panels"
          >
            {aiTabs.map((t) => (
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
                  <h2>{aiTabs.find((t) => t.id === tab)?.label}</h2>
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
                      value={state.wave || 0}
                      onChange={(v) => patch({ wave: v })}
                    />
                  </div>
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
                            setFormat(a.id === "none" ? "png" : "gif");
                            if (a.id !== "none" && quality > 1920)
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
                    {["png", "gif"].map((f) => (
                      <button
                        key={f}
                        className={format === f ? "active" : ""}
                        onClick={() => {
                          setFormat(f);
                          setQuality(f === "gif" ? 768 : 1280);
                        }}
                      >
                        {f.toUpperCase()}
                        {f === "gif" && !paid && <LockKeyhole size={12} />}
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
                  <button
                    className="button accent full"
                    disabled={busy}
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
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 8000000) throw new Error();
                            patch(
                              editorSchema.parse(
                                JSON.parse(await file.text()),
                              ) as EditorState,
                            );
                            toast("Project loaded.");
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
          <div className="controls-bottom">
            <span>
              {locked ? "Locked template" : "AI image-letter template"}
            </span>
            <button className="button dark" onClick={() => setTab("export")}>
              <Download size={16} />
              Export
            </button>
          </div>
        </section>
      </div>
      <ShareButtons style={style} />
    </main>
  );
}
