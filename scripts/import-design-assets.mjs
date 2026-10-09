import ts from 'typescript';
import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile(process.argv[2],'utf8');
const start=source.indexOf('const ELEMENTS_DATA =');
if(start<0)throw new Error('Reference has no elements library.');
const end=source.indexOf('\n];',start);
const ast=ts.createSourceFile('assets.js',source.slice(start,end+3),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const list=ast.statements[0].declarationList.declarations[0].initializer;
const assets=list.elements.map((item,index)=>{
  const record=Object.fromEntries(item.properties.map(p=>[p.name.text,p.initializer.text]));
  return {id:`design-asset-${index+1}`,name:record.name,category:record.cat,svg:record.svg};
});
if(assets.some(a=>!a.name||!a.svg))throw new Error('Invalid asset in reference.');
await writeFile('src/lib/design-assets.json',JSON.stringify(assets,null,2)+'\n');
console.log(`Imported ${assets.length} SVG assets from the supplied reference.`);
