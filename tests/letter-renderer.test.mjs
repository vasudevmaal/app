import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {drawLetters} from '../src/lib/letter-renderer.mjs';
import {animations} from '../src/lib/original-renderer.js';

const glyph=createCanvas(80,100),g=glyph.getContext('2d');g.fillStyle='#fa2345';g.fillRect(0,0,80,100);g.fillStyle='#20cba5';g.fillRect(5,5,20,35);
const images={A:glyph};
const state={text:'AAAAAAAAAA\nAAAA',letterSpacing:5,lineHeight:1.1,rotation:71,curve:80,zigzag:60,wave:35,bg:{type:'transparent'},animation:{id:'none',speed:1}};
test('every AI animation keeps rotated multiline letters within mobile and desktop frames',()=>{
  for(const [width,height] of [[320,186],[800,400]])for(const animation of animations){
    const canvas=createCanvas(width,height),ctx=canvas.getContext('2d'),s={...state,animation:{id:animation.id,speed:1}};
    for(const t of [0,.13,.38,.67,.91]){
      drawLetters(canvas,s,images,'',t);
      const pixels=ctx.getImageData(0,0,width,height).data;let ink=0,edge=0;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){const a=pixels[(y*width+x)*4+3];if(a){ink++;if(x<2||y<2||x>=width-2||y>=height-2)edge++;}}
      assert.equal(edge,0,`${animation.id} clipped at ${t}, ${width}x${height}`);
      if(!['flip_x','flip_y','3d_spin','orbit_3d','letter_flip_both'].includes(animation.id))assert.ok(ink>0,animation.id+' blank');
    }
  }
});
test('AI animation frames change and background images render in preview',()=>{
  const canvas=createCanvas(320,186),s={...state,rotation:0,animation:{id:'float',speed:1}};
  drawLetters(canvas,s,images,'',0);const first=canvas.toBuffer('image/png');drawLetters(canvas,s,images,'',.25);assert.notDeepEqual(canvas.toBuffer('image/png'),first);
  const bg=createCanvas(10,10);bg.getContext('2d').fillStyle='#32cba4';bg.getContext('2d').fillRect(0,0,10,10);
  drawLetters(canvas,{...state,text:'',bg:{type:'image',image:bg,imageMode:'cover'}},{});assert.deepEqual([...canvas.getContext('2d').getImageData(0,0,1,1).data],[50,203,164,255]);
});
