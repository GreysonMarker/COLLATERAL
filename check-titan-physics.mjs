import assert from 'node:assert/strict';
import {titanLocomotionSafe} from './dist/titan-physics.js';
const base={character:{id:'monolith',height:28},flying:false,vertical:0};
for(const vertical of [0,-1,-12,-40,-73])assert(titanLocomotionSafe({...base,vertical}),'ordinary walking / proportional small falls');
for(const changes of [{vertical:-75},{combat:true},{flying:true},{held:true},{dead:true},{character:{id:'original',height:1}}])assert(!titanLocomotionSafe({...base,...changes}),'preserve combat and large fall reactions');
const {readFileSync}=await import('node:fs');
const html=readFileSync('dist/index.html','utf8');const map=JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
assert(map.imports['./titan-physics.js'].endsWith('titan-oneway-v9'));
console.log('Titan movement immunity, proportional falls, combat exclusions and release map pass.');

const {createGroundField}=await import('./dist/ground-damage.js');
const visible=createGroundField(()=>0),support=createGroundField(()=>0,10);
for(const [x,z,r,d] of [[0,0,9.6,.9],[3,0,4,6],[-3,0,9,4]]){visible.add(x,z,r,d);support.add(x,z,r,d);}
assert(visible.height(0,0)<0);
for(let x=-15;x<=15;x+=.25)assert.equal(support.height(x,0),0,'foot-sized scars cannot trap titan');
support.add(0,0,22.5,5);assert.equal(support.height(0,0),-5,'large blast craters remain physical');
support.add(0,0,4,12);assert.equal(support.height(0,0),-5,'small nested scars cannot deepen titan support');
console.log('Own footprints, overlapping small divots and large crater support pass.');
const T=await import('./dist/vendor/three.module.js');
const {CollisionWorld}=await import('./dist/collision.js');
const flatSupport=createGroundField(()=>0,10);flatSupport.add(0,0,9.6,.9);
const world=new CollisionWorld([],flatSupport.height);world.bodyRadius=.28*28*.82/.74;
const offsets=world.bodyOffsets(new T.Quaternion(),false,28,.82/.74),position=new T.Vector3(-12,0,0);
for(let i=0;i<120;i++){assert(!world.moveAxis(position,'x',.2,offsets));assert(world.moveAxis(position,'y',-.02,offsets));assert(Math.abs(position.y)<.005);}
console.log('Titan capsule crosses its footprint without catching or dropping.');
