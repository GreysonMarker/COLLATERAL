import assert from 'node:assert/strict';
import * as T from './dist/vendor/three.module.js';
import {createHero} from './dist/hero.js';
import {readFileSync} from 'node:fs';
const hero=createHero(c=>new T.MeshStandardMaterial({color:c}));
for(const id of ['pale-king','monolith','ghostshot']){
 hero.setAppearance(id);const meshes=hero.meshes.filter(m=>m.visible&&m.name===id+'-concept');let triangles=0,back=0;
 for(const m of meshes){const p=m.geometry.attributes.position;triangles+=p.count/3;for(let i=0;i<p.count;i++){assert(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));if(p.getZ(i)<-.10)back++;}}
 assert(back>500,'full rear geometry');assert(triangles>5000,'detailed model');
 // The turntable orbits the camera. The character animation remains independent.
 for(let i=0;i<600;i++){hero.update(1/60,i/60,{flying:false,moving:false,boost:false,vx:0,vy:0,vz:0,grounded:true,groundY:0});hero.root.updateMatrixWorld(true);hero.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}
 console.log(id,Math.round(triangles)+' triangles',meshes.length+' merged draws',back+' rear vertices');
}
const menu=readFileSync('./dist/main-menu.js','utf8');assert(!menu.includes('preview.orientation.rotation'));assert(menu.includes('Math.sin(orbit+.40)'));
console.log('Stable idle animation and camera-only turntable verified.');
