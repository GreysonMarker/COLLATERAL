import * as T from './vendor/three.module.js';
function iconTexture(shield){const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const a=(x-31.5)/31.5,b=(y-31.5)/31.5;let alpha=0;if(shield){const inside=Math.abs(a)<.66&&b<.75&&b>-.8+Math.abs(a)*.8;const inner=Math.abs(a)<.51&&b<.58&&b>-.60+Math.abs(a)*.8;alpha=inside?(inner?.16:1):0;}else{const rays=Math.exp(-Math.abs(a)*19)*Math.max(0,1-Math.abs(b))+Math.exp(-Math.abs(b)*19)*Math.max(0,1-Math.abs(a));alpha=Math.min(1,rays+Math.max(0,1-Math.hypot(a,b)*3));}const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=alpha*255;}const t=new T.DataTexture(data,size,size);t.needsUpdate=true;return t;}
export function createDefenseFX(scene,hero){
 const outlineMaterial=new T.MeshBasicMaterial({color:'#ffe650',side:T.BackSide,toneMapped:false,depthWrite:false});
 outlineMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += normal * 0.045;');};
 outlineMaterial.customProgramCacheKey=()=> 'parry-outline-v1';
 const outlines=hero.meshes.map(parent=>{const mesh=new T.Mesh(parent.geometry,outlineMaterial);mesh.visible=false;mesh.userData.defenseOutline=true;mesh.renderOrder=1;parent.add(mesh);return mesh;});
 const shield=new T.Sprite(new T.SpriteMaterial({map:iconTexture(true),color:'#ffe650',depthWrite:false,depthTest:false,toneMapped:false}));
 const spark=new T.Sprite(new T.SpriteMaterial({map:iconTexture(false),color:'#ff303e',blending:T.AdditiveBlending,depthWrite:false,depthTest:false,toneMapped:false}));
 shield.visible=spark.visible=false;shield.renderOrder=spark.renderOrder=10;scene.add(shield,spark);
 const geo=new T.RingGeometry(.85,1,40),rings=Array.from({length:8},()=>{const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({color:'#e8f8ff',transparent:true,side:T.DoubleSide,depthWrite:false,toneMapped:false}));mesh.visible=false;scene.add(mesh);return {mesh,age:1,size:5};});let cursor=0;
 function impact(point,direction,kind='normal',blocking=false){const r=rings[cursor++%rings.length];r.age=0;r.size=kind==='serious'?10:kind==='normal'?6:3;r.mesh.visible=true;r.mesh.position.copy(point).add(new T.Vector3(0,1.3*hero.character.height,0));r.mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction.clone().normalize());r.mesh.material.color.set(blocking?'#ffe7a2':'#e8f8ff');r.mesh.scale.setScalar(.3);}
 return {dispose(){for(const m of outlines)m.removeFromParent();outlineMaterial.dispose();for(const s of [shield,spark]){s.removeFromParent();s.material.map.dispose();s.material.dispose();}for(const r of rings){r.mesh.removeFromParent();r.mesh.material.dispose();}geo.dispose();},impact,update(dt,defense){for(const m of outlines)m.visible=defense.parrying;
   const eyes=hero.eyePositions(),top=eyes[0].clone().add(eyes[1]).multiplyScalar(.5);top.y+=.6*hero.character.height;
   shield.position.copy(top);spark.position.copy(top);shield.scale.setScalar(.72*hero.character.height);spark.scale.setScalar(.9*hero.character.height);
   shield.visible=defense.parrying;spark.visible=defense.vulnerable; // No fade extends either timing window.
   spark.material.rotation=defense.age*5;
   for(const r of rings){if(!r.mesh.visible)continue;r.age+=dt;if(r.age>=.4){r.mesh.visible=false;continue;}r.mesh.scale.setScalar(.3+r.size*r.age/.4);r.mesh.material.opacity=.65*(1-r.age/.4)**2;}
  },reset(){shield.visible=spark.visible=false;for(const m of outlines)m.visible=false;for(const r of rings)r.mesh.visible=false;},get stats(){return {outline:outlines.some(m=>m.visible),shield:shield.visible,vulnerable:spark.visible,rings:rings.filter(r=>r.mesh.visible).length};}};
}
