import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const roots=['/Users/vasudevmaal/Documents/Codex/2026-09-25/m/excpix/backend/node_modules','/Users/vasudevmaal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'];
const done=new Set();
function copy(name){if(done.has(name))return;done.add(name);let from=roots.map(r=>path.join(r,name)).find(p=>fs.existsSync(path.join(p,'package.json')));if(!from){if(fs.existsSync(path.join('node_modules',name,'package.json')))return;throw new Error('Missing '+name);}fs.cpSync(from,path.join('node_modules',name),{recursive:true});const p=JSON.parse(fs.readFileSync(path.join(from,'package.json'),'utf8'));for(const dep of Object.keys(p.dependencies||{}))copy(dep);}
for(const name of ['@electric-sql/pglite','pg','zod','pdf-lib','playwright'])copy(name);
const assets='/Users/vasudevmaal/Documents/Codex/2026-09-25/m/excpix/frontend/public/editor';
fs.mkdirSync('public/editor',{recursive:true});for(const name of ['fonts','fonts.css','background','gif.js','gif.worker.js'])fs.cpSync(path.join(assets,name),path.join('public/editor',name),{recursive:true});
const manifest=JSON.parse(fs.readFileSync('package.json','utf8'));
for(const group of ['dependencies','devDependencies'])for(const name of Object.keys(manifest[group])){const p=path.join('node_modules',name,'package.json');if(fs.existsSync(p))manifest[group][name]=JSON.parse(fs.readFileSync(p,'utf8')).version;else delete manifest[group][name];}
manifest.devDependencies.playwright=JSON.parse(fs.readFileSync('node_modules/playwright/package.json','utf8')).version;
manifest.scripts.test='node --test tests/*.test.mjs';
fs.writeFileSync('package.json',JSON.stringify(manifest,null,2)+'\n');
