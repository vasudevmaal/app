import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderSvg } from '../src/lib/svg-export.mjs';

const seed = JSON.parse(await readFile('reference/default-state.json', 'utf8'));
seed.fontFamily = 'Bungee';
seed.wave = 0;
seed.text = 'SVG';
seed.bg.type = 'transparent';

test('SVG exports outlined text, requested dimensions and nonblank pixels', async () => {
  const state = structuredClone(seed);
  state.animation.id = 'none';
  const data = await renderSvg(state, 640, '16:9');
  const xml = data.toString();
  assert.match(xml, /width="640" height="360"/);
  assert.match(xml, /<path/);
  assert.doesNotMatch(xml, /<text\b|<script\b|<animate\b|<image\b|data:image\//i);
  const image = await loadImage(data);
  const canvas = createCanvas(640, 360);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, 640, 360).data;
  assert.ok(pixels.some((v, i) => i % 4 === 3 && v > 0));
  for (let x = 0; x < 640; x++) {
    assert.equal(pixels[x * 4 + 3], 0);
    assert.equal(pixels[((359 * 640) + x) * 4 + 3], 0);
  }
});

test('animated SVG embeds a full repeating cycle with unique resource IDs', async () => {
  const state = structuredClone(seed);
  state.animation = { id: 'float', speed: 2 };
  const xml = (await renderSvg(state, 640, 'original', 2)).toString();
  assert.equal((xml.match(/<animate /g) || []).length, 60);
  assert.match(xml, /dur="1s" repeatCount="indefinite"/);
  const ids = [...xml.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.doesNotMatch(xml, /<script\b|<image\b|data:image\/|https?:\/\/[^" ]+\.(woff|ttf)/i);
});

test('translucent depth, gradients, wraps and shadows stay vector-only', async () => {
  const state = structuredClone(seed);
  state.animation.id = 'none';
  state.bg = { ...state.fill, type: 'radial' };
  state.layers[0].opacity = 0.35;
  state.layers.push(
    { ...state.layers[0], id: 2, layerType: 'outer_wrap', width: 8 },
    { ...state.layers[0], id: 3, layerType: 'shadow', size: 4, blur: 10, offsetX: 5, offsetY: 5 },
    { ...state.layers[0], id: 4, layerType: 'inner_shadow', size: 3, blur: 10, offsetX: 5, offsetY: 5 },
  );
  const xml = (await renderSvg(state, 640, '1:1')).toString();
  assert.doesNotMatch(xml, /<image\b|data:image\//i);
  assert.match(xml, /<feGaussianBlur/);
  assert.match(xml, /<feMorphology/);
  assert.match(xml, /<feComposite/);
  assert.match(xml, /opacity="0.35"/);
  assert.match(xml, /<radialGradient/);
  await loadImage(Buffer.from(xml));
});

test('image paints fail explicitly instead of silently embedding a bitmap', async () => {
  const state = structuredClone(seed);
  for (const paint of [
    { type: 'image' }, { type: 'pattern' }, { type: 'alternating', altMode: 'image' },
  ]) {
    state.fill = { ...state.fill, ...paint };
    await assert.rejects(renderSvg(state, 640, '1:1'), /cannot embed image fills/);
  }
  state.fill = structuredClone(seed.fill);
  state.layers.push({ ...state.layers[0], id: 99, enabled: false, type: 'pattern' });
  await renderSvg(state, 640, '1:1');
});

test('inner shadow stays inside glyphs and responds to offset with translucent paint', async () => {
  const state = structuredClone(seed);
  state.animation.id = 'none';
  state.fill = { ...state.fill, type: 'solid', color: '#ffffff', opacity: 1 };
  state.layers = [];
  const pixels = async () => {
    const image = await loadImage(await renderSvg(state, 640, '16:9'));
    const ctx = createCanvas(640, 360).getContext('2d');
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, 640, 360).data;
  };
  const base = await pixels();
  state.layers.push({ ...seed.layers[0], layerType: 'inner_shadow', type: 'solid',
    color: '#000000', enabled: true, opacity: 0.5, size: 0, blur: 10, offsetX: 8, offsetY: 8 });
  const shadow = await pixels();
  let darkened = 0;
  for (let i = 0; i < base.length; i += 4) {
    if (base[i + 3] === 0) assert.equal(shadow[i + 3], 0);
    if (base[i + 3] === 255 && shadow[i] < base[i] - 10) darkened++;
  }
  assert.ok(darkened > 100, 'inner shadow must visibly darken the glyph interior');
});
