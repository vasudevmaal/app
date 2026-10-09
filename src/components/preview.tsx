'use client';
import { useEffect, useRef, useState } from 'react';
import type { EditorState } from '@/lib/types';
import { createRenderer } from '@/lib/original-renderer';
import { drawLetters } from '@/lib/letter-renderer.mjs';

const cache = new Map<string, Promise<HTMLImageElement | null>>();
function image(src: string) {
  if (!cache.has(src)) {
    if (cache.size >= 160) cache.delete(cache.keys().next().value!);
    cache.set(src, new Promise(resolve => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src; }));
  }
  return cache.get(src)!;
}
export async function hydrate(state: EditorState) {
  const copy = structuredClone(state) as any;
  await Promise.all([copy.fill, copy.bg, ...copy.layers].map(async obj => {
    if (obj.patternBase64) obj.patternImage = await image(obj.patternBase64);
    if (obj.base64) obj.image = await image(obj.base64);
    if (obj.altImages) await Promise.all(obj.altImages.map(async (a: any) => { if(a.base64) a.image = await image(a.base64); }));
  }));
  return copy;
}
export function Preview({ state, animated = false, className = '', glyphs }: { state: EditorState; animated?: boolean; className?: string; glyphs?: Record<string, string> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [missing, setMissing] = useState('');
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '100px' });
    if(ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !visible) return;
    let dead = false, frame = 0, last = -Infinity;
    let ready: any;
    let images: Record<string, HTMLImageElement> = {};
    const moving = animated && state.animation.id !== 'none' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = glyphs ? undefined : createRenderer(canvas, schedule);
    function schedule() { if (!dead && !frame && !document.hidden) frame = requestAnimationFrame(paint); }
    function paint(now: number) {
      frame = 0;
      if (dead || !ready || !canvas || document.hidden) return;
      if (moving && now - last < 1000 / 24) { schedule(); return; }
      last = now;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, animated ? 1.25 : 1.5, 1000 / Math.max(rect.width, rect.height, 1));
      const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
      if(canvas.width !== width) canvas.width = width;
      if(canvas.height !== height) canvas.height = height;
      if(glyphs) drawLetters(canvas, ready, images, '', moving ? (now % (2000 / state.animation.speed)) / (2000 / state.animation.speed) : undefined);
      else draw!(ready, moving ? (now % (2000 / state.animation.speed)) / (2000 / state.animation.speed) : undefined);
      if(moving) schedule();
    }
    const observer = new ResizeObserver(schedule); observer.observe(canvas);
    document.addEventListener('visibilitychange', schedule);
    const timer = setTimeout(async () => {
      try {
        if (glyphs) {
          const chars = [...new Set(state.text.toUpperCase().replace(/\s/g, ''))];
          const loaded = await Promise.all(chars.map(async c => [c, glyphs[c] ? await image(glyphs[c]) : null] as const));
          images = Object.fromEntries(loaded.filter((entry): entry is readonly [string, HTMLImageElement] => !!entry[1]));
          if(!dead) setMissing(loaded.filter(([, im]) => !im).map(([c]) => c).join(', '));
          ready = await hydrate(state);
        } else {
          [ready] = await Promise.all([hydrate(state), document.fonts.load(`${state.isBold ? 800 : 400} 48px "${state.fontFamily}"`)]);
        }
        schedule();
      } catch { if(!dead) setMissing('Preview could not be loaded.'); }
    }, 65);
    return () => { dead = true; clearTimeout(timer); cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', schedule); };
  }, [state, animated, glyphs, visible]);
  return <><canvas ref={ref} className={'type-preview ' + className} aria-label={state.text + ' lettering preview'} role="img" />{missing && glyphs && <span className="asset-status" role="status">Missing letters: {missing}</span>}</>;
}
