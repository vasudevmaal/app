"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { buttonFrame, buttonLayout } from "@/lib/button-renderer.mjs";
import type { ButtonState } from "@/lib/button";

export function ButtonPreview({
  state,
  playing,
  fontRevision = 0,
}: {
  state: ButtonState;
  playing: boolean;
  fontRevision?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const current = useRef({ state, playing, fontRevision });
  const refresh = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    current.current = { state, playing, fontRevision };
    refresh.current?.();
  }, [state, playing, fontRevision]);

  // Keep the canvas, observer and animation clock alive across edits.
  useLayoutEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;
    let previous = performance.now();
    let phase = 0;
    let animation = current.current.state.animation;
    let layoutState = current.current.state;
    let layoutRevision = current.current.fontRevision;
    let layout = buttonLayout(ctx, layoutState);
    const draw = () => {
      const value = current.current;
      if (
        layoutState !== value.state ||
        layoutRevision !== value.fontRevision
      ) {
        layoutState = value.state;
        layoutRevision = value.fontRevision;
        layout = buttonLayout(ctx, layoutState);
      }
      if (animation !== value.state.animation) {
        animation = value.state.animation;
        phase = 0;
      }
      buttonFrame(ctx, value.state, layout, canvas.width, canvas.height, phase);
    };
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      const width = Math.max(
        1,
        Math.round(box.width * Math.min(devicePixelRatio, 2)),
      );
      const height = Math.max(
        1,
        Math.round(box.height * Math.min(devicePixelRatio, 2)),
      );
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      // Changing the backing dimensions clears pixels; redraw before paint.
      draw();
    };
    const tick = (now: number) => {
      const value = current.current;
      const wholeAnimation =
        value.state.wholeAnimation ?? value.state.animation;
      const textAnimation = value.state.textAnimation ?? "none";
      if (
        value.playing &&
        (wholeAnimation !== "none" || textAnimation !== "none")
      ) {
        const duration = wholeAnimation === "pulse" ? 2400 : 2200;
        phase =
          (phase +
            (Math.min(now - previous, 100) * value.state.animationSpeed) /
              duration) %
          1;
      }
      previous = now;
      draw();
      frame = requestAnimationFrame(tick);
    };
    refresh.current = () => {
      layoutRevision = -1;
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    frame = requestAnimationFrame(tick);
    return () => {
      refresh.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void document.fonts
      .load(
        `${state.isItalic ? "italic " : ""}${state.fontWeight} ${state.fontSize}px "${state.fontFamily}"`,
      )
      .then(() => {
        if (active) refresh.current?.();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [
    state.fontFamily,
    state.fontWeight,
    state.fontSize,
    state.isItalic,
    fontRevision,
  ]);

  useEffect(() => {
    if (!state.iconDataUrl) return;
    const image = new Image();
    image.onload = () => refresh.current?.();
    image.src = state.iconDataUrl;
  }, [state.iconDataUrl]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`${state.text || "Empty"} button preview`}
    />
  );
}
