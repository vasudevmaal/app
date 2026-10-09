import {query} from './db';
import {getStyles} from './data';
import assets from './design-assets.json';
import type {DesignAsset,DesignBackground} from './design';
let seeded:Promise<void>|undefined;
async function seedAssets(){
  seeded ??= (async()=>{
    await query(`INSERT INTO settings(key,value) VALUES('design-assets',$1) ON CONFLICT DO NOTHING`,[JSON.stringify(assets)]);
  })().catch(error=>{seeded=undefined;throw error;});
  await seeded;
}
export async function designLibrary(){
  await seedAssets();
  const [icons,letters,ai,templates,backgrounds]=await Promise.all([
    query<{value:DesignAsset[]}>("SELECT value FROM settings WHERE key='design-assets'"),
    getStyles('3d-text',undefined,1000),getStyles('ai',undefined,1000),getStyles('design',undefined,1000),
    query<DesignBackground>('SELECT * FROM background_assets ORDER BY created_at DESC'),
  ]);
  return {assets:icons[0]?.value||[],letters:[...letters,...ai],templates,backgrounds};
}
