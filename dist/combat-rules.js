import * as T from './vendor/three.module.js';
import {ATTACK_DAMAGE} from './health.js';
export const MAX_LAUNCH_SPEED=600;
export function addLaunchMomentum(launch,momentum){if(momentum)launch.add(momentum);return launch.clampLength(0,MAX_LAUNCH_SPEED);}
export const PARRY_WINDOW=13/30, PARRY_RECOVERY=.5, PARRY_COOLDOWN=2.5, QUICK_STUN=2.2;
export const CAR_THROW_SPEED=135, THROW_GRAVITY=18, THROW_REFERENCE_ANGLE=35*Math.PI/180, PUNCH_LAUNCH_ANGLE=8*Math.PI/180;
// Clear, level-ground range at the existing car launch speed and gravity.
export const SERIOUS_NPC_RANGE=CAR_THROW_SPEED**2*Math.sin(2*THROW_REFERENCE_ANGLE)/THROW_GRAVITY;
export function punchResponse(kind,{hero=false,blocking=false}={}){
 const factor={quick:1/6,normal:1/3,serious:1}[kind];
 if(factor===undefined)throw new Error('Unknown punch: '+kind);
 if(hero&&kind==='quick')return {distance:0,stun:blocking?0:QUICK_STUN,mode:'stun',damageBlocked:blocking};
 return {distance:SERIOUS_NPC_RANGE*factor*(hero?.5:1)*(hero&&blocking?.5:1),stun:0,mode:hero&&blocking&&kind==='normal'?'slide':'launch',damageBlocked:blocking};
}
export function launchForRange(distance,direction,gravity=THROW_GRAVITY){
 const flat=new T.Vector3(direction.x,0,direction.z);if(flat.lengthSq()<.0001)flat.set(0,0,1);flat.normalize();
 const speed=Math.sqrt(Math.max(0,distance)*gravity/Math.sin(2*PUNCH_LAUNCH_ANGLE));return flat.multiplyScalar(speed*Math.cos(PUNCH_LAUNCH_ANGLE)).setY(speed*Math.sin(PUNCH_LAUNCH_ANGLE));
}
export function createDefense(){
 let phase='idle',age=0,cooldown=0,held=false,stun=0,success=false;
 return {
  get phase(){return phase;},get age(){return age;},get cooldown(){return cooldown;},get stun(){return stun;},get successful(){return success;},
  get parrying(){return phase==='parry';},get vulnerable(){return phase==='vulnerable';},
  get blocking(){return held&&phase==='idle'&&stun<=0;},get locked(){return phase!=='idle'||stun>0;},get busy(){return this.locked||this.blocking;},
  hold(value){held=!!value;},parry(){if(cooldown>0||phase!=='idle'||stun>0)return false;phase='parry';age=0;cooldown=PARRY_COOLDOWN;success=false;return true;},
  markSuccess(){if(phase==='parry')success=true;},stagger(seconds){stun=Math.max(stun,seconds);held=false;},
  update(dt){cooldown=Math.max(0,cooldown-dt);stun=Math.max(0,stun-dt);age+=dt;
   if(phase==='parry'&&age>=PARRY_WINDOW){age-=PARRY_WINDOW;phase='vulnerable';}
   if(phase==='vulnerable'&&age>=PARRY_RECOVERY){age=0;phase='idle';}
  },
  clearStun(){stun=0;},
  reset(){phase='idle';age=cooldown=stun=0;held=success=false;}
 };
}
// Shared by the player and future hero/villain controllers. A hit carries its
// attacker and an optional redirect callback for persistent beams/projectiles.
export function createCombat({onHeroImpact=()=>{},onParry=()=>{}}={}){
 const actors=new Map();let clock=0;const seen=new Map();
 function hit(targetId,attack){
  const target=actors.get(targetId);if(!target||target.health?.dead||attack.attacker===targetId||attack.scenery&&target.character?.()==='monolith')return {ignored:true};
  const key=attack.id!==undefined?targetId+':'+attack.id:null;
  if(key&&seen.has(key))return {ignored:true};if(key)seen.set(key,clock+(attack.continuous?.09:10));
  if(target.forwardHit){target.forwardHit(attack);return {forwarded:true};}
  if(attack.kind==='collision'){target.health?.suppressImpacts();const damage=target.health?.damage(Math.min(60,Math.max(0,attack.damage||0)))||0;return {damage};}
  const defense=target.defense,position=target.position().clone(),direction=attack.direction?.clone()||new T.Vector3(0,0,1);
  if(defense?.parrying&&!attack.reflected){
   defense.markSuccess();const attacker=actors.get(attack.attacker),returnDir=attacker?attacker.position().clone().sub(position).normalize():direction.clone().negate();
   onParry(position,returnDir);if(attack.redirect)attack.redirect(returnDir,targetId);
   else if(attacker)hit(attack.attacker,{...attack,id:undefined,attacker:targetId,direction:returnDir,momentum:attack.momentum?returnDir.clone().multiplyScalar(attack.momentum.length()):undefined,reflected:true});
   if(attack.punch)onHeroImpact(position,direction,attack.kind,true);
   return {parried:true,damageBlocked:true,direction:returnDir};
  }
  const blocking=!!defense?.blocking&&!(attack.kind==='grab'&&attack.reflected);
  const result=attack.punch?punchResponse(attack.kind,{hero:true,blocking}):{distance:0,stun:blocking?0:attack.kind==='grab'?(attack.reflected?1:.5):.12,mode:'stun',damageBlocked:blocking};
  if(attack.punch&&result.distance>0&&attack.momentum?.lengthSq()>0){result.momentum=attack.momentum.clone().multiplyScalar(blocking?.5:1);result.velocity=addLaunchMomentum(launchForRange(result.distance,direction,24),result.momentum);}
  if(attack.velocity&&!attack.punch){result.velocity=attack.velocity.clone().multiplyScalar(blocking?.5:1);result.mode='launch';}
  if(result.distance>0||result.velocity)target.health?.launch();
  result.damage=target.health?.damage(blocking&&attack.kind!=='clash'?0:(ATTACK_DAMAGE[attack.kind]||0))||0;
  if(result.stun)defense?.stagger(result.stun);
  if(attack.punch)onHeroImpact(position,direction,attack.kind,blocking);
  target.onHit?.({...result,blocking,direction,attack});return result;
 }
 function trace(origin,direction,reach,width=0,exclude=null,accept=null){
  const ray=new T.Ray(origin,direction),at=new T.Vector3();let closest=null;
  for(const [id,a]of actors){if(id===exclude||a.active&&!a.active()||accept&&!accept(a))continue;const p=a.position(),radius=(a.radius?.()||.7)+width,height=a.height?.()||2.2;
   const box=new T.Box3(new T.Vector3(p.x-radius,p.y-width,p.z-radius),new T.Vector3(p.x+radius,p.y+height+width,p.z+radius));
   let distance;if(box.containsPoint(origin))distance=0;else if(ray.intersectBox(box,at))distance=origin.distanceTo(at);else continue;
   if(distance>reach)continue;if(!closest||distance<closest.distance)closest={id,distance};}
  return closest;
 }
 return {register(actor){actors.set(actor.id,actor);return ()=>actors.delete(actor.id);},hit,trace,
  punch(origin,direction,kind,spec,attacker='player',id){for(const [target,a]of actors){if(target===attacker)continue;const center=a.position().clone().add(new T.Vector3(0,(a.height?.()||2.2)*.5,0)),delta=center.sub(origin),along=delta.dot(direction),width=spec.width+(spec.spread||0)*Math.max(0,along)+(a.radius?.()||.7);if(along<Math.max(-.5,spec.minDistance??-.5)||along>Math.min(spec.reach,spec.maxDistance??spec.reach)||delta.addScaledVector(direction,-along).lengthSq()>width*width)continue;hit(target,{id,kind,punch:true,attacker,direction,origin,momentum:spec.momentum});}},
  update(dt){clock+=dt;for(const [key,expiry]of seen)if(expiry<=clock)seen.delete(key);},reset(){seen.clear();},get actors(){return actors;}
 };
}
