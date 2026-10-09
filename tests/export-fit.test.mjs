import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import sharp from "sharp";
import { renderExport } from "../src/lib/server-renderer.mjs";
import { renderLetters, renderLettersGif } from "../src/lib/local-media.mjs";
import { animations } from "../src/lib/original-renderer.js";

const seed = JSON.parse(await readFile("reference/default-state.json", "utf8"));
seed.fontFamily = "Bungee";
seed.bg.type = "transparent";

async function assertUnclipped(bytes, label, animated = false) {
  const { data, info } = await sharp(bytes, { animated }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const height = info.pageHeight || info.height, width = info.width;
  let ink = 0;
  for (let frame = 0; frame < info.height / height; frame++) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const alpha = data[((frame * height + y) * width + x) * 4 + 3];
      ink += alpha > 0 ? 1 : 0;
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2)
        assert.equal(alpha, 0, `${label}: clipped pixel at ${x},${y}, frame ${frame}`);
    }
  }
  assert.ok(ink > 10, `${label}: export must not be blank`);
}

test("PNG fits uploaded italic fonts, low line height, accents and large layered effects", async () => {
  const file = (await readdir("public/editor/fonts")).find((name) => name.endsWith(".woff2"));
  const s = structuredClone(seed);
  Object.assign(s, {
    text: "ÁjÅ\nqgj", lineHeight: .5, isItalic: true, isUnderline: true,
    fontFamily: "Export Bounds Test",
    fontBase64: `data:font/woff2;base64,${(await readFile(`public/editor/fonts/${file}`)).toString("base64")}`,
    curve: -90, zigzag: -100, wave: 90, rotation: 53,
  });
  s.layers = [
    { ...s.layers[0], size: 80, width: 30 },
    { ...s.layers[0], id: 2, size: 80, angle: 251 },
    { ...s.layers[0], id: 3, layerType: "outer_wrap", width: 30 },
    { ...s.layers[0], id: 4, layerType: "shadow", size: 20, blur: 30, offsetX: -70, offsetY: 70 },
  ];
  for (const ratio of ["16:9", "9:16", "1:1"])
    await assertUnclipped(await renderExport(s, 512, ratio, "png"), `PNG ${ratio}`);
});

test("every 3D Text animation stays inside landscape and portrait GIF frames", async () => {
  for (const { id } of animations) {
    for (const ratio of ["16:9", "9:16"]) {
      const s = structuredClone(seed);
      Object.assign(s, { text: "Ágj\nTYPE", rotation: 47, lineHeight: .5, curve: 80, zigzag: -75, wave: 60 });
      s.animation = { id, speed: 1 };
      s.layers[0].width = 25;
      s.layers[0].size = 60;
      const gif = await renderExport(s, 256, ratio, "gif", "", { frames: 12 });
      await assertUnclipped(gif, `${id} ${ratio}`, true);
    }
  }
});

test("AI PNG and all decoded GIF frames retain rotated glyph edges", async () => {
  const glyphs = Object.fromEntries([..."GOLD"].map((c) => [c, `/ai/imgs7727/liquid-gold/3d-cartoon-alien-text/${c}.webp`]));
  const s = structuredClone(seed);
  Object.assign(s, { text: "GOLD\nGOLD", rotation: -67, lineHeight: .5, curve: -100, zigzag: -100, wave: 100 });
  for (const ratio of ["16:9", "9:16"]) {
    await assertUnclipped(await renderLetters(s, glyphs, 512, ratio, ""), `AI PNG ${ratio}`);
    for (const id of ["spin", "letter_scale", "letter_orbit", "hurricane", "curve_dance"]) {
      s.animation = { id, speed: 2 };
      await assertUnclipped(await renderLettersGif(s, glyphs, 256, ratio, ""), `AI ${id} ${ratio}`, true);
    }
  }
});
