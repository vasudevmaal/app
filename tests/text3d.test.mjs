import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import {
  createTextGeometry,
  fitTextCamera,
} from "../src/components/text3d/geometry.ts";
import {
  defaultText3D,
  applyText3DPreset,
  text3dPresets,
} from "../src/lib/text3d.ts";
import { text3dProjectSchema } from "../src/lib/text3d-project.ts";

const font = new FontLoader().parse(
  JSON.parse(
    readFileSync(
      new URL(
        "../public/fonts/3d/helvetiker_bold.typeface.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

test("3D text has finite centered geometry, full gradient UVs and three distinct materials", () => {
  for (const layout of ["straight", "arc"]) {
    const geometry = createTextGeometry(
      { ...defaultText3D, text: "EXCPIX\n3D", layout },
      font,
    );
    assert.ok(geometry.getAttribute("position").count > 0);
    for (const name of ["position", "normal", "uv"]) {
      assert.ok(
        [...geometry.getAttribute(name).array].every(Number.isFinite),
        name,
      );
    }
    assert.ok(
      geometry.boundingBox.getCenter(new THREE.Vector3()).length() < 0.001,
    );
    assert.deepEqual(
      new Set(geometry.groups.map((g) => g.materialIndex)),
      new Set([0, 1, 2]),
    );
    assert.equal(
      geometry.groups.reduce((n, g) => n + g.count, 0),
      geometry.getAttribute("position").count,
    );
    assert.ok(
      geometry.boundingBox.getSize(new THREE.Vector3()).z > defaultText3D.depth,
    );
    const uv = [...geometry.getAttribute("uv").array];
    assert.ok(Math.min(...uv) >= -0.001 && Math.max(...uv) <= 1.001);
    geometry.dispose();
  }
});

test("empty text does not create invalid geometry and missing glyphs produce an actionable error", () => {
  assert.equal(
    createTextGeometry({ ...defaultText3D, text: " \n " }, font),
    null,
  );
  assert.throws(
    () => createTextGeometry({ ...defaultText3D, text: "\u{1f680}" }, font),
    /does not include/,
  );
});

test("camera fit keeps all corners inside portrait, mobile, desktop and 4K frames at multiple views", () => {
  for (const text of ["I", "EXCPIX EXCPIX EXCPIX", "A\nB\nC\nD"]) {
    const geometry = createTextGeometry({ ...defaultText3D, text }, font);
    const mesh = new THREE.Mesh(geometry);
    for (const aspect of [9 / 16, 320 / 280, 1440 / 700, 3840 / 720]) {
      for (const angle of [0, 0.6, 1.5, 2.8]) {
        mesh.rotation.set(angle / 2, angle, angle / 4);
        const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 10000);
        camera.position.set(100, 65, 420);
        camera.lookAt(0, 0, 0);
        fitTextCamera(camera, mesh);
        const box = new THREE.Box3().setFromObject(mesh);
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) {
              const projected = new THREE.Vector3(x, y, z).project(camera);
              assert.ok(
                Math.abs(projected.x) < 1 &&
                  Math.abs(projected.y) < 1 &&
                  Math.abs(projected.z) < 1,
                `${text}, ${aspect}, ${angle}`,
              );
            }
      }
    }
    geometry.dispose();
    mesh.material.dispose();
  }
});

test("OBJ and binary STL exports round-trip with nonempty faces and matching bounds", () => {
  const geometry = createTextGeometry(defaultText3D, font);
  const mesh = new THREE.Mesh(
    geometry,
    [0, 1, 2].map(() => new THREE.MeshPhysicalMaterial()),
  );
  mesh.updateMatrixWorld(true);
  const obj = new OBJExporter().parse(mesh);
  assert.ok(obj.includes("\nf "));
  const loadedObj = new OBJLoader().parse(obj);
  assert.equal(
    loadedObj.children[0].geometry.getAttribute("position").count,
    geometry.getAttribute("position").count,
  );
  const stl = new STLExporter().parse(mesh, { binary: true });
  const loadedStl = new STLLoader().parse(stl.buffer);
  loadedStl.computeBoundingBox();
  assert.equal(
    loadedStl.getAttribute("position").count,
    geometry.getAttribute("position").count,
  );
  assert.deepEqual(loadedStl.boundingBox, geometry.boundingBox);
  geometry.dispose();
  loadedStl.dispose();
  mesh.material.forEach((m) => m.dispose());
});

test("all premade styles preserve user text and typography", () => {
  const current = {
    ...defaultText3D,
    text: "My name",
    font: "custom-test",
    layout: "arc",
    radius: 300,
    spacing: 4,
    lineHeight: 2,
  };
  text3dPresets.forEach((_, index) => {
    const next = applyText3DPreset(current, index);
    for (const key of [
      "text",
      "font",
      "layout",
      "radius",
      "spacing",
      "lineHeight",
    ])
      assert.equal(next[key], current[key]);
  });
});

test("GLB contains valid binary geometry and all three physical materials", async (t) => {
  const original = globalThis.FileReader;
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = result;
        this.onloadend?.();
      });
    }
  };
  t.after(() => {
    globalThis.FileReader = original;
  });
  const geometry = createTextGeometry({ ...defaultText3D, text: "3D" }, font);
  const materials = [
    defaultText3D.front,
    defaultText3D.side,
    defaultText3D.edge,
  ].map((color) => new THREE.MeshPhysicalMaterial({ color, metalness: 0.6 }));
  const mesh = new THREE.Mesh(geometry, materials);
  try {
    const result = await new GLTFExporter().parseAsync(mesh, { binary: true });
    const bytes = new DataView(result);
    assert.equal(bytes.getUint32(0, true), 0x46546c67);
    assert.equal(bytes.getUint32(4, true), 2);
    assert.equal(bytes.getUint32(8, true), result.byteLength);
    const jsonLength = bytes.getUint32(12, true);
    const model = JSON.parse(
      new TextDecoder().decode(new Uint8Array(result, 20, jsonLength)),
    );
    assert.equal(model.materials.length, 3);
    assert.ok(
      model.meshes[0].primitives.every((p) => Number.isInteger(p.material)),
    );
    assert.ok(model.accessors.some((a) => a.count > 100 && a.type === "VEC3"));
    assert.ok(model.buffers[0].byteLength > 1000);
    assert.equal(bytes.getUint32(24 + jsonLength, true), 0x004e4942);
  } finally {
    geometry.dispose();
    materials.forEach((m) => m.dispose());
  }
});

test("project JSON round-trips built-in and embedded custom fonts and rejects invalid state", () => {
  const project = { tool: "3d-text", version: 1, state: defaultText3D };
  assert.deepEqual(
    text3dProjectSchema.parse(JSON.parse(JSON.stringify(project))),
    project,
  );
  const custom = {
    ...project,
    state: { ...defaultText3D, font: "custom-test" },
    fontName: "Uploaded font",
    fontData: font.data,
  };
  assert.equal(
    text3dProjectSchema.parse(custom).fontData.resolution,
    font.data.resolution,
  );
  for (const invalid of [
    { ...project, version: 2 },
    { ...custom, fontData: undefined },
    { ...project, state: { ...defaultText3D, depth: Infinity } },
    { ...project, state: { ...defaultText3D, text: "A".repeat(121) } },
    {
      ...project,
      state: { ...defaultText3D, texture: "https://example.test/asset.png" },
    },
    { ...project, thumbnail: "data:image/svg+xml;base64,PHN2Zz4=" },
  ])
    assert.equal(text3dProjectSchema.safeParse(invalid).success, false);
});

test(
  "saved tool projects are listed, updated and isolated by account",
  { skip: !process.env.TEST_URL },
  async () => {
    const base = process.env.TEST_URL;
    async function register(suffix) {
      const response = await fetch(`${base}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "3D Tool Test",
          email: `tool-${Date.now()}-${suffix}@example.test`,
          password: "test-password-2026",
        }),
      });
      assert.equal(response.status, 200, await response.text());
      return response.headers.get("set-cookie").split(";")[0];
    }
    const owner = await register("owner"),
      other = await register("other");
    const call = (cookie, path, data, method = data ? "POST" : "GET") =>
      fetch(`${base}/api/${path}`, {
        method,
        headers: { cookie, "Content-Type": "application/json" },
        body: data ? JSON.stringify(data) : undefined,
      });
    const content = {
      tool: "3d-text",
      version: 1,
      state: { ...defaultText3D, text: "SAVED" },
    };
    const response = await call(owner, "projects", { content_json: content });
    assert.equal(
      response.status,
      200,
      response.status === 200 ? undefined : await response.text(),
    );
    const { id } = await response.json();
    assert.ok(id);
    try {
      const projects = await (await call(owner, "projects")).json();
      assert.equal(projects.length, 1);
      assert.equal(projects[0].title, "SAVED");
      assert.deepEqual(projects[0].content_json, content);
      const account = await (await call(owner, "account")).json();
      assert.equal(account.projects[0].id, id);
      const updated = {
        ...content,
        state: { ...content.state, text: "UPDATED" },
      };
      assert.equal(
        (await call(owner, "projects", { id, content_json: updated })).status,
        200,
      );
      await call(other, "projects", { id, content_json: content });
      const final = await (await call(owner, "projects")).json();
      assert.equal(final.length, 1);
      assert.equal(final[0].content_json.state.text, "UPDATED");
      assert.equal((await (await call(other, "projects")).json()).length, 0);
      assert.equal(
        (
          await call(owner, "projects", {
            content_json: { ...content, version: 99 },
          })
        ).status,
        400,
      );
    } finally {
      await call(owner, "projects", { id }, "DELETE");
      await call(owner, "auth/logout", {});
      await call(other, "auth/logout", {});
    }
  },
);
