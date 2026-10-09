import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { query } from './db';

export async function uploadBackground(file: File, kind: 'image'|'pattern') {
  if (!file.size || file.size > 10_000_000) throw new Error('Each image must be between 1 byte and 10 MB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase().replace('.jpeg','.jpg');
  if (!['.png','.jpg','.webp','.svg'].includes(ext)) throw new Error('Upload PNG, JPEG, WebP or SVG images.');
  if (ext === '.svg') {
    const svg = bytes.toString('utf8');
    if (!/<svg[\s>]/i.test(svg) || /<!DOCTYPE|<!ENTITY|<\s*(script|foreignObject|iframe|object|embed)|\bon\w+\s*=|@import|(?:href\s*=\s*["']\s*(?!#))|url\(\s*["']?\s*(?!#)/i.test(svg)) throw new Error('SVG must be self-contained, without scripts or external resources.');
  } else if (!(ext === '.png' && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) && !(ext === '.jpg' && bytes[0] === 255 && bytes[1] === 216) && !(ext === '.webp' && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP')) throw new Error('File contents do not match the image extension.');
  const image = await loadImage(bytes);
  if (!image.width || !image.height || image.width * image.height > 40_000_000 || image.height / image.width > 10) throw new Error('Image dimensions exceed the supported limit.');
  const id = randomUUID(), root = path.join(process.cwd(),'public','background');
  const original_url = `/background/images/${id}${ext}`, preview_url = `/background/webp/${id}.webp`;
  const render_url = ext === '.svg' ? `/background/images/${id}.png` : original_url;
  const preview = createCanvas(250,Math.max(1,Math.round(image.height * 250 / image.width)));
  preview.getContext('2d').drawImage(image,0,0,preview.width,preview.height);
  await mkdir(path.join(root,'images'),{recursive:true});
  await mkdir(path.join(root,'webp'),{recursive:true});
  const files:string[] = [];
  const save = async (url:string,data:Uint8Array) => { const filename=path.join(process.cwd(),'public',url); await writeFile(filename,data,{flag:'wx'});files.push(filename); };
  try {
    await save(original_url,bytes);
    await save(preview_url,await preview.encode('webp',82));
    if(ext === '.svg') { const raster=createCanvas(image.width,image.height);raster.getContext('2d').drawImage(image,0,0);await save(render_url,await raster.encode('png')); }
    const record={id,name:file.name.slice(0,180),kind,original_url,preview_url,render_url,width:image.width,height:image.height};
    await query('INSERT INTO background_assets(id,name,kind,original_url,preview_url,render_url,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',Object.values(record));
    return record;
  } catch(error) { await Promise.allSettled(files.map(filename => unlink(filename))); throw error; }
}
