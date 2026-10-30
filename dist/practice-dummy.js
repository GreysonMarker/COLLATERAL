import {createDefenseFX} from './defense-fx.js';
import {createCombatAI} from './combat-ai.js';
import {createPunches} from './punches.js';
import {createHeatVision} from './heat-vision.js';
import {FLIGHT_SPEEDS} from './flight-modes.js';
import * as T from './vendor/three.module.js';
import {createHealth} from './health.js';
import {createHero} from './hero.js';
import {createDefense,launchForRange} from './combat-rules.js';
import {createGroundRecovery,restingOnSolid} from './ground-recovery.js';
import {resolveImpact} from './impact.js';
import {coast} from './air-momentum.js';
// An idle hero: same rig, body capsule, gravity, collision impulses and recovery
// as the controlled character. No AI locomotion and no automatic teleport home.
export function createPracticeDummy(scene,combat,ground,{world,material=c=>new T.MeshStandardMaterial({color:c}),destruction=null,groundDamage=null,arena=null,getOpponent=()=>null,random=Math.random}={}){
 const hero=createHero(material),root=hero.root,position=root.position,velocity=new T.Vector3(),defense=createDefense(),recovery=createGroundRecovery();
 const home=new T.Vector3(0,ground(0,159),159);position.copy(home);scene.add(root);
 let held=false,hits=0,time=0,grounded=true,pose={phase:'none',progress:0,grounded:true},enabled=true;
 const defenseFX=arena?createDefenseFX(scene,hero):null;
 const health=createHealth(),brain=createCombatAI(random);let fighting=false,flying=false,launched=false,airTime=0,heading=0,pitch=0,fast=false,moving=false,decision=null,laserIntent=false,stuck=0,lastPosition=position.clone();
 const aimPoint=new T.Vector3(),aimDirection=new T.Vector3(0,0,-1);
 const punches=arena?createPunches(scene,{...arena,buildings:arena.buildings||[],groundHeight:ground,hero,combat,destruction,groundDamage,camera:null,actorId:'practice-dummy',getVelocity:()=>velocity}):null;
 const heat=arena?createHeatVision(scene,{camera:new T.PerspectiveCamera(),hero,destruction,cityLife:arena.cityLife,groundHeight:ground,collisionWorld:world,combat,actorId:'practice-dummy',targetPoint:()=>aimPoint.clone()}):null;
 function cancelAttack(){punches?.state.cancel();heat?.stop();laserIntent=false;}
 function think(dt){
  const enemy=getOpponent();const free=fighting&&enemy&&enemy.alive&&!held&&!health.dead&&!launched&&!recovery.locked&&defense.stun<=0;
  if(!free){defense.hold(false);cancelAttack();if(fighting&&enemy&&!enemy.alive&&!held&&!launched)velocity.multiplyScalar(Math.exp(-dt*5));return;}
  const delta=enemy.position.clone().sub(position),distance=delta.length();
  decision=brain.update(dt,{...enemy,distance,attacking:!!enemy.attacking},{busy:!!punches?.state.current||defense.locked,canAttack:kind=>!!punches?.state.canPress(kind)});
  if(decision.seen){aimPoint.copy(decision.seen.position).add(new T.Vector3(0,1.4*(enemy.height||1),0)).addScaledVector(decision.seen.velocity,.16);aimDirection.copy(aimPoint).sub(position).sub(new T.Vector3(0,1.45*hero.character.height,0)).normalize();heading=Math.atan2(-aimDirection.x,-aimDirection.z);pitch=Math.atan2(-aimDirection.y,Math.hypot(aimDirection.x,aimDirection.z));}
  defense.hold(decision.blocking&&!punches?.state.current);if(decision.parry)defense.parry();
  if(decision.attack&&!defense.busy){heat?.stop();punches?.state.press(decision.attack,aimDirection);}
  laserIntent=decision.laser&&!defense.busy&&!punches?.state.current;
  const floor=world?world.floorAt(position.x,position.z,position.y+.5,true):ground(position.x,position.z);
  if(enemy.flying||enemy.position.y-position.y>3||distance>22)flying=true;
  if(!enemy.flying&&distance<12&&position.y-floor<.6){flying=false;}
  fast=flying;moving=distance>4.4;
  // Fast is the default flight mode; brake only on the final melee approach.
  const speed=flying?Math.min(FLIGHT_SPEEDS.fast,Math.max(5,distance*8)):9;
  const desired=delta.clone();if(flying&&!enemy.flying&&distance>12)desired.y+=3;
  desired.normalize().multiplyScalar(moving?speed:0);
  if(distance<14){desired.x+=Math.cos(heading)*decision.strafe*2.3;desired.z-=Math.sin(heading)*decision.strafe*2.3;}
  if(punches?.state.current||defense.busy)desired.multiplyScalar(punches?.state.current?.kind==='serious'?.15:.4);
  // Climb over obstacles when a low-speed approach stalls; fast collisions use
  // the same destructible building response as the player.
  stuck=position.distanceToSquared(lastPosition)<.0025&&moving?stuck+dt:0;lastPosition.copy(position);
  if(stuck>.45){flying=true;desired.y=Math.max(18,desired.y);desired.x*=.6;desired.z*=.6;}
  const blend=1-Math.exp(-dt*(flying?3.5:7));velocity.x+=(desired.x-velocity.x)*blend;velocity.z+=(desired.z-velocity.z)*blend;
  if(flying){velocity.y+=(desired.y-velocity.y)*blend;grounded=false;}
 }
 const target={id:'practice-dummy',kind:'hero',actor:{get cut(){return health.dead;}}};
 function launch(v){launched=true;airTime=0;flying=false;cancelAttack();health.launch();velocity.copy(v);grounded=false;hero.resetCollision();recovery.reset();pose={phase:'none',progress:0,grounded:false};hero.impact({closing:v.length(),impulse:v.clone(),point:position.clone().add(new T.Vector3(0,1.4*hero.character.height,0)),normal:v.clone().normalize()});}
 const unregister=combat.register({id:'practice-dummy',type:'hero',character:()=>hero.character.id,health,active:()=>enabled&&!health.dead,position:()=>position,height:()=>2.2*hero.character.height,radius:()=>.6*hero.character.height,defense,onHit(r){
  hits++;if(!r.damageBlocked)cancelAttack();if(r.damageBlocked&&r.distance===0&&!r.velocity)return;
  if(r.velocity||r.distance>0)launch(r.velocity||launchForRange(r.distance,r.direction,24));
 }});
 function reset(p=home){defenseFX?.reset();brain.reset();punches?.reset();heat?.reset();flying=launched=false;airTime=stuck=0;health.reset();held=false;position.copy(p);position.y=world?world.floorAt(p.x,p.z,p.y+3,true):ground(p.x,p.z);home.copy(position);velocity.set(0,0,0);hero.resetCollision();recovery.reset();defense.reset();grounded=true;pose={phase:'none',progress:0,grounded:true};}
 function update(dt,hand,carry=null){if(!enabled)return;if(health.update(dt)){reset();return;}time+=dt;defense.update(dt);if(health.dead)flying=false;
  if(launched&&!held&&!grounded){airTime+=dt;if(fighting&&airTime>=2&&!health.dead){launched=false;flying=true;defense.clearStun();hero.resetCollision();recovery.reset();pose={phase:'none',progress:0,grounded:false};}}
  if(grounded&&launched){launched=false;airTime=0;}
  think(dt);
  const previousRadius=world?.bodyRadius,height=hero.character.height;
  if(world)world.bodyRadius=.28*height*hero.character.width/.74;
  try{
   if(held){position.copy(hand).add(new T.Vector3(0,-1.65*height,0));velocity.set(0,0,0);grounded=false;}
   else if(world){
    let offsets=world.bodyOffsets(hero.orientation.quaternion,!grounded,height,hero.character.width/.74);
    world.recover(position,offsets);if(!flying)velocity.y-=24*dt;
    if(!flying&&(!grounded||recovery.active))coast(velocity,0,0,dt);
    if(grounded&&!fighting){const drag=Math.exp(-.85*dt);velocity.x*=drag;velocity.z*=drag;}
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(velocity.x),Math.abs(velocity.y),Math.abs(velocity.z))*dt/.18));let supported=false;
    for(let i=0;i<steps;i++)for(const axis of ['x','z','y']){
     if(!world.moveAxis(position,axis,velocity[axis]*dt/steps,offsets))continue;
     airTime=0;const contact=world.lastContact;if(!contact){velocity[axis]=0;if(axis==='y')supported=true;continue;}
     if(!flying)health.damage(health.impact(contact,velocity));
     const speed=velocity.length(),broken=destruction?.hit(contact,position,velocity,{powered:flying});
     if(contact.normal.y>.5&&!contact.solid)groundDamage?.contact(position.clone().add(contact.offset),velocity,contact.normal);
     if(broken?.pass){if(flying)continue;const bodyHit=resolveImpact(velocity.clone(),contact,hero.orientation.quaternion,{powered:flying});if(bodyHit)hero.impact({...bodyHit,point:position.clone().add(contact.offset)});continue;}
     const impact=resolveImpact(velocity,contact,hero.orientation.quaternion,{powered:flying});
     if(impact){recovery.impact({flying,normal:contact.normal,closing:impact.closing,speed});if(!flying&&impact.closing>6)hero.impact({...impact,point:position.clone().add(contact.offset).addScaledVector(contact.normal,-.28)});}

     if(contact.normal.y>.55&&(!impact||impact.rebound<1.8)){supported=true;velocity.y=0;}
    }
    if(!flying&&!supported&&restingOnSolid(world,position,offsets,velocity.y)){supported=true;velocity.y=0;}
    grounded=supported;pose=recovery.update(dt,{flying,grounded,speed:Math.hypot(velocity.x,velocity.z),body:hero.collisionFeedback});
    if(pose.clearance){hero.resetCollision();offsets=world.bodyOffsets(new T.Quaternion(),false,height,hero.character.width/.74);world.recover(position,offsets);}
    if(recovery.locked)velocity.x=velocity.z=0;
   }else{velocity.y-=24*dt;position.addScaledVector(velocity,dt);if(position.y<=ground(position.x,position.z)){position.y=ground(position.x,position.z);velocity.y=0;velocity.x*=Math.exp(-dt*.85);velocity.z*=Math.exp(-dt*.85);grounded=true;}}
   const punch=punches?.update(dt,position);heat&&(heat.held=laserIntent&&!health.dead&&!held);heat?.update(dt,fighting&&!held&&!health.dead&&!defense.busy&&!launched&&!punch);
   hero.update(dt,time,{health:health.value,punch,heatAim:heat?.active?aimDirection:null,held:held&&carry?{...carry,mode:carry.tackle?'tackle':'grab'}:null,flying,moving:fighting&&moving,boost:fast,grounded,vx:velocity.x,vy:velocity.y,vz:velocity.z,yaw:heading,pitch,groundMode:'walk',groundY:world?world.floorAt(position.x,position.z,position.y+.3,true):ground(position.x,position.z),collisionWorld:world,groundRecovery:pose,defense:{phase:defense.phase,age:defense.age,blocking:defense.blocking,stun:defense.stun}});
   defenseFX?.update(dt,defense);
   if(held&&carry)hero.pinHeld(hand,carry.tackle?'tackle':'grab');
   if(world&&!held){const offsets=world.bodyOffsets(hero.orientation.quaternion,!grounded,height,hero.character.width/.74);world.recover(position,offsets);}
   if(world)world.confine(position,velocity,world.bodyRadius,world.bodyOffsets(hero.orientation.quaternion,!grounded,height,hero.character.width/.74));
  }finally{if(world)world.bodyRadius=previousRadius;}
 }
 return {root,hero,health,reset,update,get fighting(){return fighting;},setCombat(value){fighting=!!value&&!!arena;brain.reset();cancelAttack();punches?.reset();heat?.reset();defense.reset();if(!fighting)flying=false;return fighting;},get airborne(){return !grounded;},get hits(){return hits;},get state(){return {controlledFlight:fighting&&flying&&!grounded&&!held&&!health.dead&&!launched&&!recovery.locked&&!defense.busy,fighting,flying,fast,launched,airTime,attack:punches?.state.current?.kind||null,blocking:defense.blocking,grounded,held,velocity:velocity.toArray(),recovery:pose.phase,body:hero.collisionFeedback};},setCharacter(id){hero.setAppearance(id);reset(position.clone());},acquire(mode='grab'){if(held||!enabled||health.dead)return null;const result=combat.hit('practice-dummy',{kind:mode==='tackle'?'tackle':'grab',attacker:'player',direction:position.clone().sub(combat.actors.get('player')?.position()||position).normalize()});if(result.parried||result.damageBlocked)return null;cancelAttack();flying=false;health.launch();held=true;velocity.set(0,0,0);hero.resetCollision();recovery.reset();return target;},release(v){held=false;if(v)launch(v);},dispose(){defenseFX?.dispose();cancelAttack();punches?.reset();enabled=false;unregister();root.removeFromParent();}};
}
