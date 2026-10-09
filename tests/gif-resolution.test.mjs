import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { renderExport } from "../src/lib/server-renderer.mjs";
import { renderLettersGif } from "../src/lib/local-media.mjs";

test("3D Text and AI export Large and HD GIFs with moving, nonblank frames", async () => {
  const state = JSON.parse(await readFile("reference/default-state.json", "utf8"));
  state.text = "GOLD";
  state.fontFamily = "Bungee";
  state.bg.type = "transparent";
  state.animation = { id: "float", speed: 3 };
  const glyphs = Object.fromEntries([..."GOLD"].map((c) => [c,
    `/ai/imgs7727/liquid-gold/3d-cartoon-alien-text/${c}.webp`,
  ]));
  for (const size of [1280, 1920]) {
    for (const kind of ["3d-text", "ai"]) {
      const gif = kind === "ai"
        ? await renderLettersGif(state, glyphs, size, "2:1", "")
        : await renderExport(state, size, "2:1", "gif");
      const metadata = await sharp(gif, { animated: true }).metadata();
      assert.equal(metadata.width, size);
      assert.equal(metadata.pageHeight, size / 2);
      assert.equal(metadata.pages, 17);
      assert.equal(metadata.delay.reduce((sum, delay) => sum + delay, 0), 670);
      const first = await sharp(gif, { page: 0 }).ensureAlpha().raw().toBuffer();
      const next = await sharp(gif, { page: 3 }).ensureAlpha().raw().toBuffer();
      assert.notDeepEqual(first, next, `${kind} ${size}: animation must move`);
      assert.ok(first.some((value, index) => index % 4 === 3 && value > 0));
    }
  }
  await assert.rejects(renderExport(state, 1921, "2:1", "gif"), /up to 1920px/);
  await assert.rejects(renderLettersGif(state, glyphs, 1921, "2:1", ""), /up to 1920px/);
});
