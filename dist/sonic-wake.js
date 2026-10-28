import * as T from './vendor/three.module.js';
export function createSonicWake(scene,damage){
 let strength=0,time=0,started=false;const last=new T.Vector3(),direction=new T.Vector3(),center=new T.Vector3(),sample=new T.Vector3(),rear=new T.Vector3();let pulses=0;
 function update(dt,position,velocity,enabled){
  const speed=velocity.length(),active=enabled&&speed>100;time+=dt;strength=T.MathUtils.damp(strength,active?1:0,active?10:15,dt);
  if(speed>1)direction.copy(velocity).normalize();center.copy(position);center.y+=1.2;
  // Preserve the rear hitbox path exactly; allocate no visual meshes or shaders.
  rear.copy(center).addScaledVector(direction,-6.8*(.97+.03*Math.sin(time*12)));
  if(!active){started=false;last.copy(rear);return;}
  if(!started){started=true;last.copy(rear);damage(rear.clone(),3,direction.clone());pulses++;return;}
  const distance=last.distanceTo(rear);if(distance>30){last.copy(rear);return;}const count=Math.min(2,Math.floor(distance/7));
  for(let i=0;i<count;i++){sample.copy(rear).sub(last).normalize().multiplyScalar(7).add(last);last.copy(sample);damage(sample.clone(),3,direction.clone());pulses++;}
 }
 return {update,get stats(){return {active:strength>.1,damagePulses:pulses}}};
}
