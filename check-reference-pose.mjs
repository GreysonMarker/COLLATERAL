import * as T from './dist/vendor/three.module.js';
import {createHero} from './dist/hero.js';
import {recoveryPose} from './dist/recovery-pose.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const images=[];
for(const progress of [0,.24,.48,.62,.85,1]){const h=createHero(color=>new T.MeshStandardMaterial({color}));for(let i=0;i<60;i++)h.update(1/60,i/60,{flying:false,grounded:true,moving:false,boost:false,vx:0,vy:0,vz:0,groundY:0,groundRecovery:{phase:'rising',grounded:true,progress}});h.root.updateWorldMatrix(true,true);const triangles=[];
for(const m of h.meshes){const p=m.geometry.attributes.position,idx=m.geometry.index;for(let k=0;k<(idx?.count??p.count);k+=3){const face=[];for(let j=0;j<3;j++){const v=new T.Vector3().fromBufferAttribute(p,idx?idx.getX(k+j):k+j).applyMatrix4(m.matrixWorld);assert(v.toArray().every(Number.isFinite));face.push(v.toArray());}triangles.push({p:face,c:'#'+m.material.color.getHexString()});}}images.push({progress,triangles});}
for(let i=0;i<100;i++){const a=recoveryPose(i/100),b=recoveryPose((i+1)/100);for(const key of Object.keys(a))assert(Math.abs(a[key]-b[key])<.2);}fs.writeFileSync(new URL('./pose-meshes.json',import.meta.url),JSON.stringify(images));console.log('Recovery pose continuity and hero geometry checks passed.');
