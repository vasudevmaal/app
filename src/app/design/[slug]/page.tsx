import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getStyle} from '@/lib/data';
import {designLibrary} from '@/lib/design-data';
import {readDesign} from '@/lib/design';
import {DesignEditor} from '@/components/design/editor';
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {slug}=await params,style=await getStyle('design',slug);
  if(!style)return {title:'Design not found',robots:{index:false,follow:false}};
  const title=style.seo_title||style.title,description=style.seo_description||style.description;
  const url=`/design/${encodeURIComponent(slug)}`,image=style.image_url||`/previews/${slug}.png`;
  return {title:{absolute:title},description,keywords:style.seo_keywords,alternates:{canonical:url},openGraph:{title,description,url,type:'website',siteName:'EXCPIX',images:[{url:image,alt:style.image_alt||style.title}]},twitter:{card:'summary_large_image',title,description,images:[image]}};
}
export default async function DesignPage({params}:Props){
  const {slug}=await params,style=await getStyle('design',slug);
  if(!style)notFound();
  const library=await designLibrary(),document=readDesign(style);
  const base=process.env.APP_URL||'http://localhost:3010';
  const schema={'@context':'https://schema.org','@type':'WebPage',name:style.seo_title||style.title,description:style.seo_description||style.description,url:new URL(`/design/${slug}`,base).href,image:new URL(style.image_url||`/previews/${slug}.png`,base).href,dateModified:style.updated_at,publisher:{'@type':'Organization',name:'EXCPIX',url:base}};
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/><DesignEditor key={style.id} style={style} initial={document} library={library}/></>;
}
