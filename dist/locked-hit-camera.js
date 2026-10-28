import * as T from './vendor/three.module.js';
const clamp=T.MathUtils.clamp;
// Camera orbit is deliberately slower than targeting. Passing through/under an
// opponent must not swing the camera around the ragdoll in a single frame.
export function lockedHitAngles(delta,yaw,pitch,dt){
 const flat=Math.hypot(delta.x,delta.z),wanted=flat>2?Math.atan2(-delta.x,-delta.z):yaw;
 const turn=Math.atan2(Math.sin(wanted-yaw),Math.cos(wanted-yaw));
 return {yaw:yaw+clamp(turn,-1.2*dt,1.2*dt),pitch:pitch+clamp(clamp(Math.atan2(-delta.y,Math.max(2,flat)),-1.15,1.15)-pitch,-.9*dt,.9*dt)};
}
export function steadyTargetCamera(camera,point,previous,dt){
 const delta=point.clone().sub(camera.position),flat=Math.hypot(delta.x,delta.z);
 if(delta.lengthSq()<.01){camera.quaternion.copy(previous);return;}
 // Preserve a defined horizontal heading at the vertical pole.
 if(flat<.1){const forward=new T.Vector3(0,0,-1).applyQuaternion(previous);delta.x=forward.x*.1;delta.z=forward.z*.1;if(Math.hypot(delta.x,delta.z)<.001)delta.z=-.1;}
 const horizontal=Math.hypot(delta.x,delta.z);delta.y=clamp(delta.y,-horizontal*6,horizontal*6);
 camera.up.set(0,1,0);camera.lookAt(camera.position.clone().add(delta));
 const desired=camera.quaternion.clone();camera.quaternion.copy(previous).rotateTowards(desired,2.4*dt);
}
