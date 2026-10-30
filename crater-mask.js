import * as T from './vendor/three.module.js';
const GRID=512,TILE=16,NODES=17;
export function createCraterMask(){
 const lookup=new Uint8Array(GRID*GRID*4),map=new T.DataTexture(lookup,GRID,GRID,T.RGBAFormat);
 let columns=32,size=columns*NODES,data=new Uint8Array(size*size),atlas=texture(data,size);const slots=new Map();
 map.magFilter=map.minFilter=T.NearestFilter;map.generateMipmaps=false;map.needsUpdate=true;
 function texture(bytes,width){const t=new T.DataTexture(bytes,width,width,T.RedFormat);t.magFilter=t.minFilter=T.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;}
 const uniforms={craterMap:{value:map},craterDepth:{value:atlas},craterColumns:{value:columns},craterAtlasSize:{value:size}};
 function update(a,b,depths){const mx=a+GRID/2,mz=b+GRID/2;if(mx<0||mz<0||mx>=GRID||mz>=GRID)return;
  const key=a+','+b;let slot=slots.get(key);if(slot===undefined){slot=slots.size;slots.set(key,slot);}
  if(slot>=columns*columns){const old=data,oldSize=size,oldColumns=columns;columns*=2;size=columns*NODES;data=new Uint8Array(size*size);
   for(let s=0;s<slot;s++)for(let y=0;y<NODES;y++){const src=(Math.floor(s/oldColumns)*NODES+y)*oldSize+(s%oldColumns)*NODES,dst=(Math.floor(s/columns)*NODES+y)*size+(s%columns)*NODES;data.set(old.subarray(src,src+NODES),dst);}
   atlas.dispose();atlas=texture(data,size);uniforms.craterDepth.value=atlas;uniforms.craterColumns.value=columns;uniforms.craterAtlasSize.value=size;
  }
  const ox=(slot%columns)*NODES,oy=Math.floor(slot/columns)*NODES;
  for(let y=0;y<NODES;y++)for(let x=0;x<NODES;x++)data[(oy+y)*size+ox+x]=Math.round(Math.min(1,Math.max(0,depths[y*NODES+x])/.2)*255);
  const i=(mz*GRID+mx)*4,id=slot+1;lookup[i]=id%256;lookup[i+1]=Math.floor(id/256);lookup[i+3]=255;map.needsUpdate=atlas.needsUpdate=true;
 }
 return {uniforms,update};
}
export const CRATER_MASK_GLSL=`
uniform sampler2D craterMap;
uniform sampler2D craterDepth;
uniform float craterColumns;
uniform float craterAtlasSize;
float craterCoverage(vec2 worldXZ){
 vec2 tile=floor(worldXZ/16.0),cell=tile+vec2(256.0);
 if(any(lessThan(cell,vec2(0.0)))||any(greaterThanEqual(cell,vec2(512.0))))return 0.0;
 vec2 code=floor(texture2D(craterMap,(cell+.5)/512.0).rg*255.0+.5);
 float slot=code.x+256.0*code.y-1.0;if(slot<0.0)return 0.0;
 vec2 origin=vec2(mod(slot,craterColumns),floor(slot/craterColumns))*17.0;
 return texture2D(craterDepth,(origin+(worldXZ-tile*16.0)+.5)/craterAtlasSize).r;
}`;
