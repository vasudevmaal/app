"use client";
import { RotateCcw, Upload } from "lucide-react";
import type {
  DesignDocument,
  DesignElement,
  DesignBackground,
} from "@/lib/design";
import { PresetPicker, GradientStops } from "@/components/presets";
import css from "./editor.module.css";
type Patch = (value: Partial<DesignElement>) => void;
const gradient: NonNullable<DesignElement["gradient"]> = {
  type: "linear",
  color1: "#ff6b6b",
  color2: "#ffd166",
  angle: 90,
};
export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  return (
    <label className={css.field}>
      <span>
        {label}
        <output>{Math.round(value * 100) / 100}</output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </label>
  );
}
export function PaintControls({
  element,
  onChange,
  showSolidColorPicker = false,
}: {
  element: DesignElement;
  onChange: Patch;
  showSolidColorPicker?: boolean;
}) {
  const g = element.gradient || gradient;
  return (
    <>
      <label className={css.field}>
        <span>Fill</span>
        <select
          value={element.fillType}
          onChange={(e) =>
            onChange({
              fillType: e.target.value as DesignElement["fillType"],
              gradient: g,
            })
          }
        >
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
          <option value="radial">Radial</option>
        </select>
      </label>
      {element.fillType === "solid" ? (
        <>
          {showSolidColorPicker && (
            <label className={css.field}>
              <span>Color</span>
              <input
                type="color"
                aria-label="Element color"
                value={element.color}
                onChange={(e) => onChange({ color: e.target.value })}
              />
            </label>
          )}
          <PresetPicker
            type="color"
            onTransparent={() => onChange({ opacity: 0 })}
            onSelect={(p) => onChange({ color: p.color, opacity: 1 })}
          />
        </>
      ) : (
        <>
          <PresetPicker
            type="gradient"
            onTransparent={() => onChange({ opacity: 0 })}
            onSelect={(p) =>
              onChange({
                fillType: p.gradientType === "radial" ? "radial" : "gradient",
                opacity: 1,
                gradient: {
                  ...g,
                  type: p.gradientType,
                  stops: p.stops,
                  angle: p.angle,
                },
              })
            }
          />
          <GradientStops
            stops={
              g.stops || [
                { color: g.color1, pos: 0 },
                { color: g.color2, pos: 100 },
              ]
            }
            onChange={(stops) => onChange({ gradient: { ...g, stops } })}
          />
          <Slider
            label="Fill angle"
            value={g.angle}
            max={360}
            onChange={(angle) => onChange({ gradient: { ...g, angle } })}
          />
        </>
      )}
    </>
  );
}
export function ImageControls({
  element: e,
  onChange,
}: {
  element: DesignElement;
  onChange: Patch;
}) {
  const f = e.filters;
  return (
    <>
      <h3>Image adjustments</h3>
      {(
        [
          { key: "brightness", name: "Brightness", max: 200 },
          { key: "contrast", name: "Contrast", max: 200 },
          { key: "saturation", name: "Saturation", max: 200 },
          { key: "grayscale", name: "Grayscale", max: 100 },
          { key: "sepia", name: "Sepia", max: 100 },
          { key: "hue", name: "Hue", max: 360 },
          { key: "blur", name: "Blur", max: 20 },
          { key: "pixelate", name: "Pixelate", max: 50 },
        ] as const
      ).map((x) => (
        <Slider
          key={x.key}
          label={x.name}
          value={f[x.key]}
          max={x.max}
          onChange={(v) => onChange({ filters: { ...f, [x.key]: v } })}
        />
      ))}
      <button
        className={css.secondary}
        type="button"
        onClick={() =>
          onChange({
            filters: {
              brightness: 100,
              contrast: 100,
              saturation: 100,
              grayscale: 0,
              sepia: 0,
              hue: 0,
              blur: 0,
              pixelate: 0,
            },
          })
        }
      >
        <RotateCcw size={15} />
        Reset filters
      </button>
      <h3>Shape & border</h3>
      <Slider
        label="Corner radius"
        value={e.radius}
        max={50}
        onChange={(radius) => onChange({ radius })}
      />
      <label className={css.check}>
        <input
          type="checkbox"
          checked={e.borderEnabled}
          onChange={(v) => onChange({ borderEnabled: v.target.checked })}
        />
        Border
      </label>
      {e.borderEnabled && (
        <>
          <Slider
            label="Border size"
            value={e.borderWidth}
            onChange={(borderWidth) => onChange({ borderWidth })}
          />
          <label className={css.field}>
            <span>Border color</span>
            <input
              type="color"
              value={e.borderColor}
              onChange={(v) => onChange({ borderColor: v.target.value })}
            />
          </label>
          <PresetPicker
            type="color"
            onSelect={(p) => onChange({ borderColor: p.color })}
          />
        </>
      )}
    </>
  );
}
export function ShadowControls({
  element: e,
  onChange,
}: {
  element: DesignElement;
  onChange: Patch;
}) {
  return (
    <>
      <label className={css.check}>
        <input
          type="checkbox"
          checked={e.shadowEnabled}
          onChange={(v) => onChange({ shadowEnabled: v.target.checked })}
        />
        Enable shadow
      </label>
      {e.shadowEnabled && (
        <>
          <Slider
            label="Shadow X"
            value={e.shadowX}
            min={-100}
            onChange={(shadowX) => onChange({ shadowX })}
          />
          <Slider
            label="Shadow Y"
            value={e.shadowY}
            min={-100}
            onChange={(shadowY) => onChange({ shadowY })}
          />
          <Slider
            label="Shadow blur"
            value={e.shadowBlur}
            onChange={(shadowBlur) => onChange({ shadowBlur })}
          />
          <Slider
            label="Shadow opacity"
            value={e.shadowOpacity}
            max={1}
            step={0.01}
            onChange={(shadowOpacity) => onChange({ shadowOpacity })}
          />
          <label className={css.field}>
            <span>Shadow color</span>
            <input
              type="color"
              value={e.shadowColor}
              onChange={(v) => onChange({ shadowColor: v.target.value })}
            />
          </label>
        </>
      )}
    </>
  );
}
export function BackgroundControls({
  bg,
  assets,
  onChange,
  onAngleChange,
  onAngleCommit,
  onUpload,
  disabled,
}: {
  bg: DesignDocument["bg"];
  assets: DesignBackground[];
  onChange: (value: DesignDocument["bg"]) => void;
  onAngleChange?: (value: DesignDocument["bg"]) => void;
  onAngleCommit?: () => void;
  onUpload: (underlay?: boolean) => void;
  disabled: boolean;
}) {
  const g = bg.gradState || gradient;
  const patch = (p: Partial<DesignDocument["bg"]>) =>
    onChange({ ...bg, gradState: g, ...p });
  const gradControls = (
    <>
      <PresetPicker
        type="gradient"
        onSelect={(p) =>
          patch({
            gradState: {
              ...g,
              type: p.gradientType,
              stops: p.stops,
              angle: p.angle,
            },
          })
        }
      />
      <label className={css.field}>
        <span>Gradient type</span>
        <select
          value={g.type}
          onChange={(e) =>
            patch({
              gradState: { ...g, type: e.target.value as "linear" | "radial" },
            })
          }
        >
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
      </label>
      <GradientStops
        stops={
          g.stops || [
            { color: g.color1, pos: 0 },
            { color: g.color2, pos: 100 },
          ]
        }
        onChange={(stops) => patch({ gradState: { ...g, stops } })}
      />
      <Slider
        label="Background angle"
        value={g.angle}
        max={360}
        onChange={(angle) =>
          (onAngleChange || onChange)({
            ...bg,
            gradState: { ...g, angle },
          })
        }
        onCommit={onAngleCommit}
      />
    </>
  );
  return (
    <fieldset disabled={disabled}>
      <label className={css.field}>
        <span>Background</span>
        <select
          value={bg.type}
          onChange={(e) => patch({ type: e.target.value as typeof bg.type })}
        >
          {["solid", "gradient", "image", "pattern", "transparent"].map(
            (type) => (
              <option key={type}>{type}</option>
            ),
          )}
        </select>
      </label>
      {bg.type === "solid" && (
        <>
          <label className={css.field}>
            <span>Color</span>
            <input
              type="color"
              value={bg.color}
              onChange={(e) => patch({ color: e.target.value })}
            />
          </label>
          <PresetPicker
            type="color"
            onTransparent={() => patch({ type: "transparent", opacity: 0 })}
            onSelect={(p) => patch({ color: p.color, opacity: 1 })}
          />
        </>
      )}
      {bg.type === "gradient" && gradControls}
      {["image", "pattern"].includes(bg.type) && (
        <>
          <button
            type="button"
            className={css.primary}
            onClick={() => onUpload()}
          >
            <Upload size={17} />
            Upload background
          </button>
          <PresetPicker type="image" onSelect={(p) => patch({ src: p.url })} />
          {bg.type === "image" && (
            <label className={css.field}>
              <span>Image size</span>
              <select
                value={bg.imageMode}
                onChange={(e) =>
                  patch({ imageMode: e.target.value as typeof bg.imageMode })
                }
              >
                <option value="original">Original size</option>
                <option value="cover">Fill canvas</option>
                <option value="contain">Fit in canvas</option>
                <option value="stretch">Canvas size</option>
              </select>
            </label>
          )}
          {bg.type === "pattern" && (
            <>
              <Slider
                label="Pattern size"
                value={bg.patternSize}
                min={5}
                max={400}
                onChange={(patternSize) => patch({ patternSize })}
              />
              <label className={css.field}>
                <span>Pattern background</span>
                <select
                  value={bg.patternBgType}
                  onChange={(e) =>
                    patch({
                      patternBgType: e.target.value as typeof bg.patternBgType,
                    })
                  }
                >
                  {["transparent", "solid", "gradient", "image"].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              {bg.patternBgType === "solid" && (
                <>
                  <input
                    aria-label="Pattern background color"
                    type="color"
                    value={bg.color}
                    onChange={(e) => patch({ color: e.target.value })}
                  />
                  <PresetPicker
                    type="color"
                    onSelect={(p) => patch({ color: p.color })}
                  />
                </>
              )}
              {bg.patternBgType === "gradient" && gradControls}
              {bg.patternBgType === "image" && (
                <>
                  <button
                    type="button"
                    className={css.secondary}
                    onClick={() => onUpload(true)}
                  >
                    <Upload size={16} />
                    Upload pattern background
                  </button>
                  <PresetPicker
                    type="image"
                    onSelect={(p) => patch({ patternBgImage: p.url })}
                  />
                </>
              )}
            </>
          )}
          <div className={css.tiles}>
            {assets
              .filter((a) => a.kind === bg.type)
              .map((a) => (
                <button
                  type="button"
                  key={a.id}
                  className={css.styleTile}
                  title={a.name}
                  onClick={() => patch({ src: a.render_url || a.original_url })}
                >
                  <img src={a.preview_url} alt={a.name} loading="lazy" />
                  <span>{a.name}</span>
                </button>
              ))}
          </div>
        </>
      )}
    </fieldset>
  );
}
