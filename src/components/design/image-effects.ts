import type {DesignElement} from '@/lib/design';
export function imageEffects(source:HTMLImageElement|HTMLCanvasElement,element:DesignElement,resolution:number){
  const scale=Math.min(2,resolution/Math.max(element.w,element.h,1));
  const w=Math.max(1,Math.round(element.w*scale)),h=Math.max(1,Math.round(element.h*scale));
  const border=element.borderEnabled?Math.min(element.borderWidth*scale,w/3,h/3):0;
  const iw=Math.max(1,w-2*border),ih=Math.max(1,h-2*border);
  const filtered=document.createElement('canvas');filtered.width=Math.ceil(iw);filtered.height=Math.ceil(ih);
  const ctx=filtered.getContext('2d')!,f=element.filters;
  ctx.filter=`brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) grayscale(${f.grayscale}%) sepia(${f.sepia}%) hue-rotate(${f.hue}deg) blur(${f.blur*scale}px)`;
  const crop=element.crop||{top:0,right:0,bottom:0,left:0};
  const sx=source.width*crop.left/100,sy=source.height*crop.top/100;
  const sw=source.width*(1-(crop.left+crop.right)/100),sh=source.height*(1-(crop.top+crop.bottom)/100);
  const sourceAspect=sw/sh,targetAspect=iw/ih;
  if(sourceAspect>targetAspect){const cropWidth=sh*targetAspect;ctx.drawImage(source,sx+(sw-cropWidth)/2,sy,cropWidth,sh,0,0,iw,ih);}
  else{const cropHeight=sw/targetAspect;ctx.drawImage(source,sx,sy+(sh-cropHeight)/2,sw,cropHeight,0,0,iw,ih);}
  ctx.filter='none';
  if(f.pixelate>0){const small=document.createElement('canvas');const block=Math.max(1,f.pixelate*scale);small.width=Math.max(1,Math.round(iw/block));small.height=Math.max(1,Math.round(ih/block));small.getContext('2d')!.drawImage(filtered,0,0,small.width,small.height);ctx.clearRect(0,0,iw,ih);ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,iw,ih);ctx.imageSmoothingEnabled=true;}
  const clipped=document.createElement('canvas');clipped.width=filtered.width;clipped.height=filtered.height;const mask=clipped.getContext('2d')!;
  mask.beginPath();mask.roundRect(0,0,iw,ih,Math.min(iw,ih)*element.radius/100);mask.clip();mask.drawImage(filtered,0,0);
  const output=document.createElement('canvas');output.width=w;output.height=h;const out=output.getContext('2d')!;
  if(border>0){
    // Dilate the alpha silhouette; transparent cutouts and rounded corners keep their outline.
    const tint=document.createElement('canvas');tint.width=clipped.width;tint.height=clipped.height;const t=tint.getContext('2d')!;t.drawImage(clipped,0,0);t.globalCompositeOperation='source-in';t.fillStyle=element.borderColor;t.fillRect(0,0,iw,ih);
    const steps=Math.max(32,Math.ceil(Math.PI*border*2));for(let i=0;i<steps;i++){const a=i/steps*Math.PI*2;out.drawImage(tint,border+Math.cos(a)*border,border+Math.sin(a)*border);}
  }
  out.drawImage(clipped,border,border);return output;
}
