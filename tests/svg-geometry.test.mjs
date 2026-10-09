import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createSvgGeometryPool } from '../src/lib/svg-geometry.mjs';

const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="100">${body}</svg>`;
async function pixels(svg) {
  const canvas = createCanvas(200, 100);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(await loadImage(Buffer.from(svg)), 0, 0);
  return ctx.getImageData(0, 0, 200, 100).data;
}

test('shared geometry preserves exact pixels, gradients, transforms, stroke and opacity', async () => {
  const d = 'M5 5L45 5Q55 25 45 45L5 45Z';
  const body = `<defs><linearGradient id="paint"><stop stop-color="#ff9933"/><stop offset="1" stop-color="#cc3377"/></linearGradient><clipPath id="clip"><rect width="185" height="80"/></clipPath></defs><g clip-path="url(#clip)"><path d="${d}" fill="url(#paint)"/><path d="${d}" fill="none" stroke="#234567" stroke-width="3" transform="translate(55 8)"/><g opacity="0.4"><path d="${d}" fill="#22aa77" transform="translate(120 25) rotate(8)"/></g></g>`;
  const pool = createSvgGeometryPool();
  const compact = pool.compact(body);
  assert.equal((pool.definitions().match(/<path /g) || []).length, 1);
  assert.equal((compact.match(/<use /g) || []).length, 3);
  assert.deepEqual(await pixels(wrap(pool.definitions() + compact)), await pixels(wrap(body)));
});

test('geometry pool reuses outlines across separate frames without changing animation', () => {
  const pool = createSvgGeometryPool();
  const d = 'M0 0L10 0L10 10Z';
  const animation = '<animate attributeName="visibility" values="visible;hidden" dur="2s" repeatCount="indefinite"/>';
  for (let i = 0; i < 60; i++) {
    const frame = pool.compact(`<g>${animation}<path transform="translate(${i} 0)" d="${d}"/></g>`);
    assert.ok(frame.includes(animation));
    assert.ok(frame.includes(`translate(${i} 0)`));
  }
  assert.equal((pool.definitions().match(/<path /g) || []).length, 1);
});
