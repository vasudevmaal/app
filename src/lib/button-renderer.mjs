const customIconImages = new Map();

export function buttonLayout(ctx, state) {
  const s = state;
  const font = `${s.isItalic ? "italic " : ""}${s.fontWeight} ${s.fontSize}px "${s.fontFamily}"`;
  ctx.font = font;
  const lines = s.text.split("\n");
  const iconGlyph = {
    none: "",
    custom: "◇",
    play: "▶",
    heart: "♥",
    check: "✓",
    arrow: "→",
    star: "★",
    plus: "+",
    minus: "−",
    close: "×",
    dot: "•",
    circle: "●",
    square: "■",
    diamond: "◆",
    triangle: "▲",
    bolt: "⚡",
    music: "♪",
    phone: "☎",
    mail: "✉",
    search: "⌕",
    home: "⌂",
    user: "♙",
    lock: "⌑",
    unlock: "⌗",
    bell: "♢",
    flag: "⚑",
    bookmark: "▮",
    calendar: "▦",
    clock: "◷",
    camera: "▣",
    image: "▧",
    link: "🔗",
    globe: "⊕",
    gear: "⚙",
    cloud: "☁",
    download: "⇩",
    upload: "⇧",
    share: "↗",
    send: "➤",
    pencil: "✎",
    trash: "♲",
    cart: "▱",
    gift: "✚",
    coffee: "◒",
    flame: "♨",
    leaf: "❧",
    sun: "☀",
    moon: "☾",
    snowflake: "❄",
    rocket: "➶",
    sparkles: "✦",
    smile: "☺",
    warning: "⚠",
    info: "ⓘ",
    question: "?",
    location: "⌖",
    eye: "◉",
  }[s.icon];
  const iconWidth = iconGlyph ? s.iconSize + s.iconGap : 0;
  const glyphs = [];
  const icons = [];
  const widths = lines.map(
    (line) =>
      iconWidth +
      Array.from(line).reduce(
        (sum, char, i) =>
          sum +
          Math.max(
            0.5,
            ctx.measureText(char).width + (i ? s.letterSpacing : 0),
          ),
        0,
      ),
  );
  const lineWidth = Math.max(1, ...widths);
  let left = 0,
    right = lineWidth,
    top = -s.fontSize * 0.75;
  let bottom =
    (lines.length - 1) * s.fontSize * s.lineHeight + s.fontSize * 0.75;
  lines.forEach((line, row) => {
    let x =
      s.align === "left"
        ? 0
        : s.align === "right"
          ? lineWidth - widths[row]
          : (lineWidth - widths[row]) / 2;
    const iconX =
      x + (s.iconPosition === "right" ? widths[row] - iconWidth : 0);
    const textOffset = s.iconPosition === "left" ? iconWidth : 0;
    x += textOffset;
    Array.from(line).forEach((char, i) => {
      const metrics = ctx.measureText(char);
      const advance = Math.max(0.5, metrics.width + s.letterSpacing);
      const position =
        widths[row] > 0
          ? (x + metrics.width / 2 - (lineWidth - widths[row]) / 2) /
            widths[row]
          : 0.5;
      const u = position * 2 - 1;
      const y =
        row * s.fontSize * s.lineHeight +
        s.curve * (u * u - 1) * 0.5 +
        (i % 2 ? s.zigzag : -s.zigzag) * 0.25 +
        Math.sin(i * 0.9) * s.wave * 0.25;
      glyphs.push({ char, x, y, width: metrics.width });
      left = Math.min(left, x - (metrics.actualBoundingBoxLeft || 0));
      right = Math.max(
        right,
        x + Math.max(metrics.width, metrics.actualBoundingBoxRight || 0),
      );
      top = Math.min(
        top,
        y - Math.max(s.fontSize * 0.75, metrics.actualBoundingBoxAscent || 0),
      );
      bottom = Math.max(
        bottom,
        y + Math.max(s.fontSize * 0.75, metrics.actualBoundingBoxDescent || 0),
      );
      x += advance;
    });
    if (iconGlyph) {
      const iconY = row * s.fontSize * s.lineHeight;
      icons.push({
        icon: iconGlyph,
        image: s.icon === "custom" ? s.iconDataUrl : "",
        x: iconX,
        y: iconY,
        width: iconWidth,
      });
      left = Math.min(left, iconX);
      right = Math.max(right, iconX + iconWidth);
      top = Math.min(top, iconY - s.iconSize * 0.6);
      bottom = Math.max(bottom, iconY + s.iconSize * 0.6);
    }
  });
  const width = right - left + 2 * (s.paddingX + s.borderWidth);
  const height = bottom - top + 2 * (s.paddingY + s.borderWidth);
  return {
    font,
    width,
    height,
    glyphs: glyphs.map((g) => ({
      ...g,
      x: g.x - left + s.paddingX + s.borderWidth - width / 2,
      y: g.y - top + s.paddingY + s.borderWidth - height / 2,
    })),
    icons: icons.map((item) => ({
      ...item,
      x: item.x - left + s.paddingX + s.borderWidth - width / 2,
      y: item.y - top + s.paddingY + s.borderWidth - height / 2,
    })),
  };
}

export function buttonFrame(
  ctx,
  s,
  layout,
  width,
  height,
  phase = 0,
  options = {},
) {
  const { vector = false, hover = false, iconImage = null } = options;
  const wholeAnimation = s.wholeAnimation || s.animation || "none";
  const textAnimation = s.textAnimation || "none";
  const radians = (s.rotation * Math.PI) / 180;
  const shadowPad = s.shadowEnabled
    ? s.shadowBlur * 2 + Math.max(Math.abs(s.shadowX), Math.abs(s.shadowY))
    : 0;
  const pad = shadowPad + s.borderWidth + 12 + s.hoverLift;
  const extentX =
    Math.abs(Math.cos(radians)) * layout.width +
    Math.abs(Math.sin(radians)) * layout.height;
  const extentY =
    Math.abs(Math.sin(radians)) * layout.width +
    Math.abs(Math.cos(radians)) * layout.height;
  const scale =
    Math.min(
      width / (extentX * 1.035 + pad * 2),
      height / (extentY * 1.035 + pad * 2),
    ) * 0.85;
  ctx.clearRect(0, 0, width, height);
  const backgroundType =
    s.backgroundType || (s.backgroundTransparent ? "transparent" : "solid");
  if (backgroundType !== "transparent") {
    let backgroundFill = s.background;
    const stops = (
      s.backgroundStops?.length
        ? s.backgroundStops
        : [
            { color: s.background, pos: 0 },
            { color: s.backgroundEnd || s.background, pos: 100 },
          ]
    )
      .slice()
      .sort((a, b) => a.pos - b.pos);
    if (backgroundType === "gradient" || backgroundType === "radial") {
      if (backgroundType === "radial") {
        backgroundFill = ctx.createRadialGradient(
          width / 2,
          height / 2,
          0,
          width / 2,
          height / 2,
          Math.max(width, height) / 2,
        );
      } else {
        const angle = ((s.backgroundAngle ?? 135) * Math.PI) / 180;
        const dx = Math.sin(angle),
          dy = -Math.cos(angle);
        const length = Math.abs(width * dx) + Math.abs(height * dy);
        backgroundFill = ctx.createLinearGradient(
          width / 2 - (dx * length) / 2,
          height / 2 - (dy * length) / 2,
          width / 2 + (dx * length) / 2,
          height / 2 + (dy * length) / 2,
        );
      }
      for (const stop of stops)
        backgroundFill.addColorStop(stop.pos / 100, stop.color);
    }
    ctx.fillStyle = backgroundFill;
    ctx.save();
    ctx.globalAlpha = s.backgroundOpacity ?? 1;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  const wave = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  if (["pulse", "breathe"].includes(wholeAnimation))
    ctx.scale(
      1 + wave * (wholeAnimation === "breathe" ? 0.06 : 0.035),
      1 + wave * (wholeAnimation === "breathe" ? 0.06 : 0.035),
    );
  if (["bounce", "jump", "float", "wave"].includes(wholeAnimation))
    ctx.translate(
      0,
      -Math.sin(phase * Math.PI * 2) * (wholeAnimation === "jump" ? 12 : 6),
    );
  if (wholeAnimation === "heartbeat")
    ctx.scale(
      1 + Math.pow(Math.max(0, Math.sin(phase * Math.PI * 4)), 8) * 0.07,
      1 + Math.pow(Math.max(0, Math.sin(phase * Math.PI * 4)), 8) * 0.07,
    );
  if (wholeAnimation === "swing" || wholeAnimation === "pendulum")
    ctx.rotate(Math.sin(phase * Math.PI * 2) * 0.06);
  if (wholeAnimation === "shake" || wholeAnimation === "earthquake")
    ctx.translate(
      Math.sin(phase * Math.PI * 16) * 4,
      Math.cos(phase * Math.PI * 13) * 2,
    );
  if (wholeAnimation === "wobble") {
    ctx.rotate(Math.sin(phase * Math.PI * 2) * 0.04);
    ctx.scale(
      1 + Math.sin(phase * Math.PI * 4) * 0.025,
      1 - Math.sin(phase * Math.PI * 4) * 0.025,
    );
  }
  if (["spin", "roll"].includes(wholeAnimation))
    ctx.rotate(phase * Math.PI * 2);
  if (wholeAnimation === "flip_x") ctx.scale(Math.cos(phase * Math.PI * 2), 1);
  if (wholeAnimation === "flip_y") ctx.scale(1, Math.cos(phase * Math.PI * 2));
  if (wholeAnimation === "squeeze")
    ctx.scale(0.84 + Math.abs(Math.cos(phase * Math.PI * 2)) * 0.16, 1.06);
  if (wholeAnimation === "ripple")
    ctx.scale(
      1 + Math.sin(phase * Math.PI * 2) * 0.025,
      1 + Math.sin(phase * Math.PI * 2) * 0.025,
    );
  if (wholeAnimation === "zoom_in")
    ctx.scale(0.92 + wave * 0.08, 0.92 + wave * 0.08);
  if (hover) ctx.translate(0, -s.hoverLift);
  ctx.rotate(radians);
  const x = -layout.width / 2,
    y = -layout.height / 2;
  const rect = () => {
    ctx.beginPath();
    ctx.roundRect(
      x + s.borderWidth / 2,
      y + s.borderWidth / 2,
      layout.width - s.borderWidth,
      layout.height - s.borderWidth,
      Math.min(
        s.radius,
        (layout.width - s.borderWidth) / 2,
        (layout.height - s.borderWidth) / 2,
      ),
    );
  };
  const shape = () => {
    rect();
    if (!vector && s.shadowEnabled) {
      ctx.shadowColor = `${s.shadowColor}${Math.round(s.shadowOpacity * 255)
        .toString(16)
        .padStart(2, "0")}`;
      ctx.shadowBlur = s.shadowBlur * scale;
      ctx.shadowOffsetX = s.shadowX * scale;
      ctx.shadowOffsetY = s.shadowY * scale;
    }
    let fill = hover ? s.hoverFill : s.fillStart;
    if (!hover && s.fillType !== "solid") {
      if (s.fillType === "radial")
        fill = ctx.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          Math.max(layout.width, layout.height) / 2,
        );
      else {
        const angle = (s.fillAngle * Math.PI) / 180;
        const dx = Math.sin(angle),
          dy = -Math.cos(angle);
        const length =
          Math.abs(layout.width * dx) + Math.abs(layout.height * dy);
        fill = ctx.createLinearGradient(
          (-dx * length) / 2,
          (-dy * length) / 2,
          (dx * length) / 2,
          (dy * length) / 2,
        );
      }
      const stops = (
        s.fillStops?.length
          ? s.fillStops
          : [
              { color: s.fillStart, pos: 0 },
              { color: s.fillEnd, pos: 100 },
            ]
      )
        .slice()
        .sort((a, b) => a.pos - b.pos);
      for (const stop of stops) fill.addColorStop(stop.pos / 100, stop.color);
    }
    ctx.fillStyle = fill;
    ctx.globalAlpha *= s.fillOpacity ?? 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowColor = "transparent";
    if (s.borderWidth) {
      ctx.lineWidth = s.borderWidth;
      ctx.strokeStyle = s.borderColor;
      ctx.stroke();
    }
  };
  if (options.svgShadow) options.svgShadow(ctx.getTransform(), shape, scale);
  else shape();
  ctx.font = layout.font;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = hover ? s.hoverText : s.textColor;
  if (!hover && s.textFillType && s.textFillType !== "solid") {
    let paint;
    if (s.textFillType === "radial") {
      paint = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(layout.width, layout.height) / 2);
    } else {
      const angle = (s.textAngle ?? 90) * Math.PI / 180;
      const dx = Math.sin(angle), dy = -Math.cos(angle);
      const length = Math.abs(layout.width * dx) + Math.abs(layout.height * dy);
      paint = ctx.createLinearGradient(-dx * length / 2, -dy * length / 2, dx * length / 2, dy * length / 2);
    }
    for (const stop of [...s.textStops].sort((a, b) => a.pos - b.pos)) paint.addColorStop(stop.pos / 100, stop.color);
    ctx.fillStyle = paint;
  }
  ctx.save();
  ctx.globalAlpha *= s.textOpacity ?? 1;
  for (const [index, g] of layout.glyphs.entries()) {
    const local = (phase + index / Math.max(1, layout.glyphs.length)) % 1;
    const textWave = Math.sin(local * Math.PI * 2);
    const textPulse = 1 + Math.max(0, textWave) * 0.12;
    ctx.save();
    ctx.translate(g.x + g.width / 2, g.y);
    if (["wave", "letter_bounce"].includes(textAnimation))
      ctx.translate(0, -textWave * 7);
    if (["float", "letter_orbit"].includes(textAnimation))
      ctx.translate(0, -textWave * 4);
    if (["swing", "letter_swing"].includes(textAnimation))
      ctx.rotate(textWave * 0.16);
    if (["shake", "letter_shake"].includes(textAnimation))
      ctx.translate(Math.sin(local * Math.PI * 16) * 3, 0);
    if (["letter_spin", "letter_orbit"].includes(textAnimation))
      ctx.rotate(textWave * Math.PI);
    if (textAnimation === "letter_scale") ctx.scale(textPulse, textPulse);
    if (textAnimation === "letter_bounce")
      ctx.scale(
        1 + Math.max(0, textWave) * 0.08,
        1 + Math.max(0, textWave) * 0.08,
      );
    if (textAnimation === "flash") ctx.globalAlpha = textWave > 0.1 ? 1 : 0.35;
    ctx.fillText(g.char, -g.width / 2, 0);
    if (s.isUnderline && g.char.trim())
      ctx.fillRect(
        -g.width / 2,
        s.fontSize * 0.4,
        g.width + Math.max(0, s.letterSpacing),
        Math.max(1, s.fontSize / 16),
      );
    ctx.restore();
  }
  ctx.restore();
  if (layout.icons?.length) {
    ctx.fillStyle = s.iconColor || s.textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${s.iconSize}px sans-serif`;
    for (const [index, icon] of layout.icons.entries()) {
      const local = (phase + index / Math.max(1, layout.icons.length)) % 1;
      const iconWave = Math.sin(local * Math.PI * 2);
      ctx.save();
      ctx.translate(icon.x + icon.width / 2, icon.y);
      if (["wave", "letter_bounce"].includes(textAnimation))
        ctx.translate(0, -iconWave * 7);
      if (["float", "letter_orbit"].includes(textAnimation))
        ctx.translate(0, -iconWave * 4);
      if (["swing", "letter_swing"].includes(textAnimation))
        ctx.rotate(iconWave * 0.16);
      if (["shake", "letter_shake"].includes(textAnimation))
        ctx.translate(Math.sin(local * Math.PI * 16) * 3, 0);
      if (["letter_spin", "letter_orbit"].includes(textAnimation))
        ctx.rotate(iconWave * Math.PI);
      if (textAnimation === "letter_scale") {
        const scale = 1 + Math.max(0, iconWave) * 0.12;
        ctx.scale(scale, scale);
      }
      const image =
        iconImage ||
        (icon.image && typeof Image !== "undefined"
          ? (() => {
              const cached = customIconImages.get(icon.image);
              if (cached) return cached.complete ? cached : null;
              const next = new Image();
              next.src = icon.image;
              customIconImages.set(icon.image, next);
              return null;
            })()
          : null);
      if (image) {
        ctx.drawImage(
          image,
          -s.iconSize / 2,
          -s.iconSize / 2,
          s.iconSize,
          s.iconSize,
        );
      } else {
        ctx.fillText(icon.icon, 0, 0);
      }
      ctx.restore();
    }
  }
  if (
    wholeAnimation === "shine" ||
    wholeAnimation === "disco" ||
    wholeAnimation === "neon_flicker"
  ) {
    ctx.save();
    rect();
    ctx.clip();
    const stripeX = x - layout.width * 0.35 + phase * layout.width * 1.7;
    const shine = ctx.createLinearGradient(
      stripeX,
      y,
      stripeX + layout.width * 0.35,
      y,
    );
    shine.addColorStop(0, "#ffffff00");
    shine.addColorStop(
      0.5,
      wholeAnimation === "neon_flicker" ? "#ffffffaa" : "#ffffff66",
    );
    shine.addColorStop(1, "#ffffff00");
    ctx.fillStyle = shine;
    ctx.fillRect(stripeX, y, layout.width * 0.35, layout.height);
    ctx.restore();
  }
  ctx.restore();
  return scale;
}
