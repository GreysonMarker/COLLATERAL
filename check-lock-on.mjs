import assert from 'node:assert/strict';
import * as T from './dist/vendor/three.module.js';
import {selectLockTarget} from './dist/lock-on.js';
import {createPracticeDummy} from './dist/practice-dummy.js';
import {createCombat} from './dist/combat-rules.js';
const camera=new T.PerspectiveCamera(62,1,.1,1000);camera.position.set(0,1.32,0);camera.lookAt(0,1.32,-1);camera.updateMatrixWorld();
const actors=new Map();const actor=(id,x,z,active=true)=>actors.set(id,{position:()=>new T.Vector3(x,0,z),active:()=>active});
actor('player',0,-1);actor('near',2,-5);actor('center',0,-40);actor('behind',0,10);actor('inactive',0,-3,false);
assert.equal(selectLockTarget(actors,camera,new T.Vector2(),new T.Vector3()),'center');
assert.equal(selectLockTarget(actors,camera,new T.Vector2(),new T.Vector3(),p=>p.z!==-40),'near');
actors.delete('center');actors.delete('near');assert.equal(selectLockTarget(actors,camera,new T.Vector2(),new T.Vector3()),null);
const combat=createCombat(),scene=new T.Scene(),dummy=createPracticeDummy(scene,combat,()=>0);
const original=dummy.root.position.clone();combat.hit('practice-dummy',{kind:'normal',punch:true,attacker:'player',direction:new T.Vector3(0,0,-1)});dummy.update(.1,new T.Vector3());assert(dummy.root.position.distanceTo(original)>1);assert.equal(dummy.hits,1);
const captured=dummy.acquire();assert.equal(captured.kind,'hero');dummy.update(.1,new T.Vector3(5,10,3));assert.equal(dummy.root.position.x,5);dummy.release(new T.Vector3(0,20,10));dummy.update(.1,new T.Vector3());assert(dummy.root.position.z>3);dummy.reset();assert(dummy.root.position.equals(original));
console.log('PASS: screen-space selection, visibility filter, inactive/self/behind exclusion, dummy damage, hold, throw, reset');
const {createGrab}=await import('./dist/grab.js');
let flying=false,actorReach=0,npcReach=0;
const grabs=createGrab(new T.Scene(),{hero:{character:{height:1}},isFlying:()=>flying,combat:{trace(o,d,r){actorReach=r;return null;}},life:{acquireGrab(o,d,r){npcReach=r;return null;}}});
const tryGrab=()=>{grabs.reset();grabs.press();grabs.update(.25,new T.Vector3(),new T.Vector3(0,0,-1));};
tryGrab();assert.equal(actorReach,4.4);assert.equal(npcReach,4.4);flying=true;tryGrab();assert.equal(actorReach,7.5);assert.equal(npcReach,4.4);
console.log('PASS: flying-only hero grab extension; ground and civilian/car ranges unchanged');
// Selection and retention are not bounded by world distance or the far plane.
actor('distant',0,-1000000);assert.equal(selectLockTarget(actors,camera,new T.Vector2(),new T.Vector3()),'distant');
const {createLockOn}=await import('./dist/lock-on.js');
const distanceLabel={textContent:'',style:{}},label={textContent:''},button={setAttribute(){},querySelector(){return label;}},dot={hidden:true,style:{},querySelector:()=>distanceLabel};
let visible=true;const lock=createLockOn({combat:{actors},camera,player:new T.Vector3(),button,dot,reticle:()=>new T.Vector2(),visible:()=>visible});lock.toggle();assert.equal(lock.id,'distant');visible=false;assert(lock.update(100));assert.equal(lock.id,'distant');lock.draw();assert.equal(dot.hidden,false);assert.equal(distanceLabel.textContent,'1000000 m');actor('distant',0,-100);lock.draw();assert.equal(distanceLabel.textContent,'100 m');actors.delete('distant');lock.update();assert.equal(lock.id,null);
console.log('PASS: unlimited distance, far-plane selection, occlusion retains lock, despawn clears lock');
// A held actor suspends assistance through the throw windup; release restores it.
let releases=0;const heldTarget={id:'practice-dummy',kind:'hero',actor:{}};
const holdSystem=createGrab(new T.Scene(),{hero:{character:{height:1},grabHand:()=>new T.Vector3()},life:{},combat:{trace:()=>({id:heldTarget.id})},network:{acquireGrab:()=>heldTarget,releaseGrab(){releases++;}}});
holdSystem.press();holdSystem.update(.25,new T.Vector3(),new T.Vector3(0,0,1));assert(holdSystem.carrying);holdSystem.press();holdSystem.update(.05,new T.Vector3(),new T.Vector3(1,0,0));assert(holdSystem.carrying);holdSystem.update(1,new T.Vector3(),new T.Vector3(1,0,0));assert(!holdSystem.carrying);assert.equal(releases,1);
console.log('PASS: assistance suspension lasts through holding and ends at throw release');
// Starting a fight can explicitly acquire its opponent, even off-screen/occluded.
assert.equal(lock.lock('behind'),true);assert.equal(lock.id,'behind');assert.equal(label.textContent,'LOCKED');
lock.toggle();assert.equal(lock.id,null);
for(const id of ['player','inactive','missing']){assert.equal(lock.lock(id),false);assert.equal(lock.id,null);}
console.log('PASS: explicit opponent lock, manual unlock, invalid target rejection');
