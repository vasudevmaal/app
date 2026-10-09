// Canvas engine mechanically extracted from the user-supplied editor.
export function createRenderer(canvas, invalidate = () => {}, glyphs = {}) {
  const ctx = canvas.getContext("2d");
  const BASE_FONT_SIZE = 180;
  let state = {};
  let textCanvas = null;
  const tCtx = ctx;
  const isImageTextMode = Object.keys(glyphs).length > 0;
  const charImageCache = {};
  function getCharImage(char) {
    const key = char.toUpperCase();
    if (charImageCache[key] !== undefined) return charImageCache[key];
    const url = glyphs[key];
    if (!url) return null;
    charImageCache[key] = null;
    const img = new Image();
    img.onload = () => {
      charImageCache[key] = img;
      invalidate();
    };
    img.onerror = () => {
      charImageCache[key] = false;
    };
    img.src = url;
    return null;
  }
  function hexToRgb(hex) {
    if (!hex) return [0, 0, 0];
    let h = hex.replace("#", "");
    if (h.length === 8)
      h = h
        .split("")
        .map((x) => x + x)
        .join("");
    const c = parseInt(h, 16);
    return [c >> 16, (c >> 8) & 255, c & 255];
  }

  function blendColors(c1, c2, factor) {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const r = Math.round(rgb1[0] + factor * (rgb2[0] - rgb1[0]));
    const g = Math.round(rgb1[1] + factor * (rgb2[1] - rgb1[1]));
    const b = Math.round(rgb1[2] + factor * (rgb2[2] - rgb1[2]));
    return `rgb(${r},${g},${b})`;
  }

  function getGradientColorAt(stops, percent) {
    if (!stops || stops.length === 0) return "#000000";
    if (stops.length === 1) return stops[0].color;
    const sorted = [...stops].sort((a, b) => a.pos - b.pos);
    if (percent <= sorted[0].pos) return sorted[0].color;
    if (percent >= sorted[sorted.length - 1].pos)
      return sorted[sorted.length - 1].color;

    for (let i = 0; i < sorted.length - 1; i++) {
      if (percent >= sorted[i].pos && percent <= sorted[i + 1].pos) {
        const range = sorted[i + 1].pos - sorted[i].pos;
        const f = range === 0 ? 0 : (percent - sorted[i].pos) / range;
        return blendColors(sorted[i].color, sorted[i + 1].color, f);
      }
    }
    return sorted[0].color;
  }

  function getPaintStyle(targetCtx, styleDef, boxW, boxH, centerX, centerY) {
    if (styleDef.type === "solid") return styleDef.color || "#000";
    if (
      ["gradient", "radial"].includes(styleDef.type) &&
      styleDef.stops &&
      styleDef.stops.length >= 2
    ) {
      const radius = Math.max(boxW, boxH) / 1.5;
      let grad;
      if (styleDef.type === "radial") {
        grad = targetCtx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          radius,
        );
      } else {
        let gradAngle =
          styleDef.angleGrad !== undefined
            ? styleDef.angleGrad
            : styleDef.angle !== undefined
              ? styleDef.angle
              : 90;
        const angleRad = ((gradAngle - 90) * Math.PI) / 180;
        const x0 = centerX - Math.cos(angleRad) * radius;
        const y0 = centerY - Math.sin(angleRad) * radius;
        const x1 = centerX + Math.cos(angleRad) * radius;
        const y1 = centerY + Math.sin(angleRad) * radius;
        grad = targetCtx.createLinearGradient(x0, y0, x1, y1);
      }
      const sortedStops = [...styleDef.stops].sort((a, b) => a.pos - b.pos);
      sortedStops.forEach((s) => grad.addColorStop(s.pos / 100, s.color));
      return grad;
    }
    if (styleDef.type === "pattern" && styleDef.patternImage) {
      const pat = targetCtx.createPattern(styleDef.patternImage, "repeat");
      if (
        pat &&
        styleDef.patternSize !== undefined &&
        styleDef.patternSize !== 100
      ) {
        const scale = styleDef.patternSize / 100;
        const matrix = new DOMMatrix().scale(scale, scale);
        pat.setTransform(matrix);
      }
      return pat || "#000";
    }
    return styleDef.type === "pattern"
      ? "rgba(0,0,0,0)"
      : styleDef.color || "#000";
  }

  function getTargetDimensionsForRatio(contentW, contentH, ratioString) {
    if (ratioString === "original") return { w: contentW, h: contentH };
    const [rw, rh] = ratioString.split(":").map(Number);
    const targetRatio = rw / rh;
    const currentRatio = contentW / contentH;

    if (currentRatio > targetRatio) {
      return { w: contentW, h: contentW / targetRatio };
    } else {
      return { w: contentH * targetRatio, h: contentH };
    }
  }

  function getFontString(stateObj) {
    const styleStr = stateObj.isItalic ? "italic " : "";
    const weightStr = stateObj.isBold ? "800 " : "400 ";
    return `${styleStr}${weightStr}${BASE_FONT_SIZE}px "${stateObj.fontFamily}", sans-serif`;
  }

  function drawTextLayer(
    ox,
    oy,
    mode,
    paintDef,
    extraProps = {},
    targetContext = tCtx,
    fullLinesData = null,
    currentStateRef = state,
  ) {
    targetContext.save();

    // --- PATTERN BACKGROUND RECURSIVE PASS ---
    if (
      paintDef.type === "pattern" &&
      paintDef.patternBgType &&
      paintDef.patternBgType !== "none" &&
      !extraProps._isPatternBgPass
    ) {
      const bgPaintDef = {
        type: paintDef.patternBgType,
        color: paintDef.patternBgColor,
        angleGrad: paintDef.patternBgAngle,
        stops: paintDef.patternBgStops,
        scope: paintDef.scope,
        opacity: paintDef.opacity,
      };
      drawTextLayer(
        ox,
        oy,
        mode,
        bgPaintDef,
        { ...extraProps, _isPatternBgPass: true },
        targetContext,
        fullLinesData,
        currentStateRef,
      );
    }

    // --- ALTERNATING IMAGE BACKGROUND RECURSIVE PASS ---
    if (
      paintDef.type === "alternating" &&
      paintDef.altMode === "image" &&
      paintDef.altPatternBgType &&
      paintDef.altPatternBgType !== "none" &&
      !extraProps._isPatternBgPass
    ) {
      const bgPaintDef = {
        type: paintDef.altPatternBgType,
        color: paintDef.altPatternBgColor,
        angleGrad: paintDef.altPatternBgAngle,
        stops: paintDef.altPatternBgStops,
        scope: "letter", // Set letter scope explicitly to mimic pattern per letter correctly
        opacity: paintDef.opacity,
      };
      drawTextLayer(
        ox,
        oy,
        mode,
        bgPaintDef,
        { ...extraProps, _isPatternBgPass: true },
        targetContext,
        fullLinesData,
        currentStateRef,
      );
    }
    // -----------------------------------------

    const isLetterScope = paintDef.scope === "letter";
    const isWordScope = paintDef.scope === "word";
    const isExtrudedScope = paintDef.scope === "extruded";
    const isAlternating = paintDef.type === "alternating";
    const isAltGrad = isAlternating && paintDef.altMode === "gradient";
    const isAltRadial = isAlternating && paintDef.altMode === "radial";

    let mainStyle = null;

    if (isExtrudedScope && ["gradient", "radial"].includes(paintDef.type)) {
      const ratio = extraProps.totalSteps
        ? extraProps.stepIndex / extraProps.totalSteps
        : 0;
      mainStyle = getGradientColorAt(paintDef.stops, ratio * 100);
      if (mode === "fill") targetContext.fillStyle = mainStyle;
      else targetContext.strokeStyle = mainStyle;
    } else if (!isLetterScope && !isWordScope && !isAlternating) {
      mainStyle = getPaintStyle(
        targetContext,
        paintDef,
        fullLinesData.maxWidth,
        fullLinesData.totalHeight,
        0,
        0,
      );
      if (mode === "fill") targetContext.fillStyle = mainStyle;
      else targetContext.strokeStyle = mainStyle;
    }

    if (mode === "stroke") targetContext.lineWidth = extraProps.width || 1;
    targetContext.globalAlpha =
      extraProps.opacity !== undefined
        ? extraProps.opacity
        : paintDef.opacity !== undefined
          ? paintDef.opacity
          : 1;

    let charGlobalIdx = 0;
    let altLetterIdx = 0;
    let altWordIdx = -1;

    fullLinesData.lines.forEach((line, i) => {
      let inWord = false;
      const y = fullLinesData.startY + i * fullLinesData.lineHeightPx + oy;
      let x = ox;

      const charWidthsForLine = fullLinesData.linesCharWidths[i];
      const sumCharW = charWidthsForLine.reduce((a, b) => a + b, 0);
      const spcW = Math.max(0, line.length - 1) * currentStateRef.letterSpacing;
      const fullW = sumCharW + spcW;

      if (currentStateRef.align === "center") x = ox - fullW / 2;
      else if (currentStateRef.align === "left")
        x = ox - fullLinesData.maxWidth / 2;
      else if (currentStateRef.align === "right")
        x = ox + fullLinesData.maxWidth / 2 - fullW;

      if (fullLinesData.needsCharRender) {
        let cx = x;
        const lineCenterX = x + fullW / 2;

        let charLocalIdx = 0;
        let wordStartX = cx,
          wordWidth = 0;
        for (let char of line) {
          let isSpace = char === " ";
          if (!isSpace && !inWord) {
            inWord = true;
            altWordIdx++;
            wordStartX = cx;
            let end = charLocalIdx;
            while (end < line.length && line[end] !== " ") end++;
            wordWidth =
              charWidthsForLine
                .slice(charLocalIdx, end)
                .reduce((a, b) => a + b, 0) +
              Math.max(0, end - charLocalIdx - 1) *
                currentStateRef.letterSpacing;
          } else if (isSpace && inWord) {
            inWord = false;
          }

          let currentAltIdx =
            paintDef.altScope === "word"
              ? Math.max(0, altWordIdx)
              : altLetterIdx;

          const charW = charWidthsForLine[charLocalIdx];
          targetContext.save();

          let charY = y;
          let charX = cx + charW / 2;
          let charRot = 0;
          let cScaleX = 1,
            cScaleY = 1;

          if (fullLinesData.activeCurve !== 0) {
            const distFromCenter = charX - lineCenterX;
            const normDist = fullW > 0 ? distFromCenter / (fullW / 2) : 0;
            charY += fullLinesData.activeCurve * (normDist * normDist);
            charRot += Math.atan2(
              (2 * fullLinesData.activeCurve * normDist) / (fullW / 2 || 1),
              1,
            );
          }
          if (fullLinesData.activeZigzag !== 0) {
            charY +=
              charGlobalIdx % 2 === 0
                ? -fullLinesData.activeZigzag
                : fullLinesData.activeZigzag;
          }
          if (fullLinesData.activeWave !== 0) {
            charY += Math.sin(charGlobalIdx * 0.5) * fullLinesData.activeWave;
          }

          if (fullLinesData.isAnimOnCharsGlobal) {
            const iNorm = charGlobalIdx / fullLinesData.totalChars;
            const p2 = Math.PI * 2;
            switch (currentStateRef.animation.id) {
              case "jump":
                charY +=
                  -Math.abs(Math.sin((fullLinesData.t - iNorm) * p2)) * 40;
                break;
              case "wave":
                charY += Math.sin((fullLinesData.t - iNorm) * p2) * 20;
                break;
              case "ripple":
                cScaleX = cScaleY =
                  1 + 0.3 * Math.sin((fullLinesData.t - iNorm) * p2);
                break;
              case "flip_x":
                cScaleX = Math.cos((fullLinesData.t - iNorm) * p2);
                break;
              case "flip_y":
                cScaleY = Math.cos((fullLinesData.t - iNorm) * p2);
                break;
              case "letter_spin":
                charRot += fullLinesData.t * p2;
                break;
              case "letter_swing":
                charRot += Math.sin((fullLinesData.t - iNorm) * p2) * 0.5;
                break;
              case "letter_bounce":
                charY +=
                  -Math.abs(Math.sin((fullLinesData.t - iNorm * 2) * p2)) * 50;
                break;
              case "letter_scale":
                cScaleX = cScaleY =
                  1 + 0.5 * Math.sin((fullLinesData.t - iNorm) * p2);
                break;
              case "letter_shake":
                charX += Math.sin((fullLinesData.t * 10 - iNorm) * p2) * 5;
                charY += Math.cos((fullLinesData.t * 10 - iNorm) * p2) * 5;
                break;
              case "letter_orbit":
                charX += Math.cos((fullLinesData.t - iNorm) * p2) * 20;
                charY += Math.sin((fullLinesData.t - iNorm) * p2) * 20;
                break;
              case "letter_flip_both":
                cScaleX = Math.cos((fullLinesData.t - iNorm) * p2);
                cScaleY = Math.sin((fullLinesData.t - iNorm) * p2);
                break;
            }
          }

          targetContext.translate(charX, charY);
          if (charRot !== 0) targetContext.rotate(charRot);
          if (cScaleX !== 1 || cScaleY !== 1)
            targetContext.scale(cScaleX, cScaleY);

          if (isAlternating) {
            if (
              (isAltGrad || isAltRadial) &&
              paintDef.altGradients &&
              paintDef.altGradients.length > 0
            ) {
              const gradDef =
                paintDef.altGradients[
                  currentAltIdx % paintDef.altGradients.length
                ];
              const tempGradStyle = {
                type: isAltRadial ? "radial" : "gradient",
                angleGrad: gradDef.angle,
                stops: gradDef.stops || [
                  { color: gradDef.c1 || "#ffffff", pos: 0 },
                  { color: gradDef.c2 || "#000000", pos: 100 },
                ],
              };
              const word = paintDef.altScope === "word";
              const charStyle = getPaintStyle(
                targetContext,
                tempGradStyle,
                word ? wordWidth : charW,
                fullLinesData.lineHeightPx,
                word ? wordStartX + wordWidth / 2 - charX : 0,
                0,
              );
              if (mode === "fill") targetContext.fillStyle = charStyle;
              else targetContext.strokeStyle = charStyle;
            } else if (
              paintDef.altMode === "image" &&
              paintDef.altImages &&
              paintDef.altImages.length > 0
            ) {
              const imgObj =
                paintDef.altImages[currentAltIdx % paintDef.altImages.length];
              if (imgObj && imgObj.image) {
                const pat = targetContext.createPattern(imgObj.image, "repeat");
                if (
                  pat &&
                  paintDef.altPatternSize !== undefined &&
                  paintDef.altPatternSize !== 100
                ) {
                  const scale = paintDef.altPatternSize / 100;
                  pat.setTransform(new DOMMatrix().scale(scale, scale));
                }
                if (mode === "fill") targetContext.fillStyle = pat || "#000";
                else targetContext.strokeStyle = pat || "#000";
              } else {
                if (mode === "fill") targetContext.fillStyle = "#000";
                else targetContext.strokeStyle = "#000";
              }
            } else if (
              paintDef.altMode === "solid" &&
              paintDef.colors &&
              paintDef.colors.length > 0
            ) {
              const c = paintDef.colors[currentAltIdx % paintDef.colors.length];
              if (mode === "fill") targetContext.fillStyle = c;
              else targetContext.strokeStyle = c;
            }
          } else if (
            (isLetterScope || isWordScope) &&
            !isAlternating &&
            !isExtrudedScope
          ) {
            const charStyle = getPaintStyle(
              targetContext,
              paintDef,
              isWordScope ? wordWidth : charW,
              fullLinesData.lineHeightPx,
              isWordScope ? wordStartX + wordWidth / 2 - charX : 0,
              0,
            );
            if (mode === "fill") targetContext.fillStyle = charStyle;
            else targetContext.strokeStyle = charStyle;
          }

          if (currentStateRef.isUnderline) {
            let uThick = BASE_FONT_SIZE * 0.08;
            let uY = BASE_FONT_SIZE * 0.35;
            let connectSpace =
              charLocalIdx < line.length - 1
                ? currentStateRef.letterSpacing
                : 0;
            let uW = charW + connectSpace;
            if (mode === "stroke")
              targetContext.strokeRect(-charW / 2, uY, uW, uThick);
            else targetContext.fillRect(-charW / 2, uY, uW, uThick);
          }

          let isImageDrawn = false;
          if (isImageTextMode && /^[a-zA-Z0-9]$/.test(char)) {
            const img = getCharImage(char);
            if (img) {
              if (mode === "fill") {
                const h = BASE_FONT_SIZE;
                const w = img.width * (BASE_FONT_SIZE / img.height);
                targetContext.drawImage(img, -w / 2, -h / 2, w, h);
              }
              isImageDrawn = true;
            }
          }
          if (!isImageDrawn) {
            if (mode === "stroke")
              targetContext.strokeText(char, -charW / 2, 0);
            else targetContext.fillText(char, -charW / 2, 0);
          }

          targetContext.restore();

          if (!isSpace) altLetterIdx++;

          cx += charW + currentStateRef.letterSpacing;
          charGlobalIdx++;
          charLocalIdx++;
        }
      } else {
        targetContext.textAlign = "left";
        if (currentStateRef.isUnderline) {
          let uThick = BASE_FONT_SIZE * 0.08;
          let uY = y + BASE_FONT_SIZE * 0.35;
          if (mode === "stroke") targetContext.strokeRect(x, uY, fullW, uThick);
          else targetContext.fillRect(x, uY, fullW, uThick);
        }
        if (mode === "stroke") targetContext.strokeText(line, x, y);
        else targetContext.fillText(line, x, y);
      }
    });
    targetContext.restore();
  }

  function render(
    currentState = state,
    exportCtx = null,
    exportTargetW = 0,
    exportTargetH = 0,
    exportScale = "auto",
    t = undefined,
    isGifExport = false,
    fitOptions = null,
  ) {
    const targetCtx = exportCtx || ctx;
    const w = exportCtx ? exportTargetW : targetCtx.canvas.width;
    const h = exportCtx ? exportTargetH : targetCtx.canvas.height;

    let tCtx = targetCtx;
    if (!fitOptions?.measureOnly && !fitOptions?.vector) {
      if (!textCanvas) {
        textCanvas = document.createElement("canvas");
      }
      if (textCanvas.width !== w || textCanvas.height !== h) {
        textCanvas.width = w;
        textCanvas.height = h;
      }
      tCtx = textCanvas.getContext("2d", { willReadFrequently: true });
      tCtx.clearRect(0, 0, w, h);
    }

    tCtx.font = getFontString(currentState);
    tCtx.textBaseline = "middle";
    tCtx.lineJoin = "round";
    tCtx.lineCap = "round";
    tCtx.miterLimit = 2;

    const lines = currentState.text.split("\n");
    const lineHeightPx = BASE_FONT_SIZE * currentState.lineHeight;
    const totalHeight = lines.length * lineHeightPx;
    const startY = -(totalHeight / 2) + lineHeightPx / 2;

    let maxWidth = 0;
    let totalChars = 0;
    const linesCharWidths = [];

    lines.forEach((line, i) => {
      let sumCharW = 0;
      const charW = [];
      for (let char of line) {
        let cw;
        if (isImageTextMode && /^[a-zA-Z0-9]$/.test(char)) {
          const img = getCharImage(char);
          if (img) {
            cw = img.width * (BASE_FONT_SIZE / img.height);
          } else {
            cw = BASE_FONT_SIZE * 0.8;
          }
        } else {
          cw = tCtx.measureText(char).width;
        }
        charW.push(cw);
        sumCharW += cw;
      }
      linesCharWidths.push(charW);
      const lw =
        sumCharW + Math.max(0, line.length - 1) * currentState.letterSpacing;
      if (lw > maxWidth) maxWidth = lw;
      totalChars += line.length;
    });

    let gX = 0,
      gY = 0,
      gRot = 0,
      gScaleX = 1,
      gScaleY = 1,
      hueShift = 0;
    let depthMult = 1,
      angleOffset = 0,
      curveOffset = 0,
      zigzagOffset = 0,
      isStrobing = false;

    if (t !== undefined && currentState.animation.id !== "none") {
      const p2 = Math.PI * 2;
      switch (currentState.animation.id) {
        case "pulse":
          gScaleX = gScaleY = 1 + 0.05 * Math.sin(t * p2);
          break;
        case "breathe":
          gScaleX = gScaleY = 1 + 0.02 * Math.sin(t * p2);
          break;
        case "heartbeat":
          gScaleX = gScaleY =
            1 + 0.15 * Math.exp(-20 * Math.pow((t % 0.5) - 0.1, 2));
          break;
        case "float":
          gY = Math.sin(t * p2) * 20;
          break;
        case "bounce":
          gY = -Math.abs(Math.sin(t * p2)) * 30;
          break;
        case "swing":
          gRot = Math.sin(t * p2) * 0.15;
          break;
        case "shake":
          gX = Math.sin(t * p2 * 15) * 5;
          gY = Math.cos(t * p2 * 13) * 5;
          break;
        case "wobble":
          gRot = Math.sin(t * p2) * 0.1;
          gScaleX = gScaleY = 1 + 0.1 * Math.sin(t * p2 * 2);
          break;
        case "squeeze":
          gScaleX = 1 + 0.15 * Math.sin(t * p2);
          gScaleY = 1 - 0.15 * Math.sin(t * p2);
          break;
        case "spin":
          gRot = t * p2;
          break;
        case "roll":
          gRot = t * p2;
          gScaleX = gScaleY = 0.5 + 0.5 * Math.abs(Math.sin(t * p2));
          break;
        case "orbit":
          gX = Math.cos(t * p2) * 30;
          gY = Math.sin(t * p2) * 30;
          break;
        case "glitch":
          if (Math.random() < 0.1) {
            gX = (Math.random() - 0.5) * 30;
            gScaleY = 1 + Math.random() * 0.2;
          }
          break;
        case "hue_rotate":
          hueShift = t * 360;
          break;
        case "disco":
          hueShift = Math.floor(t * 10) * 36;
          break;
        case "3d_pump":
          depthMult = 0.5 + 0.5 * Math.sin(t * p2);
          break;
        case "3d_spin":
          angleOffset = t * 360;
          break;
        case "3d_swing":
          angleOffset = Math.sin(t * p2) * 45;
          break;
        case "curve_flex":
          curveOffset = Math.sin(t * p2) * 50;
          break;
        case "zigzag_flow":
          zigzagOffset = Math.sin(t * p2) * 30;
          break;
        case "smash":
          gScaleY = 1 - 0.5 * Math.abs(Math.sin(t * p2));
          gY = (Math.abs(Math.sin(t * p2)) * totalHeight) / 4;
          break;
        case "rubber_band":
          gScaleX = 1 + 0.3 * Math.sin(t * p2);
          gScaleY = 1 - 0.2 * Math.sin(t * p2);
          break;
        case "earthquake":
          gX = (Math.random() - 0.5) * 15;
          gY = (Math.random() - 0.5) * 15;
          gRot = (Math.random() - 0.5) * 0.05;
          break;
        case "strobe":
          if (t % 0.2 < 0.1) isStrobing = true;
          break;
        case "flash":
          if (Math.sin(t * p2 * 5) > 0) isStrobing = true;
          break;
        case "zoom_in":
          gScaleX = gScaleY = 0.5 + 0.5 * Math.abs(Math.sin(t * p2));
          break;
        case "pendulum":
          gRot = Math.sin(t * p2) * 0.3;
          gX = Math.sin(t * p2) * 20;
          break;
        case "figure8":
          gX = Math.sin(t * p2) * 40;
          gY = Math.sin(t * p2 * 2) * 20;
          break;
        case "tada":
          gScaleX = gScaleY = 1 + 0.1 * Math.sin(t * p2 * 3);
          gRot = Math.sin(t * p2 * 5) * 0.1;
          break;
        case "jello":
          gScaleX = 1 + 0.15 * Math.sin(t * p2 * 3);
          gScaleY = 1 - 0.15 * Math.sin(t * p2 * 3);
          break;
        case "slide_x":
          gX = Math.sin(t * p2) * 60;
          break;
        case "slide_y":
          gY = Math.sin(t * p2) * 60;
          break;
        case "orbit_3d":
          gScaleX = Math.cos(t * p2);
          gX = Math.sin(t * p2) * 50;
          depthMult = 0.5 + 0.5 * Math.sin(t * p2);
          break;
        case "hurricane":
          gRot = t * p2 * 2;
          gScaleX = gScaleY = 1 + 0.3 * Math.sin(t * p2);
          break;
        case "tornado":
          gRot = t * p2 * 2;
          zigzagOffset = Math.sin(t * p2) * 20;
          curveOffset = Math.cos(t * p2) * 30;
          break;
        case "jellyfish":
          gScaleY = 1 + 0.15 * Math.sin(t * p2 * 2);
          gY = Math.sin(t * p2) * 30;
          break;
        case "color_glitch":
          hueShift = Math.random() > 0.8 ? Math.random() * 360 : 0;
          gX = Math.random() > 0.9 ? (Math.random() - 0.5) * 20 : 0;
          break;
        case "depth_throb":
          depthMult = 1 + 2 * Math.abs(Math.sin(t * p2));
          break;
        case "curve_dance":
          curveOffset = Math.sin(t * p2) * 150;
          break;
        case "zigzag_crazy":
          zigzagOffset = Math.sin(t * p2) * 80;
          break;
        case "helicopter":
          gRot = t * p2 * 10;
          gScaleY = 0.5 + 0.5 * Math.sin(t * p2);
          break;
      }
    }

    let maxStrokeW = 0;
    let currentOffsetX = 0,
      currentOffsetY = 0;
    let maxShadowEx = 0;
    let sumWrapW = 0;
    let innerShadowCalls = [];

    currentState.layers.forEach((layer) => {
      if (!layer.enabled) return;
      if (layer.layerType === "stroke")
        maxStrokeW = Math.max(maxStrokeW, layer.width || 0);
      else if (layer.layerType === "3d") {
        maxStrokeW = Math.max(maxStrokeW, layer.width || 0);
        currentOffsetX +=
          layer.size *
          depthMult *
          Math.cos(((layer.angle + angleOffset) * Math.PI) / 180);
        currentOffsetY +=
          layer.size *
          depthMult *
          Math.sin(((layer.angle + angleOffset) * Math.PI) / 180);
      } else if (layer.layerType === "shadow")
        maxShadowEx = Math.max(
          maxShadowEx,
          layer.blur +
            Math.abs(layer.offsetX) +
            Math.abs(layer.offsetY) +
            (layer.size || 0),
        );
      else if (layer.layerType === "outer_wrap") sumWrapW += layer.width || 0;
    });

    const activeCurve = (currentState.curve || 0) + curveOffset;
    const activeZigzag = (currentState.zigzag || 0) + zigzagOffset;
    const activeWave = currentState.wave || 0;
    let extraPad =
      20 +
      maxStrokeW +
      Math.abs(currentOffsetX) +
      Math.abs(currentOffsetY) +
      maxShadowEx +
      sumWrapW;
    extraPad +=
      Math.abs(activeCurve) + Math.abs(activeZigzag) + Math.abs(activeWave);

    const contentW = maxWidth + extraPad * 2;
    const contentH = totalHeight + extraPad * 2;

    if (fitOptions?.measureOnly) {
      // Use actual font ink, including overhangs and accents, not just advances/line height.
      const animation = t === undefined ? "none" : currentState.animation.id;
      const characterAnimations = [
        "jump",
        "wave",
        "ripple",
        "flip_x",
        "flip_y",
        "letter_spin",
        "letter_swing",
        "letter_bounce",
        "letter_scale",
        "letter_shake",
        "letter_orbit",
        "letter_flip_both",
      ];
      const characterPaint = [
        currentState.fill,
        ...currentState.layers.filter((layer) => layer.enabled),
      ].some(
        (paint) =>
          paint.type === "alternating" ||
          ["letter", "word"].includes(paint.scope),
      );
      const perCharacter =
        currentState.letterSpacing !== 0 ||
        activeCurve !== 0 ||
        activeZigzag !== 0 ||
        activeWave !== 0 ||
        characterAnimations.includes(animation) ||
        currentState.isUnderline ||
        isImageTextMode ||
        characterPaint;
      const characterScale =
        animation === "letter_scale" ? 1.5 : animation === "ripple" ? 1.3 : 1;
      const motionX =
        animation === "letter_orbit"
          ? 20
          : animation === "letter_shake"
            ? 5
            : 0;
      const motionY =
        {
          jump: 40,
          wave: 20,
          letter_bounce: 50,
          letter_shake: 5,
          letter_orbit: 20,
        }[animation] || 0;
      let extentX = 1,
        extentY = 1,
        characterIndex = 0;
      tCtx.textAlign = "left";
      lines.forEach((line, lineIndex) => {
        const widths = linesCharWidths[lineIndex];
        const lineWidth =
          widths.reduce((sum, value) => sum + value, 0) +
          Math.max(0, line.length - 1) * currentState.letterSpacing;
        const origin =
          currentState.align === "left"
            ? -maxWidth / 2
            : currentState.align === "right"
              ? maxWidth / 2 - lineWidth
              : -lineWidth / 2;
        const y = startY + lineIndex * lineHeightPx;
        if (!perCharacter) {
          const ink = tCtx.measureText(line);
          extentX = Math.max(
            extentX,
            Math.abs(origin - ink.actualBoundingBoxLeft),
            Math.abs(origin + ink.actualBoundingBoxRight),
          );
          extentY = Math.max(
            extentY,
            Math.abs(y - ink.actualBoundingBoxAscent),
            Math.abs(y + ink.actualBoundingBoxDescent),
          );
          return;
        }
        let cursor = origin,
          index = 0;
        for (const char of line) {
          const width = widths[index++];
          const x = cursor + width / 2;
          const norm =
            lineWidth > 0 ? (x - origin - lineWidth / 2) / (lineWidth / 2) : 0;
          const charY =
            y +
            activeCurve * norm * norm +
            (characterIndex % 2 === 0 ? -activeZigzag : activeZigzag) +
            Math.sin(characterIndex * 0.5) * activeWave;
          const ink = tCtx.measureText(char);
          let radiusX = Math.max(
            Math.abs(-ink.actualBoundingBoxLeft - width / 2),
            Math.abs(ink.actualBoundingBoxRight - width / 2),
          );
          let radiusY = Math.max(
            Math.abs(ink.actualBoundingBoxAscent),
            Math.abs(ink.actualBoundingBoxDescent),
          );
          if (isImageTextMode) {
            radiusX = Math.max(radiusX, width / 2);
            radiusY = Math.max(radiusY, BASE_FONT_SIZE / 2);
          }
          if (currentState.isUnderline) {
            radiusX = Math.max(
              radiusX,
              Math.abs(width / 2 + currentState.letterSpacing),
            );
            radiusY = Math.max(radiusY, BASE_FONT_SIZE * 0.43);
          }
          radiusX *= characterScale;
          radiusY *= characterScale;
          if (
            activeCurve ||
            animation === "letter_spin" ||
            animation === "letter_swing"
          )
            radiusX = radiusY = Math.hypot(radiusX, radiusY);
          extentX = Math.max(extentX, Math.abs(x) + radiusX + motionX);
          extentY = Math.max(extentY, Math.abs(charY) + radiusY + motionY);
          cursor += width + currentState.letterSpacing;
          characterIndex++;
        }
      });
      let depth = 0,
        stroke = 0,
        wrap = 0,
        shadow = 0,
        blur = 0;
      for (const layer of currentState.layers) {
        if (!layer.enabled) continue;
        if (layer.layerType === "3d") depth += Math.abs(layer.size * depthMult);
        if (layer.layerType === "3d" || layer.layerType === "stroke")
          stroke = Math.max(stroke, (layer.width || 0) / 2);
        if (layer.layerType === "outer_wrap")
          wrap += Math.abs(layer.width || 0);
        if (layer.layerType === "shadow") {
          shadow = Math.max(
            shadow,
            Math.abs(layer.offsetX || 0) +
              Math.abs(layer.offsetY || 0) +
              Math.abs(layer.size || 0),
          );
          blur = Math.max(
            blur,
            4 * layer.blur * (animation === "neon_flicker" ? 1.5 : 1),
          );
        }
      }
      const effect = depth + (stroke + wrap + shadow) * characterScale;
      const x = (extentX + effect) * Math.abs(gScaleX),
        y =
          (extentY + effect) *
          Math.max(Math.abs(gScaleY), animation === "glitch" ? 1.2 : 0);
      const angle = ((currentState.rotation || 0) * Math.PI) / 180 + gRot;
      const c = Math.abs(Math.cos(angle)),
        s = Math.abs(Math.sin(angle));
      const jitter = animation === "earthquake" ? Math.hypot(x, y) * 0.05 : 0;
      const dx = Math.max(
        Math.abs(gX),
        animation === "glitch"
          ? 15
          : animation === "earthquake"
            ? 7.5
            : animation === "color_glitch"
              ? 10
              : 0,
      );
      const dy = Math.max(Math.abs(gY), animation === "earthquake" ? 7.5 : 0);
      const safety = Math.max(4, Math.min(w, h) * 0.02);
      const safeScale = Math.min(
        (w / 2 - safety) / Math.max(1, c * x + s * y + dx + jitter + blur),
        (h / 2 - safety) / Math.max(1, s * x + c * y + dy + jitter + blur),
      );
      const legacyScale = Math.min(
        (w * 0.98) / (c * contentW + s * contentH),
        (h * 0.98) / (s * contentW + c * contentH),
      );
      return Math.max(0.000001, Math.min(safeScale, legacyScale));
    }

    let fitScale = exportScale;
    if (exportScale === "auto") {
      const safeW = w * 0.98;
      const safeH = h * 0.98;
      const angle = ((currentState.rotation || 0) * Math.PI) / 180 + gRot;
      const fitW =
        Math.abs(Math.cos(angle)) * contentW +
        Math.abs(Math.sin(angle)) * contentH;
      const fitH =
        Math.abs(Math.sin(angle)) * contentW +
        Math.abs(Math.cos(angle)) * contentH;
      const scaleX = safeW / fitW;
      const scaleY = safeH / fitH;
      fitScale = Math.min(scaleX, scaleY);
    }

    tCtx.save();
    tCtx.translate(w / 2, h / 2);
    tCtx.scale(fitScale, fitScale);
    tCtx.translate(gX, gY);
    if (currentState.rotation || gRot)
      tCtx.rotate((currentState.rotation * Math.PI) / 180 + gRot);
    if (gScaleX !== 1 || gScaleY !== 1) tCtx.scale(gScaleX, gScaleY);

    const isAnimOnCharsGlobal =
      t !== undefined &&
      [
        "jump",
        "wave",
        "ripple",
        "flip_x",
        "flip_y",
        "letter_spin",
        "letter_swing",
        "letter_bounce",
        "letter_scale",
        "letter_shake",
        "letter_orbit",
        "letter_flip_both",
      ].includes(currentState.animation.id);
    let globalNeedsCharRender =
      currentState.letterSpacing !== 0 ||
      activeCurve !== 0 ||
      activeZigzag !== 0 ||
      activeWave !== 0 ||
      isAnimOnCharsGlobal ||
      currentState.isUnderline ||
      isImageTextMode;
    if (
      currentState.fill &&
      (currentState.fill.type === "alternating" ||
        ["letter", "word"].includes(currentState.fill.scope))
    ) {
      globalNeedsCharRender = true;
    }
    if (currentState.layers) {
      currentState.layers.forEach((l) => {
        if (
          l.enabled &&
          (l.type === "alternating" || ["letter", "word"].includes(l.scope))
        ) {
          globalNeedsCharRender = true;
        }
      });
    }

    // Centralized data to avoid repetitive computations
    const fullLinesData = {
      lines,
      lineHeightPx,
      totalHeight,
      startY,
      linesCharWidths,
      maxWidth,
      totalChars,
      activeCurve,
      activeZigzag,
      activeWave,
      isAnimOnCharsGlobal,
      t,
      needsCharRender: globalNeedsCharRender,
    };

    const drawCalls = [];
    let pass1OffsetX = 0;
    let pass1OffsetY = 0;
    const collectedShapes = [];

    collectedShapes.push({
      type: "fill",
      x: 0,
      y: 0,
      baseW: 0,
      intrinsicW: 0,
      style: currentState.fill,
    });

    let accumulatedWrapWidth = 0;
    let currentThickness = 0;

    currentState.layers.forEach((layer) => {
      if (!layer.enabled) return;

      if (layer.layerType === "stroke") {
        currentThickness = Math.max(currentThickness, layer.width || 0);
        const op = {
          type: "stroke",
          x: pass1OffsetX,
          y: pass1OffsetY,
          w: layer.width || 0,
          baseW: layer.width || 0,
          intrinsicW: layer.width || 0,
          style: layer,
        };
        collectedShapes.push(op);
        drawCalls.push(op);
      } else if (layer.layerType === "3d") {
        currentThickness = Math.max(currentThickness, layer.width || 0);
        const activeAngle = layer.angle + angleOffset;
        const activeSize = layer.size * depthMult;
        const r = (activeAngle * Math.PI) / 180;
        const dx = Math.cos(r);
        const dy = Math.sin(r);
        const scaledActiveSize = Math.max(1, Math.round(activeSize * fitScale));

        for (let i = 1; i <= scaledActiveSize; i++) {
          const op = {
            type: "3d_step",
            x: pass1OffsetX + i * (dx / fitScale),
            y: pass1OffsetY + i * (dy / fitScale),
            baseW: (layer.width || 0) + accumulatedWrapWidth * 2,
            intrinsicW: layer.width || 0,
            style: layer,
            stepIndex: i,
            totalSteps: scaledActiveSize,
          };
          collectedShapes.push(op);
          drawCalls.push(op);
        }
        pass1OffsetX += activeSize * dx;
        pass1OffsetY += activeSize * dy;
      } else if (layer.layerType === "outer_wrap") {
        accumulatedWrapWidth += layer.width || 0;
        const currentWrapW = accumulatedWrapWidth * 2;

        collectedShapes.forEach((shape) => {
          drawCalls.push({
            type: "stroke",
            x: shape.x,
            y: shape.y,
            w: shape.intrinsicW + currentWrapW,
            style: layer,
            isWrap: true,
            stepIndex: shape.stepIndex,
            totalSteps: shape.totalSteps,
          });
        });
      } else if (layer.layerType === "shadow") {
        drawCalls.push({
          type: "shadow",
          x: pass1OffsetX,
          y: pass1OffsetY,
          style: layer,
          thickness: currentThickness + accumulatedWrapWidth * 2,
        });
      } else if (layer.layerType === "inner_shadow") {
        innerShadowCalls.push({
          type: "inner_shadow",
          x: pass1OffsetX,
          y: pass1OffsetY,
          style: layer,
        });
      }
    });

    drawCalls.unshift({ type: "fill", x: 0, y: 0, style: currentState.fill });

    for (let i = innerShadowCalls.length - 1; i >= 0; i--) {
      drawCalls.unshift(innerShadowCalls[i]);
    }

    for (let i = drawCalls.length - 1; i >= 0; i--) {
      const op = drawCalls[i];
      if (fitOptions?.svgLayer) {
        const ops = [op];
        if (op.type === "3d_step") {
          while (
            i > 0 &&
            drawCalls[i - 1].type === "3d_step" &&
            drawCalls[i - 1].style.id === op.style.id
          )
            ops.push(drawCalls[--i]);
        }
        fitOptions.svgLayer(
          ops,
          {
            transform: tCtx.getTransform(),
            font: getFontString(currentState),
            scale: fitScale,
          },
          (
            target,
            item,
            mode,
            props = {},
            paint = item.style,
            x = item.x,
            y = item.y,
          ) =>
            drawTextLayer(
              x,
              y,
              mode,
              paint,
              props,
              target,
              fullLinesData,
              currentState,
            ),
        );
        continue;
      }
      if (op.type === "3d_step") {
        let j = i;
        let tempCanvas = document.createElement("canvas");
        tempCanvas.width = w;
        tempCanvas.height = h;
        let tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

        tempCtx.font = getFontString(currentState);
        tempCtx.textBaseline = "middle";
        tempCtx.lineJoin = "round";
        tempCtx.lineCap = "round";
        tempCtx.miterLimit = 2;

        tempCtx.translate(w / 2, h / 2);
        tempCtx.scale(fitScale, fitScale);
        tempCtx.translate(gX, gY);
        if (currentState.rotation || gRot)
          tempCtx.rotate((currentState.rotation * Math.PI) / 180 + gRot);
        if (gScaleX !== 1 || gScaleY !== 1) tempCtx.scale(gScaleX, gScaleY);

        const currentLayerId = op.style.id;
        const layerOpacity =
          op.style.opacity !== undefined ? op.style.opacity : 1;

        while (
          j >= 0 &&
          drawCalls[j].type === "3d_step" &&
          drawCalls[j].style.id === currentLayerId
        ) {
          const subOp = drawCalls[j];
          if (subOp.baseW > 0)
            drawTextLayer(
              subOp.x,
              subOp.y,
              "stroke",
              subOp.style,
              {
                width: Math.max(2, subOp.baseW),
                stepIndex: subOp.stepIndex,
                totalSteps: subOp.totalSteps,
                opacity: 1,
              },
              tempCtx,
              fullLinesData,
              currentState,
            );
          else
            drawTextLayer(
              subOp.x,
              subOp.y,
              "stroke",
              subOp.style,
              {
                width: 2,
                stepIndex: subOp.stepIndex,
                totalSteps: subOp.totalSteps,
                opacity: 1,
              },
              tempCtx,
              fullLinesData,
              currentState,
            );
          drawTextLayer(
            subOp.x,
            subOp.y,
            "fill",
            subOp.style,
            {
              stepIndex: subOp.stepIndex,
              totalSteps: subOp.totalSteps,
              opacity: 1,
            },
            tempCtx,
            fullLinesData,
            currentState,
          );
          j--;
        }
        i = j + 1;

        tCtx.save();
        tCtx.setTransform(1, 0, 0, 1, 0, 0);
        tCtx.globalAlpha = layerOpacity;
        tCtx.drawImage(tempCanvas, 0, 0);
        tCtx.restore();
      } else if (op.type === "stroke" || op.isWrap) {
        if (op.w > 0)
          drawTextLayer(
            op.x,
            op.y,
            "stroke",
            op.style,
            { width: op.w, stepIndex: op.stepIndex, totalSteps: op.totalSteps },
            tCtx,
            fullLinesData,
            currentState,
          );
      } else if (op.type === "fill") {
        drawTextLayer(
          op.x,
          op.y,
          "fill",
          op.style,
          {},
          tCtx,
          fullLinesData,
          currentState,
        );
      } else if (op.type === "inner_shadow") {
        let maskCanvas = document.createElement("canvas");
        maskCanvas.width = w;
        maskCanvas.height = h;
        let maskCtx = maskCanvas.getContext("2d");
        maskCtx.font = getFontString(currentState);
        maskCtx.textBaseline = "middle";
        maskCtx.lineJoin = "round";
        maskCtx.lineCap = "round";
        maskCtx.miterLimit = 2;
        maskCtx.translate(w / 2, h / 2);
        maskCtx.scale(fitScale, fitScale);
        maskCtx.translate(gX, gY);
        if (currentState.rotation || gRot)
          maskCtx.rotate((currentState.rotation * Math.PI) / 180 + gRot);
        if (gScaleX !== 1 || gScaleY !== 1) maskCtx.scale(gScaleX, gScaleY);
        drawTextLayer(
          op.x,
          op.y,
          "fill",
          { type: "solid", color: "#000000", opacity: 1 },
          { opacity: 1 },
          maskCtx,
          fullLinesData,
          currentState,
        );

        let holeCanvas = document.createElement("canvas");
        holeCanvas.width = w;
        holeCanvas.height = h;
        let holeCtx = holeCanvas.getContext("2d");
        holeCtx.fillStyle = "#000000";
        holeCtx.fillRect(0, 0, w, h);
        holeCtx.globalCompositeOperation = "destination-out";
        holeCtx.drawImage(maskCanvas, 0, 0);

        // Allow Inner Shadow Spread/Size
        let holeCanvasSpread = holeCanvas;
        if (op.style.size && op.style.size > 0) {
          holeCanvasSpread = document.createElement("canvas");
          holeCanvasSpread.width = w;
          holeCanvasSpread.height = h;
          let spreadCtx = holeCanvasSpread.getContext("2d");
          spreadCtx.drawImage(holeCanvas, 0, 0);
          spreadCtx.globalCompositeOperation = "source-over";
          spreadCtx.font = getFontString(currentState);
          spreadCtx.textBaseline = "middle";
          spreadCtx.lineJoin = "round";
          spreadCtx.lineCap = "round";
          spreadCtx.miterLimit = 2;
          spreadCtx.translate(w / 2, h / 2);
          spreadCtx.scale(fitScale, fitScale);
          spreadCtx.translate(gX, gY);
          if (currentState.rotation || gRot)
            spreadCtx.rotate((currentState.rotation * Math.PI) / 180 + gRot);
          if (gScaleX !== 1 || gScaleY !== 1) spreadCtx.scale(gScaleX, gScaleY);

          drawTextLayer(
            op.x,
            op.y,
            "stroke",
            { type: "solid", color: "#000000", opacity: 1 },
            { width: op.style.size * 2, opacity: 1 },
            spreadCtx,
            fullLinesData,
            currentState,
          );
        }

        let tempCanvas = document.createElement("canvas");
        tempCanvas.width = w;
        tempCanvas.height = h;
        let tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
        tempCtx.shadowColor = "#000000";
        tempCtx.shadowBlur = op.style.blur * fitScale;
        tempCtx.shadowOffsetX = op.style.offsetX * fitScale;
        tempCtx.shadowOffsetY = op.style.offsetY * fitScale;
        tempCtx.drawImage(holeCanvasSpread, 0, 0);

        tempCtx.globalCompositeOperation = "destination-out";
        tempCtx.drawImage(holeCanvas, 0, 0); // Erase from exact original border
        tempCtx.globalCompositeOperation = "destination-in";
        tempCtx.drawImage(maskCanvas, 0, 0); // Intersect with base bounds

        let colorCanvas = document.createElement("canvas");
        colorCanvas.width = w;
        colorCanvas.height = h;
        let colorCtx = colorCanvas.getContext("2d");
        colorCtx.font = getFontString(currentState);
        colorCtx.textBaseline = "middle";
        colorCtx.lineJoin = "round";
        colorCtx.lineCap = "round";
        colorCtx.miterLimit = 2;
        colorCtx.translate(w / 2, h / 2);
        colorCtx.scale(fitScale, fitScale);
        colorCtx.translate(gX, gY);
        if (currentState.rotation || gRot)
          colorCtx.rotate((currentState.rotation * Math.PI) / 180 + gRot);
        if (gScaleX !== 1 || gScaleY !== 1) colorCtx.scale(gScaleX, gScaleY);
        drawTextLayer(
          op.x,
          op.y,
          "fill",
          op.style,
          { opacity: 1 },
          colorCtx,
          fullLinesData,
          currentState,
        );

        colorCtx.setTransform(1, 0, 0, 1, 0, 0);
        colorCtx.globalCompositeOperation = "destination-in";
        colorCtx.drawImage(tempCanvas, 0, 0);

        tCtx.save();
        tCtx.setTransform(1, 0, 0, 1, 0, 0);
        tCtx.globalAlpha =
          op.style.opacity !== undefined ? op.style.opacity : 1;
        tCtx.drawImage(colorCanvas, 0, 0);
        tCtx.restore();
      } else if (op.type === "shadow") {
        let sBlur = op.style.blur;
        if (currentState.animation.id === "neon_flicker")
          sBlur *= 0.5 + Math.random();

        let tempCanvas = document.createElement("canvas");
        tempCanvas.width = w;
        tempCanvas.height = h;
        let tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

        tempCtx.font = getFontString(currentState);
        tempCtx.textBaseline = "middle";
        tempCtx.lineJoin = "round";
        tempCtx.lineCap = "round";
        tempCtx.miterLimit = 2;

        tempCtx.translate(w / 2, h / 2);
        tempCtx.scale(fitScale, fitScale);
        tempCtx.translate(gX, gY);
        if (currentState.rotation || gRot)
          tempCtx.rotate((currentState.rotation * Math.PI) / 180 + gRot);
        if (gScaleX !== 1 || gScaleY !== 1) tempCtx.scale(gScaleX, gScaleY);

        const sx = op.x + op.style.offsetX;
        const sy = op.y + op.style.offsetY;

        if (op.thickness > 0 || (op.style.size && op.style.size > 0)) {
          drawTextLayer(
            sx,
            sy,
            "stroke",
            op.style,
            { width: op.thickness + (op.style.size || 0) * 2, opacity: 1 },
            tempCtx,
            fullLinesData,
            currentState,
          );
        }
        drawTextLayer(
          sx,
          sy,
          "fill",
          op.style,
          { opacity: 1 },
          tempCtx,
          fullLinesData,
          currentState,
        );

        tCtx.save();
        tCtx.setTransform(1, 0, 0, 1, 0, 0);
        tCtx.filter = `blur(${sBlur * fitScale}px)`;
        tCtx.globalAlpha =
          op.style.opacity !== undefined ? op.style.opacity : 0.5;
        tCtx.drawImage(tempCanvas, 0, 0);
        tCtx.restore();
      }
    }
    tCtx.restore();

    if (fitOptions?.vector) return { hueShift, isStrobing };

    targetCtx.clearRect(0, 0, w, h);

    if (!exportCtx || currentState.bg.type !== "transparent") {
      targetCtx.save();
      targetCtx.globalAlpha =
        currentState.bg.opacity !== undefined ? currentState.bg.opacity : 1;
      if (
        ["solid", "gradient", "radial", "pattern"].includes(
          currentState.bg.type,
        )
      ) {
        if (
          currentState.bg.type === "pattern" &&
          currentState.bg.patternBgType &&
          currentState.bg.patternBgType !== "none"
        ) {
          const bgBgStyle = {
            type: currentState.bg.patternBgType,
            color: currentState.bg.patternBgColor,
            angleGrad: currentState.bg.patternBgAngle,
            stops: currentState.bg.patternBgStops,
          };
          targetCtx.fillStyle = getPaintStyle(
            targetCtx,
            bgBgStyle,
            w,
            h,
            w / 2,
            h / 2,
          );
          targetCtx.fillRect(0, 0, w, h);
        }
        targetCtx.fillStyle = getPaintStyle(
          targetCtx,
          currentState.bg,
          w,
          h,
          w / 2,
          h / 2,
        );
        targetCtx.fillRect(0, 0, w, h);
      } else if (currentState.bg.type === "image" && currentState.bg.image) {
        const img = currentState.bg.image;
        const mode = currentState.bg.imageMode || "stretch";
        if (mode === "original") {
          targetCtx.drawImage(img, (w - img.width) / 2, (h - img.height) / 2);
        } else if (mode === "cover" || mode === "contain") {
          const scale =
            mode === "cover"
              ? Math.max(w / img.width, h / img.height)
              : Math.min(w / img.width, h / img.height);
          const sw = img.width * scale;
          const sh = img.height * scale;
          targetCtx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
        } else {
          targetCtx.drawImage(img, 0, 0, w, h);
        }
      }
      targetCtx.restore();
    } else if (
      exportCtx &&
      currentState.bg.type === "transparent" &&
      isGifExport
    ) {
      // Background relies on canvas clear (0,0,0,0). Will be mapped via threshold in exportGIF loop to avoid edge artifacts.
    }

    if (isStrobing || fitOptions?.backgroundOnly) return;

    targetCtx.save();
    if (hueShift !== 0) targetCtx.filter = `hue-rotate(${hueShift}deg)`;
    targetCtx.drawImage(textCanvas, 0, 0);
    targetCtx.restore();
  }

  return (value, t, fitOptions = null) => {
    state = value;
    return render(
      value,
      ctx,
      canvas.width,
      canvas.height,
      fitOptions?.scale ?? "auto",
      t,
      false,
      fitOptions,
    );
  };
}
export const animations = [
  { id: "none", n: "None", i: "fa-ban" },
  { id: "pulse", n: "Pulse", i: "fa-heart-pulse" },
  { id: "breathe", n: "Breathe", i: "fa-wind" },
  { id: "heartbeat", n: "Heartbeat", i: "fa-heartbeat" },
  { id: "float", n: "Float", i: "fa-up-down" },
  { id: "bounce", n: "Bounce", i: "fa-basketball" },
  { id: "swing", n: "Swing", i: "fa-clock" },
  { id: "shake", n: "Shake", i: "fa-bolt" },
  { id: "wobble", n: "Wobble", i: "fa-arrows-spin" },
  { id: "jump", n: "Jump", i: "fa-person-arrow-up-from-line" },
  { id: "wave", n: "Wave", i: "fa-water" },
  { id: "ripple", n: "Ripple", i: "fa-wifi" },
  { id: "flip_x", n: "Flip X", i: "fa-money-bill-transfer" },
  { id: "flip_y", n: "Flip Y", i: "fa-retweet" },
  { id: "squeeze", n: "Squeeze", i: "fa-compress" },
  { id: "spin", n: "Spin", i: "fa-compact-disc" },
  { id: "roll", n: "Roll", i: "fa-dharmachakra" },
  { id: "orbit", n: "Orbit", i: "fa-satellite" },
  { id: "glitch", n: "Glitch", i: "fa-microchip" },
  { id: "hue_rotate", n: "Hue Rotate", i: "fa-palette" },
  { id: "disco", n: "Disco", i: "fa-music" },
  { id: "neon_flicker", n: "Neon Flicker", i: "fa-lightbulb" },
  { id: "3d_pump", n: "3D Pump", i: "fa-cubes" },
  { id: "3d_spin", n: "3D Spin", i: "fa-cube" },
  { id: "3d_swing", n: "3D Swing", i: "fa-dice-d6" },
  { id: "curve_flex", n: "Curve Flex", i: "fa-bezier-curve" },
  { id: "zigzag_flow", n: "Zigzag Flow", i: "fa-wave-square" },
  { id: "letter_spin", n: "Letter Spin", i: "fa-font" },
  { id: "letter_swing", n: "Letter Swing", i: "fa-italic" },
  { id: "smash", n: "Smash", i: "fa-gavel" },
  { id: "rubber_band", n: "Rubber Band", i: "fa-bacon" },
  { id: "earthquake", n: "Earthquake", i: "fa-house-crack" },
  { id: "flash", n: "Flash", i: "fa-bolt-lightning" },
  { id: "zoom_in", n: "Zoom In", i: "fa-magnifying-glass-plus" },

  // --- 20 NEW ANIMATIONS ---
  { id: "pendulum", n: "Pendulum", i: "fa-ruler" },
  { id: "figure8", n: "Figure 8", i: "fa-infinity" },
  { id: "tada", n: "Tada", i: "fa-wand-magic-sparkles" },
  { id: "jello", n: "Jello", i: "fa-plate-wheat" },
  { id: "slide_x", n: "Slide X", i: "fa-arrows-left-right" },
  { id: "slide_y", n: "Slide Y", i: "fa-arrows-up-down" },
  { id: "orbit_3d", n: "3D Orbit", i: "fa-globe" },
  { id: "hurricane", n: "Hurricane", i: "fa-hurricane" },
  { id: "tornado", n: "Tornado", i: "fa-tornado" },
  { id: "jellyfish", n: "Jellyfish", i: "fa-water" },
  { id: "color_glitch", n: "Color Glitch", i: "fa-brush" },
  { id: "depth_throb", n: "Depth Throb", i: "fa-layer-group" },
  { id: "curve_dance", n: "Curve Dance", i: "fa-bezier-curve" },
  { id: "zigzag_crazy", n: "Crazy Zigzag", i: "fa-wave-square" },
  { id: "helicopter", n: "Helicopter", i: "fa-helicopter" },
  { id: "letter_bounce", n: "Letter Bounce", i: "fa-text-height" },
  { id: "letter_scale", n: "Letter Scale", i: "fa-text-width" },
  { id: "letter_shake", n: "Letter Shake", i: "fa-text-slash" },
  { id: "letter_orbit", n: "Letter Orbit", i: "fa-satellite" },
  { id: "letter_flip_both", n: "Letter Flip", i: "fa-arrows-spin" },
];
