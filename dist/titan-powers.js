import * as T from './vendor/three.module.js';
// Shared tuning for all titan-class character controllers and remote animation.
export const TITAN_POWER={leapCooldown:10,leapRange:180,leapDuration:2.5,leapWindup:.55,leapHeight:38,windup:1.25,duration:2.6,cooldown:3.2,reach:337.5,width:26.25,spread:30/337.5,damage:200,impactHold:.16,beamWindup:1.2,beamRadius:10.5,beamRange:337.5,beamTurnRate:.32};
export const isTitan=c=>typeof c==='string'?c==='monolith':c?.combatClass==='titan'||c?.id==='monolith';
export function steerTitan(current,wanted,dt,rate){
 const target=wanted.clone().normalize();if(!target.lengthSq())return current;
 const angle=current.angleTo(target);if(angle<1e-7)return current.copy(target);
 const q=new T.Quaternion().setFromUnitVectors(current.clone().normalize(),target);
 current.applyQuaternion(new T.Quaternion().slerp(q,Math.min(1,rate*dt/angle))).normalize();return current;
}
export function titanStrikeType(origin,target,height){return target&&target.y<origin.y+height*1.05?'kick':'punch';}
export function createTitanLeap(){
 let age=-1,cooldown=0,start=new T.Vector3(),direction=new T.Vector3();
 return {get active(){return age>=0;},get cooldown(){return cooldown;},get age(){return age;},
 press(p,d,grounded){if(age>=0||cooldown>0||!grounded)return false;age=0;cooldown=TITAN_POWER.leapCooldown;start.copy(p);direction.copy(d).setY(0);if(direction.lengthSq()<.001)direction.set(0,0,1);direction.normalize();return true;},
 update(dt,p,v,ground,confine){cooldown=Math.max(0,cooldown-dt);if(age<0)return null;age+=dt;const t=T.MathUtils.clamp((age-TITAN_POWER.leapWindup)/TITAN_POWER.leapDuration,0,1),previous=p.clone();p.copy(start).addScaledVector(direction,TITAN_POWER.leapRange*t);p.y=ground(p.x,p.z)+4*TITAN_POWER.leapHeight*t*(1-t);v.copy(p).sub(previous).divideScalar(Math.max(dt,.00001));confine?.(p,v);const landed=t>=1;if(landed){age=-1;v.set(0,0,0);}return {grounded:t===0||landed,landed};},
 cancel(){age=-1;},reset(){age=-1;cooldown=0;}};
}
export function titanAttackPose(age,type){
 const smooth=(a,b)=>T.MathUtils.smoothstep(age,a,b),wind=smooth(0,.85),drive=smooth(.85,TITAN_POWER.windup),recover=1-smooth(1.55,TITAN_POWER.duration);
 return {weight:smooth(0,.18)*recover,coil:wind*(1-drive)*recover,drive:drive*recover,kick:type==='kick'};
}
