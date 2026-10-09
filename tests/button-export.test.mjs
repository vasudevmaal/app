import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { renderButtonExport } from "../src/lib/button-export.mjs";
import { buttonFrame, buttonLayout } from "../src/lib/button-renderer.mjs";
import { font } from "../src/lib/server-renderer.mjs";

const seed = {
  text: "SUBSCRIBE",
  fontFamily: "Inter",
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: 0.4,
  lineHeight: 1.5,
  align: "center",
  isItalic: false,
  isUnderline: false,
  rotation: 0,
  curve: 0,
  zigzag: 0,
  wave: 0,
  paddingX: 36,
  paddingY: 15,
  radius: 30,
  borderWidth: 0,
  borderColor: "#b50000",
  textColor: "#ffffff",
  fillType: "gradient",
  fillStart: "#ff2020",
  fillEnd: "#c90000",
  fillAngle: 135,
  shadowEnabled: true,
  shadowColor: "#8d0000",
  shadowOpacity: 0.3,
  shadowBlur: 18,
  shadowX: 0,
  shadowY: 7,
  hoverFill: "#a90000",
  hoverText: "#ffffff",
  hoverLift: 3,
  animation: "none",
  animationSpeed: 1,
  background: "#f4f5f6",
  backgroundTransparent: true,
};

async function pixels(bytes, width = 640, height = 360) {
  const ctx = createCanvas(width, height).getContext("2d");
  ctx.drawImage(await loadImage(bytes), 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}
function unclipped(data, width = 640, height = 360) {
  let count = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha) count++;
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2)
        assert.equal(alpha, 0, `clipped edge: ${x},${y}`);
    }
  assert.ok(count > 100, "export is nonblank");
}

test("text linear and radial paints retain vector gradients in SVG and match PNG preview", async () => {
  for (const textFillType of ["gradient", "radial"]) {
    const state = { ...seed, fillType: "solid", fillOpacity: 0, shadowEnabled: false,
      textFillType, textOpacity: 0.65, textAngle: 90,
      textStops: [{ color: "#ff0000", pos: 0 }, { color: "#0000ff", pos: 100 }] };
    const svg = await renderButtonExport(state, 640, "16:9", "svg");
    assert.match(svg.toString(), textFillType === "radial" ? /<radialGradient/ : /<linearGradient/);
    assert.doesNotMatch(svg.toString(), /<image\b|<text\b/);
    const png = await renderButtonExport(state, 640, "16:9", "png");
    const canvas = createCanvas(640, 360);
    const ctx = canvas.getContext("2d");
    buttonFrame(ctx, state, buttonLayout(ctx, state), 640, 360);
    assert.deepEqual(await pixels(png), ctx.getImageData(0, 0, 640, 360).data);
    unclipped(await pixels(svg));
  }
});

test("button SVG outlines fonts and preserves gradient, shadow and clear edges", async () => {
  const bytes = await renderButtonExport(seed, 640, "16:9", "svg");
  const xml = bytes.toString();
  assert.match(xml, /width="640" height="360"/);
  assert.match(xml, /<path/);
  assert.match(xml, /<linearGradient/);
  assert.match(xml, /<feDropShadow/);
  assert.doesNotMatch(xml, /<text\b|<image\b|<script\b|data:image\//i);
  unclipped(await pixels(bytes));
});

test("every animated SVG uses repeating vector frames with unique resources", async () => {
  for (const animation of ["pulse", "bounce", "shine"]) {
    const xml = (
      await renderButtonExport({ ...seed, animation }, 640, "16:9", "svg")
    ).toString();
    assert.equal((xml.match(/<animate /g) || []).length, 60);
    assert.match(xml, /repeatCount="indefinite"/);
    const ids = [...xml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(ids.length, new Set(ids).size);
    assert.doesNotMatch(xml, /<text\b|<image\b|data:image\//i);
  }
});

test("PNG uses the same drawing as preview, including text and gradient angle", async () => {
  const state = {
    ...seed,
    fillAngle: 280,
    isItalic: true,
    isUnderline: true,
    text: "One\nTwo",
    rotation: -12,
  };
  await font(state);
  const ctx = createCanvas(640, 360).getContext("2d");
  buttonFrame(ctx, state, buttonLayout(ctx, state), 640, 360);
  assert.deepEqual(
    await pixels(await renderButtonExport(state, 640, "16:9", "png")),
    ctx.getImageData(0, 0, 640, 360).data,
  );
});

test("uploaded fonts and extreme effects stay inside PNG and SVG bounds", async () => {
  const file = (await readdir("public/editor/fonts")).find((name) =>
    name.endsWith(".woff2"),
  );
  const state = {
    ...seed,
    text: "ÁjÅ\nqgj",
    fontFamily: "ButtonUpload",
    fontBase64: `data:font/woff2;base64,${(await readFile(`public/editor/fonts/${file}`)).toString("base64")}`,
    isItalic: true,
    isUnderline: true,
    rotation: 53,
    curve: -100,
    zigzag: -100,
    wave: 100,
    lineHeight: 0.5,
    shadowBlur: 80,
    shadowX: -50,
    shadowY: 50,
    borderWidth: 20,
  };
  for (const format of ["png", "svg"])
    unclipped(
      await pixels(await renderButtonExport(state, 640, "16:9", format)),
    );
});

test("button GIF is an animated image with a complete looping cycle", async () => {
  const bytes = await renderButtonExport(
    { ...seed, animation: "bounce", animationSpeed: 4 },
    256,
    "16:9",
    "gif",
  );
  assert.match(bytes.subarray(0, 6).toString(), /^GIF8/);
  assert.ok(bytes.includes(Buffer.from("NETSCAPE2.0")));
  assert.ok(bytes.length > 1000);
});
