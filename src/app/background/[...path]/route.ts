import { readFile } from 'node:fs/promises';
import path from 'node:path';
export const runtime = 'nodejs';
export async function GET(_request:Request, context:{params:Promise<{path:string[]}>}) {
  const [folder,name,...rest] = (await context.params).path;
  if(rest.length || !['images','webp'].includes(folder) || !/^[a-f0-9-]{36}\.(png|jpg|webp|svg)$/.test(name || '')) return new Response('Not found',{status:404});
  try {
    const bytes = await readFile(path.join(process.cwd(),'public','background',folder,name));
    const ext = name.split('.').at(-1)!;
    return new Response(bytes,{headers:{'Content-Type':({'png':'image/png','jpg':'image/jpeg','webp':'image/webp','svg':'image/svg+xml'} as Record<string,string>)[ext], 'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff',...(ext === 'svg' ? {'Content-Disposition':`attachment; filename="${name}"`,'Content-Security-Policy':"default-src 'none'; sandbox"} : {})}});
  } catch {return new Response('Not found',{status:404});}
}
