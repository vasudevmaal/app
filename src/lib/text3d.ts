export const text3dFonts = [
  { id: "helvetiker_bold", name: "Helvetiker Bold" },
  { id: "helvetiker_regular", name: "Helvetiker Regular" },
  { id: "optimer_bold", name: "Optimer Bold" },
  { id: "optimer_regular", name: "Optimer Regular" },
  { id: "gentilis_bold", name: "Gentilis Bold" },
  { id: "droid_sans_regular", name: "Droid Sans Regular" },
  { id: "droid_sans_bold", name: "Droid Sans Bold" },
  { id: "droid_sans_mono_regular", name: "Droid Sans Mono" },
  { id: "droid_serif_regular", name: "Droid Serif Regular" },
  { id: "droid_serif_bold", name: "Droid Serif Bold" },
] as const;

export type Text3DState = {
  text: string;
  font: string;
  size: number;
  depth: number;
  bevel: number;
  bevelThickness: number;
  spacing: number;
  lineHeight: number;
  layout: "straight" | "arc";
  radius: number;
  curve: number;
  fill: "solid" | "gradient" | "image";
  sideFill: "solid" | "gradient" | "image";
  edgeFill: "solid" | "gradient" | "image";
  front: string;
  frontOpacity: number;
  side: string;
  sideOpacity: number;
  edge: string;
  edgeOpacity: number;
  gradientEnd: string;
  gradientAngle: number;
  texture: string;
  textureStrength: number;
  patternMode: boolean;
  patternSize: number;
  sideGradientEnd: string;
  edgeGradientEnd: string;
  sideGradientAngle: number;
  edgeGradientAngle: number;
  sideTexture: string;
  sideTextureStrength: number;
  sidePatternMode: boolean;
  sidePatternSize: number;
  edgeTexture: string;
  edgeTextureStrength: number;
  edgePatternMode: boolean;
  edgePatternSize: number;
  finish:
    | "matte"
    | "glossy"
    | "metal"
    | "glass"
    | "satin"
    | "chrome"
    | "plastic"
    | "iridescent";
  metalness: number;
  roughness: number;
  transmission: number;
  light: number;
  background: "solid" | "transparent" | "gradient";
  backgroundColor: string;
  backgroundEnd: string;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
};

export const defaultText3D: Text3DState = {
  text: "EXCPIX",
  font: "helvetiker_bold",
  size: 50,
  depth: 14,
  bevel: 1.2,
  bevelThickness: 1,
  spacing: 1,
  lineHeight: 1.4,
  layout: "straight",
  radius: 180,
  curve: 0,
  fill: "solid",
  sideFill: "solid",
  edgeFill: "solid",
  front: "#ed674a",
  frontOpacity: 1,
  side: "#8b3028",
  sideOpacity: 1,
  edge: "#ffb29c",
  edgeOpacity: 1,
  gradientEnd: "#ffc857",
  gradientAngle: 90,
  texture: "",
  textureStrength: 1,
  patternMode: true,
  patternSize: 33,
  sideGradientEnd: "#c6533d",
  edgeGradientEnd: "#ffd2c2",
  sideGradientAngle: 90,
  edgeGradientAngle: 90,
  sideTexture: "",
  sideTextureStrength: 1,
  sidePatternMode: true,
  sidePatternSize: 33,
  edgeTexture: "",
  edgeTextureStrength: 1,
  edgePatternMode: true,
  edgePatternSize: 33,
  finish: "glossy",
  metalness: 0.15,
  roughness: 0.24,
  transmission: 0,
  light: 1,
  background: "solid",
  backgroundColor: "#f1f3f5",
  backgroundEnd: "#d6e9ef",
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

export const text3dPresets: { name: string; state: Partial<Text3DState> }[] = [
  { name: "Coral", state: {} },
  {
    name: "Chrome",
    state: {
      front: "#dce2e8",
      side: "#687887",
      edge: "#ffffff",
      finish: "metal",
      metalness: 1,
      roughness: 0.18,
    },
  },
  {
    name: "Emerald",
    state: {
      front: "#28b887",
      side: "#125b4c",
      edge: "#9df5d4",
      backgroundColor: "#eaf5ef",
      metalness: 0.35,
    },
  },
  {
    name: "Gold",
    state: {
      front: "#e9b34f",
      side: "#92662c",
      edge: "#fff0a6",
      finish: "metal",
      metalness: 0.85,
      roughness: 0.25,
    },
  },
  {
    name: "Ocean",
    state: {
      fill: "gradient",
      front: "#087fa7",
      gradientEnd: "#7ae6d9",
      side: "#124e6b",
      edge: "#a0f1ed",
      backgroundColor: "#edf7f8",
    },
  },
  {
    name: "Berry",
    state: {
      fill: "gradient",
      front: "#e94f85",
      gradientEnd: "#9e58d1",
      side: "#652a65",
      edge: "#ffb8d6",
      backgroundColor: "#f9edf3",
    },
  },
  {
    name: "Glass",
    state: {
      front: "#d6f4ff",
      side: "#a7d7eb",
      edge: "#ffffff",
      finish: "glass",
      transmission: 0.92,
      metalness: 0,
      roughness: 0.08,
      background: "gradient",
      backgroundColor: "#e3f2f0",
      backgroundEnd: "#b6cadf",
    },
  },
  {
    name: "Graphite",
    state: {
      front: "#3f454b",
      side: "#202326",
      edge: "#7e858b",
      finish: "matte",
      metalness: 0.1,
      roughness: 0.85,
    },
  },
  {
    name: "Porcelain",
    state: {
      front: "#ffffff",
      side: "#aab6bf",
      edge: "#f1f7fb",
      roughness: 0.15,
      backgroundColor: "#ccd9df",
    },
  },
  {
    name: "Sunset",
    state: {
      fill: "gradient",
      front: "#fa5867",
      gradientEnd: "#ffd66e",
      side: "#993b46",
      edge: "#ffd6aa",
      gradientAngle: 35,
    },
  },
  {
    name: "Ice",
    state: {
      front: "#7ecbea",
      side: "#317598",
      edge: "#dbf6ff",
      finish: "metal",
      metalness: 0.6,
      roughness: 0.18,
    },
  },
  {
    name: "Lilac",
    state: {
      front: "#b7a0de",
      side: "#68518c",
      edge: "#e6d7fb",
      finish: "matte",
      metalness: 0,
      roughness: 0.65,
    },
  },
];

export function applyText3DPreset(
  current: Text3DState,
  index: number,
): Text3DState {
  return {
    ...defaultText3D,
    ...text3dPresets[index].state,
    text: current.text,
    font: current.font,
    size: current.size,
    spacing: current.spacing,
    lineHeight: current.lineHeight,
    layout: current.layout,
    radius: current.radius,
    curve: current.curve,
  };
}
