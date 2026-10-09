import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import { encodeAnimatedGif } from "../src/lib/animated-gif.mjs";
import { drawLetters } from "../src/lib/letter-renderer.mjs";

test("decoded GIF preserves moving pixels, clears old frames, and keeps static colors stable", async () => {
  const canvas = createCanvas(160, 80), ctx = canvas.getContext("2d");
  const sources = [];
  const render = (time) => {
    ctx.clearRect(0, 0, 160, 80);
    const gradient = ctx.createLinearGradient(0, 0, 80, 0);
    gradient.addColorStop(0, "#305614");
    gradient.addColorStop(1, "#beed59");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 80, 30);
    ctx.fillStyle = time < .5 ? "#fe3a78" : "#227bee";
    ctx.fillRect(Math.round(time * 120), 40, 20, 20);
    sources.push(Buffer.from(ctx.getImageData(0, 0, 160, 80).data));
  };
  const gif = await encodeAnimatedGif(canvas, render, { frames: 8, speed: 1.5 });
  const metadata = await sharp(gif, { animated: true }).metadata();
  assert.equal(metadata.pages, 8);
  assert.equal(metadata.loop, 0);
  assert.equal(metadata.delay.reduce((sum, delay) => sum + delay, 0), 1330);
  const { data } = await sharp(gif, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bytes = 160 * 80 * 4;
  const frames = sources.slice(-8);
  for (let frame = 0; frame < 8; frame++) {
    const decoded = data.subarray(frame * bytes, (frame + 1) * bytes);
    assert.deepEqual(decoded.subarray(0, 160 * 30 * 4), data.subarray(0, 160 * 30 * 4));
    let error = 0, colors = 0;
    for (let p = 0; p < bytes; p += 4) {
      assert.equal(decoded[p + 3], frames[frame][p + 3], `alpha mismatch at frame ${frame}, pixel ${p / 4}`);
      if (decoded[p + 3]) for (let c = 0; c < 3; c++) {
        error += Math.abs(decoded[p + c] - frames[frame][p + c]);
        colors++;
      }
    }
    assert.ok(error / colors < 5, `excessive color error in frame ${frame}`);
  }
});

test("AI GIF decoded frames follow the same glyph animation as preview", async () => {
  const glyph = createCanvas(80, 100), g = glyph.getContext("2d");
  const gradient = g.createLinearGradient(0, 0, 80, 100);
  gradient.addColorStop(0, "#adf344");
  gradient.addColorStop(1, "#227531");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 80, 100);
  const state = { text: "AA", letterSpacing: 5, lineHeight: 1, bg: { type: "transparent" }, animation: { id: "float", speed: 1 } };
  const canvas = createCanvas(240, 180), ctx = canvas.getContext("2d");
  const render = (time) => drawLetters(canvas, state, { A: glyph }, "", time);
  const gif = await encodeAnimatedGif(canvas, render, { frames: 8 });
  const { data } = await sharp(gif, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bytes = 240 * 180 * 4;
  for (let frame = 0; frame < 8; frame++) {
    render(frame / 8);
    const expected = ctx.getImageData(0, 0, 240, 180).data;
    for (let p = 3; p < bytes; p += 4)
      assert.equal(data[frame * bytes + p], expected[p] >= 128 ? 255 : 0);
  }
  assert.notDeepEqual(data.subarray(0, bytes), data.subarray(2 * bytes, 3 * bytes));
});

test("default GIF cadence is 25fps with the exact preview loop duration", async () => {
  const canvas = createCanvas(16, 16);
  const gif = await encodeAnimatedGif(canvas, () => {
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 16, 16);
  });
  const metadata = await sharp(gif, { animated: true }).metadata();
  assert.equal(metadata.pages, 50);
  assert.deepEqual(metadata.delay, Array(50).fill(40));
  const pixels = await sharp(gif).ensureAlpha().raw().toBuffer();
  assert.equal(pixels[3], 255, "opaque black must not become transparent");
});

test("smooth gradient rows stay free of dithering dots and sampled frames are reused", async () => {
  const canvas = createCanvas(256, 32), ctx = canvas.getContext("2d");
  let renders = 0;
  const gif = await encodeAnimatedGif(canvas, () => {
    renders++;
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, "#214318");
    gradient.addColorStop(1, "#c4ef63");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 32);
  }, { frames: 8 });
  assert.equal(renders, 8, "cached palette samples should not be rendered twice");
  const pixels = await sharp(gif).ensureAlpha().raw().toBuffer();
  for (let row = 1; row < 32; row++)
    assert.deepEqual(pixels.subarray(row * 256 * 4, (row + 1) * 256 * 4), pixels.subarray(0, 256 * 4));
});
