import { createRequire } from "node:module";

const { GIFEncoder, quantize, applyPalette } = createRequire(import.meta.url)("gifenc");

const frameCacheBudget = 32 * 1024 * 1024;

// Canonical RGB565 colors make palette lookup independent of pixel traversal order.
const colors = new Uint8Array(65536 * 4);
for (let key = 0; key < 65536; key++) {
  colors[key * 4] = Math.round(((key >> 11) & 31) * 255 / 31);
  colors[key * 4 + 1] = Math.round(((key >> 5) & 63) * 255 / 63);
  colors[key * 4 + 2] = Math.round((key & 31) * 255 / 31);
  colors[key * 4 + 3] = 255;
}

export function gifFrameCount(speed = 1, frames) {
  const duration = Math.max(2, Math.round(200 / Math.max(0.1, speed)));
  return frames ?? Math.max(2, Math.min(240, Math.round(duration / 4)));
}

export async function encodeAnimatedGif(canvas, render, { speed = 1, frames } = {}) {
  const { width, height } = canvas;
  const ctx = canvas.getContext("2d");
  const duration = Math.max(2, Math.round(200 / Math.max(0.1, speed)));
  const count = gifFrameCount(speed, frames);
  const sampleCount = Math.min(count, 16);
  const stride = Math.max(1, Math.ceil(width * height * sampleCount / 262144));
  const samples = [];
  const cachedFrames = new Map();
  const cacheLimit = Math.floor(frameCacheBudget / (width * height * 4));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Exclude transparent pixels so their hidden RGB does not consume visible colors.
  for (let i = 0; i < sampleCount; i++) {
    const frame = Math.floor(i * count / sampleCount);
    render(frame / count);
    const rgba = ctx.getImageData(0, 0, width, height).data;
    if (cachedFrames.size < cacheLimit) cachedFrames.set(frame, rgba);
    for (let p = 0; p < rgba.length; p += stride * 4) {
      if (rgba[p + 3] >= 128)
        samples.push(rgba[p], rgba[p + 1], rgba[p + 2], 255);
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  const opaquePalette = samples.length
    ? quantize(Uint8Array.from(samples), 255, { format: "rgb565" })
    : [[0, 0, 0]];
  const lookup = applyPalette(colors, opaquePalette, "rgb565");
  const palette = [[0, 0, 0], ...opaquePalette];
  const gif = GIFEncoder();
  for (let i = 0; i < count; i++) {
    let rgba = cachedFrames.get(i);
    if (rgba) {
      cachedFrames.delete(i);
    } else {
      render(i / count);
      rgba = ctx.getImageData(0, 0, width, height).data;
    }
    const index = new Uint8Array(width * height);
    for (let p = 0; p < index.length; p++) {
      const offset = p * 4;
      if (rgba[offset + 3] < 128) continue;
      // Map colors directly to avoid a visible grain pattern on smooth fills.
      const r = rgba[offset];
      const g = rgba[offset + 1];
      const b = rgba[offset + 2];
      const key = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
      index[p] = lookup[key] + 1;
    }
    gif.writeFrame(index, width, height, {
      palette: i === 0 ? palette : undefined,
      delay: (Math.round((i + 1) * duration / count) - Math.round(i * duration / count)) * 10,
      repeat: 0,
      transparent: true,
      transparentIndex: 0,
      // Moving transparent frames must clear the previous frame to avoid trails.
      dispose: 2,
    });
    await new Promise((resolve) => setImmediate(resolve));
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}
