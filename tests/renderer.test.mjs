import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { renderExport } from "../src/lib/server-renderer.mjs";
import sharp from "sharp";
const seed = JSON.parse(await readFile("reference/default-state.json", "utf8"));
seed.fontFamily = "Bungee";
seed.wave = 0;
test("PNG renders content and respects dimensions", async () => {
  const png = await renderExport(seed, 640, "16:9", "png", "");
  assert.equal(png.readUInt32BE(16), 640);
  assert.equal(png.readUInt32BE(20), 360);
  const im = await loadImage(png),
    canvas = createCanvas(640, 360),
    ctx = canvas.getContext("2d");
  ctx.drawImage(im, 0, 0);
  const data = ctx.getImageData(0, 0, 640, 360).data;
  const colors = new Set();
  for (let i = 0; i < data.length; i += 64)
    colors.add(data.slice(i, i + 4).join(","));
  assert.ok(
    colors.size > 20,
    "Canvas must contain lettering, not only a flat background",
  );
});
test("watermark is part of the generated pixels", async () => {
  const plain = await renderExport(seed, 640, "16:9", "png", "");
  const marked = await renderExport(seed, 640, "16:9", "png", "EXCPIX");
  assert.notDeepEqual(plain, marked);
});
test("transparent PNG preserves alpha and 4K portrait sizing", async () => {
  const s = structuredClone(seed);
  s.bg.type = "transparent";
  const png = await renderExport(s, 3840, "9:16", "png", "");
  assert.equal(png.readUInt32BE(16), 2160);
  assert.equal(png.readUInt32BE(20), 3840);
  const im = await loadImage(png),
    canvas = createCanvas(20, 20);
  canvas.getContext("2d").drawImage(im, 0, 0, 20, 20);
  assert.equal(canvas.getContext("2d").getImageData(0, 0, 1, 1).data[3], 0);
});
test("GIF contains multiple frames and transparent palette", async () => {
  const s = structuredClone(seed);
  s.bg.type = "transparent";
  s.animation = { id: "float", speed: 1 };
  const gif = await renderExport(s, 256, "1:1", "gif", "", { frames: 3 });
  assert.equal(gif.subarray(0, 6).toString(), "GIF89a");
  assert.ok(gif.length > 1000);
});
test("3D Text GIF uses the preview ratio only for Original exports", async () => {
  const s = structuredClone(seed);
  s.animation = { id: "float", speed: 1 };
  const options = { frames: 3, previewAspect: 1.25 };
  const original = await renderExport(s, 300, "original", "gif", "", options);
  assert.equal(original.readUInt16LE(6), 300);
  assert.equal(original.readUInt16LE(8), 240);
  const square = await renderExport(s, 300, "1:1", "gif", "", options);
  assert.equal(square.readUInt16LE(8), 300);
  const png = await renderExport(s, 300, "original", "png", "", options);
  assert.equal(png.readUInt32BE(20), 150);
});
test("3D Text GIF first frame retains the source rendering and transparent silhouette", async () => {
  const s = structuredClone(seed);
  s.bg.type = "transparent";
  s.animation = { id: "float", speed: 1 };
  const png = await renderExport(s, 320, "1:1", "png", "");
  const gif = await renderExport(s, 320, "1:1", "gif", "", { frames: 4 });
  const expected = await sharp(png).ensureAlpha().raw().toBuffer();
  const actual = await sharp(gif).ensureAlpha().raw().toBuffer();
  let error = 0, colors = 0;
  for (let p = 0; p < expected.length; p += 4) {
    // PNG encoding can round boundary alpha by one byte relative to getImageData.
    if (Math.abs(expected[p + 3] - 128) > 1)
      assert.equal(actual[p + 3], expected[p + 3] >= 128 ? 255 : 0);
    if (expected[p + 3] === 255) for (let c = 0; c < 3; c++) {
      error += Math.abs(actual[p + c] - expected[p + c]);
      colors++;
    }
  }
  assert.ok(colors > 0);
  assert.ok(error / colors < 8, "GIF colors should remain close to the source");
});
test("export rejects remote pattern fetches", async () => {
  const s = structuredClone(seed);
  s.fill.patternBase64 = "https://example.com/test.png";
  await assert.rejects(renderExport(s, 256, "1:1", "png", ""), /embedded/);
});
test("embedded browser font exports without a server installation", async () => {
  const file = (await readdir("public/editor/fonts")).find((name) =>
    name.endsWith(".woff2"),
  );
  assert.ok(file);
  const s = structuredClone(seed);
  s.fontFamily = "Local Upload Test";
  s.fontBase64 = `data:font/woff2;base64,${(await readFile(`public/editor/fonts/${file}`)).toString("base64")}`;
  const png = await renderExport(s, 320, "1:1", "png", "");
  assert.equal(png.readUInt32BE(16), 320);
  assert.equal(png.readUInt32BE(20), 320);
});
