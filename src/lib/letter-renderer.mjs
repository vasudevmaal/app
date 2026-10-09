function gradient(ctx, w, h, stops, angle = 90, radial = false) {
  const a = ((angle - 90) * Math.PI) / 180,
    x = Math.cos(a) * w,
    y = Math.sin(a) * h;
  const paint = radial
    ? ctx.createRadialGradient(
        w / 2,
        h / 2,
        0,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.7,
      )
    : ctx.createLinearGradient(
        w / 2 - x / 2,
        h / 2 - y / 2,
        w / 2 + x / 2,
        h / 2 + y / 2,
      );
  for (const stop of stops || [])
    paint.addColorStop(Math.max(0, Math.min(1, stop.pos / 100)), stop.color);
  return paint;
}
function background(ctx, canvas, bg) {
  const w = canvas.width,
    h = canvas.height;
  if (bg.type === "transparent") return;
  ctx.save();
  ctx.globalAlpha = bg.opacity ?? 1;
  if (["gradient", "radial"].includes(bg.type))
    ctx.fillStyle = gradient(
      ctx,
      w,
      h,
      bg.stops,
      bg.angleGrad ?? bg.angle,
      bg.type === "radial",
    );
  else if (bg.type === "image" && bg.image) {
    const image = bg.image,
      mode = bg.imageMode || "cover";
    const scale =
      mode === "contain"
        ? Math.min(w / image.width, h / image.height)
        : mode === "original"
          ? 1
          : Math.max(w / image.width, h / image.height);
    const dw = mode === "stretch" ? w : image.width * scale,
      dh = mode === "stretch" ? h : image.height * scale;
    ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.restore();
    return;
  } else if (bg.type === "pattern" && bg.patternImage) {
    if (["solid", "gradient", "radial"].includes(bg.patternBgType)) {
      ctx.fillStyle =
        bg.patternBgType === "solid"
          ? bg.patternBgColor || "#ffffff"
          : gradient(
              ctx,
              w,
              h,
              bg.patternBgStops,
              bg.patternBgAngle,
              bg.patternBgType === "radial",
            );
      ctx.fillRect(0, 0, w, h);
    }
    const pattern = ctx.createPattern(
      bg.patternImage,
      bg.patternRepeat || "repeat",
    );
    if (pattern) {
      const scale = (bg.patternSize || 100) / 100;
      ctx.scale(scale, scale);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w / scale, h / scale);
    }
    ctx.restore();
    return;
  } else ctx.fillStyle = bg.color || "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function motion(id, t) {
  const m = {
      x: 0,
      y: 0,
      r: 0,
      sx: 1,
      sy: 1,
      curve: 0,
      zigzag: 0,
      hue: 0,
      alpha: 1,
    },
    p = t * Math.PI * 2,
    s = Math.sin(p),
    c = Math.cos(p);
  switch (id) {
    case "pulse":
      m.sx = m.sy = 1 + 0.05 * s;
      break;
    case "breathe":
      m.sx = m.sy = 1 + 0.02 * s;
      break;
    case "heartbeat":
      m.sx = m.sy = 1 + 0.15 * Math.exp(-20 * ((t % 0.5) - 0.1) ** 2);
      break;
    case "float":
      m.y = s * 20;
      break;
    case "bounce":
      m.y = -Math.abs(s) * 30;
      break;
    case "swing":
      m.r = s * 0.15;
      break;
    case "shake":
      m.x = Math.sin(p * 15) * 5;
      m.y = Math.cos(p * 13) * 5;
      break;
    case "wobble":
      m.r = s * 0.1;
      m.sx = m.sy = 1 + 0.1 * Math.sin(p * 2);
      break;
    case "squeeze":
      m.sx = 1 + 0.15 * s;
      m.sy = 1 - 0.15 * s;
      break;
    case "spin":
      m.r = p;
      break;
    case "roll":
      m.r = p;
      m.sx = m.sy = 0.5 + 0.5 * Math.abs(s);
      break;
    case "orbit":
      m.x = c * 30;
      m.y = s * 30;
      break;
    case "glitch":
      m.x = Math.sin(p * 19) > 0.8 ? 20 * c : 0;
      m.sy = 1 + 0.1 * Math.sin(p * 7);
      break;
    case "hue_rotate":
      m.hue = t * 360;
      break;
    case "disco":
      m.hue = Math.floor(t * 10) * 36;
      break;
    case "neon_flicker":
      m.alpha = 0.65 + 0.35 * Math.abs(Math.sin(p * 7));
      break;
    case "3d_pump":
      m.sx = m.sy = 1 + 0.08 * s;
      break;
    case "3d_spin":
      m.sx = c;
      break;
    case "3d_swing":
      m.sx = 0.8 + 0.2 * c;
      m.r = 0.08 * s;
      break;
    case "curve_flex":
      m.curve = s * 50;
      break;
    case "zigzag_flow":
      m.zigzag = s * 30;
      break;
    case "smash":
      m.sy = 1 - 0.5 * Math.abs(s);
      m.y = Math.abs(s) * 25;
      break;
    case "rubber_band":
      m.sx = 1 + 0.3 * s;
      m.sy = 1 - 0.2 * s;
      break;
    case "earthquake":
      m.x = Math.sin(p * 17) * 7.5;
      m.y = Math.cos(p * 23) * 7.5;
      m.r = Math.sin(p * 11) * 0.025;
      break;
    case "flash":
      m.alpha = Math.sin(p * 5) > 0 ? 0.15 : 1;
      break;
    case "zoom_in":
      m.sx = m.sy = 0.5 + 0.5 * Math.abs(s);
      break;
    case "pendulum":
      m.r = s * 0.3;
      m.x = s * 20;
      break;
    case "figure8":
      m.x = s * 40;
      m.y = Math.sin(p * 2) * 20;
      break;
    case "tada":
      m.sx = m.sy = 1 + 0.1 * Math.sin(p * 3);
      m.r = Math.sin(p * 5) * 0.1;
      break;
    case "jello":
      m.sx = 1 + 0.15 * Math.sin(p * 3);
      m.sy = 1 - 0.15 * Math.sin(p * 3);
      break;
    case "slide_x":
      m.x = s * 60;
      break;
    case "slide_y":
      m.y = s * 60;
      break;
    case "orbit_3d":
      m.sx = c;
      m.x = s * 50;
      break;
    case "hurricane":
      m.r = p * 2;
      m.sx = m.sy = 1 + 0.3 * s;
      break;
    case "tornado":
      m.r = p * 2;
      m.zigzag = s * 20;
      m.curve = c * 30;
      break;
    case "jellyfish":
      m.sy = 1 + 0.15 * Math.sin(p * 2);
      m.y = s * 30;
      break;
    case "color_glitch":
      m.hue = Math.sin(p * 13) > 0.6 ? 180 : 0;
      m.x = Math.sin(p * 17) * 10;
      break;
    case "depth_throb":
      m.sx = m.sy = 1 + 0.15 * Math.abs(s);
      break;
    case "curve_dance":
      m.curve = s * 150;
      break;
    case "zigzag_crazy":
      m.zigzag = s * 80;
      break;
    case "helicopter":
      m.r = p * 10;
      m.sy = 0.5 + 0.5 * s;
      break;
  }
  return m;
}
function glyphsAt(state, layout, time) {
  const id = time === undefined ? "none" : state.animation?.id || "none",
    t = time ?? 0,
    m = motion(id, t);
  const curve = (state.curve || 0) + m.curve,
    zigzag = (state.zigzag || 0) + m.zigzag;
  const glyphs = layout.map((g, i) => {
    const n = g.center / (g.lineWidth / 2 || 1),
      phase = (t - i / Math.max(1, layout.length)) * Math.PI * 2;
    const out = {
      ...g,
      x: g.x,
      y:
        g.y +
        curve * n * n +
        (i % 2 ? 1 : -1) * zigzag +
        Math.sin(i * 0.5) * (state.wave || 0),
      r: Math.atan2(2 * curve * n, g.lineWidth / 2 || 1),
      sx: 1,
      sy: 1,
    };
    switch (id) {
      case "jump":
        out.y -= Math.abs(Math.sin(phase)) * 40;
        break;
      case "wave":
        out.y += Math.sin(phase) * 20;
        break;
      case "ripple":
        out.sx = out.sy = 1 + 0.3 * Math.sin(phase);
        break;
      case "flip_x":
        out.sx = Math.cos(phase);
        break;
      case "flip_y":
        out.sy = Math.cos(phase);
        break;
      case "letter_spin":
        out.r += t * Math.PI * 2;
        break;
      case "letter_swing":
        out.r += Math.sin(phase) * 0.5;
        break;
      case "letter_bounce":
        out.y -= Math.abs(Math.sin(phase)) * 50;
        break;
      case "letter_scale":
        out.sx = out.sy = 1 + 0.5 * Math.sin(phase);
        break;
      case "letter_shake":
        out.x += Math.sin(phase * 10) * 5;
        out.y += Math.cos(phase * 10) * 5;
        break;
      case "letter_orbit":
        out.x += Math.cos(phase) * 20;
        out.y += Math.sin(phase) * 20;
        break;
      case "letter_flip_both":
        out.sx = Math.cos(phase);
        out.sy = Math.sin(phase);
        break;
    }
    return out;
  });
  m.r += ((state.rotation || 0) * Math.PI) / 180;
  return { m, glyphs };
}
function bounds({ m, glyphs }) {
  let x = 1,
    y = 1;
  const c = Math.cos(m.r),
    s = Math.sin(m.r);
  for (const g of glyphs) {
    const gc = Math.cos(g.r),
      gs = Math.sin(g.r);
    for (const dx of [-g.width / 2, g.width / 2])
      for (const dy of [-50, 50]) {
        const gx = (g.x + dx * g.sx * gc - dy * g.sy * gs) * m.sx,
          gy = (g.y + dx * g.sx * gs + dy * g.sy * gc) * m.sy;
        x = Math.max(x, Math.abs(gx * c - gy * s + m.x));
        y = Math.max(y, Math.abs(gx * s + gy * c + m.y));
      }
  }
  return { x, y };
}
const layouts = new WeakMap();
function prepare(state, images) {
  const cached = layouts.get(state);
  if (cached?.images === images) return cached;
  const lines = state.text
    .toUpperCase()
    .split("\n")
    .map((line) =>
      [...line].map((char) => ({
        image: images[char],
        width:
          char === " "
            ? 45
            : images[char]
              ? (100 * images[char].width) / images[char].height
              : 60,
      })),
    );
  const gap = state.letterSpacing || 0,
    widths = lines.map(
      (line) =>
        line.reduce((sum, g) => sum + g.width, 0) +
        Math.max(0, line.length - 1) * gap,
    ),
    max = Math.max(1, ...widths);
  const height = 100 + (lines.length - 1) * 100 * state.lineHeight,
    layout = [];
  lines.forEach((line, i) => {
    let x =
      state.align === "left"
        ? -max / 2
        : state.align === "right"
          ? max / 2 - widths[i]
          : -widths[i] / 2;
    line.forEach((g) => {
      if (g.image)
        layout.push({
          ...g,
          x: x + g.width / 2,
          center: x + g.width / 2,
          y: -height / 2 + 50 + i * 100 * state.lineHeight,
          lineWidth: Math.max(1, widths[i]),
        });
      x += g.width + gap;
    });
  });
  // Cache the whole motion envelope so rotation and animation never crop the canvas.
  const envelope = bounds(glyphsAt(state, layout, undefined));
  if (state.animation?.id !== "none")
    for (let i = 0; i < 120; i++) {
      const b = bounds(glyphsAt(state, layout, i / 120));
      envelope.x = Math.max(envelope.x, b.x);
      envelope.y = Math.max(envelope.y, b.y);
    }
  const result = { layout, envelope, images };
  layouts.set(state, result);
  return result;
}
export function drawLetters(canvas, state, images, watermark = "", time) {
  const ctx = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  background(ctx, canvas, state.bg || {});
  const { layout, envelope } = prepare(state, images),
    frame = glyphsAt(state, layout, time),
    current = bounds(frame);
  const scale = Math.min(
    (w * 0.92) / (2 * Math.max(envelope.x, current.x)),
    (h * 0.92) / (2 * Math.max(envelope.y, current.y)),
  );
  const { m, glyphs } = frame;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.translate(m.x, m.y);
  ctx.rotate(m.r);
  ctx.scale(m.sx, m.sy);
  ctx.globalAlpha = m.alpha;
  if (m.hue) ctx.filter = `hue-rotate(${m.hue}deg)`;
  for (const g of glyphs) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.r);
    ctx.scale(g.sx, g.sy);
    ctx.drawImage(g.image, -g.width / 2, -50, g.width, 100);
    ctx.restore();
  }
  ctx.restore();
  if (watermark) {
    const fs = Math.max(14, w * 0.018);
    ctx.font = `600 ${fs}px sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillText(watermark, w - fs, h - fs);
  }
}
