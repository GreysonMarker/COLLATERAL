import * as T from './vendor/three.module.js';
// Unit-mass contact impulse. Tangential friction is limited by the normal hit:
// glancing blows retain their slide instead of losing all forward motion.
export function resolveImpact(velocity,contact,orientation,{powered=false}={}){
 const normal=contact.normal,closing=-velocity.dot(normal);
 if(closing<=0)return null;
 const before=velocity.clone(),tangent=before.clone().addScaledVector(normal,closing),speed=tangent.length();
 const ground=normal.y>.55,incidence=closing/Math.max(before.length(),.001);
 // Most wall hits deflect. Only the narrow, nearly head-on range absorbs
 // most of the normal speed; tangential movement is never heavily braked.
 const headOn=T.MathUtils.smoothstep(incidence,.82,.995);
 const restitution=!powered&&closing>5?(ground?.24:T.MathUtils.lerp(.88,.34,headOn)):0;
 const rebound=ground?Math.min(18,closing*restitution):closing*restitution;
 const friction=Math.min(speed,closing*(powered?0:ground?.025:.012));
 velocity.copy(tangent).multiplyScalar(speed>0?1-friction/speed:0).addScaledVector(normal,rebound);
 const impulse=velocity.clone().sub(before);
 const arm=contact.offset.clone().addScaledVector(normal,-.28).sub(new T.Vector3(0,1.2,0));
 const angular=new T.Vector3().crossVectors(arm,impulse).multiplyScalar(.16);
 angular.clampLength(0,9).applyQuaternion(orientation.clone().invert());
 const localPoint=arm.clone().applyQuaternion(orientation.clone().invert());localPoint.y+=1.2;
 return {closing,angular,impulse,rebound,localPoint,normal:normal.clone()};
}
// Allow a brief carry-through before flight progressively regains its usual authority.
export function recoveryRate(remaining,normalRate){
 const progress=1-T.MathUtils.clamp(remaining/1.15,0,1);
 return T.MathUtils.lerp(1.15,normalRate,progress*progress);
}
