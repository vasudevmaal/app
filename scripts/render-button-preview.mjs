import { createCanvas } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";

const canvas = createCanvas(1200, 800);
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#f4f5f6";
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.scale(3, 3);
ctx.font = "800 20px Arial";
ctx.letterSpacing = "0.4px";
const width = ctx.measureText("SUBSCRIBE").width + 72;
const height = 60;
const x = (400 - width) / 2;
const y = (800 / 3 - height) / 2;
ctx.shadowColor = "rgba(141,0,0,0.3)";
ctx.shadowBlur = 54;
ctx.shadowOffsetY = 21;
const extent = (width + height) / 4;
const gradient = ctx.createLinearGradient(
  x + width / 2 - extent, y + height / 2 - extent,
  x + width / 2 + extent, y + height / 2 + extent,
);
gradient.addColorStop(0, "#ff2020");
gradient.addColorStop(1, "#c90000");
ctx.fillStyle = gradient;
ctx.beginPath();
ctx.roundRect(x, y, width, height, 30);
ctx.fill();
ctx.shadowColor = "transparent";
ctx.fillStyle = "#ffffff";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("SUBSCRIBE", 200, 800 / 6);

const output = new URL("../public/images/button/youtube-button-maker.png", import.meta.url);
await mkdir(new URL(".", output), { recursive: true });
await writeFile(output, canvas.toBuffer("image/png"));
console.log(output.pathname);
