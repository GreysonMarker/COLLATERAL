import * as T from './vendor/three.module.js';
let desktop=false;
export function setVisualProfile(mobile){desktop=!mobile;}
export function desktopVisuals(){return desktop;}
const textures=new Map();
// Shared deterministic, seamless material maps. No downloads or per-hero texture copies.
export function detailMap(kind='stone'){
 if(textures.has(kind))return textures.get(kind);
 const n=128,data=new Uint8Array(n*n*4);let seed=8191;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296;
  const weave=(Math.sin(x*Math.PI)*Math.cos(y*Math.PI));
  const v=kind==='cloth'?155+30*Math.sin(x*Math.PI/2)*Math.cos(y*Math.PI/2)+noise*12:kind==='skin'?185+noise*25:kind==='metal'?175+Math.sin(y*.5)*12+noise*8:145+noise*65;
  const i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(v+weave);data[i+3]=255;
 }
 const map=new T.DataTexture(data,n,n);map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.repeat.set(kind==='cloth'?12:kind==='skin'?4:6,kind==='cloth'?12:kind==='skin'?4:6);map.needsUpdate=true;textures.set(kind,map);return map;
}
export function finishCharacterMaterial(m,kind='cloth'){
 if(!desktop||!m.isMeshStandardMaterial)return m;
 m.flatShading=false;m.bumpMap=detailMap(kind);m.bumpScale=kind==='skin'?.006:kind==='metal'?.008:.012;
 m.roughness=kind==='metal'?.3:kind==='skin'?.58:kind==='hair'?.72:.82;m.metalness=kind==='metal'?.65:0;m.envMapIntensity=kind==='metal'?.8:.3;
 return m;
}
// World-space grain and broad weathering avoid stretched textures on huge merged roads.
export function finishSurface(m,kind='concrete'){
 if(!desktop||!m.isMeshStandardMaterial)return m;
 const prior=m.onBeforeCompile,key=m.customProgramCacheKey();
 const scale=kind==='asphalt'?7:kind==='grass'?3:.9;
 m.onBeforeCompile=shader=>{prior.call(m,shader);shader.vertexShader='varying vec3 surfaceWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 surfaceP=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nsurfaceP=instanceMatrix*surfaceP;\n#endif\nsurfaceWorld=(modelMatrix*surfaceP).xyz;');shader.fragmentShader='varying vec3 surfaceWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec3 grainP=surfaceWorld*${scale.toFixed(1)};
 float grit=fract(sin(dot(floor(grainP*7.),vec3(12.9898,78.233,37.719)))*43758.5453);
 float wear=sin(grainP.x*.031+sin(grainP.z*.043))*sin(grainP.z*.027+grainP.y*.06);
 diffuseColor.rgb*=.9+grit*.15+wear*.065;`);};m.customProgramCacheKey=()=>key+'-weathered-'+kind;m.needsUpdate=true;return m;
}
export function pressureMaterial(color='#d7eeff'){
 const m=new T.MeshBasicMaterial({color,transparent:true,opacity:.7,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
 if(!desktop)return m;
 m.onBeforeCompile=s=>{s.vertexShader='varying vec3 pressureLocal;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npressureLocal=position;');s.fragmentShader='varying vec3 pressureLocal;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float r=length(pressureLocal.xy);float a=atan(pressureLocal.y,pressureLocal.x);
 float rim=exp(-pow((r-.96)*48.,2.));float vapor=exp(-pow((r-.91)*20.,2.));float breakup=.72+.16*sin(a*29.+r*190.)+.12*sin(a*61.-r*113.);
 diffuseColor.a*=clamp((rim+vapor*.36)*breakup,0.,1.);`);};m.customProgramCacheKey=()=> 'pressure-vapor-v1';return m;
}
export function vaporMap(){
 if(textures.has('vapor'))return textures.get('vapor');
 const n=128,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const dx=(x-63.5)/63.5,dy=(y-63.5)/63.5,r=Math.hypot(dx,dy),cloud=.7+.16*Math.sin(x*.19+Math.sin(y*.12)*3)+.14*Math.cos(y*.22+Math.sin(x*.1)*4),i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(Math.max(0,1-r*r)**2*cloud*255);}
 const t=new T.DataTexture(data,n,n);t.magFilter=t.minFilter=T.LinearFilter;t.needsUpdate=true;textures.set('vapor',t);return t;
}
