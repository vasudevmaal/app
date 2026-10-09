import { createCanvas, SvgExportFlag } from '@napi-rs/canvas';
import { engine, font } from './server-renderer.mjs';
import { createSvgGeometryPool, svgFrameAnimation } from './svg-geometry.mjs';

let running = false;

// Sample the shared animation geometry, but serialize every layer as paths and
// SVG filters. No canvas snapshots or bitmap animation frames enter the SVG.
export async function renderSvg(state, size, ratio, previewAspect = 2) {
  if (running) throw new Error('An SVG export is already running. Please try again shortly.');
  running = true;
  try {
    await font(state);
    const s = structuredClone(state);
    const paints = [s.fill, s.bg, ...s.layers.filter(layer => layer.enabled)];
    if (paints.some(paint => paint.type === 'image' || paint.type === 'pattern' ||
      (paint.type === 'alternating' && paint.altMode === 'image'))) {
      throw new Error('Vector SVG cannot embed image fills. Choose solid, gradient, radial or alternating colors before downloading.');
    }
    const aspect = ratio === 'original' ? previewAspect : ratio.split(':').map(Number).reduce((a, b) => a / b);
    // SVG paths scale without needing a large raster drawing surface.
    const width = aspect >= 1 ? 1280 : Math.round(1280 * aspect);
    const height = aspect >= 1 ? Math.round(1280 / aspect) : 1280;
    const renderer = await engine();
    const measure = renderer(createCanvas(width, height));
    const animated = s.animation.id !== 'none';
    const frames = animated ? 60 : 1;
    let scale = measure(s, undefined, { measureOnly: true });
    for (let i = 0; animated && i < 120; i++) {
      scale = Math.min(scale, measure(s, i / 120, { measureOnly: true }));
    }
    const duration = 2 / Math.max(0.1, s.animation.speed);
    const flags = SvgExportFlag.ConvertTextToPaths;
    const background = createCanvas(width, height, flags);
    renderer(background)({ ...s, text: '', layers: [], animation: { id: 'none', speed: 1 } }, undefined, { backgroundOnly: true });
    const geometry = createSvgGeometryPool();
    const inner = (canvas, prefix) => geometry.compact(canvas.getContent().toString()
      .replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '')
      .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
      .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`)
      .replace(/((?:xlink:)?href)="#([^"]+)"/g, (_, attr, id) => `${attr}="#${prefix}${id}"`));
    const body = [inner(background, 'bg_')];
    for (let i = 0; i < frames; i++) {
      const canvas = createCanvas(width, height, flags);
      const layers = [];
      let layerIndex = 0;
      const svgLayer = (ops, layout, draw) => {
        const layer = createCanvas(width, height, flags);
        const ctx = layer.getContext('2d');
        ctx.font = layout.font;
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.miterLimit = 2;
        ctx.setTransform(layout.transform);
        const op = ops[0];
        const id = `f${i}_l${layerIndex++}_`;
        let filter = '';
        let opacity = op.style.opacity ?? 1;
        if (op.type === '3d_step') {
          for (const step of ops) {
            const props = { width: Math.max(2, step.baseW || 0), stepIndex: step.stepIndex, totalSteps: step.totalSteps, opacity: 1 };
            draw(ctx, step, 'stroke', props);
            draw(ctx, step, 'fill', props);
          }
        } else if (op.type === 'shadow') {
          const props = { opacity: 1, width: (op.thickness || 0) + (op.style.size || 0) * 2 };
          const x = op.x + (op.style.offsetX || 0), y = op.y + (op.style.offsetY || 0);
          if (props.width > 0) draw(ctx, op, 'stroke', props, op.style, x, y);
          draw(ctx, op, 'fill', { opacity: 1 }, op.style, x, y);
          filter = `<feGaussianBlur stdDeviation="${Math.max(0, op.style.blur || 0) * layout.scale}"/>`;
        } else if (op.type === 'inner_shadow') {
          draw(ctx, op, 'fill', { opacity: 1 });
          const mask = createCanvas(width, height, flags);
          const maskCtx = mask.getContext('2d');
          maskCtx.font = layout.font;
          maskCtx.textBaseline = 'middle';
          maskCtx.lineJoin = 'round';
          maskCtx.lineCap = 'round';
          maskCtx.setTransform(layout.transform);
          draw(maskCtx, op, 'fill', { opacity: 1 }, { type: 'solid', color: '#ffffff', opacity: 1 });
          const spread = Math.max(0, op.style.size || 0) * layout.scale;
          // Blur the outside of an opaque glyph, independently of its paint alpha.
          filter = `${spread ? `<feMorphology in="SourceAlpha" operator="erode" radius="${spread}" result="shape"/>` : ''}<feComponentTransfer in="${spread ? 'shape' : 'SourceAlpha'}" result="outside"><feFuncA type="linear" slope="-1" intercept="1"/></feComponentTransfer><feGaussianBlur in="outside" stdDeviation="${Math.max(0, op.style.blur || 0) * layout.scale / 2}" result="blur"/><feOffset in="blur" dx="${(op.style.offsetX || 0) * layout.scale}" dy="${(op.style.offsetY || 0) * layout.scale}" result="offset"/><feMerge><feMergeNode in="outside"/><feMergeNode in="offset"/></feMerge><feComposite in2="SourceAlpha" operator="in"/>`;
          filter += '<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/>';
          layers.push(`<defs><filter id="${id}filter" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" color-interpolation-filters="sRGB">${filter}</filter><mask id="${id}mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><g filter="url(#${id}filter)">${inner(mask, `${id}mask_`)}</g></mask></defs>`);
          layers.push(`<g opacity="${opacity}" mask="url(#${id}mask)">${inner(layer, id)}</g>`);
          return;
        } else {
          // These layers already apply their own opacity in drawTextLayer.
          opacity = 1;
          if (op.type === 'fill') draw(ctx, op, 'fill');
          else if (op.w > 0) draw(ctx, op, 'stroke', { width: op.w, stepIndex: op.stepIndex, totalSteps: op.totalSteps });
        }
        if (filter) layers.push(`<defs><filter id="${id}filter" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" color-interpolation-filters="sRGB">${filter}</filter></defs>`);
        layers.push(`<g opacity="${opacity}"${filter ? ` filter="url(#${id}filter)"` : ''}>${inner(layer, id)}</g>`);
      };
      const result = renderer(canvas)(s, animated ? i / frames : undefined, { scale, vector: true, svgLayer });
      const filter = result.hueShift ? ` filter="url(#hue${i})"` : '';
      if (filter) body.push(`<defs><filter id="hue${i}" x="-50%" y="-50%" width="200%" height="200%"><feColorMatrix type="hueRotate" values="${result.hueShift}"/></filter></defs>`);
      body.push(`<g visibility="${i === 0 ? 'visible' : 'hidden'}"${filter}>${svgFrameAnimation(i, frames, duration)}${result.isStrobing ? '' : layers.join('')}</g>`);
      if (i % 5 === 0) await new Promise(resolve => setImmediate(resolve));
    }
    const outWidth = aspect >= 1 ? size : Math.round(size * aspect);
    const outHeight = aspect >= 1 ? Math.round(size / aspect) : size;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${outWidth}" height="${outHeight}" viewBox="0 0 ${width} ${height}">${geometry.definitions()}${body.join('')}</svg>`;
    if (/<image\b|data:image\//i.test(svg)) throw new Error('SVG export unexpectedly contained an image. Please use vector-only fills.');
    return Buffer.from(svg);
  } finally {
    running = false;
  }
}
