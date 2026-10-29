import {finishCharacterMaterial} from './visual-polish.js';
import * as T from './vendor/three.module.js';
// A single continuous head surface. All facial markings share one texture;
// the nose, eye sockets and lips deform the surface, never separate solids.
export function createCharacterFace(style,toon){
 const pow=(v,p)=>Math.sign(v)*Math.abs(v)**p;
 const bump=(x,y,cx,cy,wx,wy)=>Math.exp(-(((x-cx)/wx)**2+((y-cy)/wy)**2));
 function point(u,v){
  const a=(u-.5)*Math.PI*2,t=(1-v)*Math.PI,sy=Math.cos(t),ring=Math.sin(t);
  const y=.025+.225*sy,jaw=sy<-.1?1+.16*(sy+.1):1;
  const x=.192*ring*pow(Math.sin(a),.72)*jaw;
  const front=Math.max(0,Math.cos(a));
  let z=.012+.176*ring*pow(Math.cos(a),.55);
  z+=front**8*(.052*bump(x,y,0,.005,.028,.04)+.025*bump(x,y,0,.055,.022,.08)
   -.012*(bump(x,y,-.081,.066,.048,.026)+bump(x,y,.081,.066,.048,.026))
   +.008*bump(x,y,0,-.093,.061,.015)+.012*bump(x,y,0,-.15,.09,.04));
  return [x,y,z,front];
 }
 const geo=new T.SphereGeometry(1,48,32),p=geo.attributes.position,uv=geo.attributes.uv;
 for(let i=0;i<p.count;i++){const q=point(uv.getX(i),uv.getY(i));p.setXYZ(i,q[0],q[1],q[2]);}
 geo.computeVertexNormals();geo.computeBoundingSphere();
 const size=256,data=new Uint8Array(size*size*4);
 const rgb=c=>{const color=new T.Color(c).convertLinearToSRGB();return [color.r*255,color.g*255,color.b*255];};
 const skin=rgb(style.colors[6]),ink=rgb('#181923'),white=rgb('#fff9ef'),iris=rgb('#473a30'),cyan=rgb('#adf8ff'),scar=rgb('#854347'),lip=skin.map((c,i)=>c*(i===0?.72:.59));
 for(let row=0;row<size;row++)for(let col=0;col<size;col++){
  const [x,y,z,f]=point((col+.5)/size,(row+.5)/size);let color=skin;
  if(f>.65){
   const ax=Math.abs(x),ex=ax-.081;
   if(style.id==='teal'&&ax<.165&&y>.019&&y<.115-Math.max(0,ax-.11)*.4)color=ink;
   const eyeY=.067+ex*.07,eyeHeight=.017*Math.sqrt(Math.max(0,1-(ex/.045)**2));
   if(Math.abs(ex)<.045&&Math.abs(y-eyeY)<eyeHeight){color=white;if(style.id==='teal')color=cyan;else if(Math.abs(ex)<.013){color=iris;if(Math.abs(ex)<.007)color=ink;} }
   if(style.id!=='teal'&&ax>.033&&ax<.145&&Math.abs(y-(.101+(ax-.033)*.22))<.009)color=ink;
   if(ax<.057&&Math.abs(y-(-.104+.006*(1-(x/.057)**2)))<.0027)color=lip;
   if(Math.abs(ax-.018)<.005&&Math.abs(y+.024)<.003)color=lip;
   if(style.id==='gold'&&y>-.10&&y<.20&&Math.abs(x-(.09+(.13-y)*.16))<.0035)color=scar;
  }
  const at=(row*size+col)*4;data[at]=color[0];data[at+1]=color[1];data[at+2]=color[2];data[at+3]=255;
 }
 const map=new T.DataTexture(data,size,size,T.RGBAFormat);map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
 const material=toon('#ffffff');material.map=map;material.flatShading=false;material.roughness=.85;finishCharacterMaterial(material,'skin');
 return {geometry:geo,material};
}
