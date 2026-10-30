import assert from 'node:assert/strict';
import * as T from './dist/vendor/three.module.js';
import {moveTitan} from './dist/titan-movement.js';
import {CollisionWorld} from './dist/collision.js';
const obstacles=[{x1:2,x2:40,y1:0,y2:200,z1:-20,z2:20,building:{}},{kind:'vehicle',x:0,z:0,dx:0,dz:1,w:1,l:2,x1:-1,x2:1,y1:0,y2:2,z1:-2,z2:2}];
const world=new CollisionWorld(obstacles,()=>-20);world.setArenaBounds({minX:-100,maxX:100,minZ:-100,maxZ:100,minY:-64,maxY:900});
const p=new T.Vector3(0,.455,0),v=new T.Vector3(36,0,0);let grounded=true;
for(let i=0;i<120;i++){const result=moveTitan(p,v,-24/60,1/60,{grounded,ground:()=>.455,confine:(p,v)=>world.confine(p,v,8)});grounded=result.grounded;assert.equal(p.y,.455);assert.equal(v.x,36);assert(grounded);}
assert(Math.abs(p.x-72)<1e-8,'constant speed through building and vehicle');
let vertical=24;grounded=false;let peak=p.y;
for(let i=0;i<150;i++){vertical-=24/60;const result=moveTitan(p,new T.Vector3(),vertical,1/60,{grounded,ground:()=>.455});grounded=result.grounded;vertical=result.vertical;peak=Math.max(peak,p.y);}
assert(peak>10);assert(grounded);assert.equal(p.y,.455);
const edge=new T.Vector3(91,.455,0),speed=new T.Vector3(54,0,0);moveTitan(edge,speed,-.4,.04,{grounded:true,ground:()=>.455,confine:(p,v)=>world.confine(p,v,8)});assert.equal(edge.x,92);assert.equal(speed.x,0);
console.log('Independent titan movement preserves speed over scenery/craters, supports jump/landing and respects arena bounds.');
