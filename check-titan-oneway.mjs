import assert from 'node:assert/strict';
import * as T from './dist/vendor/three.module.js';
import {CollisionWorld} from './dist/collision.js';
const fixtures=[{kind:'branch',a:new T.Vector3(0,0,0),b:new T.Vector3(0,10,0),r:.4},{kind:'vehicle',actor:{},x:0,z:0,dx:0,dz:1,w:1,l:2,x1:-1,x2:1,z1:-2,z2:2,y1:0,y2:2},{streetProp:true,x1:-1,x2:1,z1:-1,z2:1,y1:0,y2:8},{kind:'convex',actor:{},planes:[],x1:-1,x2:1,z1:-1,z2:1,y1:0,y2:2}];
for(const solid of fixtures){
 const world=new CollisionWorld([solid],()=>0),position=new T.Vector3(0,0,0),offsets=[new T.Vector3(0,1,0)];world.bodyRadius=.3;
 assert(world.bodyHit(position,offsets));world.titanBody=true;
 assert(!world.bodyHit(position,offsets),'object cannot block titan');assert.equal(world.contactAt(position,offsets,.3),null,'no pushback contact');assert.equal(world.floorAt(0,0,10,true),0,'no stepping onto obstacle');
 assert(world.sphereSolid(new T.Vector3(0,1,0),.3,solid),'outgoing geometric hit remains detectable');
 const before=position.clone();assert(world.recover(position,offsets));assert(position.equals(before),'no recovery shove');
 world.titanBody=false;assert(world.bodyHit(position,offsets),'ordinary heroes remain blocked');
}
const building={building:{},x1:-1,x2:1,y1:0,y2:10,z1:-1,z2:1},world=new CollisionWorld([building],()=>0);world.titanBody=true;assert(world.bodyHit(new T.Vector3(),[new T.Vector3(0,1,0)]));world.setArenaBounds({minX:-10,maxX:10});assert(world.bodyHit(new T.Vector3(11,0,0),[new T.Vector3(0,1,0)]));
console.log('One-way titan collision: trees, cars, props and wreckage cannot block, step, push or recover him; outgoing hits, ordinary heroes, buildings and arena walls remain intact.');
