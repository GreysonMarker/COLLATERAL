import * as T from './vendor/three.module.js';
// Pooled contact flash and pressure rings: local impact frames, no full-screen strobe.
export function createTitanImpactFX(scene){
 const group=new T.Group();scene.add(group);const rings=[];const geo=new T.RingGeometry(.86,1,64),ball=new T.SphereGeometry(1,12,8);
 for(let i=0;i<6;i++){const flash=new T.Mesh(ball,new T.MeshBasicMaterial({color:'#e5fbff',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));const ring=new T.Mesh(geo,new T.MeshBasicMaterial({color:'#91dbff',side:T.DoubleSide,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));group.add(flash,ring);rings.push({flash,ring,age:10});}
 let index=0;return {hit(point,direction){const r=rings[index++%rings.length];r.age=0;r.flash.position.copy(point);r.ring.position.copy(point);r.ring.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction);},update(dt){for(const r of rings){r.age+=dt;const t=r.age;r.flash.visible=t<.16;r.ring.visible=t<.7;if(t>.7)continue;r.flash.scale.setScalar(2+16*Math.min(1,t/.08));r.flash.material.opacity=.7*Math.max(0,1-t/.16);r.ring.scale.setScalar(1+t*110);r.ring.material.opacity=.85*(1-t/.7)**2;}},reset(){for(const r of rings){r.age=10;r.flash.visible=r.ring.visible=false;}}};
}
