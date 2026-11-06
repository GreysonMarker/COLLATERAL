import assert from 'node:assert/strict';
import * as T from './dist/vendor/three.module.js';
import {titanResponse,createTitanReactions,sampleTitanReaction} from './dist/titan-reactions.js';
import {punchResponse,SERIOUS_NPC_RANGE} from './dist/combat-rules.js';
import {createCombatAI} from './dist/combat-ai.js';
import {createTitanLeap} from './dist/titan-powers.js';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
for(const kind of ['quick','normal','serious']){const factor={quick:1/6,normal:1/3,serious:1}[kind];assert.equal(punchResponse(kind).distance,SERIOUS_NPC_RANGE*factor);if(kind!=='quick')assert.equal(punchResponse(kind,{hero:true}).distance,SERIOUS_NPC_RANGE*factor*.5);}
for(const face of ['front','back'])for(const side of [-1,0,1])for(const direct of [false,true]){
 const head=titanResponse({kind:'serious',direction:v(0,0,face==='front'?-1:1)},{zone:face+'-head-'+side,direction:2,distance:90,direct});assert(head.headStun);assert.equal(head.duration,1.8);assert.equal(head.distance,28);const pose=sampleTitanReaction(head,.7);assert(pose.headGuard.weight>.99);assert.equal(pose.lift,0);
 const controller=createTitanReactions();controller.trigger(head);controller.update(1);assert(controller.locked);assert(!controller.trigger(head));controller.update(.81);assert(!controller.locked);
}
assert.equal(titanResponse({kind:'serious'},{zone:'front-mid-chest',direct:true,distance:9}).distance,20);
assert.equal(titanResponse({kind:'serious',titanStrike:true},{zone:'front-mid-chest',direct:true,distance:9}).distance,10);
assert.equal(titanResponse({kind:'normal'},{zone:'front-head-0',direct:true,distance:5}).headStun,false);
const ai=createCombatAI(()=>.5),observation={position:v(),velocity:v(),alive:true,distance:50,height:28,aimPoints:{head:v(0,61,0),chest:v(0,48,0)}};let headCount=0,chestCount=0;for(let i=0;i<30;i++){const d=ai.update(.5,observation,{canAttack:()=>false});headCount+=d.aimRegion==='head';chestCount+=d.aimRegion==='chest';assert(d.seen.aimPoints.head!==observation.aimPoints.head);}assert(headCount>=8&&headCount<=12);assert(chestCount>=18);
const leap=createTitanLeap();leap.press(v(),v(0,0,1),true);leap.update(.5,v(),v(),()=>0);leap.cancel();assert(!leap.active);assert.equal(leap.cooldown,9.5);
console.log('PASS: ordinary knockback unchanged; Monolith-only 28/20m hero serious displacement; all head regions stagger 1.8s without lifting/falling; interruption lock; head/chest perception mix; cancelled leap retains cooldown.');
