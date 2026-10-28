import {PUNCHES} from './punches.js';
import {CAR_THROW_SPEED,MAX_LAUNCH_SPEED,addLaunchMomentum} from './combat-rules.js';
import {THROW_RELEASE,THROW_DURATION} from './grab-pose.js';
import * as T from './vendor/three.module.js';
export function createGrab(scene,{life,hero,aimAt=null,combat=null,actorId='player',network=null,isFlying=()=>false}){
 let phase='idle',age=0,cooldown=0,target=null,carPose=false,tacklePunches=0,tackleSpent=false;
 const direction=new T.Vector3(0,0,1);let shake=0,tackle=false,flightCarry=false;const carryVelocity=new T.Vector3();
 // Two reusable additive sprites: a blue starburst and a white-hot core.
 const pixels=new Uint8Array(64*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){const dx=(x-31.5)/31.5,dy=(y-31.5)/31.5,r=Math.hypot(dx,dy),rays=Math.exp(-Math.abs(dx)*32)*Math.max(0,1-Math.abs(dy))+Math.exp(-Math.abs(dy)*32)*Math.max(0,1-Math.abs(dx)),i=(y*64+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.min(255,255*(Math.max(0,1-r)**3*.7+rays));}
 const texture=new T.DataTexture(pixels,64,64);texture.needsUpdate=true;
 const spark=new T.Sprite(new T.SpriteMaterial({map:texture,color:'#39afff',transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
 const core=new T.Sprite(new T.SpriteMaterial({map:texture,color:'#edfcff',transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
 spark.add(core);core.scale.setScalar(.4);spark.visible=false;scene.add(spark);
 const stats={grabs:0,throws:0,misses:0};
 function press(){if(tackle)return false;if(phase==='hold'){phase='throw';age=0;return true;}if(phase!=='idle'||cooldown>0)return false;phase='windup';age=0;return true;}
 function spendTackle(force=false){if(tackle&&target&&(!target.pending||force)&&!target.actor.cut&&!tackleSpent){tacklePunches=5;tackleSpent=true;}}
 function countPunch(){tacklePunches=Math.max(0,tacklePunches-1);}
 function reset(){spendTackle(true);if(target)(target.kind==='hero'?network:life).releaseGrab(target,target.kind==='hero'?null:new T.Vector3());target=null;tackle=false;phase='idle';age=0;cooldown=0;shake=0;spark.visible=false;}
 function startTackle(id,v){
  if(phase!=='idle'||cooldown>0||tacklePunches>0)return false;
  target=network?.acquireGrab(id,'tackle')||null;if(!target)return false;
  tackle=true;tackleSpent=false;spendTackle();carPose=false;carryVelocity.copy(v);direction.copy(v).normalize();phase=target.pending?'pending':'tackle';age=0;stats.grabs++;return true;
 }
 function endTackle(slam=false){if(!tackle||!target)return false;spendTackle(true);
  const launch=carryVelocity.clone();if(slam)launch.y=-Math.max(45,Math.abs(launch.y));launch.clampLength(0,MAX_LAUNCH_SPEED);
  network.releaseGrab(target,launch);target=null;tackle=false;phase='recover';age=0;cooldown=.8;shake=slam?1:.35;return true;
 }
 function update(dt,player,aim,inherited=new T.Vector3(),moving=true){
  direction.copy(tackle&&inherited.lengthSq()>1?inherited:aim).normalize();flightCarry=isFlying()&&inherited.length()>8&&!carPose;cooldown=Math.max(0,cooldown-dt);age+=dt;shake=Math.max(0,shake-dt*4);
  if(target?.actor.cut){target=null;tackle=false;phase='recover';age=0;}
  if(phase==='windup'&&age>=.24){const origin=player.clone().add(new T.Vector3(0,1.45*hero.character.height,0));const defender=combat?.trace(origin,direction,isFlying()?PUNCHES.normal.reach+2.5:4.4*hero.character.height,.7,actorId);if(defender){target=network?.acquireGrab(defender.id)||null;}else target=life.acquireGrab(origin,direction,4.4*hero.character.height);
   if(target){phase=target.pending?'pending':'hold';carPose=target.kind==='car';stats.grabs++;}else{phase='recover';stats.misses++;}age=0;
  }
  if(phase==='pending'&&target&&!target.pending){spendTackle();phase=tackle?'tackle':'hold';age=0;}
  if(tackle&&target){if(!isFlying()||!moving||inherited.length()<8)endTackle();else{carryVelocity.copy(inherited);if(phase==='tackle'&&age>=2)endTackle();}}
  if(phase==='hold'&&age>3){phase='throw';age=0;}
  if(phase==='throw'&&age>=THROW_RELEASE&&target){const r=target.actor.reaction,origin=r?new T.Vector3(r.x,r.y+(target.kind==='car'?.9:.6),r.z):hero.grabHand(),speed=target.kind==='car'?CAR_THROW_SPEED:target.kind==='hero'?135:170;
   const shot=aimAt?.(origin),launch=shot?shot.target.clone().sub(origin).normalize().multiplyScalar(speed):direction.clone().multiplyScalar(speed);
   // Compensate ballistic drop at the same aim point as heat vision.
   if(shot)launch.y+=9*origin.distanceTo(shot.target)/speed;
   addLaunchMomentum(launch,inherited);
   (target.kind==='hero'?network:life).releaseGrab(target,launch);target=null;stats.throws++;shake=1;}
  if((phase==='throw'&&age>THROW_DURATION)||(phase==='recover'&&age>.32)){phase='idle';cooldown=.55;age=0;}
  return phase==='idle'?null:{phase,age,direction:direction.clone(),car:carPose,flightCarry,tackle};
 }
 function attach(){
  if(phase==='idle'){spark.visible=false;return;}
  const hand=hero.grabHand(),throwFlash=phase==='throw'&&age>=THROW_RELEASE&&age<THROW_RELEASE+.20;
  spark.visible=phase==='windup'||throwFlash;
  spark.position.copy(hand);spark.scale.setScalar(throwFlash?3.8:2.4+Math.sin(age*55)*.35);
  spark.material.rotation=age*5;spark.material.opacity=throwFlash?Math.max(0,1-(age-THROW_RELEASE)/.20):.95;
  core.material.opacity=spark.material.opacity;
  if(target){const anchor=hand.clone();if(target.kind==='car')anchor.addScaledVector(direction,1.3);if(target.kind!=='hero')life.positionGrab(target,anchor,direction);}
 }
 return {press,update,attach,reset,countPunch,get tacklePunches(){return tacklePunches;},startTackle,endTackle,stats,get tackling(){return tackle&&!!target;},get targetId(){return target?.id;},get confirmedTargetId(){return target&&!target.pending?target.id:null;},get pose(){return phase==='idle'?null:{phase:phase==='pending'?'windup':phase,age,direction:direction.toArray(),car:carPose,flightCarry,tackle};},get shake(){return shake;},get carrying(){return !!target;},get active(){return phase!=='idle';},get phase(){return phase;},get cooldown(){return cooldown;}};
}
