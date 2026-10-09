import * as THREE from "three";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Font } from "three/addons/loaders/FontLoader.js";
import type { Text3DState } from "@/lib/text3d";

export function createTextGeometry(state: Text3DState, font: Font) {
  const parts: THREE.BufferGeometry[] = [];
  const lines = state.text.replace(/\t/g, "    ").split("\n");
  const glyphs = font.data.glyphs;
  try {
    lines.forEach((line, row) => {
      const chars = Array.from(line);
      const widths = chars.map((char) => {
        const glyph = glyphs[char];
        if (!glyph && char.trim())
          throw new Error(
            `This font does not include "${char}". Choose or upload another font.`,
          );
        return (
          ((glyph?.ha ?? font.data.resolution * 0.35) * state.size) /
          font.data.resolution
        );
      });
      const width =
        widths.reduce((sum, n) => sum + n, 0) +
        Math.max(0, chars.length - 1) * state.spacing;
      let x = -width / 2;
      const curve = state.curve;
      const radius = Math.max(
        width / (Math.PI * 1.75),
        6000 / Math.max(Math.abs(curve), 1),
      );
      chars.forEach((char, i) => {
        if (char.trim()) {
          const geometry = new TextGeometry(char, {
            font,
            size: state.size,
            depth: state.depth,
            curveSegments: 10,
            bevelEnabled: state.bevel > 0 && state.bevelThickness > 0,
            bevelSize: state.bevel,
            bevelThickness: state.bevelThickness,
            bevelSegments: 4,
          });
          parts.push(geometry);
          // Classify before bending, so the bevel remains independently editable.
          const normals = geometry.getAttribute("normal");
          geometry.clearGroups();
          let start = 0,
            previous = -1;
          for (let v = 0; v < normals.count; v += 3) {
            const nz = Math.abs(normals.getZ(v));
            const material = nz > 0.999 ? 0 : nz < 0.001 ? 1 : 2;
            if (material !== previous) {
              if (previous !== -1)
                geometry.addGroup(start, v - start, previous);
              start = v;
              previous = material;
            }
          }
          if (previous !== -1)
            geometry.addGroup(start, normals.count - start, previous);
          if (curve !== 0) {
            const angle = (x + widths[i] / 2) / radius;
            const bendDirection = curve > 0 ? 1 : -1;
            geometry.translate(-widths[i] / 2, 0, -state.depth / 2);
            geometry.rotateZ(-angle * bendDirection);
            geometry.translate(
              Math.sin(angle) * radius,
              (Math.cos(angle) * radius - radius) * bendDirection -
                row * state.size * state.lineHeight,
              0,
            );
          } else {
            geometry.translate(
              x,
              -row * state.size * state.lineHeight,
              -state.depth / 2,
            );
          }
        }
        x += widths[i] + state.spacing;
      });
    });
    const visible = parts.filter((g) => g.getAttribute("position").count > 0);
    if (!visible.length) return null;
    const merged = mergeGeometries(visible, false);
    if (!merged)
      throw new Error("Unable to build this text. Try a different font.");
    let offset = 0;
    for (const part of visible) {
      for (const group of part.groups)
        merged.addGroup(offset + group.start, group.count, group.materialIndex);
      offset += part.getAttribute("position").count;
    }
    merged.center();
    merged.computeBoundingBox();
    const bounds = merged.boundingBox!;
    const size = bounds.getSize(new THREE.Vector3());
    const position = merged.getAttribute("position"),
      uv = merged.getAttribute("uv");
    for (let i = 0; i < position.count; i++) {
      uv.setXY(
        i,
        (position.getX(i) - bounds.min.x) / Math.max(size.x, 0.001),
        (position.getY(i) - bounds.min.y) / Math.max(size.y, 0.001),
      );
    }
    merged.computeBoundingSphere();
    return merged;
  } finally {
    parts.forEach((g) => g.dispose());
  }
}

export function fitTextCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  padding = 1.18,
) {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const inverse = camera.quaternion.clone().invert();
  const tanY = Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2);
  const tanX = tanY * camera.aspect;
  let distance = 1;
  // Fit every box corner in camera space, including depth and the chosen view.
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z)
          .sub(center)
          .applyQuaternion(inverse);
        distance = Math.max(
          distance,
          (Math.abs(point.x) * padding) / tanX + point.z,
          (Math.abs(point.y) * padding) / tanY + point.z,
        );
      }
  camera.position
    .copy(center)
    .add(new THREE.Vector3(0, 0, distance).applyQuaternion(camera.quaternion));
  camera.near = Math.max(0.01, distance / 1000);
  camera.far = Math.max(1000, distance * 10);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return center;
}
