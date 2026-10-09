import {mkdir,writeFile} from 'node:fs/promises';
import {renderExport} from '../src/lib/server-renderer.mjs';
const base=process.env.APP_URL||'http://127.0.0.1:3010';
const response=await fetch(base+'/api/styles');if(!response.ok)throw new Error('Start the app before generating preview assets.');
const styles=await response.json();await mkdir('public/previews',{recursive:true});
for(const s of styles){await writeFile(`public/previews/${s.slug}.png`,await renderExport(s.content_json,1200,'16:9','png',''));console.log(s.slug);}
