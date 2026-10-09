import {
  createCanvas,
  GlobalFonts,
  loadImage,
  DOMMatrix,
  Image,
} from "@napi-rs/canvas";
import { encodeAnimatedGif, gifFrameCount } from "./animated-gif.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { localImage } from "./local-media.mjs";
let running = false;
const loadedFonts = new Map();
let factory;
export async function engine() {
  if (!factory) {
    const source = (
      await readFile(
        path.join(process.cwd(), "src/lib/original-renderer.js"),
        "utf8",
      )
    )
      .replace("export function createRenderer", "function createRenderer")
      .replace("export const animations", "const animations");
    factory = new Function(
      "document",
      "DOMMatrix",
      "Image",
      source + ";return createRenderer;",
    )({ createElement: () => createCanvas(1, 1) }, DOMMatrix, Image);
  }
  return factory;
}
export async function font(state) {
  const signature = state.fontBase64
    ? `${state.fontBase64.length}:${state.fontBase64.slice(-48)}`
    : "bundled";
  if (loadedFonts.get(state.fontFamily) === signature) return;
  if (state.fontBase64) {
    if (
      !/^data:.*;base64,/.test(state.fontBase64) ||
      state.fontBase64.length > 4100000
    )
      throw new Error("Invalid embedded font");
    if (
      !GlobalFonts.register(
        Buffer.from(state.fontBase64.split(",")[1], "base64"),
        state.fontFamily,
      )
    )
      throw new Error("This font format cannot be exported.");
  } else {
    const css = await readFile("public/editor/fonts.css", "utf8");
    const blocks = (css.match(/@font-face\s*\{[^}]+\}/g) || []).filter((b) =>
      b.includes(`'${state.fontFamily}'`),
    );
    if (!blocks.length)
      throw new Error("This font is not installed on the server.");
    for (const block of blocks) {
      const url = block.match(/url\(([^)]+)\)/)?.[1];
      if (url)
        GlobalFonts.registerFromPath(
          path.join(process.cwd(), "public", url),
          state.fontFamily,
        );
    }
  }
  loadedFonts.set(state.fontFamily, signature);
}
export async function hydrate(obj) {
  for (const [source, target] of [
    ["base64", "image"],
    ["patternBase64", "patternImage"],
  ]) {
    if (obj[source]) {
      if (
        /^\/background\/(images|webp)\/[a-f0-9-]+\.(png|jpg|webp)$/.test(
          obj[source],
        )
      ) {
        obj[target] = await localImage(obj[source]);
        continue;
      }
      if (
        !/^data:image\/(png|jpeg|webp|gif);base64,/.test(obj[source]) ||
        obj[source].length > 3000000
      )
        throw new Error("Use an embedded PNG, JPEG, WebP or GIF image.");
      obj[target] = await loadImage(
        Buffer.from(obj[source].split(",")[1], "base64"),
      );
    }
  }
  if (obj.altImages) await Promise.all(obj.altImages.map(hydrate));
}
export async function renderExport(
  state,
  size,
  ratio,
  format,
  watermark = "",
  options = {},
) {
  if (running)
    throw new Error("The export server is busy. Please try again shortly.");
  running = true;
  try {
    if (format === "gif" && size > 1920)
      throw new Error(
        "GIF exports support up to 1920px. Use PNG for 4K, 8K or MAX.",
      );
    await font(state);
    const s = structuredClone(state);
    await Promise.all([s.fill, s.bg, ...s.layers].map(hydrate));
    const r =
      ratio === "original"
        ? (format === "gif" && options.previewAspect) || 2
        : ratio
            .split(":")
            .map(Number)
            .reduce((a, b) => a / b);
    const width = r >= 1 ? size : Math.round(size * r),
      height = r >= 1 ? Math.round(size / r) : size;
    const canvas = createCanvas(width, height);
    const renderer = await engine();
    const draw = renderer(canvas);
    let scale = draw(s, undefined, { measureOnly: true });
    if (s.animation.id !== 'none') {
      // One scale for the entire cycle prevents clipping and frame-to-frame zoom changes.
      const counts = new Set([120, gifFrameCount(s.animation.speed, options.frames)]);
      for (const count of counts) {
        for (let i = 0; i < count; i++) {
          scale = Math.min(scale, draw(s, i / count, { measureOnly: true }));
        }
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
    const render = (t) => {
      draw(s, t, { scale });
      if (watermark) {
        const ctx = canvas.getContext("2d");
        const fs = Math.max(16, width * 0.018);
        ctx.font = `600 ${fs}px sans-serif`;
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(0,0,0,.5)";
        ctx.fillText(watermark, width - fs, height - fs);
      }
    };
    if (format === "png") {
      render();
      return canvas.encode("png");
    }
    return await encodeAnimatedGif(canvas, render, {
      speed: s.animation.speed,
      frames: options.frames,
    });
  } finally {
    running = false;
  }
}
