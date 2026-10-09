import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import ts from "typescript";

test("edits, font loading and pointer events preserve the preview canvas and animation", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const keys = [
    "window",
    "document",
    "ResizeObserver",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "devicePixelRatio",
    "IS_REACT_ACT_ENVIRONMENT",
  ];
  const original = new Map(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const frames = new Map();
  let sequence = 0,
    observers = 0,
    writes = 0;
  const draws = [];
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    devicePixelRatio: 1,
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: (fn) => {
      frames.set(++sequence, fn);
      return sequence;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: class {
      constructor() {
        observers++;
      }
      observe() {}
      disconnect() {}
    },
  });
  document.fonts = { load: async () => [] };
  const proto = dom.window.HTMLCanvasElement.prototype;
  proto.getContext = () => ({});
  proto.getBoundingClientRect = () => ({ width: 640, height: 360 });
  for (const name of ["width", "height"]) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, name);
    Object.defineProperty(proto, name, {
      configurable: true,
      get: descriptor.get,
      set(value) {
        writes++;
        descriptor.set.call(this, value);
      },
    });
  }
  const require = createRequire(import.meta.url);
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const source = await readFile("src/components/button/preview.tsx", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) =>
      name === "@/lib/button-renderer.mjs"
        ? {
            buttonLayout: () => ({}),
            buttonFrame: (...args) => draws.push(args),
          }
        : require(name),
    module,
    module.exports,
  );
  const { ButtonPreview } = module.exports;
  const root = createRoot(document.getElementById("root"));
  let state = {
    text: "SUBSCRIBE",
    fontFamily: "Inter",
    fontSize: 20,
    fontWeight: 800,
    animation: "bounce",
    animationSpeed: 1,
  };
  const update = (playing = true, fontRevision = 0) =>
    React.act(async () =>
      root.render(
        React.createElement(ButtonPreview, { state, playing, fontRevision }),
      ),
    );
  try {
    await update();
    const canvas = document.querySelector("canvas");
    writes = 0;
    const tick = [...frames.entries()][0];
    frames.delete(tick[0]);
    tick[1](performance.now() + 40);
    const phase = draws.at(-1)[5];
    assert.ok(phase > 0, "animation advances");
    for (let i = 0; i < 20; i++) {
      state = { ...state, text: `Text ${i}`, fontSize: 20 + i };
      await update();
      assert.equal(document.querySelector("canvas"), canvas);
      assert.equal(
        draws.at(-1)[5],
        phase,
        "editing does not restart animation",
      );
    }
    await update(true, 1);
    await update(false, 1);
    canvas.dispatchEvent(
      new dom.window.MouseEvent("pointerover", { bubbles: true }),
    );
    canvas.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(
      document.querySelector("canvas"),
      canvas,
      "font update keeps the same canvas",
    );
    assert.equal(
      writes,
      0,
      "edits never clear the canvas by resetting backing dimensions",
    );
    assert.equal(observers, 1, "one resize observer stays attached");
    assert.ok(
      draws.every((args) => !args[6]?.hover),
      "pointer interaction never enables hover",
    );
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const key of keys) {
      const descriptor = original.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
