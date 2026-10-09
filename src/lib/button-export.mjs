import { createCanvas, loadImage, SvgExportFlag } from "@napi-rs/canvas";
import { font } from "./server-renderer.mjs";
import { buttonFrame, buttonLayout } from "./button-renderer.mjs";
import { createSvgGeometryPool, svgFrameAnimation } from "./svg-geometry.mjs";
import { encodeAnimatedGif } from "./animated-gif.mjs";

let running = false;
export async function renderButtonExport(
  state,
  size,
  ratio,
  format,
  previewAspect = 2,
) {
  if (running)
    throw new Error(
      "A button export is already running. Please try again shortly.",
    );
  running = true;
  try {
    await font(state);
    const aspect =
      ratio === "original"
        ? previewAspect
        : ratio
            .split(":")
            .map(Number)
            .reduce((a, b) => a / b);
    const length = format === "svg" ? 1280 : size;
    const width = Math.max(
      1,
      Math.round(aspect >= 1 ? length : length * aspect),
    );
    const height = Math.max(
      1,
      Math.round(aspect >= 1 ? length / aspect : length),
    );
    const wholeAnimation = state.wholeAnimation || state.animation || "none";
    const textAnimation = state.textAnimation || "none";
    const animated = wholeAnimation !== "none" || textAnimation !== "none";
    const duration =
      (wholeAnimation === "pulse" ? 2.4 : 2.2) / state.animationSpeed;
    const measure = createCanvas(1, 1);
    const layout = buttonLayout(measure.getContext("2d"), state);
    const iconImage = state.iconDataUrl
      ? await loadImage(state.iconDataUrl)
      : null;
    if (format !== "svg") {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");
      const draw = (phase = 0) =>
        buttonFrame(ctx, state, layout, width, height, phase, { iconImage });
      if (format === "png") {
        draw();
        return canvas.encode("png");
      }
      return await encodeAnimatedGif(canvas, draw, { speed: 2 / duration });
    }
    const pool = createSvgGeometryPool();
    const frames = animated ? 60 : 1;
    const backgroundType =
      state.backgroundType ||
      (state.backgroundTransparent ? "transparent" : "solid");
    const body = [];
    for (let i = 0; i < frames; i++) {
      const canvas = createCanvas(
        width,
        height,
        SvgExportFlag.ConvertTextToPaths,
      );
      const scale = buttonFrame(
        canvas.getContext("2d"),
        { ...state, backgroundTransparent: backgroundType === "transparent" },
        layout,
        width,
        height,
        i / frames,
        { vector: true, iconImage },
      );
      const content = canvas
        .getContent()
        .toString()
        .replace(/^[\s\S]*?<svg\b[^>]*>/, "")
        .replace(/<\/svg>\s*$/, "")
        .replace(/\bid="([^"]+)"/g, (_, id) => `id="f${i}_${id}"`)
        .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#f${i}_${id})`)
        .replace(
          /((?:xlink:)?href)="#([^"]+)"/g,
          (_, attr, id) => `${attr}="#f${i}_${id}"`,
        );
      if (i === 0 && state.shadowEnabled)
        body.push(
          `<defs><filter id="buttonShadow" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" color-interpolation-filters="sRGB"><feDropShadow dx="${state.shadowX * scale}" dy="${state.shadowY * scale}" stdDeviation="${(state.shadowBlur * scale) / 2}" flood-color="${state.shadowColor}" flood-opacity="${state.shadowOpacity}"/></filter></defs>`,
        );
      body.push(
        `<g visibility="${i === 0 ? "visible" : "hidden"}"${state.shadowEnabled ? ' filter="url(#buttonShadow)"' : ""}>${svgFrameAnimation(i, frames, duration)}${pool.compact(content)}</g>`,
      );
      if (i % 5 === 0) await new Promise((resolve) => setImmediate(resolve));
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.round(aspect >= 1 ? size : size * aspect)}" height="${Math.round(aspect >= 1 ? size / aspect : size)}" viewBox="0 0 ${width} ${height}">${pool.definitions()}${body.join("")}</svg>`;
    if (/<image\b|<text\b|data:image\//i.test(svg))
      throw new Error("Button SVG must contain vector paths only.");
    return Buffer.from(svg);
  } finally {
    running = false;
  }
}
