import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  FontLoader,
  type Font,
  type FontData,
} from "three/addons/loaders/FontLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createTextGeometry, fitTextCamera } from "./geometry";
import { text3dFonts, type Text3DState } from "@/lib/text3d";

export type ExportFormat = "png" | "obj" | "stl" | "glb";
type TextMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial[]>;

function gradient(first: string, last: string, angle: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const radians = THREE.MathUtils.degToRad(angle);
  const dx = Math.cos(radians) * 256,
    dy = Math.sin(radians) * 256;
  const fill = ctx.createLinearGradient(256 - dx, 256 + dy, 256 + dx, 256 - dy);
  fill.addColorStop(0, first);
  fill.addColorStop(1, last);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function disposeMaterials(materials: THREE.MeshPhysicalMaterial[]) {
  for (const material of materials) {
    material.map?.dispose();
    material.dispose();
  }
}

export class Text3DScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10000);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private mesh: TextMesh | null = null;
  private fonts = new Map<string, Font>();
  private observer: ResizeObserver;
  private environment: THREE.WebGLRenderTarget;
  private geometryKey = "";
  private revision = 0;
  private disposed = false;
  private lastTime = 0;
  private lights: THREE.Light[];
  private contextLost: (event: Event) => void;

  constructor(
    private container: HTMLElement,
    onContextLost: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setClearColor(0, 0);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D text preview",
    );
    this.renderer.domElement.setAttribute("role", "img");
    container.appendChild(this.renderer.domElement);
    this.camera.position.set(100, 65, 420);
    this.camera.lookAt(0, 0, 0);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.autoRotateSpeed = 1.4;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.environment.texture;
    const ambient = new THREE.HemisphereLight(0xffffff, 0x79818b, 1.4);
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(100, 150, 300);
    const fill = new THREE.DirectionalLight(0xe4f2ff, 1.5);
    fill.position.set(-150, 30, 100);
    this.lights = [ambient, key, fill];
    this.scene.add(...this.lights);
    this.observer = new ResizeObserver(() => {
      const width = Math.max(container.clientWidth, 1),
        height = Math.max(container.clientHeight, 1);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.fit();
    });
    this.observer.observe(container);
    this.contextLost = (event) => {
      event.preventDefault();
      onContextLost();
    };
    this.renderer.domElement.addEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.renderer.setAnimationLoop((time) => {
      const delta = this.lastTime
        ? Math.min((time - this.lastTime) / 1000, 0.1)
        : 0;
      this.lastTime = time;
      this.controls.update(delta);
      this.renderer.render(this.scene, this.camera);
    });
  }

  async uploadFont(file: File) {
    if (file.size > 8 * 1024 * 1024)
      throw new Error("Font must be smaller than 8 MB.");
    let font: Font;
    if (/\.json$/i.test(file.name)) {
      const data = JSON.parse(await file.text());
      if (
        !data.glyphs ||
        !Number.isFinite(data.resolution) ||
        data.resolution <= 0 ||
        !data.boundingBox
      )
        throw new Error("Choose a valid Three.js typeface JSON font.");
      font = new FontLoader().parse(data);
    } else if (/\.(ttf|otf)$/i.test(file.name)) {
      const { TTFLoader } = await import("three/addons/loaders/TTFLoader.js");
      font = new FontLoader().parse(
        new TTFLoader().parse(await file.arrayBuffer()),
      );
    } else throw new Error("Choose a TTF, OTF or typeface JSON font.");
    const id = "custom-" + crypto.randomUUID();
    this.fonts.set(id, font);
    return id;
  }

  getFontData(id: string) {
    return this.fonts.get(id)?.data;
  }
  restoreFont(id: string, data: unknown) {
    this.fonts.set(id, new FontLoader().parse(data as FontData));
  }
  copyFonts(source: Text3DScene) {
    this.fonts = new Map(source.fonts);
  }

  async update(state: Text3DState) {
    const revision = ++this.revision;
    let geometry: THREE.BufferGeometry | null = null;
    const textures: THREE.Texture[] = [];
    const key = JSON.stringify([
      state.text,
      state.font,
      state.size,
      state.depth,
      state.bevel,
      state.bevelThickness,
      state.spacing,
      state.lineHeight,
      state.layout,
      state.radius,
      state.curve,
    ]);
    try {
      let font = this.fonts.get(state.font);
      if (!font) {
        if (!text3dFonts.some((f) => f.id === state.font))
          throw new Error("Please upload this custom font again.");
        font = await new FontLoader().loadAsync(
          `/fonts/3d/${state.font}.typeface.json`,
        );
        this.fonts.set(state.font, font);
      }
      if (this.disposed || revision !== this.revision) return false;
      if (key !== this.geometryKey) geometry = createTextGeometry(state, font);
      const materialTexture = async (
        fill: Text3DState["fill"],
        start: string,
        end: string,
        angle: number,
        source: string,
        patternMode: boolean,
        patternSize: number,
        strength: number,
      ) => {
        let texture: THREE.Texture | null = null;
        if (fill === "image" && source) {
          const loader = new THREE.TextureLoader();
          texture = await loader.loadAsync(source);
          texture.colorSpace = THREE.SRGBColorSpace;
          if (patternMode) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            const repeat = 100 / Math.max(10, patternSize);
            texture.repeat.set(repeat, repeat);
          }
          if (strength < 0.999) {
            const image = texture.image as HTMLImageElement;
            const canvas = document.createElement("canvas");
            canvas.width = image.width || 512;
            canvas.height = image.height || 512;
            const context = canvas.getContext("2d")!;
            context.fillStyle = start;
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.globalAlpha = strength;
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            texture.dispose();
            texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            if (patternMode) {
              texture.wrapS = THREE.RepeatWrapping;
              texture.wrapT = THREE.RepeatWrapping;
              const repeat = 100 / Math.max(10, patternSize);
              texture.repeat.set(repeat, repeat);
            }
          }
        } else if (fill === "gradient") {
          texture = gradient(start, end, angle);
        }
        if (texture) textures.push(texture);
        return texture;
      };
      const frontTexture = await materialTexture(
        state.fill,
        state.front,
        state.gradientEnd,
        state.gradientAngle,
        state.texture,
        state.patternMode ?? true,
        state.patternSize ?? 33,
        state.textureStrength ?? 1,
      );
      const sideTexture = await materialTexture(
        state.sideFill,
        state.side,
        state.sideGradientEnd,
        state.sideGradientAngle,
        state.sideTexture,
        state.sidePatternMode ?? true,
        state.sidePatternSize ?? 33,
        state.sideTextureStrength ?? 1,
      );
      const edgeTexture = await materialTexture(
        state.edgeFill,
        state.edge,
        state.edgeGradientEnd,
        state.edgeGradientAngle,
        state.edgeTexture,
        state.edgePatternMode ?? true,
        state.edgePatternSize ?? 33,
        state.edgeTextureStrength ?? 1,
      );
      if (this.disposed || revision !== this.revision) {
        geometry?.dispose();
        textures.forEach((item) => item.dispose());
        return false;
      }
      const settings = {
        metalness: state.metalness,
        roughness: state.roughness,
        transmission: state.finish === "glass" ? state.transmission : 0,
        thickness: state.depth / 3,
        ior: 1.5,
        clearcoat: ["glossy", "chrome", "plastic", "iridescent"].includes(
          state.finish,
        )
          ? 1
          : state.finish === "satin"
            ? 0.25
            : 0,
        envMapIntensity: state.light,
      };
      const materials = [
        new THREE.MeshPhysicalMaterial({
          ...settings,
          color: frontTexture ? "#ffffff" : state.front,
          map: frontTexture,
          transparent: state.frontOpacity < 1,
          opacity: state.frontOpacity,
        }),
        new THREE.MeshPhysicalMaterial({
          ...settings,
          color: sideTexture ? "#ffffff" : state.side,
          map: sideTexture,
          transparent: state.sideOpacity < 1,
          opacity: state.sideOpacity,
        }),
        new THREE.MeshPhysicalMaterial({
          ...settings,
          color: edgeTexture ? "#ffffff" : state.edge,
          map: edgeTexture,
          transparent: state.edgeOpacity < 1,
          opacity: state.edgeOpacity,
        }),
      ];
      materials.forEach((m, i) => {
        m.name = ["Front", "Sides", "Bevel"][i];
      });
      const shapeChanged = key !== this.geometryKey;
      const rotationChanged =
        this.mesh &&
        (Math.abs(
          this.mesh.rotation.x - THREE.MathUtils.degToRad(state.rotationX),
        ) > 0.0001 ||
          Math.abs(
            this.mesh.rotation.y - THREE.MathUtils.degToRad(state.rotationY),
          ) > 0.0001 ||
          Math.abs(
            this.mesh.rotation.z - THREE.MathUtils.degToRad(state.rotationZ),
          ) > 0.0001);
      if (shapeChanged) {
        if (this.mesh) {
          this.scene.remove(this.mesh);
          this.mesh.geometry.dispose();
          disposeMaterials(this.mesh.material);
        }
        this.mesh = geometry ? new THREE.Mesh(geometry, materials) : null;
        if (this.mesh) {
          this.mesh.name = "3D Text";
          this.scene.add(this.mesh);
        } else disposeMaterials(materials);
      } else if (this.mesh) {
        disposeMaterials(this.mesh.material);
        this.mesh.material = materials;
      } else disposeMaterials(materials);
      this.geometryKey = key;
      if (this.mesh)
        this.mesh.rotation.set(
          ...([state.rotationX, state.rotationY, state.rotationZ].map(
            THREE.MathUtils.degToRad,
          ) as [number, number, number]),
        );
      if (this.scene.background instanceof THREE.Texture)
        this.scene.background.dispose();
      this.scene.background =
        state.background === "transparent"
          ? null
          : state.background === "gradient"
            ? gradient(state.backgroundColor, state.backgroundEnd, 90)
            : new THREE.Color(state.backgroundColor);
      this.lights.forEach((light, i) => {
        light.intensity = [1.4, 3, 1.5][i] * state.light;
      });
      if (shapeChanged || rotationChanged) this.fit();
      return true;
    } catch (error) {
      geometry?.dispose();
      textures.forEach((item) => item.dispose());
      if (this.disposed || revision !== this.revision) return false;
      throw error;
    }
  }

  get hasText() {
    return !!this.mesh;
  }
  fit() {
    if (!this.mesh) return;
    const center = fitTextCamera(this.camera, this.mesh);
    if (center) this.controls.target.copy(center);
    const distance = this.camera.position.distanceTo(this.controls.target);
    this.controls.minDistance = distance * 0.12;
    this.controls.maxDistance = distance * 5;
    this.controls.update();
  }
  view(front: boolean) {
    this.controls.reset();
    this.camera.position.set(
      ...((front ? [0, 0, 420] : [100, 65, 420]) as [number, number, number]),
    );
    this.controls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
    this.fit();
  }
  zoom(factor: number) {
    this.camera.position
      .sub(this.controls.target)
      .multiplyScalar(factor)
      .add(this.controls.target);
    this.controls.update();
  }
  async export(
    format: ExportFormat,
    resolution: number,
    aspect: number | null,
    transparent: boolean,
  ) {
    if (!this.mesh) throw new Error("Enter some text before exporting.");
    // Export only the model; lights, environment and editor helpers stay out.
    const mesh = this.mesh.clone();
    mesh.updateMatrixWorld(true);
    if (format === "obj") {
      const { OBJExporter } =
        await import("three/addons/exporters/OBJExporter.js");
      return new Blob([new OBJExporter().parse(mesh)], { type: "text/plain" });
    }
    if (format === "stl") {
      const { STLExporter } =
        await import("three/addons/exporters/STLExporter.js");
      const data = new STLExporter().parse(mesh, { binary: true });
      return new Blob([new Uint8Array(data.buffer as ArrayBuffer)], {
        type: "application/octet-stream",
      });
    }
    if (format === "glb") {
      const { GLTFExporter } =
        await import("three/addons/exporters/GLTFExporter.js");
      const data = await new GLTFExporter().parseAsync(mesh, { binary: true });
      return new Blob([data as ArrayBuffer], { type: "model/gltf-binary" });
    }
    const ratio = aspect || this.camera.aspect;
    const width = Math.round(ratio >= 1 ? resolution : resolution * ratio);
    const height = Math.round(ratio >= 1 ? resolution / ratio : resolution);
    const renderer = this.renderer;
    const oldSize = renderer.getSize(new THREE.Vector2());
    const pixelRatio = renderer.getPixelRatio();
    const background = this.scene.background;
    const camera = this.camera.clone();
    camera.aspect = width / height;
    // Keep a little extra room for high-resolution exports so antialiasing and
    // depth edges never touch the image boundary.
    fitTextCamera(camera, mesh, 1.3);
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      if (transparent) this.scene.background = null;
      renderer.render(this.scene, camera);
      // Capture synchronously before the animation loop can redraw the preview.
      const snapshot = document.createElement("canvas");
      snapshot.width = width;
      snapshot.height = height;
      snapshot.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
      return await new Promise<Blob>((resolve, reject) =>
        snapshot.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(
                  new Error("PNG export failed. Try a smaller resolution."),
                ),
          "image/png",
        ),
      );
    } finally {
      this.scene.background = background;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(oldSize.x, oldSize.y, false);
      renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.revision++;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.controls.dispose();
    if (this.mesh) {
      this.mesh.geometry.dispose();
      disposeMaterials(this.mesh.material);
    }
    if (this.scene.background instanceof THREE.Texture)
      this.scene.background.dispose();
    this.environment.dispose();
    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
