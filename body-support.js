import * as T from './vendor/three.module.js';
// Probe only within a limb's reach; return a real surface contact, not a pose marker.
export function findBrace(world,start,direction,reach=.67,radius=.10){
 if(!world||direction.lengthSq()<.001)return null;
 const dir=direction.clone().normalize();
 for(let distance=.12;distance<=reach;distance+=.045){const point=start.clone().addScaledVector(dir,distance);if(world.sphereHit(point,radius,true,true)){const contact=world.contactAt(point,[new T.Vector3()],radius);if(!contact)continue;point.addScaledVector(contact.normal,contact.depth+.005);if(point.distanceTo(start)<=reach+.02)return {point,normal:contact.normal};}}
 return null;
}
export function motorStrength({shock,grounded,sliding,flying}){
 const control=Math.max(.06,1-shock*.80);
 return flying?Math.max(.25,control):grounded&&sliding?control*.22:control;
}
