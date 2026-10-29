import assert from 'node:assert/strict';
import {titanLocomotionSafe} from './dist/titan-physics.js';
const base={character:{id:'monolith',height:28},flying:false,vertical:0};
for(const vertical of [0,-1,-12,-40,-73])assert(titanLocomotionSafe({...base,vertical}),'ordinary walking / proportional small falls');
for(const changes of [{vertical:-75},{combat:true},{flying:true},{held:true},{dead:true},{character:{id:'original',height:1}}])assert(!titanLocomotionSafe({...base,...changes}),'preserve combat and large fall reactions');
const {readFileSync}=await import('node:fs');
const html=readFileSync('dist/index.html','utf8');const map=JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
assert(map.imports['./titan-physics.js'].endsWith('titan-mass-v4'));
console.log('Titan movement immunity, proportional falls, combat exclusions and release map pass.');
