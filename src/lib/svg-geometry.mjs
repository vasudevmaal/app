import { SaxesParser } from 'saxes';

const escape = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function svgFrameAnimation(index, frames, duration) {
  if (frames === 1) return '';
  const keys = index === 0 ? `0;${1 / frames};1` : `0;${index / frames};${(index + 1) / frames}${index === frames - 1 ? '' : ';1'}`;
  const values = index === 0 ? 'visible;hidden;hidden' : `hidden;visible;hidden${index === frames - 1 ? '' : ';hidden'}`;
  return `<animate attributeName="visibility" calcMode="discrete" values="${values}" keyTimes="${keys}" dur="${duration}s" repeatCount="indefinite"/>`;
}

// Share exact outlines across layers and frames without rounding coordinates or
// changing per-instance transforms, paint, opacity, clipping or animation timing.
export function createSvgGeometryPool() {
  const paths = new Map();
  const definitions = [];
  return {
    definitions: () => `<defs>${definitions.join('')}</defs>`,
    compact(fragment) {
      const output = [];
      const stack = [];
      const parser = new SaxesParser({ fragment: true });
      parser.on('opentag', node => {
        let name = node.name;
        const attrs = { ...node.attributes };
        if (name === 'path' && attrs.d) {
          let id = paths.get(attrs.d);
          if (!id) {
            id = `excpixGeometry${paths.size}`;
            paths.set(attrs.d, id);
            definitions.push(`<path id="${id}" d="${escape(attrs.d)}"/>`);
          }
          delete attrs.d;
          attrs['xlink:href'] = `#${id}`;
          name = 'use';
        }
        output.push(`<${name}${Object.entries(attrs).map(([key, value]) => ` ${key}="${escape(value)}"`).join('')}${node.isSelfClosing ? '/>' : '>'}`);
        stack.push({ name, selfClosing: node.isSelfClosing });
      });
      parser.on('closetag', () => {
        const node = stack.pop();
        if (!node.selfClosing) output.push(`</${node.name}>`);
      });
      parser.on('text', text => { if (text.trim()) output.push(escape(text)); });
      parser.write(fragment).close();
      return output.join('');
    },
  };
}
