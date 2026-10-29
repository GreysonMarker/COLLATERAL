import {buildNewCharacter} from './new-character-models.js';
import {buildReferenceCharacter} from './reference-character.js';
import * as T from './vendor/three.module.js';
export const CHARACTERS=[
 {id:'pale-king',name:'Pale King',size:'Powerhouse · model preview',height:1.75,width:1.16,depth:1.0,concept:true,colors:['#20242b','#ded0ac','#ded0ac','#6d2035','#ded0ac','#20242b','#ded0ac','#20242b']},
 {id:'monolith',name:'Monolith',size:'Giant · model preview',height:28,width:.82,depth:.78,concept:true,colors:['#343b3d','#c3a779','#c3a779','#343b3d','#38d8cc','#343b3d','#c3a779','#343b3d']},
 {id:'ghostshot',name:'Ghostshot',size:'Standard · model preview',height:1,width:.80,depth:.73,concept:true,colors:['#20242b','#eeeae2','#eeeae2','#182532','#36d8ff','#20242b','#eeeae2','#20242b']},
 {id:'original',name:'Meridian',size:'Original',height:1,width:.74,depth:.70,cape:true,colors:['#17233e','#306ac7','#e6e1cc','#db3e57','#ffc65e','#151728','#bc896d','#232039']},
 {id:'obsidian',name:'Black armor',size:'Large',height:1.55,width:1.08,depth:.9,colors:['#111322','#242637','#a9afbc','#202233','#a9afbc','#11121c','#bd8663','#11111c']},
 {id:'gold',name:'Black & gold',size:'Large',height:1.45,width:1.10,depth:.94,colors:['#111322','#181928','#e8bd51','#141523','#dba83e','#10111b','#ac7850','#10111c']},
 {id:'violet',name:'Violet helmet',size:'Large',height:1.50,width:1.02,depth:.90,colors:['#24242b','#482360','#bb56e8','#3e2058','#bb8044','#17171e','#24222d','#34203f']},
 {id:'lanky',name:'Blue & white',size:'Slim',height:.91,width:.68,depth:.59,cape:true,colors:['#12336b','#2355bd','#f1eee7','#c72343','#edbf42','#112348','#bd8768','#151626']},
 {id:'teal',name:'Teal sentinel',size:'Standard',height:1,width:.74,depth:.70,colors:['#112239','#167e98','#f1f0eb','#e89b32','#efac42','#101b30','#805236','#101521']}
];
export function installAppearance({root,rig,head,arms,legs,materials,part,cube,gem,all,cape,toon}){
 const original=[...all],base=original.map(m=>({m,visible:m.visible})),extras=new Map();
 for(const style of CHARACTERS){if(style.id==='original')continue;const before=all.length;
  (style.concept?buildNewCharacter:buildReferenceCharacter)({style,rig,head,arms,legs,all,toon});extras.set(style.id,all.slice(before));
 }
 const originalCapeColors=cape.mesh.geometry.attributes.color.array.slice();
 let current=CHARACTERS.find(s=>s.id==='original');
 function setAppearance(id){const style=CHARACTERS.find(s=>s.id===id)||CHARACTERS[0];current=style;
  Object.values(materials).forEach((m,i)=>m.color.set(style.colors[i]));root.scale.setScalar(style.height);rig.scale.set(style.width,1,style.depth);head.scale.set(1.08*(style.id==='lanky'?1.25:style.id==='teal'?1.16:1),.96,1.08);
  for(const {m,visible} of base)m.visible=style.id==='original'&&visible;
  for(const [key,meshes] of extras)for(const m of meshes)m.visible=key===style.id;
  const colors=cape.mesh.geometry.attributes.color;
  if(style.id==='lanky'){const c=new T.Color('#b92338');for(let i=0;i<colors.count;i++)colors.setXYZ(i,c.r,c.g,c.b);}else colors.array.set(originalCapeColors);colors.needsUpdate=true;
  cape.mesh.visible=!!style.cape;cape.reset();return style;
 }
 setAppearance('original');return {setAppearance,get style(){return current;}};
}
