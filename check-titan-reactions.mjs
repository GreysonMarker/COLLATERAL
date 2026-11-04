import {packMotion,unpackMotion} from './dist/network-codec.js';
import assert from 'node:assert/strict';
import * as T from './dist/vendor/three.module.js';
import {createHero} from './dist/hero.js';
import {createCombat} from './dist/combat-rules.js';
import {createHealth} from './dist/health.js';
import {TITAN_ZONES,TITAN_DIRECTIONS,sampleTitanReaction,titanResponse,createTitanReactions} from './dist/titan-reactions.js';
import {encodeCombatAttack,decodeCombatAttack} from './dist/combat-packet.js';
const hero=createHero(c=>new T.MeshStandardMaterial({color:c}));hero.setAppearance('monolith');
const update=(dt=1/60)=>hero.update(dt,0,{flying:false,grounded:true,moving:false,vx:0,vy:0,vz:0,groundY:0});for(let i=0;i<60;i++)update();
const zones=hero.titanZoneCenters();
let checks=0;
for(const zone of TITAN_ZONES){
 const signatures=new Set();
 for(let direction=0;direction<5;direction++){
  const state=titanResponse({kind:'serious',direction:new T.Vector3(0,0,-1)},{zone:zone.id,direction,distance:30,direct:true});
  const pose=sampleTitanReaction(state,.32);const json=JSON.stringify(pose);assert(!json.includes('null'),'finite joint angles');signatures.add(json);checks++;
 }
 assert.equal(signatures.size,5,zone.id+' needs five distinguishable directional clips');
}
for(const zone of TITAN_ZONES){for(const distance of [9.99,10.01,14.99,15.01,100]){
 const r=titanResponse({kind:'serious'},{zone:zone.id,direction:2,distance,direct:true});
 assert.equal(r.special,zone.type==='head'&&distance<=15||zone.type==='core'&&distance<=10);
 assert.equal(titanResponse({kind:'normal'},{zone:zone.id,direction:2,distance:1,direct:true}).special,false);
 assert.equal(titanResponse({kind:'serious'},{zone:zone.id,direction:2,distance:1,direct:false}).special,false);
}}
const head=zones.find(z=>z.id==='front-head-0').point;
const origin=head.clone().add(new T.Vector3(0,0,-12)),dir=new T.Vector3(0,0,1);
const contact=hero.titanHit(origin,dir,{reach:50,width:10.5});assert(contact?.direct);assert(contact.zone.startsWith('front-head'),JSON.stringify(contact));assert(contact.distance<15);
// A gigantic torso capsule used to be hit even with the ray outside the model.
assert.equal(hero.titanHit(new T.Vector3(100,60,0),new T.Vector3(0,0,1),{reach:20,width:2}),null);
const health=createHealth();let hits=0,last=null;const combat=createCombat();combat.register({id:'giant',character:()=> 'monolith',position:()=>hero.root.position,height:()=>61.6,radius:()=>16.8,titanHit:hero.titanHit,health,onHit(r){hits++;last=r;hero.reactTitan(r.titan);}});
combat.punch(origin,dir,'serious',{reach:60,width:10.5},'other','one');assert.equal(hits,1);assert(last.titan.special);assert.equal(health.value,900);
for(let i=0;i<10;i++)combat.punch(origin,dir,'serious',{reach:60,width:10.5},'other','one');assert.equal(hits,1,'one region and one damage event per punch');
assert.equal(last.velocity,undefined);assert.equal(last.distance,0);
for(const kind of ['grab','tackle'])assert(combat.hit('giant',{kind,attacker:'other'}).damageBlocked);
const state=last.titan;
const snap={p:[0,0,0],v:[0,0,0],character:'monolith',active:true,pose:{},titanReaction:{...state,age:.2},health:900};
assert.deepEqual(unpackMotion(packMotion(snap)).titanReaction,snap.titanReaction,'compact multiplayer transport preserves animation');
const invalid=packMotion(snap);invalid[15]={...snap.titanReaction,direction:NaN};assert.equal(unpackMotion(invalid),null);
const ctl=createTitanReactions();ctl.trigger(state);let distance=0;for(let i=0;i<300;i++){ctl.update(1/60);distance+=ctl.consumeMotion().length();}assert(Math.abs(distance-14)<1e-8);assert(!ctl.active);
ctl.trigger(state);ctl.update(.3);assert.equal(ctl.trigger({...state,kind:'normal',special:false}),false,'cannot interrupt fixed recovery');ctl.reset();
for(const dt of [1/30,1/60,1/144]){ctl.trigger(state);let d=new T.Vector3();for(let t=0;t<3.5;t+=dt){ctl.update(dt);d.add(ctl.consumeMotion());}assert(Math.abs(d.length()-14)<1e-7);}
const wire=decodeCombatAttack(encodeCombatAttack({kind:'serious',punch:true,origin,direction:dir,titanHit:contact},'self'),'other');assert(wire.origin.equals(origin));assert.deepEqual(wire.titanHit,contact);
// Generic impacts cannot activate the ragdoll or make the giant tumble.
hero.resetTitan();hero.impact({closing:300,impulse:new T.Vector3(200,100,0),point:head,normal:dir});
for(let i=0;i<180;i++){update();assert(!hero.collisionFeedback?.active);}
// Exercise every region/direction through the actual rig, checking nonaccumulation
// and sole placement for all articulated reactions.
const feet=hero.meshes.filter(m=>m.name==='monolith-concept'&&Math.abs(m.parent.position.y+.47)<1e-6),v=new T.Vector3();
for(const z of TITAN_ZONES)for(let direction=0;direction<5;direction++){
 hero.resetTitan();hero.reactTitan(titanResponse({kind:'serious'},{zone:z.id,direction,distance:40,direct:true}));
 for(let i=0;i<4;i++){update(.12);hero.root.updateMatrixWorld(true);let low=Infinity;for(const m of feet){const p=m.geometry.attributes.position;for(let j=0;j<p.count;j++){v.fromBufferAttribute(p,j).applyMatrix4(m.matrixWorld);low=Math.min(low,v.y);}}assert(Math.abs(low-.025)<1e-6,z.id+' soles');}
}
hero.resetTitan();for(let i=0;i<180;i++)update();assert.equal(hero.titanReaction,null);assert(hero.root.position.equals(new T.Vector3()));
console.log(`${TITAN_ZONES.length} full-body regions / ${checks} directional clips: geometry hits, single-hit damage, thresholds, fixed displacement at 30/60/144 FPS, network payload, ragdoll exclusion and planted soles pass.`);
