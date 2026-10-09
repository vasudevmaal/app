import {
  Canvas,
  FabricImage,
  FabricObject,
  Textbox,
  Gradient,
  Pattern,
  Shadow,
} from "fabric";
import { hydrate } from "@/components/preview";
import { createRenderer } from "@/lib/original-renderer";
import { drawLetters } from "@/lib/letter-renderer.mjs";
import { glyphMap } from "@/lib/content";
import { defaultState } from "@/lib/defaults";
import type { Style, EditorState } from "@/lib/types";
import {
  designElementSchema,
  type DesignDocument,
  type DesignElement,
} from "@/lib/design";
import { imageEffects } from "./image-effects";

export type DesignObject = FabricObject & {
  designData?: DesignElement;
  imageSource?: HTMLImageElement | HTMLCanvasElement;
};
export function svgSource(source: string, color = "#000000") {
  const xml = new DOMParser().parseFromString(source, "image/svg+xml");
  if (
    xml.querySelector("parsererror") ||
    xml.documentElement.localName !== "svg"
  )
    throw new Error("This SVG is invalid.");
  const allowed = new Set([
    "svg",
    "g",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "defs",
    "linearGradient",
    "radialGradient",
    "stop",
    "clipPath",
    "title",
    "desc",
  ]);
  for (const el of [...xml.querySelectorAll("*")]) {
    if (!allowed.has(el.localName)) {
      el.remove();
      continue;
    }
    for (const a of [...el.attributes]) {
      if (
        /^on/i.test(a.name) ||
        ["style", "href", "xlink:href"].includes(a.name) ||
        (/url\(/i.test(a.value) && !/^url\(#[\w-]+\)$/.test(a.value))
      )
        el.removeAttribute(a.name);
      else if (a.value === "currentColor") el.setAttribute(a.name, color);
    }
  }
  xml.documentElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  xml.documentElement.setAttribute("width", "512");
  xml.documentElement.setAttribute("height", "512");
  return (
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(new XMLSerializer().serializeToString(xml))
  );
}
export async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("An image could not be loaded."));
    im.src = src;
  });
}
const rendered = new Map<string, HTMLCanvasElement>();
export async function lettering(
  element: DesignElement,
  styles: Style[],
  resolution = 1600,
) {
  const style = styles.find(
    (s) => s.id === element.styleId || s.slug === element.styleId,
  );
  if (!style)
    throw new Error(`Text style "${element.styleId}" is unavailable.`);
  const key = JSON.stringify([
    style.id,
    style.updated_at,
    element.text,
    element.letterSpacing,
    element.lineHeight,
    resolution,
  ]);
  if (rendered.has(key)) return rendered.get(key)!;
  const base = style.content_json?.fill ? style.content_json : defaultState;
  const state: EditorState = {
    ...structuredClone(base),
    text: element.uppercase ? element.text.toUpperCase() : element.text,
    rotation: 0,
    letterSpacing: element.letterSpacing,
    lineHeight: element.lineHeight,
    animation: { id: "none", speed: 1 },
    bg: { ...base.bg, type: "transparent", opacity: 0 },
  };
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = Math.round(resolution * 0.65);
  await document.fonts.load(
    `${state.isBold ? 700 : 400} 64px "${state.fontFamily}"`,
  );
  const ready = await hydrate(state);
  if (style.kind === "ai") {
    const glyphs = glyphMap(style);
    const images: Record<string, HTMLImageElement> = {};
    for (const char of new Set(state.text.toUpperCase().replace(/\s/g, ""))) {
      if (!glyphs[char])
        throw new Error(`The selected AI style does not include "${char}".`);
      try {
        images[char] = await loadImage(glyphs[char]);
      } catch {
        throw new Error(`AI letter "${char}" is missing from ${style.title}.`);
      }
    }
    drawLetters(canvas, ready, images, "");
  } else createRenderer(canvas, () => {})(ready);
  const ctx = canvas.getContext("2d")!,
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width,
    top = canvas.height,
    right = 0,
    bottom = 0;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++)
      if (pixels[(y * canvas.width + x) * 4 + 3] > 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  const cropped = document.createElement("canvas");
  cropped.width = Math.max(1, right - left + 1);
  cropped.height = Math.max(1, bottom - top + 1);
  if (right >= left)
    cropped
      .getContext("2d")!
      .drawImage(
        canvas,
        left,
        top,
        cropped.width,
        cropped.height,
        0,
        0,
        cropped.width,
        cropped.height,
      );
  if (rendered.size > 30) rendered.delete(rendered.keys().next().value!);
  rendered.set(key, cropped);
  return cropped;
}
export function snapshot(canvas: Canvas, doc: DesignDocument): DesignDocument {
  return {
    ...doc,
    elements: canvas
      .getObjects()
      .map((obj, index) => {
        const object = obj as DesignObject,
          original = object.designData!;
        if (!original) return null;
        const p = object.getPointByOrigin("left", "top");
        const update: Partial<DesignElement> = {
          x: p.x,
          y: p.y,
          w: Math.abs(object.width * object.scaleX),
          h: Math.abs(object.height * object.scaleY),
          rotation: object.angle,
          opacity: object.opacity,
          visible: object.visible,
          flipX: object.flipX,
          flipY: object.flipY,
          zIndex: index,
          locked: original.locked,
        };
        if (object instanceof Textbox) {
          update.text = object.text;
          update.fontSize = object.fontSize * object.scaleY;
          update.letterSpacing = (object.charSpacing * object.fontSize) / 1000;
        }
        return { ...original, ...update };
      })
      .filter((e): e is DesignElement => !!e),
  };
}
export function lockObject(object: DesignObject, locked: boolean) {
  object.set({
    lockMovementX: locked,
    lockMovementY: locked,
    lockRotation: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    hasControls: !locked,
  });
  if (object instanceof Textbox) object.editable = !locked;
  if (object.designData) object.designData.locked = locked;
}
const loadedFonts = new Map<string, string>();
export async function makeObject(
  element: DesignElement,
  styles: Style[],
  resolution = 1600,
): Promise<DesignObject> {
  let object: DesignObject;
  let imageSource: HTMLImageElement | HTMLCanvasElement | undefined;
  if (element.type === "text") {
    const family = element.fontFamily.split(",")[0].trim();
    if (element.fontData && loadedFonts.get(family) !== element.fontData) {
      const font = new FontFace(family, `url(${element.fontData})`);
      await font.load();
      document.fonts.add(font);
      loadedFonts.set(family, element.fontData);
    }
    await document.fonts.load(`${element.bold ? 700 : 400} 64px "${family}"`);
    object = new Textbox(
      element.uppercase ? element.text.toUpperCase() : element.text,
      {
        width: Math.max(1, element.w),
        fontFamily: family,
        fontSize: element.fontSize,
        fontWeight: element.bold ? "bold" : "normal",
        fontStyle: element.italic ? "italic" : "normal",
        underline: element.underline,
        textAlign: element.align,
        lineHeight: element.lineHeight,
        charSpacing: (element.letterSpacing / element.fontSize) * 1000,
        fill:
          element.fillType === "solid"
            ? element.color
            : fabricGradient(
                element.gradient,
                element.w,
                element.h,
                element.fillType === "radial",
              ),
        stroke: element.strokeWidth ? element.strokeColor : undefined,
        strokeWidth: element.strokeWidth,
        strokeLineJoin: "round",
        strokeLineCap: "round",
        paintFirst: "stroke",
        splitByGrapheme: true,
      },
    );
  } else {
    let source: HTMLImageElement | HTMLCanvasElement =
      element.type === "imageText"
        ? await lettering(element, styles, resolution)
        : await loadImage(
            element.type === "svg"
              ? svgSource(element.svgStr || "", element.color)
              : element.src || "",
          );
    if (element.type === "svg" && element.fillType !== "solid") {
      const bitmap = document.createElement("canvas");
      bitmap.width = source.width;
      bitmap.height = source.height;
      const ctx = bitmap.getContext("2d")!;
      ctx.drawImage(source, 0, 0);
      ctx.globalCompositeOperation = "source-in";
      const grad = element.gradient;
      const stops = grad?.stops || [
        { color: grad?.color1 || "#000000", pos: 0 },
        { color: grad?.color2 || "#ffffff", pos: 100 },
      ];
      const angle = (((grad?.angle || 90) - 90) * Math.PI) / 180,
        r = Math.max(bitmap.width, bitmap.height) / 2;
      const fill =
        element.fillType === "radial"
          ? ctx.createRadialGradient(
              bitmap.width / 2,
              bitmap.height / 2,
              0,
              bitmap.width / 2,
              bitmap.height / 2,
              r,
            )
          : ctx.createLinearGradient(
              bitmap.width / 2 - Math.cos(angle) * r,
              bitmap.height / 2 - Math.sin(angle) * r,
              bitmap.width / 2 + Math.cos(angle) * r,
              bitmap.height / 2 + Math.sin(angle) * r,
            );
      stops.forEach((s) => fill.addColorStop(s.pos / 100, s.color));
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, bitmap.width, bitmap.height);
      source = bitmap;
    }
    if (element.type === "image") {
      imageSource = source;
      source = imageEffects(source, element, resolution);
    }
    object = new FabricImage(source);
    object.set({
      scaleX: Math.max(1, element.w) / object.width,
      scaleY: Math.max(1, element.h) / object.height,
    });
  }
  object.set({
    originX: "left",
    originY: "top",
    left: element.x,
    top: element.y,
    angle: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
    flipX: element.flipX,
    flipY: element.flipY,
    cornerColor: "#ed674a",
    borderColor: "#ed674a",
    cornerStrokeColor: "#ffffff",
    transparentCorners: false,
    cornerSize: 10,
    touchCornerSize: 24,
    padding: 3,
    strokeUniform: true,
  });
  if (element.shadowEnabled) {
    const hex = element.shadowColor.replace("#", "");
    const color = `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${element.shadowOpacity})`;
    object.set(
      "shadow",
      new Shadow({
        blur: element.shadowBlur,
        color,
        offsetX: element.shadowX,
        offsetY: element.shadowY,
      }),
    );
  }
  object.designData = element;
  if (imageSource) object.imageSource = imageSource;
  lockObject(object, element.locked);
  object.setCoords();
  return object;
}
export async function applyBackground(canvas: Canvas, doc: DesignDocument) {
  canvas.backgroundImage = undefined;
  const bg = doc.bg;
  if (bg.type === "transparent") canvas.backgroundColor = "";
  else if (bg.type === "gradient") {
    const grad = bg.gradState ||
      doc.gradState || {
        type: "linear",
        color1: "#b05cff",
        color2: "#52a8ff",
        angle: 180,
      };
    const a = ((grad.angle - 90) * Math.PI) / 180,
      dx = (Math.cos(a) * doc.canvasW) / 2,
      dy = (Math.sin(a) * doc.canvasH) / 2;
    const colorStops = (
      grad.stops || [
        { color: grad.color1, pos: 0 },
        { color: grad.color2, pos: 100 },
      ]
    ).map((s) => ({ offset: s.pos / 100, color: s.color }));
    canvas.backgroundColor =
      grad.type === "radial"
        ? new Gradient({
            type: "radial",
            gradientUnits: "pixels",
            coords: {
              x1: doc.canvasW / 2,
              y1: doc.canvasH / 2,
              x2: doc.canvasW / 2,
              y2: doc.canvasH / 2,
              r1: 0,
              r2: Math.max(doc.canvasW, doc.canvasH) / 2,
            },
            colorStops,
          })
        : new Gradient({
            type: "linear",
            gradientUnits: "pixels",
            coords: {
              x1: doc.canvasW / 2 - dx,
              y1: doc.canvasH / 2 - dy,
              x2: doc.canvasW / 2 + dx,
              y2: doc.canvasH / 2 + dy,
            },
            colorStops,
          });
  } else if ((bg.type === "image" || bg.type === "pattern") && bg.src) {
    const image = await loadImage(bg.src);
    if (bg.type === "pattern") {
      const bitmap = document.createElement("canvas");
      bitmap.width = doc.canvasW;
      bitmap.height = doc.canvasH;
      const ctx = bitmap.getContext("2d")!;
      if (bg.patternBgType === "solid") {
        ctx.fillStyle = bg.color;
        ctx.fillRect(0, 0, bitmap.width, bitmap.height);
      }
      if (bg.patternBgType === "gradient") {
        const grad = fabricGradient(bg.gradState, doc.canvasW, doc.canvasH);
        ctx.fillStyle = grad.toLive(ctx);
        ctx.fillRect(0, 0, bitmap.width, bitmap.height);
      }
      if (bg.patternBgType === "image" && bg.patternBgImage) {
        const base = await loadImage(bg.patternBgImage);
        ctx.drawImage(base, 0, 0, bitmap.width, bitmap.height);
      }
      const p = ctx.createPattern(image, "repeat")!;
      p.setTransform(new DOMMatrix().scale(bg.patternSize / 100));
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, bitmap.width, bitmap.height);
      canvas.backgroundColor = "";
      canvas.backgroundImage = new FabricImage(bitmap, {
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        opacity: bg.opacity,
      });
    } else {
      const ratio =
        bg.imageMode === "original"
          ? 1
          : bg.imageMode === "contain"
            ? Math.min(doc.canvasW / image.width, doc.canvasH / image.height)
            : Math.max(doc.canvasW / image.width, doc.canvasH / image.height);
      canvas.backgroundColor = bg.color;
      canvas.backgroundImage = new FabricImage(image, {
        originX: "center",
        originY: "center",
        left: doc.canvasW / 2,
        top: doc.canvasH / 2,
        scaleX: bg.imageMode === "stretch" ? doc.canvasW / image.width : ratio,
        scaleY: bg.imageMode === "stretch" ? doc.canvasH / image.height : ratio,
        opacity: bg.opacity,
      });
    }
  } else canvas.backgroundColor = bg.color;
  canvas.requestRenderAll();
}
export function newElement(
  type: DesignElement["type"],
  doc: DesignDocument,
  props: Partial<DesignElement> = {},
): DesignElement {
  return designElementSchema.parse({
    id: crypto.randomUUID(),
    type,
    x: Math.round(doc.canvasW * 0.15),
    y: Math.round(doc.canvasH * 0.4),
    w: Math.round(doc.canvasW * 0.7),
    h: Math.round(doc.canvasH * 0.2),
    text: type === "text" ? "Add your text" : "EXCPIX",
    align: "center",
    locked: false,
    color: "#000000",
    fontSize: Math.min(96, Math.round(doc.canvasW * 0.07)),
    ...props,
  });
}
function fabricGradient(
  grad: DesignElement["gradient"],
  w: number,
  h: number,
  radial = grad?.type === "radial",
) {
  const angle = (((grad?.angle || 90) - 90) * Math.PI) / 180,
    dx = (Math.cos(angle) * w) / 2,
    dy = (Math.sin(angle) * h) / 2;
  const colorStops = (
    grad?.stops || [
      { color: grad?.color1 || "#000000", pos: 0 },
      { color: grad?.color2 || "#ffffff", pos: 100 },
    ]
  ).map((s) => ({ offset: s.pos / 100, color: s.color }));
  return radial
    ? new Gradient({
        type: "radial",
        gradientUnits: "pixels",
        coords: {
          x1: w / 2,
          y1: h / 2,
          x2: w / 2,
          y2: h / 2,
          r1: 0,
          r2: Math.max(w, h) / 2,
        },
        colorStops,
      })
    : new Gradient({
        type: "linear",
        gradientUnits: "pixels",
        coords: {
          x1: w / 2 - dx,
          y1: h / 2 - dy,
          x2: w / 2 + dx,
          y2: h / 2 + dy,
        },
        colorStops,
      });
}
