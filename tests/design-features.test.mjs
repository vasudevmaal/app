import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { renderExport } from "../src/lib/server-renderer.mjs";
async function moduleURL(file, replacements = {}) {
  let code = ts.transpileModule(await readFile(file, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  for (const [from, to] of Object.entries(replacements))
    code = code
      .replaceAll(`from '${from}'`, `from '${to}'`)
      .replaceAll(`from "${from}"`, `from "${to}"`);
  return "data:text/javascript;base64," + Buffer.from(code).toString("base64");
}
const presetURL = await moduleURL("src/lib/creative-library.ts", {
  zod: import.meta.resolve("zod"),
});
const { defaultPresets, creativeLibrarySchema } = await import(presetURL);
const { designSchema, designElementSchema } = await import(
  await moduleURL("src/lib/design.ts", {
    zod: import.meta.resolve("zod"),
    "./creative-library": presetURL,
  })
);
const { imageEffects } = await import(
  await moduleURL("src/components/design/image-effects.ts")
);
test("owner presets include ten gradients and reject unsafe asset URLs", () => {
  assert.equal(defaultPresets.filter((p) => p.type === "gradient").length, 10);
  assert.equal(creativeLibrarySchema.safeParse(defaultPresets).success, true);
  assert.equal(
    creativeLibrarySchema.safeParse([
      {
        ...defaultPresets[0],
        type: "image",
        url: "https://example.test/x.png",
      },
    ]).success,
    false,
  );
});
test("design JSON retains filters, groups, gradients and image sizing without auto-locking", () => {
  const d = designSchema.parse({
    canvasW: 1200,
    canvasH: 800,
    bg: {
      type: "pattern",
      patternSize: 145,
      patternBgType: "gradient",
      imageMode: "original",
    },
    elements: [
      {
        id: "a",
        type: "text",
        text: "HELLO",
        groupId: "pair",
        fillType: "radial",
        gradient: {
          stops: [
            { color: "#ff0000", pos: 0 },
            { color: "#00ff00", pos: 50 },
            { color: "#0000ff", pos: 100 },
          ],
        },
      },
      {
        id: "b",
        type: "image",
        groupId: "pair",
        filters: { pixelate: 12 },
        borderEnabled: true,
        borderWidth: 20,
        radius: 50,
        shadowEnabled: true,
        shadowX: 10,
        shadowOpacity: 0.4,
      },
    ],
  });
  assert.equal(d.elements[0].locked, false);
  assert.equal(d.elements[1].filters.pixelate, 12);
  assert.equal(d.elements[1].groupId, "pair");
  assert.equal(d.elements[0].gradient.stops.length, 3);
  assert.equal(d.bg.patternSize, 145);
  assert.equal(designSchema.safeParse({ ...d, canvasW: 0 }).success, false);
});
test("rounded image outline preserves transparency and stays inside output dimensions", () => {
  globalThis.document = { createElement: () => createCanvas(1, 1) };
  const source = createCanvas(100, 100),
    ctx = source.getContext("2d");
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, 100, 100);
  const element = designElementSchema.parse({
    type: "image",
    w: 100,
    h: 100,
    radius: 50,
    borderEnabled: true,
    borderWidth: 10,
    borderColor: "#00ff00",
  });
  const rendered = imageEffects(source, element, 100),
    pixels = rendered.getContext("2d");
  assert.equal(rendered.width, 100);
  assert.equal(pixels.getImageData(0, 0, 1, 1).data[3], 0);
  assert.ok(pixels.getImageData(50, 2, 1, 1).data[1] > 180);
  assert.ok(pixels.getImageData(50, 50, 1, 1).data[0] > 180);
});
test("images fill their frame by cropping edges instead of stretching", () => {
  globalThis.document = { createElement: () => createCanvas(1, 1) };
  const source = createCanvas(300, 100),
    ctx = source.getContext("2d");
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, 100, 100);
  ctx.fillStyle = "#00ff00";
  ctx.fillRect(100, 0, 100, 100);
  ctx.fillStyle = "#0000ff";
  ctx.fillRect(200, 0, 100, 100);
  const element = designElementSchema.parse({ type: "image", w: 100, h: 100 });
  const rendered = imageEffects(source, element, 100),
    pixel = rendered.getContext("2d").getImageData(50, 50, 1, 1).data;
  assert.equal(rendered.width, 100);
  assert.ok(pixel[1] > 240);
  assert.ok(pixel[0] < 10);
  assert.ok(pixel[2] < 10);
});
test("pixelate reduces detail while preserving alpha", () => {
  globalThis.document = { createElement: () => createCanvas(1, 1) };
  const source = createCanvas(100, 100),
    ctx = source.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 100, 100);
  gradient.addColorStop(0, "red");
  gradient.addColorStop(1, "blue");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 100, 100);
  const e = designElementSchema.parse({
      type: "image",
      w: 100,
      h: 100,
      filters: { pixelate: 20 },
    }),
    result = imageEffects(source, e, 100),
    p = result.getContext("2d");
  assert.deepEqual(
    [...p.getImageData(3, 3, 1, 1).data],
    [...p.getImageData(15, 15, 1, 1).data],
  );
  assert.notDeepEqual(
    [...p.getImageData(3, 3, 1, 1).data],
    [...p.getImageData(85, 85, 1, 1).data],
  );
});
const seed = JSON.parse(await readFile("reference/default-state.json", "utf8"));
seed.fontFamily = "Bungee";
seed.wave = 0;
test("linear and radial gradients render distinct whole-text, word and letter scopes", async () => {
  for (const type of ["gradient", "radial"]) {
    const s = structuredClone(seed);
    s.text = "WW WW";
    s.layers = [];
    s.bg.type = "transparent";
    s.fill = {
      ...s.fill,
      type,
      angle: 90,
      stops: [
        { color: "#ff0000", pos: 0 },
        { color: "#0000ff", pos: 100 },
      ],
    };
    const images = [];
    for (const scope of ["text", "word", "letter"])
      images.push(
        await renderExport(
          { ...s, fill: { ...s.fill, scope } },
          500,
          "2:1",
          "png",
        ),
      );
    assert.notDeepEqual(images[0], images[1]);
    assert.notDeepEqual(images[1], images[2]);
  }
});
test("pattern background gradient is visible through transparent pattern pixels", async () => {
  const s = structuredClone(seed),
    pattern = createCanvas(16, 16);
  s.bg = {
    ...s.bg,
    type: "pattern",
    patternBase64: pattern.toDataURL("image/png"),
    patternBgType: "gradient",
    patternBgAngle: 90,
    patternBgStops: [
      { color: "#ff0000", pos: 0 },
      { color: "#0000ff", pos: 100 },
    ],
  };
  const png = await renderExport(s, 400, "2:1", "png"),
    img = await loadImage(png),
    out = createCanvas(400, 200);
  out.getContext("2d").drawImage(img, 0, 0);
  const ctx = out.getContext("2d");
  assert.notDeepEqual(
    [...ctx.getImageData(1, 1, 1, 1).data],
    [...ctx.getImageData(398, 1, 1, 1).data],
  );
});
