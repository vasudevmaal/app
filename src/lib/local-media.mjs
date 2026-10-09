import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { drawLetters } from "./letter-renderer.mjs";
import { encodeAnimatedGif } from "./animated-gif.mjs";

export async function localImage(url) {
  if (
    !/^\/(?!\/)[\w./-]+\.(png|jpe?g|webp)$/i.test(url) ||
    url.split("/").includes("..")
  )
    throw new Error("Use a local PNG, JPEG or WebP asset.");
  const root = await realpath(path.join(process.cwd(), "public"));
  let filename;
  try {
    filename = await realpath(path.join(root, url));
  } catch {
    throw new Error("Image asset is missing. Add it in the content library.");
  }
  if (!filename.startsWith(root + path.sep))
    throw new Error("Invalid asset path.");
  const bytes = await readFile(filename);
  if (bytes.length > 20_000_000) throw new Error("Image asset exceeds 20 MB.");
  const image = await loadImage(bytes);
  if (image.width * image.height > 40_000_000)
    throw new Error("Image dimensions exceed the export limit.");
  return image;
}
export async function renderLetters(state, glyphs, size, ratio, watermark) {
  const letters = [...new Set(state.text.toUpperCase().replace(/\s/g, ""))];
  const images = Object.fromEntries(
    await Promise.all(
      letters.map(async (char) => {
        if (!glyphs[char])
          throw new Error(`This alphabet does not include ${char}.`);
        return [char, await localImage(glyphs[char])];
      }),
    ),
  );
  const s = structuredClone(state);
  await hydrateEmbedded(s.bg);
  const r =
    ratio === "original"
      ? 2
      : ratio
          .split(":")
          .map(Number)
          .reduce((a, b) => a / b);
  const canvas = createCanvas(
    r >= 1 ? size : Math.round(size * r),
    r >= 1 ? Math.round(size / r) : size,
  );
  drawLetters(canvas, s, images, watermark);
  return canvas.encode("png");
}
async function hydrateEmbedded(obj = {}) {
  for (const [source, target] of [
    ["base64", "image"],
    ["patternBase64", "patternImage"],
  ]) {
    if (!obj[source]) continue;
    if (/^\/background\/(images|webp)\/[a-f0-9-]+\.(png|jpg|webp)$/.test(obj[source])) { obj[target] = await localImage(obj[source]); continue; }
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
export async function renderLettersGif(state, glyphs, size, ratio, watermark, options = {}) {
  if (size > 1920)
    throw new Error(
      "GIF exports support up to 1920px. Use PNG for 4K, 8K or MAX.",
    );
  const letters = [...new Set(state.text.toUpperCase().replace(/\s/g, ""))];
  const images = Object.fromEntries(
    await Promise.all(
      letters.map(async (char) => {
        if (!glyphs[char])
          throw new Error(`This alphabet does not include ${char}.`);
        return [char, await localImage(glyphs[char])];
      }),
    ),
  );
  const s = structuredClone(state);
  await hydrateEmbedded(s.bg);
  const r =
    ratio === "original"
      ? options.previewAspect || 2
      : ratio
          .split(":")
          .map(Number)
          .reduce((a, b) => a / b);
  const width = r >= 1 ? size : Math.round(size * r),
    height = r >= 1 ? Math.round(size / r) : size;
  const canvas = createCanvas(width, height);
  return encodeAnimatedGif(canvas,
    (time) => drawLetters(canvas, s, images, watermark, time),
    { speed: s.animation?.speed || 1 },
  );
}
export async function renderPromptImage(url, size, watermark) {
  const image = await localImage(url),
    scale = Math.min(1, size / Math.max(image.width, image.height));
  const canvas = createCanvas(
    Math.max(1, Math.round(image.width * scale)),
    Math.max(1, Math.round(image.height * scale)),
  );
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  if (watermark) {
    const fs = Math.max(14, canvas.width * 0.025);
    ctx.font = `600 ${fs}px sans-serif`;
    ctx.textAlign = "right";
    const width = ctx.measureText(watermark).width;
    ctx.fillStyle = "#ffffffcc";
    ctx.fillRect(
      canvas.width - width - fs * 2,
      canvas.height - fs * 2.5,
      width + fs * 1.5,
      fs * 2,
    );
    ctx.fillStyle = "#202020";
    ctx.fillText(watermark, canvas.width - fs, canvas.height - fs);
  }
  return canvas.encode("png");
}
