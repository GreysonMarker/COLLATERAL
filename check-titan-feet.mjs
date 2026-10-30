import assert from 'node:assert/strict';
import * as T from './dist/vendor/three.module.js';
import {createHero} from './dist/hero.js';
const hero=createHero(c=>new T.MeshStandardMaterial({color:c}));hero.setAppearance('monolith');
const feet=hero.meshes.filter(m=>m.name==='monolith-concept'&&Math.abs(m.parent.position.y+.47)<1e-6);assert(feet.length);
const v=new T.Vector3();let time=0;
for(const speed of [0,36,54,0])for(let i=0;i<180;i++){
 const yaw=i*.04,groundY=3;hero.root.position.set(20,groundY,-30);const before=hero.root.position.clone();
 hero.update(1/60,time+=1/60,{flying:false,grounded:true,moving:speed>0,boost:speed===54,vx:Math.sin(yaw)*speed,vy:0,vz:Math.cos(yaw)*speed,groundY});hero.root.updateMatrixWorld(true);
 let lowest=Infinity;for(const m of feet){const p=m.geometry.attributes.position;for(let j=0;j<p.count;j++){v.fromBufferAttribute(p,j).applyMatrix4(m.matrixWorld);lowest=Math.min(lowest,v.y);}}
 assert(Math.abs(lowest-groundY-.025)<1e-7,'feet stay planted above ground throughout stride and turns');assert(hero.root.position.equals(before),'visual correction cannot displace actor');
}
console.log('720 idle/walk/sprint/turn/stop poses: soles remain 2.5 cm above ground and actor position never changes.');
