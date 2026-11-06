import assert from 'node:assert/strict';
import * as T from './dist/vendor/three.module.js';
import {createPunches} from './dist/punches.js';
import {createCombat} from './dist/combat-rules.js';
import {createHealth} from './dist/health.js';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),noop=()=>{};
for(const fps of [15,30,60,144]){
 const scene=new T.Scene(),hits=[],fx=[],combat=createCombat({onHeroImpact:(p,d,k,b,a,id)=>fx.push(id)}),targets=[];
 for(const z of [30,150,300]){const h=createHealth(),events=[];targets.push({z,h,events});combat.register({id:String(z),position:()=>v(0,39.5,z),height:()=>2.2,health:h,onHit:r=>events.push(r)});}
 const moving=createHealth(),p=v(200,39.5,220);combat.register({id:'moving',position:()=>p,height:()=>2.2,health:moving,onHit:r=>hits.push(r)});
 const system=createPunches(scene,{hero:{character:{id:'monolith',height:28},root:{position:v()}},buildings:[],combat,destruction:{punchFalling:noop,plume:noop,roadBurst:noop},groundDamage:{punch:noop},cityLife:{shock:noop,punch:noop},groundHeight:()=>0});
 system.state.press('normal',v(0,0,1));let age=0;
 for(let i=0;i<fps*5;i++){
  combat.update(1/fps);system.update(1/fps,v());const ring=scene.children[0];if(ring)age+=1/fps;
  if(age>.5)p.x=0;
  for(const t of targets){if(ring&&ring.position.z<t.z-1e-7)assert.equal(t.h.value,1000,'no damage before visible front');if(t.h.value<1000&&!t.checked){t.checked=true;assert(ring.position.z>=t.z);assert(ring.position.z-t.z<=210/fps+1e-6);assert.equal(t.events[0].mode,'impact-hold');assert(fx.includes(String(t.z)));}}
 }
 for(const t of targets){assert.equal(t.h.value,800);assert.deepEqual(t.events.map(e=>e.mode),['impact-hold','launch']);}assert.equal(moving.value,800,'moving hero enters live front');assert.equal(hits.length,2);system.reset();assert.equal(scene.children.length,0);
}
console.log('PASS: swept visible front at 15/30/60/144 FPS, near/mid/300m arrivals, simultaneous impact/damage/hold, delayed single launch, moving target, reset.');
