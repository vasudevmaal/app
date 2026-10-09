import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const source=process.argv[2] || '/Users/vasudevmaal/.codex/attachments/cd6a2783-ff03-4cb6-a2c2-e934068e61b2/Pasted text.txt';
if(fs.existsSync(source)) {
 const html=fs.readFileSync(source,'utf8').replace(/\r\n/g,'\n');
 fs.mkdirSync(path.join(root,'reference'),{recursive:true});
 fs.writeFileSync(path.join(root,'reference/original-editor.html'),html);
 const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b));
 const helpers=extract('        function hexToRgb','        const jsonText');
 const renderer=extract('        function getPaintStyle','        function setupUI');
 const animations=extract('        const animsList =','        function generateAnimations').replace('const animsList =','export const animations =');
 const wrapper=`// Canvas engine mechanically extracted from the user-supplied editor.\nexport function createRenderer(canvas, invalidate = () => {}, glyphs = {}) {\nconst ctx = canvas.getContext('2d');\nconst BASE_FONT_SIZE = 180; let state = {}; let textCanvas = null; const tCtx = ctx;\nconst isImageTextMode = Object.keys(glyphs).length > 0;\nconst charImageCache = {};\nfunction getCharImage(char) { const key=char.toUpperCase(); if(charImageCache[key] !== undefined) return charImageCache[key]; const url=glyphs[key]; if(!url)return null; charImageCache[key]=null;const img=new Image();img.onload=()=>{charImageCache[key]=img;invalidate();};img.onerror=()=>{charImageCache[key]=false;};img.src=url;return null;}\n${helpers}\n${renderer}\nreturn (value, t) => { state=value; render(value,ctx,canvas.width,canvas.height,'auto',t); };\n}\n${animations}\n`;
 fs.mkdirSync(path.join(root,'src/lib'),{recursive:true});fs.writeFileSync(path.join(root,'src/lib/original-renderer.js'),wrapper);
 const sample=html.match(/<script id="default-state-json" type="application\/json">\s*([\s\S]*?)<\/script>/)?.[1];
 if(sample)fs.writeFileSync(path.join(root,'reference/default-state.json'),JSON.stringify(JSON.parse(sample),null,2));
}
if(fs.existsSync('node_modules/gif.js/dist/gif.worker.js')){fs.mkdirSync('public/vendor',{recursive:true});fs.copyFileSync('node_modules/gif.js/dist/gif.worker.js','public/vendor/gif.worker.js');}
