import assert from 'node:assert/strict';
import * as T from './dist/vendor/three.module.js';
import {createForest} from './dist/forest.js';
const ctx=new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={createElement:()=>({getContext:()=>ctx})};
const scene=new T.Scene(),specs=[{x:0,z:0,h:9},{x:30,z:0,h:9}],forest=createForest(scene,specs,true);
forest.damage(new T.Vector3(0,4,0),5.5);assert(specs[0].broken);assert(!specs[1].broken);assert(forest.solids.slice(specs[0].solidStart,specs[0].solidEnd).every(s=>s.disabled));assert(forest.solids.slice(specs[1].solidStart).every(s=>!s.disabled));
for(let i=0;i<200;i++)forest.update(new T.Vector3(0,3,0),1/60);
const matrix=new T.Matrix4();for(const binding of specs[0].bindings){binding.batch.getMatrixAt(binding.start,matrix);assert.equal(matrix.elements[0],0);assert.equal(matrix.elements[5],0);assert.equal(matrix.elements[10],0);}
for(const mesh of scene.children)assert([...mesh.instanceMatrix.array].every(Number.isFinite));
console.log('Wake topples only nearby trees, clears their collisions, preserves distant trees and cleans up finite instance transforms.');
const {CollisionWorld}=await import('./dist/collision.js');
const trees=[{x:0,z:0,h:9},{x:60,z:0,h:9}],giantForest=createForest(new T.Scene(),trees,true);
const world=new CollisionWorld(giantForest.solids,()=>0),q=new T.Quaternion();
world.bodyRadius=.28*28*.82/.74;
const offsets=world.bodyOffsets(q,false,28,.82/.74),p=new T.Vector3(-10,0,0);
for(let i=0;i<100;i++){
 giantForest.crushBody(p,offsets,world.bodyRadius+.5,world);
 assert(!world.moveAxis(p,'x',.2,offsets),'tree must not block titan');
}
assert(trees[0].broken);assert(!trees[1].broken);
assert(giantForest.solids.slice(trees[0].solidStart,trees[0].solidEnd).every(s=>s.disabled));
assert.equal(giantForest.crushBody(p,offsets,world.bodyRadius+.5,world),0,'broken tree is not repeatedly animated');
console.log('Titan walks through tree, removes all branch collision immediately and preserves distant trees.');
