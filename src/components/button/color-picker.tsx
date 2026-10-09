"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import css from "./color-picker.module.css";

export type Paint = {
  type: "solid" | "gradient" | "radial";
  color: string;
  stops: { color: string; pos: number }[];
  angle: number;
  opacity: number;
};

function hsv(hex: string) {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const h = !d
    ? 0
    : max === r
      ? ((g - b) / d + 6) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return [h * 60, max ? d / max : 0, max];
}

function hex(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return "#" + f(5) + f(3) + f(1);
}

export function paintBackground(paint: Paint) {
  if (paint.type === "solid") return paint.color;
  const stops = [...paint.stops]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => `${s.color} ${s.pos}%`)
    .join(", ");
  return paint.type === "radial"
    ? `radial-gradient(circle, ${stops})`
    : `linear-gradient(${paint.angle}deg, ${stops})`;
}

const swatches = [
  "#ffffff",
  "#111111",
  "#ff3030",
  "#ff8800",
  "#ffcc00",
  "#24b86a",
  "#00bcd4",
  "#246bff",
  "#7428ed",
  "#ef48a8",
  "#6b7280",
  "#935c3b",
];

export function PaintPicker({
  label,
  value,
  onChange,
  inline = false,
  compact = false,
}: {
  label: string;
  value: Paint;
  onChange: (paint: Paint) => void;
  inline?: boolean;
  compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"solid" | "gradient" | "swatches">(
    value.type === "solid" ? "solid" : "gradient",
  );
  const [selected, setSelected] = useState(0);
  const [hue, setHue] = useState(0);
  const [draft, setDraft] = useState("");
  const index = Math.min(selected, value.stops.length - 1);
  const color = value.type === "solid" ? value.color : value.stops[index].color;
  const [, saturation, brightness] = hsv(color);
  const patch = (update: Partial<Paint>) => onChange({ ...value, ...update });
  const changeColor = (next: string) => {
    setDraft(next);
    if (value.type === "solid") patch({ color: next });
    else
      patch({
        stops: value.stops.map((stop, i) =>
          i === index ? { ...stop, color: next } : stop,
        ),
      });
  };
  const syncColor = (next: string) => {
    setHue(hsv(next)[0]);
    setDraft(next);
  };
  return (
    <>
      {!inline && (
        <button
          type="button"
          className={css.trigger}
          onClick={() => {
            setTab(value.type === "solid" ? "solid" : "gradient");
            syncColor(color);
            dialog.current?.showModal();
          }}
          aria-label={label}
          title={label}
        >
          <span>{label}</span>
          <span
            className={css.chip}
            style={{
              background: paintBackground(value),
              opacity: value.opacity,
            }}
          />
        </button>
      )}
      <dialog
        ref={dialog}
        open={inline || undefined}
        className={
          inline
            ? compact && value.type !== "solid"
              ? css.inline + " " + css.compact
              : css.inline
            : css.dialog
        }
        aria-label={label + " colors"}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const box = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < box.left ||
              event.clientX > box.right ||
              event.clientY < box.top ||
              event.clientY > box.bottom
            )
              dialog.current?.close();
          }
        }}
      >
        <header>
          <h2>Colors</h2>
          <button
            type="button"
            aria-label="Close colors"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </header>
        <div className={css.tabs}>
          {(["solid", "gradient", "swatches"] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              aria-pressed={tab === mode}
              onClick={() => {
                setTab(mode);
                if (mode !== "swatches") {
                  const type =
                    mode === "solid"
                      ? "solid"
                      : value.type === "radial"
                        ? "radial"
                        : "gradient";
                  patch({ type });
                  syncColor(
                    type === "solid" ? value.color : value.stops[index].color,
                  );
                }
              }}
            >
              {mode === "solid"
                ? "Solid"
                : mode === "gradient"
                  ? "Gradient"
                  : "Swatches"}
            </button>
          ))}
        </div>
        {tab === "swatches" ? (
          <div className={css.swatches}>
            {swatches.map((swatch) => (
              <button
                type="button"
                key={swatch}
                style={{ background: swatch }}
                aria-label={swatch}
                title={swatch}
                onClick={() => {
                  changeColor(swatch);
                  syncColor(swatch);
                }}
              />
            ))}
          </div>
        ) : (
          <>
            {value.type !== "solid" && (
              <>
                <div className={css.modes}>
                  {(["gradient", "radial"] as const).map((type) => (
                    <button
                      type="button"
                      key={type}
                      aria-pressed={value.type === type}
                      onClick={() => patch({ type })}
                    >
                      {type === "gradient" ? "Linear" : "Radial"}
                    </button>
                  ))}
                  {value.type === "gradient" && (
                    <label>
                      Angle
                      <input
                        aria-label="Gradient angle"
                        type="number"
                        min={0}
                        max={360}
                        value={value.angle}
                        onChange={(e) =>
                          patch({
                            angle: Math.max(
                              0,
                              Math.min(360, Number(e.target.value)),
                            ),
                          })
                        }
                      />
                    </label>
                  )}
                </div>
                {compact ? (
                  <>
                    <div
                      className={css.compactBar}
                      style={{
                        background: paintBackground({
                          ...value,
                          type: "gradient",
                          angle: 90,
                        }),
                      }}
                      title="Click to add a color stop"
                      onClick={(event) => {
                        if (
                          event.target !== event.currentTarget ||
                          value.stops.length >= 12
                        )
                          return;
                        const box = event.currentTarget.getBoundingClientRect();
                        const pos = Math.round(
                          Math.max(
                            0,
                            Math.min(
                              100,
                              ((event.clientX - box.left) / box.width) * 100,
                            ),
                          ),
                        );
                        patch({ stops: [...value.stops, { color, pos }] });
                        setSelected(value.stops.length);
                      }}
                    >
                      {value.stops.map((stop, i) => (
                        <div
                          key={i}
                          className={css.compactStop}
                          style={{ left: stop.pos + "%" }}
                        >
                          <button
                            type="button"
                            className={css.stopMarker}
                            aria-label={"Move color stop " + (i + 1)}
                            title="Drag to move color stop"
                            style={{ background: index === i ? "#111" : "#888" }}
                            aria-pressed={index === i}
                            onPointerDown={(event) => {
                              event.currentTarget.setPointerCapture(
                                event.pointerId,
                              );
                              setSelected(i);
                              syncColor(stop.color);
                            }}
                            onPointerMove={(event) => {
                              if (
                                !event.currentTarget.hasPointerCapture(
                                  event.pointerId,
                                )
                              )
                                return;
                              const box =
                                event.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
                              const pos = Math.round(
                                Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    ((event.clientX - box.left) / box.width) *
                                      100,
                                  ),
                                ),
                              );
                              patch({
                                stops: value.stops.map((s, n) =>
                                  n === i ? { ...s, pos } : s,
                                ),
                              });
                            }}
                            onKeyDown={(event) => {
                              if (
                                event.key !== "ArrowLeft" &&
                                event.key !== "ArrowRight"
                              )
                                return;
                              event.preventDefault();
                              const pos = Math.max(
                                0,
                                Math.min(
                                  100,
                                  stop.pos +
                                    (event.key === "ArrowRight" ? 1 : -1),
                                ),
                              );
                              patch({
                                stops: value.stops.map((s, n) =>
                                  n === i ? { ...s, pos } : s,
                                ),
                              });
                            }}
                          />
                          {index === i && (
                            <>
                              <button
                                className={css.deleteStop}
                                type="button"
                                aria-label="Delete selected stop"
                                title="Delete selected stop"
                                disabled={value.stops.length <= 2}
                                onClick={() => {
                                  const stops = value.stops.filter(
                                    (_, n) => n !== i,
                                  );
                                  patch({ stops });
                                  setSelected(0);
                                  syncColor(stops[0].color);
                                }}
                              >
                                <X size={13} />
                              </button>
                              <input
                                className={css.stopColor}
                                type="color"
                                aria-label="Selected stop color"
                                value={stop.color}
                                onChange={(event) => {
                                  changeColor(event.target.value);
                                  syncColor(event.target.value);
                                }}
                              />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    {value.type === "gradient" && (
                      <label className={css.direction}>
                        <span>Gradient direction:</span>
                        <input
                          aria-label="Gradient direction"
                          type="range"
                          min={0}
                          max={360}
                          value={value.angle}
                          onChange={(event) =>
                            patch({ angle: Number(event.target.value) })
                          }
                        />
                      </label>
                    )}
                  </>
                ) : (
                  <>
                    <div
                      className={css.stopBar}
                      style={{
                        background: paintBackground({
                          ...value,
                          type: "gradient",
                          angle: 90,
                        }),
                      }}
                    >
                      {value.stops.map((stop, i) => (
                        <button
                          type="button"
                          key={i}
                          aria-label={`Color stop ${i + 1}`}
                          aria-pressed={i === index}
                          style={{
                            left: `${stop.pos}%`,
                            background: stop.color,
                          }}
                          onClick={() => {
                            setSelected(i);
                            syncColor(stop.color);
                          }}
                        />
                      ))}
                    </div>
                    <div className={css.stopControls}>
                      <label>
                        Position
                        <input
                          aria-label="Stop position"
                          type="range"
                          min={0}
                          max={100}
                          value={value.stops[index].pos}
                          onChange={(e) =>
                            patch({
                              stops: value.stops.map((s, i) =>
                                i === index
                                  ? { ...s, pos: Number(e.target.value) }
                                  : s,
                              ),
                            })
                          }
                          onInput={(e) =>
                            patch({
                              stops: value.stops.map((s, i) =>
                                i === index
                                  ? {
                                      ...s,
                                      pos: Number(e.currentTarget.value),
                                    }
                                  : s,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        title="Add color stop"
                        aria-label="Add color stop"
                        disabled={value.stops.length >= 12}
                        onClick={() => {
                          patch({
                            stops: [...value.stops, { color, pos: 50 }],
                          });
                          setSelected(value.stops.length);
                        }}
                      >
                        <Plus size={18} />
                      </button>
                      <button
                        type="button"
                        title="Remove color stop"
                        aria-label="Remove color stop"
                        disabled={value.stops.length <= 2}
                        onClick={() => {
                          const stops = value.stops.filter(
                            (_, i) => i !== index,
                          );
                          setSelected(0);
                          patch({ stops });
                          syncColor(stops[0].color);
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
            <div
              className={css.spectrum}
              style={{ backgroundColor: hex(hue, 1, 1) }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                const box = event.currentTarget.getBoundingClientRect();
                changeColor(
                  hex(
                    hue,
                    Math.max(
                      0,
                      Math.min(1, (event.clientX - box.left) / box.width),
                    ),
                    1 -
                      Math.max(
                        0,
                        Math.min(1, (event.clientY - box.top) / box.height),
                      ),
                  ),
                );
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId))
                  return;
                const box = event.currentTarget.getBoundingClientRect();
                changeColor(
                  hex(
                    hue,
                    Math.max(
                      0,
                      Math.min(1, (event.clientX - box.left) / box.width),
                    ),
                    1 -
                      Math.max(
                        0,
                        Math.min(1, (event.clientY - box.top) / box.height),
                      ),
                  ),
                );
              }}
            >
              <span
                style={{
                  left: `${saturation * 100}%`,
                  top: `${(1 - brightness) * 100}%`,
                }}
              />
            </div>
            <input
              className={css.hue}
              aria-label="Hue"
              type="range"
              min={0}
              max={359}
              value={hue}
              onChange={(e) => {
                const h = Number(e.target.value);
                setHue(h);
                changeColor(hex(h, saturation, brightness));
              }}
              onInput={(e) => {
                const h = Number(e.currentTarget.value);
                setHue(h);
                changeColor(hex(h, saturation, brightness));
              }}
            />
          </>
        )}
        <label className={css.opacity}>
          <output>{Math.round(value.opacity * 100)}%</output>
          <input
            aria-label="Color opacity"
            type="range"
            min={0}
            max={100}
            value={Math.round(value.opacity * 100)}
            onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })}
            onInput={(e) =>
              patch({ opacity: Number(e.currentTarget.value) / 100 })
            }
          />
        </label>
        <input
          className={css.hex}
          aria-label="Hex color"
          value={draft}
          maxLength={7}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) {
              changeColor(e.target.value);
              setHue(hsv(e.target.value)[0]);
            }
          }}
          onBlur={() => setDraft(color)}
        />
      </dialog>
    </>
  );
}
