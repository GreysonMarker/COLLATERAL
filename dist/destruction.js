import {desktopVisuals,pressureMaterial,vaporMap,finishSurface} from './visual-polish.js';
import {createImpactVisuals} from './impact-visuals.js';
import {prepareSupports,failedSupportLevel,blastOverloaded} from './building-supports.js';
import {addPoly,addBox,floatAttribute} from './destruction-geometry.js';
import * as T from './vendor/three.module.js';
export const NORMAL_DAMAGE_RADIUS=12;
export const HEAT_DAMAGE_RADIUS=.5;
const CELL=4.2,clamp=T.MathUtils.clamp;
const NEIGHBORS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
// Damage depends on inward speed as well as total speed. A fast skim cuts a
// side trench; it only destabilizes the tower if the remaining supports fail.
export function damageProfile(speed,incidence,powered,heightRatio){
 const inward=speed*Math.max(0,incidence),graze=incidence<.36;
 const strength=powered?1:.68;
 const destructive=inward*strength>34||(graze&&speed*strength>65&&inward>2);
 const fast=clamp((speed-83)/45,0,1)*strength;
 return {destructive,graze,fast,radius:graze?1.2+fast*6:1.35+fast*10,
  depth:graze?1.5+fast*5:5+inward*.13,topOnly:heightRatio>.75,
  severe:!graze&&fast>.65,retention:powered?.985:.92};
}
export function supportFailure(removed,total,coreRemoved,coreTotal){
 return removed/Math.max(1,total)>.48||coreRemoved/Math.max(1,coreTotal)>.58&&removed/Math.max(1,total)>.22;
}
function clip(poly,axis,value,sign){
 const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;
 if(da>=-1e-6)out.push(a);if((da>0&&db<0)||(da<0&&db>0)){const t=da/(da-db);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}return out;
}
const bucket=()=>({p:[],n:[],uv:[]});
const key=(x,y,z)=>x+','+y+','+z;
function bounds(s){return new T.Box3(new T.Vector3(s.x1,s.y1,s.z1),new T.Vector3(s.x2,s.y2,s.z2));}

export function createDestruction(scene,world,{concrete,roofmat,mobile=false,camera=null,audio=null}){
 const impactVisuals=createImpactVisuals(scene);
 const supportMaterial=new T.MeshStandardMaterial({color:'#555c65',roughness:.72,metalness:.45});
 const active=new Set(),dirty=new Set(),falling=[],debris=[],dust=[],waves=[],pending=[],rings=[],pressure=[];
 const stats={damagedBuildings:0,removedSections:0,collapses:0,topShears:0,topBlasts:0,secondaryImpacts:0,fractures:0,structuralBodies:0,debris:0};
 let maxDebris=mobile?1536:2048,maxDust=mobile?128:192;let clock=0;
 const rubbleMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:.95,flatShading:true});
 finishSurface(rubbleMaterial,'concrete');
 let debrisMesh=new T.InstancedMesh(new T.IcosahedronGeometry(.62,0),rubbleMaterial,maxDebris);debrisMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);debrisMesh.frustumCulled=false;debrisMesh.castShadow=false;debrisMesh.receiveShadow=true;debrisMesh.count=0;scene.add(debrisMesh);
 // One soft sprite batch, no transparent spheres or per-particle draw calls.
 const pixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const dx=(x-31.5)/31.5,dy=(y-31.5)/31.5,r=Math.sqrt(dx*dx+dy*dy),grain=.83+.17*Math.sin(x*.61+Math.sin(y*.48)*2);const i=(y*64+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.max(0,1-r)**2*grain*255;}
 const texture=new T.DataTexture(pixels,64,64);texture.needsUpdate=true;texture.magFilter=texture.minFilter=T.LinearFilter;
 const dustMat=new T.MeshBasicMaterial({color:'#b1aaa0',map:mobile?texture:vaporMap(),transparent:true,opacity:.52,depthWrite:false});
 dustMat.onBeforeCompile=shader=>{shader.vertexShader='attribute float particleAlpha;varying float vParticleAlpha;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvParticleAlpha=particleAlpha;');shader.fragmentShader='varying float vParticleAlpha;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vParticleAlpha;');};dustMat.customProgramCacheKey=()=> 'meridian-soft-dust-v1';
 const dustGeometry=new T.PlaneGeometry(1,1);let dustAlpha=new T.InstancedBufferAttribute(new Float32Array(maxDust),1);dustAlpha.setUsage(T.DynamicDrawUsage);dustGeometry.setAttribute('particleAlpha',dustAlpha);
 let dustMesh=new T.InstancedMesh(dustGeometry,dustMat,maxDust);dustMesh.frustumCulled=false;dustMesh.count=0;scene.add(dustMesh);

 const spinStep=new T.Quaternion();
 const dummy=new T.Object3D(),fragmentColors=['#a5a29a','#777a7b','#c0bcb2','#6696aa','#a0c8ce'].map(c=>new T.Color(c));
 function spawn(point,velocity,size=1,glass=false){if(debris.length>=maxDebris){maxDebris*=2;const old=debrisMesh;debrisMesh=new T.InstancedMesh(old.geometry,old.material,maxDebris);debrisMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);debrisMesh.frustumCulled=false;debrisMesh.receiveShadow=true;scene.remove(old);old.dispose();scene.add(debrisMesh);}const axis=new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();debris.push({p:point.clone(),v:velocity.clone(),q:new T.Quaternion().setFromAxisAngle(axis,Math.random()*6.28),axis,spin:2+Math.random()*7,size:new T.Vector3(size*(.6+Math.random()*.8),glass?.035+size*.045:size*(.3+Math.random()*.5),size*(.4+Math.random()*.9)),age:0,rest:false,glass,color:glass?fragmentColors[3+Math.floor(Math.random()*2)]:fragmentColors[Math.floor(Math.random()*3)]});const piece=debris[debris.length-1];dummy.position.copy(piece.p);dummy.quaternion.copy(piece.q);dummy.scale.copy(piece.size);dummy.updateMatrix();debrisMesh.setMatrixAt(debris.length-1,dummy.matrix);debrisMesh.setColorAt(debris.length-1,piece.color);debrisMesh.count=debris.length;debrisMesh.instanceMatrix.needsUpdate=true;debrisMesh.instanceColor.needsUpdate=true;stats.debris=debris.length;}
 function cloud(p,scale=1,velocity=null,lifetime=null,opacity=1){if(dust.length>=maxDust){maxDust*=2;const old=dustMesh;dustAlpha=new T.InstancedBufferAttribute(new Float32Array(maxDust),1);dustAlpha.setUsage(T.DynamicDrawUsage);dustGeometry.setAttribute("particleAlpha",dustAlpha);dustMesh=new T.InstancedMesh(dustGeometry,dustMat,maxDust);dustMesh.frustumCulled=false;scene.remove(old);old.dispose();scene.add(dustMesh);}dust.push({p:p.clone(),v:velocity?velocity.clone().multiplyScalar(.07):new T.Vector3(),opacity,scale:Math.min(lifetime?126:14,Math.max(1,scale)),age:0,life:lifetime??(1.6+Math.random()*.9),rotation:Math.random()*6.28});}
 function burst(point,velocity,count=65,spread=2){audio?.destruction(point);for(let i=0;i<count;i++){const offset=new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(spread),v=offset.clone().normalize().multiplyScalar(4+Math.random()*13).addScaledVector(velocity,.10+Math.random()*.16);v.y+=Math.random()*6;spawn(point.clone().add(offset),v,.3+Math.random()**1.4*1.8,i%7===0);}for(let i=0;i<2;i++)cloud(point.clone().add(new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(spread)),spread*.8+2,velocity);}
 function roadBurst(point,direction,radius){
  for(let i=0;i<8;i++){const angle=i*2.399,offset=new T.Vector3(Math.cos(angle),0,Math.sin(angle)).multiplyScalar(radius*(.18+Math.random()*.50)),p=point.clone().add(offset);p.y=world.ground(p.x,p.z)+.8;const v=direction.clone().multiplyScalar(18+Math.random()*24);v.y=15+Math.random()*18;spawn(p,v,2+Math.random()*2,false);const piece=debris[debris.length-1];piece.size.set(2+Math.random()*4,.35+Math.random()*.85,1.5+Math.random()*3);piece.color=new T.Color(i%3===0?'#aaa396':'#414958');}
 }
 const prepared=new Map(),urgent=new Map(),visualJobs=[];
 function* prepare(b){
  let work=0;b.cells=new Map();b.meshes=[];b.bounds=new T.Box3();for(const s of b.solids)b.bounds.union(bounds(s));b.height=b.bounds.max.y-b.bounds.min.y;b.layers=new Map();
  // Keep the original facade triangles and UVs. Cut them into replaceable cells
  // only when a building first takes damage; intact city geometry stays batched.
  for(const s of b.solids){
   for(let x=Math.floor(s.x1/CELL);x<=Math.floor((s.x2-.001)/CELL);x++)for(let y=Math.floor(s.y1/CELL);y<=Math.floor((s.y2-.001)/CELL);y++)for(let z=Math.floor(s.z1/CELL);z<=Math.floor((s.z2-.001)/CELL);z++){
    const k=key(x,y,z);let c=b.cells.get(k);if(!c){c={x,y,z,k,parts:[],surfaces:new Map(),removed:false};b.cells.set(k,c);}
    const part={x1:Math.max(x*CELL,s.x1),x2:Math.min((x+1)*CELL,s.x2),y1:Math.max(y*CELL,s.y1),y2:Math.min((y+1)*CELL,s.y2),z1:Math.max(z*CELL,s.z1),z2:Math.min((z+1)*CELL,s.z2),building:b,cell:c};
    if(s.kind==='convex'){
     const box=bounds(part),points=[];for(const xx of [box.min.x,box.max.x])for(const yy of [box.min.y,box.max.y])for(const zz of [box.min.z,box.max.z])points.push(new T.Vector3(xx,yy,zz));
     if(s.planes.some(p=>points.every(v=>p.distanceToPoint(v)>.001)))continue;
     part.kind='convex';part.planes=[...s.planes,new T.Plane(new T.Vector3(1,0,0),-part.x2),new T.Plane(new T.Vector3(-1,0,0),part.x1),new T.Plane(new T.Vector3(0,1,0),-part.y2),new T.Plane(new T.Vector3(0,-1,0),part.y1),new T.Plane(new T.Vector3(0,0,1),-part.z2),new T.Plane(new T.Vector3(0,0,-1),part.z1)];
    }
    c.parts.push(part);if(++work%32===0)yield;
   }
  }
  for(const r of b.ranges){const g=r.b.geometry,p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;r.originalPositions??=p.array.slice(r.start*3,r.end*3);
   for(let i=r.start;i<r.end;i+=3){let tri=[];for(let j=0;j<3;j++)tri.push([r.originalPositions[(i+j-r.start)*3],r.originalPositions[(i+j-r.start)*3+1],r.originalPositions[(i+j-r.start)*3+2],n.getX(i+j),n.getY(i+j),n.getZ(i+j),u.getX(i+j),u.getY(i+j)]);
    const low=[0,1,2].map(a=>Math.floor(Math.min(...tri.map(v=>v[a]))/CELL)),high=[0,1,2].map(a=>Math.floor((Math.max(...tri.map(v=>v[a]))-1e-7)/CELL));for(let a=0;a<3;a++)high[a]=Math.max(low[a],high[a]);
    for(let x=low[0];x<=high[0];x++)for(let y=low[1];y<=high[1];y++)for(let z=low[2];z<=high[2];z++){
     const k=key(x,y,z);let c=b.cells.get(k);if(!c){c={x,y,z,k,parts:[],surfaces:new Map(),removed:false};b.cells.set(k,c);}
     let poly=tri;for(const [a,index] of [[0,x],[1,y],[2,z]]){poly=clip(poly,a,index*CELL,1);poly=clip(poly,a,(index+1)*CELL,-1);if(poly.length<3)break;}if(++work%32===0)yield;if(poly.length<3)continue;
     if(!c.surfaces.has(r.m))c.surfaces.set(r.m,bucket());addPoly(c.surfaces.get(r.m),poly);
    }
   }

  }
  for(const c of b.cells.values()){if(++work%32===0)yield;c.structural=!!c.parts.length;if(!c.parts.length&&!c.surfaces.size){b.cells.delete(c.k);continue;}const center=new T.Vector3((c.x+.5)*CELL,(c.y+.5)*CELL,(c.z+.5)*CELL);c.center=center;c.core=Math.abs(center.x-b.x)<(b.bounds.max.x-b.bounds.min.x)*.24&&Math.abs(center.z-b.z)<(b.bounds.max.z-b.bounds.min.z)*.24;let l=b.layers.get(c.y);if(!l){l={total:0,removed:0,coreTotal:0,coreRemoved:0};b.layers.set(c.y,l);}if(c.parts.length){l.total++;if(c.core)l.coreTotal++;}}
  // Cell connectivity is fixed; damage changes occupancy, not adjacency. Cache
  // neighbor references once instead of constructing six string keys per flood.
  for(const c of b.cells.values()){c.neighbors=[];for(const [x,y,z] of NEIGHBORS){const n=b.cells.get(key(c.x+x,c.y+y,c.z+z));if(n)c.neighbors.push(n);}if(++work%32===0)yield;}
  yield* prepareSupports(b);
  // Cache small render bands ahead of contact as well as collision cells.
  b.renderBands=new Map();b.renderMeshes=new Map();b.dirtyBands=new Set();
  for(const c of b.cells.values()){if(++work%32===0)yield;const band=Math.floor(c.y/8);if(!b.renderBands.has(band))b.renderBands.set(band,[]);b.renderBands.get(band).push(c);}
  b.liveBands=new Map([...b.renderBands].map(([band,cells])=>[band,cells.length]));b.mesh=new T.Group();
  for(const [band,cells] of b.renderBands){const mesh=yield* geometryTask(b,cells);b.renderMeshes.set(band,mesh);b.mesh.add(mesh);}

 }
 function activate(b){
  if(b.active)return true;const job=prepared.get(b)||{iterator:prepare(b),done:false};
  if(!job.done||!job.registered){prepared.set(b,job);return false;}prepared.delete(b);b.active=true;
  for(const c of b.cells.values())for(const part of c.parts)part.disabled=!!c.removed;
  for(const s of b.solids)s.disabled=true;
  for(const r of b.ranges){const p=r.b.geometry.attributes.position;for(let i=r.start;i<r.end;i++)p.setXYZ(i,0,-10000,0);p.addUpdateRange(r.start*3,(r.end-r.start)*3);p.needsUpdate=true;}
  active.add(b);stats.damagedBuildings++;scene.add(b.mesh);impactVisuals.activate(b);return true;
 }
 function defer(b,action){if(!urgent.has(b))urgent.set(b,[]);urgent.get(b).push(action);stats.queuedImpacts=(stats.queuedImpacts||0)+1;}
 function* registerParts(b){let n=0;for(const c of b.cells.values())for(const part of c.parts){part.disabled=true;world.addStatic(part);if(++n%32===0)yield;}}
 function servicePreparation(b,deadline){let job=prepared.get(b);if(!job){job={iterator:prepare(b),done:false};prepared.set(b,job);}let units=0;while(!job.done&&units++<80&&performance.now()<deadline)job.done=job.iterator.next().done;if(job.done&&!job.registered){job.registration??=registerParts(b);while(!job.registered&&units++<80&&performance.now()<deadline)job.registered=job.registration.next().done;}return job.done&&job.registered;}

 function contactCut(b,point,velocity,profile){const d=velocity.clone().normalize();b.pendingCuts??=[];if(b.pendingCuts.length<32)b.pendingCuts.push({p:point.clone(),d,radius:profile.radius+CELL*.65,depth:profile.depth+CELL});}
 let preparationClock=1,preparationTargets=[];
 function prepareNearby(dt,position,velocity,buildings){
  preparationClock+=dt;
  if(preparationClock>.25){preparationClock=0;const speed=velocity.length(),dx=speed>1?velocity.x/speed:0,dz=speed>1?velocity.z/speed:0;
   preparationTargets=buildings.filter(b=>!b.active).map(b=>{const x=b.x-position.x,z=b.z-position.z,d=x*x+z*z,a=x*dx+z*dz;return {b,d,score:d*(a>0?.35:1)};}).filter(t=>t.d<500*500).sort((a,b)=>a.score-b.score).slice(0,8).map(t=>t.b);
   for(const [b] of prepared)if(!preparationTargets.includes(b)&&!urgent.has(b)){prepared.delete(b);world.removeFragments(b);clearRenderBands(b);b.cells=b.layers=b.supportLayers=null;b.pendingCuts=null;b.detaching=b.rebuilding=false;for(const r of b.ranges)delete r.originalPositions;}
  }
  const start=performance.now();let units=0;
  for(const b of preparationTargets){if(urgent.has(b)||b.active)continue;if(!servicePreparation(b,start+1.5)){stats.preparationMs=performance.now()-start;return;}}
  stats.preparationMs=performance.now()-start;stats.preparedBuildings=[...prepared.values()].filter(j=>j.done).length;
 }
 function* geometryTask(b,cells,cut=true,section=false){
  const selected=section?new Set(cells.map(c=>c.k)):null;
  const groups=new Map();let work=0;for(const c of cells){if(++work%8===0)yield;for(const [m,s] of c.surfaces){if(!groups.has(m))groups.set(m,bucket());const g=groups.get(m);for(const k of ['p','n','uv'])for(const v of s[k])g[k].push(v);}
   for(const beam of c.beams||[])for(const part of beam.parts){if(!groups.has(supportMaterial))groups.set(supportMaterial,bucket());const target=groups.get(supportMaterial);if(part.cutFaces){for(const face of part.cutFaces)addPoly(target,face.p);}else addBox(target,part);}
   if(!cut||!c.parts.length)continue;
   // Fresh fracture faces are solid and share the bounds of their collision cell.
   for(const [dx,dy,dz] of NEIGHBORS){
    const neighbor=b.cells.get(key(c.x+dx,c.y+dy,c.z+dz));if(!neighbor||(selected?selected.has(neighbor.k):!neighbor.removed))continue;
    if(!groups.has(concrete))groups.set(concrete,bucket());const g=groups.get(concrete);
    for(const p of c.parts){const a=dx?p.x1+(dx>0?p.x2-p.x1:0):dy?p.y1+(dy>0?p.y2-p.y1:0):p.z1+(dz>0?p.z2-p.z1:0);let vertices;
     if(dx)vertices=[[a,p.y1,p.z1],[a,p.y2,p.z1],[a,p.y2,p.z2],[a,p.y1,p.z2]];
     else if(dy)vertices=[[p.x1,a,p.z1],[p.x1,a,p.z2],[p.x2,a,p.z2],[p.x2,a,p.z1]];
     else vertices=[[p.x1,p.y1,a],[p.x2,p.y1,a],[p.x2,p.y2,a],[p.x1,p.y2,a]];
     if(dx+dy+dz<0)vertices.reverse();let poly=vertices.map((v,i)=>[...v,dx,dy,dz,i===1||i===2?1:0,i>=2?1:0]);
     if(p.kind==='convex')for(const plane of p.planes){const out=[];for(let i=0;i<poly.length;i++){const av=poly[i],bv=poly[(i+1)%poly.length],da=plane.distanceToPoint(new T.Vector3(...av.slice(0,3))),db=plane.distanceToPoint(new T.Vector3(...bv.slice(0,3)));if(da<.001)out.push(av);if(da*db<0){const t=da/(da-db);out.push(av.map((v,j)=>v+(bv[j]-v)*t));}}poly=out;}addPoly(g,poly);
    }
   }
  }
  const root=new T.Group();for(const [m,g] of groups){for(let start=0;start<g.p.length;start+=24570){const end=Math.min(g.p.length,start+24570),geo=new T.BufferGeometry();geo.setAttribute('position',floatAttribute(g.p,start,end,3));geo.setAttribute('normal',floatAttribute(g.n,start,end,3));geo.setAttribute('uv',floatAttribute(g.uv,start/3*2,end/3*2,2));geo.computeBoundingBox();geo.computeBoundingSphere();const mesh=new T.Mesh(geo,m);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);yield;}}return root;
 }
 function dispose(root){root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.userData.ownedMaterial)o.material.dispose();});root.removeFromParent();}
 function clearRenderBands(b){if(b.mesh)dispose(b.mesh);b.mesh=null;b.renderBands=b.renderMeshes=b.dirtyBands=null;}
 function* rebuildBand(b){
  const band=b.dirtyBands.values().next().value;
  if(band===undefined){dirty.delete(b);return;}
  b.dirtyBands.delete(band);
  const cells=b.renderBands.get(band)||[],old=b.renderMeshes.get(band);
  const mesh=yield* geometryTask(b,cells.filter(c=>!c.removed));
  impactVisuals.attach(b,mesh);if(old)dispose(old);b.renderMeshes.set(band,mesh);b.mesh.add(mesh);
  stats.rebuiltCells=(stats.rebuiltCells||0)+cells.length;
  if(!b.dirtyBands.size)dirty.delete(b);
 }

 function remove(b,c){if(c.removed)return;c.removed=true;const band=Math.floor(c.y/8);if(b.liveBands){const left=b.liveBands.get(band)-1;b.liveBands.set(band,left);if(left===0){const mesh=b.renderMeshes.get(band);if(mesh)mesh.visible=false;}}for(const p of c.parts)p.disabled=true;const l=b.layers.get(c.y);if(c.parts.length){l.removed+=c.supportFraction??1;if(c.core)l.coreRemoved+=c.supportFraction??1;}stats.removedSections++;
  // Adjacent bands need fresh exposed faces only when damage touches their edge.
  for(const y of [c.y-1,c.y,c.y+1]){const band=Math.floor(y/8);if(b.renderBands?.has(band))b.dirtyBands.add(band);}
  dirty.add(b);}
 function visualShockwave(point,radius,direction=new T.Vector3(0,1,0)){
  if(rings.length>=8)return;const mesh=new T.Mesh(new T.RingGeometry(.84,1,64),pressureMaterial('#d5efff'));mesh.position.copy(point);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction.clone().normalize());scene.add(mesh);rings.push({mesh,age:0,radius});
 }
 function topBlast(b,velocity,impactY=Infinity){
  const level=Math.floor(Math.min(b.bounds.min.y+b.height*.8,impactY-1.5)/CELL)*CELL;
  const cells=[...b.cells.values()].filter(c=>!c.removed&&c.center.y>=level);if(!cells.length)return;
  const center=new T.Vector3(b.x,level+b.height*.08,b.z),width=Math.max(b.bounds.max.x-b.bounds.min.x,b.bounds.max.z-b.bounds.min.z);
  for(const c of cells)remove(b,c);
  const stride=Math.max(1,Math.floor(cells.length/65));for(let i=0;i<cells.length;i+=stride){const c=cells[i],radial=c.center.clone().sub(center);radial.y=Math.abs(radial.y)*.3+width*.15;radial.normalize().multiplyScalar(18+Math.random()*24).addScaledVector(velocity,.055);spawn(c.center,radial,.45+Math.random()*1.2,i%3===0);}
  visualShockwave(center,width*.9);visualShockwave(center,width*.7,velocity);for(let i=0;i<6;i++)cloud(center.clone().add(new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(width*.65)),width*.3,velocity);
  b.pending=false;stats.topBlasts++;stats.topShears++;
 }
 function* chunks(cells,divisions){
  let work=0;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const c of cells){min[0]=Math.min(min[0],c.x);min[1]=Math.min(min[1],c.y);min[2]=Math.min(min[2],c.z);max[0]=Math.max(max[0],c.x);max[1]=Math.max(max[1],c.y);max[2]=Math.max(max[2],c.z);if(++work%64===0)yield;}
  const sizes=min.map((v,i)=>Math.max(1,Math.ceil((max[i]-v+1)/divisions[i]))),groups=new Map();for(const c of cells){const k=['x','y','z'].map((axis,i)=>Math.max(0,Math.min(divisions[i]-1,Math.floor((c[axis]-min[i]+(i===1?(c.x-min[0])*.23+(c.z-min[2])*.17+Math.sin(c.x*3.1+c.z*2.3)*.6:0))/sizes[i])))).join(',');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);if(++work%64===0)yield;}return [...groups.values()];
 }
 function restore(b){
  impactVisuals.dispose(b);
  clearRenderBands(b);
  for(const r of b.ranges){if(!r.originalPositions)continue;const p=r.b.geometry.attributes.position;p.array.set(r.originalPositions,r.start*3);p.addUpdateRange(r.start*3,(r.end-r.start)*3);p.needsUpdate=true;delete r.originalPositions;}
  world.removeFragments(b);for(const solid of b.solids)solid.disabled=false;
  b.blastDamaged=false;b.collapseStart=null;b.collapseLevel=null;b.supportLayers=null;b.lastHeat=null;b.cells=null;b.layers=null;b.active=b.falling=b.pending=b.detaching=b.rebuilding=false;b.pendingCuts=null;dirty.delete(b);active.delete(b);stats.respawns=(stats.respawns||0)+1;
 }
 function assessSupports(b,velocity){
  const live=[],rows=new Map();let maxY=-Infinity,baseY=Infinity;
  for(const c of b.cells.values()){if(!c.parts.length)continue;baseY=Math.min(baseY,c.y);if(c.removed)continue;live.push(c);maxY=Math.max(maxY,c.y);let row=rows.get(c.y);if(!row){row={count:0,center:new T.Vector3()};rows.set(c.y,row);}row.count++;row.center.add(c.center);}
  if(!live.length)return;
  // Connection to the foundation prevents disconnected islands hanging in space.
  const visit=b.structureVisit=(b.structureVisit||0)+1,queue=[];for(const c of live)if(c.y===baseY){c.visit=visit;queue.push(c);}
  for(let i=0;i<queue.length;i++)for(const n of queue[i].neighbors)if(!n.removed&&n.parts.length&&n.visit!==visit){n.visit=visit;queue.push(n);}
  const loose=new Set();for(const c of live)if(c.visit!==visit)loose.add(c.k);
  // Surviving mass above each floor must fit its remaining load-bearing section.
  const upper=new Map();let load=0,moment=new T.Vector3();
  for(const [y,row]of [...rows].sort((a,b)=>b[0]-a[0])){upper.set(y,{load,center:load?moment.clone().multiplyScalar(1/load):null});load+=row.count;moment.add(row.center);}
  let level=failedSupportLevel(b,CELL),lean=new T.Vector3();
  for(const [y,l] of b.layers){
   if(y>=maxY||!l.total||!l.removed)continue;
   const row=rows.get(y),coreLeft=l.coreTotal?1-l.coreRemoved/l.coreTotal:1,areaLeft=1-l.removed/l.total;
   const centroid=row?row.center.multiplyScalar(1/row.count):new T.Vector3();
   const eccentricity=row?Math.hypot((centroid.x-b.x)/Math.max(CELL,(b.bounds.max.x-b.bounds.min.x)*.5),(centroid.z-b.z)/Math.max(CELL,(b.bounds.max.z-b.bounds.min.z)*.5)):1;
   // Core loss, missing floor area and off-center support act together.
   const above=upper.get(y),offset=above?.center&&row?Math.hypot((above.center.x-centroid.x)/Math.max(CELL,(b.bounds.max.x-b.bounds.min.x)*.5),(above.center.z-centroid.z)/Math.max(CELL,(b.bounds.max.z-b.bounds.min.z)*.5)):0;
   const overloaded=b.blastDamaged&&blastOverloaded(areaLeft,coreLeft,offset,above?.load||0,l.total);
   const failed=overloaded||areaLeft<.42||(coreLeft<.35&&areaLeft<.78)||(areaLeft<.70&&eccentricity>.32);
   if(failed&&y*CELL<level){level=y*CELL;lean.set(b.x-centroid.x,0,b.z-centroid.z);}
  }
  if(level===Infinity&&!loose.size)return;
  let event=pending.find(e=>e.b===b&&!e.topOnly);
  if(!event){event={b,level,loose,topOnly:false,velocity:velocity.clone(),lean,delay:0};pending.push(event);
   // Low-opacity drifting plumes mark the failing floor before its sections fall.
   const y=Number.isFinite(level)?Math.max(b.bounds.min.y,level):b.bounds.min.y;
   for(let i=0;i<4;i++){const a=i*Math.PI*.5,dx=Math.cos(a),dz=Math.sin(a),p=new T.Vector3(b.x+dx*(b.bounds.max.x-b.bounds.min.x)*.48,y+1,b.z+dz*(b.bounds.max.z-b.bounds.min.z)*.48);cloud(p,2.5,new T.Vector3(dx*30,8,dz*30),1.6,.32);}
  }else{event.level=Math.min(event.level,level);for(const k of loose)event.loose.add(k);if(lean.lengthSq())event.lean.copy(lean);}
  b.pending=true;
  if(Number.isFinite(event.level)){
   b.collapseStart??=clock;b.collapseLevel=Math.min(b.collapseLevel??Infinity,event.level);
   const elapsed=clock-b.collapseStart;impactVisuals.collapse(b,b.collapseLevel,-elapsed-9*elapsed*elapsed);
   // Failed structure stops supporting collisions immediately, not after meshing.
   for(const c of live)if(c.y*CELL>=b.collapseLevel||loose.has(c.k))for(const part of c.parts)part.disabled=true;
  }
 }
 function* detach(b,level,topOnly,velocity,loose=new Set(),lean=new T.Vector3()){
  if(b.falling)return;if(topOnly){topBlast(b,velocity);return;}b.pending=false;
  const cells=[...b.cells.values()].filter(c=>!c.removed&&(c.y*CELL>=level||loose.has(c.k)));if(!cells.length)return;
  let work=0;const groups=yield* chunks(cells,[1,Math.min(4,Math.max(1,Math.ceil((Math.max(...cells.map(c=>c.y))-Math.min(...cells.map(c=>c.y)))*CELL/28))),1]);for(const c of cells){for(const part of c.parts)part.disabled=true;if(++work%64===0)yield;}
  b.falling=![...b.cells.values()].some(c=>!c.removed&&c.parts.length);
  const staged=[];
  for(let i=0;i<groups.length;i++){
   const mesh=yield* geometryTask(b,groups[i],true,true);if(!mesh.children.length)continue;
   const box=new T.Box3().setFromObject(mesh),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),emitters=[];
   for(const c of groups[i])if(c.surfaces.size&&emitters.length<96)emitters.push(c.center.clone().sub(center));
   for(const child of mesh.children){child.position.sub(center);child.castShadow=false;child.material=child.material.clone();child.material.clippingPlanes=[new T.Plane(new T.Vector3(0,1,0),-.25)];child.userData.ownedMaterial=true;}
   mesh.position.copy(center);

   const lateral=new T.Vector3(velocity.z,0,-velocity.x).normalize().multiplyScalar((i%2?1:-1)*2);
   const v=velocity.clone().multiplyScalar(.018+i*.004).add(lateral.multiplyScalar(.35)).addScaledVector(lean.clone().normalize(),3);v.y=-1-i*.35;
   const tilt=lean.lengthSq()>.01?lean:velocity;const axis=new T.Vector3(tilt.z,.025*tilt.length(),-tilt.x).normalize();
   // All active sections remain visible until their natural cleanup below ground.
   const elapsed=b.collapseStart==null?0:clock-b.collapseStart;mesh.position.y-=elapsed+9*elapsed*elapsed;v.y-=18*elapsed;
   staged.push({mesh,building:b,cells:groups[i],sourceCenter:center.clone(),v,axis,spin:.12+i*.035,age:0,radius:size.length()*.5,halfHeight:size.y*.5,halfSize:size.clone().multiplyScalar(.5),emitters,nextEmit:.35,groundDust:false});
  }
  for(const c of cells)remove(b,c);
  for(const f of staged){scene.add(f.mesh);falling.push(f);}
  if(Number.isFinite(b.collapseLevel)){impactVisuals.collapse(b,b.collapseLevel,0,true);b.collapseStart=null;}
  b.falling=![...b.cells.values()].some(c=>!c.removed&&c.parts.length);stats.collapses++;audio?.destruction({x:b.x,y:level,z:b.z},true);
 }
 function strike(b,point,velocity,profile){
  if(b.falling)return false;
  impactVisuals.cut(b,point,velocity.clone().normalize(),profile.radius+CELL*.65,profile.depth+CELL);stats.immediateCuts=(stats.immediateCuts||0)+1;
  if(!activate(b)){const p=point.clone(),v=velocity.clone();contactCut(b,p,v,profile);defer(b,()=>strike(b,p,v,profile));burst(point,velocity,profile.fast>.5?95:55,Math.min(10,profile.radius));return true;}const direction=velocity.clone().normalize(),changed=[];
  for(const c of b.cells.values()){
   if(c.removed)continue;const dx=c.center.x-point.x,dy=c.center.y-point.y,dz=c.center.z-point.z,along=dx*direction.x+dy*direction.y+dz*direction.z;if(along< -CELL||along>profile.depth+CELL)continue;
   const px=dx-direction.x*along,py=dy-direction.y*along,pz=dz-direction.z*along;if(px*px+py*py+pz*pz>(profile.radius+CELL*.65)**2)continue;remove(b,c);changed.push(c);
  }
  if(!changed.length)return false;
  burst(point,velocity,profile.fast>.5?95:55,Math.min(8,profile.radius*1.3));

  assessSupports(b,velocity);
  return true;
 }
 function shockwave(origin,radius=20){
  const seen=new Set(),targets=[];for(const solid of world.nearby(origin.x,origin.z,radius)){const b=solid.building;if(!b||b.falling||seen.has(b))continue;seen.add(b);const box=new T.Box3();for(const s of b.solids)box.union(bounds(s));const point=origin.clone().clamp(box.min,box.max),distance=point.distanceTo(origin);if(distance>=radius)continue;targets.push({b,point,distance});}
  targets.sort((a,b)=>a.distance-b.distance);for(const target of targets.slice(0,3)){const strength=1-target.distance/radius,dir=target.point.clone().sub(origin);if(dir.lengthSq()<.01)dir.set(1,0,0);dir.normalize().multiplyScalar(50);pressure.push({...target,velocity:dir,delay:.04+target.distance/55,profile:{destructive:true,graze:false,fast:0,severe:false,topOnly:false,radius:1.2+strength*3.3,depth:2+strength*4}});}
 }
 // Detached collapse sections are visual-only. Keep the public punch hook
 // for callers, but never rebuild falling geometry or recreate hero colliders.
 function punchFalling(){}
 function radialBlast(origin,radius){
  const seen=new Set(),affected=[];
  for(const solid of world.nearby(origin.x,origin.z,radius)){const b=solid.building;if(!b||b.falling||seen.has(b))continue;seen.add(b);
   const box=new T.Box3();for(const part of b.solids)box.union(bounds(part));if(box.distanceToPoint(origin)>radius)continue;
   const point=box.clampPoint(origin,new T.Vector3()),dir=box.getCenter(new T.Vector3()).sub(origin).normalize();if(!dir.lengthSq())dir.set(0,1,0);
   const size=box.getSize(new T.Vector3());b.blastDamaged=true;
   affected.push({x:b.x,z:b.z,width:size.x,depth:size.z,height:size.y,damage:Math.max(.05,1-box.distanceToPoint(origin)/radius),color:'#72919a'});
   const shape={origin:origin.clone(),reach:radius,width:radius,spread:0,sphere:true};
   // Visual and collision openings are immediate; large fracture meshes use
   // the existing time-budgeted preparation/geometry queues.
   impactVisuals.cut(b,origin,dir,radius,radius,-1,-radius);
   b.pendingCuts??=[];b.pendingCuts.push({sphere:true,p:origin.clone(),radius});
   defer(b,()=>punch(b,point,dir,'serious',shape));
  }
  return affected;
 }

 function hit(contact,position,velocity,{powered=false}={}){
  // A contact queued earlier in the frame must not catch the hero after detachment.
  if(contact.solid?.fallingSection||contact.solid?.disabled)return {pass:true};
  const b=contact.solid?.building;if(!b)return null;
  const speed=velocity.length();let closing=Math.max(0,-velocity.dot(contact.normal));
  // Inside a deferred opening, the nearest exterior face can point along travel.
  // Continue the breakthrough instead of treating that interior contact as a graze.
  const bodyPoint=position.clone().add(contact.offset);if(powered&&speed>34&&b.solids.some(s=>bodyPoint.x>s.x1&&bodyPoint.x<s.x2&&bodyPoint.y>s.y1&&bodyPoint.y<s.y2&&bodyPoint.z>s.z1&&bodyPoint.z<s.z2))closing=speed;
  const top=Math.max(...b.solids.map(s=>s.y2)),bottom=Math.min(...b.solids.map(s=>s.y1));
  const point=position.clone().add(contact.offset).addScaledVector(contact.normal,-.28);
  const profile=damageProfile(speed,closing/Math.max(.001,speed),powered,(point.y-bottom)/(top-bottom));if(!profile.destructive)return null;
  if(profile.topOnly&&profile.severe&&!b.falling){impactVisuals.cut(b,new T.Vector3(b.x,bottom+(top-bottom)*.8,b.z),new T.Vector3(0,1,0),Math.max(...b.solids.map(s=>Math.hypot(s.x2-s.x1,s.z2-s.z1))),top-bottom,0,0);if(activate(b))topBlast(b,velocity,point.y);else{const v=velocity.clone(),y=point.y;contactCut(b,point,v,profile);defer(b,()=>{activate(b);topBlast(b,v,y);});burst(point,v,95,10);}velocity.multiplyScalar(profile.retention);return {pass:true};}
  if(!strike(b,point,velocity,profile))return null;
  if(profile.fast>.5&&!profile.graze){if(rings.length<6){const ring=new T.Mesh(new T.RingGeometry(.82,1,40),pressureMaterial('#c8e4ef'));ring.position.copy(point);ring.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),velocity.clone().normalize());scene.add(ring);rings.push({mesh:ring,age:0,radius:profile.radius});}waves.push({b,p:point.clone(),v:velocity.clone(),profile:{...profile,severe:false,radius:profile.radius*1.45,depth:profile.depth*1.3},delay:.08});}
  // Direct breakthroughs retain momentum. A graze still uses the ordinary
  // collision response, which strips inward velocity while preserving the slide.
  velocity.multiplyScalar(profile.retention);return {pass:!profile.graze};
 }
 function punch(b,point,direction,kind,cone=null){
  if(!b.falling){const shape=cone||{origin:point,reach:337.5,width:10.5,spread:12/337.5};if(kind==='serious')impactVisuals.cut(b,shape.origin,direction,shape.width,shape.reach,shape.sphere?-1:shape.spread,shape.sphere?-shape.width:0);else impactVisuals.cut(b,point,direction,(kind==='quick'?1.5:NORMAL_DAMAGE_RADIUS)+CELL*.65,(kind==='quick'?4:32)+CELL);if(!b.active)burst(point,direction.clone().multiplyScalar(kind==='quick'?40:150),kind==='quick'?35:80,kind==='quick'?3:9);}
  if(!b.active&&!activate(b)){const p=point.clone(),d=direction.clone(),shape=cone?{...cone,origin:cone.origin.clone()}:null;if(kind!=='serious')contactCut(b,p,d,{radius:kind==='quick'?1.5:NORMAL_DAMAGE_RADIUS,depth:kind==='quick'?4:32});else if(shape?.sphere){b.pendingCuts??=[];b.pendingCuts.push({sphere:true,p:shape.origin.clone(),radius:shape.width});}defer(b,()=>punch(b,p,d,kind,shape));return;}
  if(b.falling)return;
  const velocity=direction.clone().multiplyScalar(kind==='quick'?40:150);
  if(kind!=='serious'){strike(b,point,velocity,{destructive:true,graze:false,fast:kind==='quick'?0:1,severe:kind==='normal',topOnly:false,radius:kind==='quick'?1.5:NORMAL_DAMAGE_RADIUS,depth:kind==='quick'?4:32});return;}
  // Cut only the force cone out of the facade; support loss drives the collapse.
  activate(b);const removed=[];
  const shape=cone||{origin:point,reach:337.5,width:10.5,spread:12/337.5};
  for(const c of b.cells.values()){
   if(c.removed)continue;const delta=c.center.clone().sub(shape.origin),along=delta.dot(direction);
   if(shape.sphere){if(delta.lengthSq()>shape.width*shape.width)continue;}else{if(along<0||along>shape.reach)continue;
   if(delta.addScaledVector(direction,-along).length()>shape.width+shape.spread*along)continue;}
   removed.push(c);remove(b,c);
  }
  if(!removed.length)return;
  // Original textured surfaces become moving fragments, not invisible geometry.
  visualJobs.push((function*(){for(const group of (yield* chunks(cone?.sphere?removed.filter((_,i)=>i%Math.max(1,Math.ceil(removed.length/128))===0):removed,[2,2,2]))){
   const mesh=yield* geometryTask(b,group,true,true);if(!mesh.children.length)continue;
   const box=new T.Box3().setFromObject(mesh),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
   for(const child of mesh.children){child.position.sub(center);child.castShadow=false;}
   mesh.position.copy(center);
   const axis=new T.Vector3(direction.z,.3,-direction.x).normalize(),v=direction.clone().multiplyScalar(22+Math.random()*16);v.y+=8+Math.random()*8;
   const elapsed=b.collapseStart==null?0:clock-b.collapseStart;mesh.position.y-=elapsed+9*elapsed*elapsed;v.y-=18*elapsed;
   falling.push({mesh,building:b,cells:group,sourceCenter:center.clone(),v,axis,spin:.4+Math.random()*.6,age:0,radius:size.length()*.5,halfHeight:size.y*.5,halfSize:size.clone().multiplyScalar(.5),emitters:[],nextEmit:0,groundDust:false});
  }
  })());
  burst(point,velocity,24,8);
  assessSupports(b,velocity);
 }
 // Heat now removes the same pre-divided cells as a Normal punch. No repeated
 // polygon subtraction, surface triangulation, or extra convex collision pieces.
 function heat(origin,direction,reach){
  if(reach<=0||direction.lengthSq()<.001)return 0;
  const dir=direction.clone().normalize(),ray=new T.Ray(origin,dir),end=origin.clone().addScaledVector(dir,reach),seen=new Set(),targets=[];
  const area=new T.Box3().setFromPoints([origin,end]);
  for(let gx=Math.floor(area.min.x/56);gx<=Math.floor(area.max.x/56);gx++)for(let gz=Math.floor(area.min.z/56);gz<=Math.floor(area.max.z/56);gz++)for(const solid of world.grid.get(gx+','+gz)||[]){
   const b=solid.building;if(!b||b.falling||seen.has(b))continue;seen.add(b);
   const box=b.bounds||b.solids.reduce((box,s)=>box.union(bounds(s)),new T.Box3()),at=box.containsPoint(origin)?origin:ray.intersectBox(box,new T.Vector3());
   if(!at||at.distanceToSquared(origin)>reach*reach)continue;
   // Radius-sized holes make sub-pixel repeat cuts unnecessary. Keep cached
   // aim per building, so an already pierced foreground cannot starve the next.
   if(b.lastHeat&&b.lastHeat.o.distanceToSquared(origin)<.25&&b.lastHeat.end.distanceToSquared(end)<.25)continue;
   targets.push({b,at:at.clone(),distance:at.distanceToSquared(origin)});
  }
  targets.sort((a,b)=>a.distance-b.distance);let hits=0,processed=0;
  for(const {b,at} of targets){
   if(processed>=1)break;impactVisuals.cut(b,origin,dir,HEAT_DAMAGE_RADIUS+CELL*.65,reach,0,0);const wasActive=b.active;if(!activate(b)){if(!urgent.has(b)){const o=origin.clone(),d=direction.clone();defer(b,()=>heat(o,d,reach));}continue;}b.lastHeat={o:origin.clone(),end:end.clone()};let removed=0;
   const limit=(HEAT_DAMAGE_RADIUS+CELL*.65)**2;
   for(const c of b.cells.values()){if(c.removed)continue;const dx=c.center.x-origin.x,dy=c.center.y-origin.y,dz=c.center.z-origin.z,along=dx*dir.x+dy*dir.y+dz*dir.z;
    if(along<0||along>reach||dx*dx+dy*dy+dz*dz-along*along>limit)continue;remove(b,c);removed++;
   }
   if(removed||!wasActive)processed++;
   if(removed){hits++;burst(at,dir.clone().multiplyScalar(3),12,Math.min(8,HEAT_DAMAGE_RADIUS));assessSupports(b,new T.Vector3());}
  }
  stats.heatBuildingsProcessed=processed;stats.heatRadius=HEAT_DAMAGE_RADIUS;
  if(hits){stats.heatCuts=(stats.heatCuts||0)+hits;}return hits;
 }
 // Falling meshes retain their tumble/dust lifecycle, but cannot obstruct movement.
 world.setHeroSections([]);
 stats.heroColliders=0;
 function update(dt,player){

  clock+=dt;for(const b of active)if(b.collapseStart!=null&&impactVisuals.has(b)){const t=clock-b.collapseStart;impactVisuals.collapse(b,b.collapseLevel,-t-9*t*t);}
  const workStart=performance.now();let collapsesThisFrame=0;
  const prepStart=performance.now();for(const [b,actions] of urgent){if(!b.active&&!servicePreparation(b,prepStart+1.25))break;if(activate(b)){let applied=0;while(actions.length&&(applied===0||performance.now()<prepStart+2)){actions.shift()();applied++;}if(!actions.length){b.pendingCuts=null;urgent.delete(b);}}if(performance.now()-prepStart>=2)break;}stats.urgentPreparationMs=performance.now()-prepStart;stats.pendingPreparations=urgent.size;

  for(const event of pressure)event.delay-=dt;const ready=pressure.findIndex(event=>event.delay<=0);if(ready>=0){const event=pressure.splice(ready,1)[0];strike(event.b,event.point,event.velocity,event.profile);stats.shockwaveHits=(stats.shockwaveHits||0)+1;}
  // Collision openings are immediate. Geometry and secondary collapses are staged,
  // rather than rebuilding every destabilized tower during the same frame.
  for(const event of pending)event.delay-=dt;
  for(let i=0;i<pending.length;){const event=pending[i];if(event.delay>0){i++;continue;}if(collapsesThisFrame>=(mobile?1:2)||collapsesThisFrame&&performance.now()-workStart>3)break;if(!event.b.detaching){event.b.detaching=true;visualJobs.unshift((function*(){yield* detach(event.b,event.level,event.topOnly,event.velocity,event.loose,event.lean);event.b.detaching=false;})());}pending.splice(i,1);collapsesThisFrame++;}
  stats.pendingCollapses=pending.length;stats.collapsesThisFrame=collapsesThisFrame;

  for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.age+=dt;if(r.age>.45){r.mesh.material.dispose();dispose(r.mesh);rings.splice(i,1);continue;}r.mesh.scale.setScalar(1+r.radius*r.age*5);r.mesh.material.opacity=.4*(1-r.age/.45);}
  for(const w of waves)w.delay-=dt;
  if(performance.now()-workStart<3){const i=waves.findIndex(w=>w.delay<=0);if(i>=0){const w=waves.splice(i,1)[0];strike(w.b,w.p,w.v,w.profile);}}
  // A bounded visual tumble replaces the expensive all-pairs rigid-body solver.
  // These sections are effects: gravity, drift and spin, then cleanup below ground.
  for(let i=falling.length-1;i>=0;i--){const f=falling[i];f.age+=dt;f.v.y-=18*dt;f.v.x*=Math.exp(-.18*dt);f.v.z*=Math.exp(-.18*dt);f.mesh.position.addScaledVector(f.v,dt);f.mesh.quaternion.premultiply(spinStep.setFromAxisAngle(f.axis,f.spin*dt));
   if(f.age>=f.nextEmit&&f.age<1.6&&f.emitters.length){f.nextEmit=f.age+.35;for(let n=0;n<2;n++){const local=f.emitters[Math.floor(Math.random()*f.emitters.length)],point=local.clone().applyQuaternion(f.mesh.quaternion).add(f.mesh.position);spawn(point,f.v.clone().multiplyScalar(.45).add(local.clone().normalize().multiplyScalar(4)),.15+Math.random()*.65,n===0);}}
   const floor=world.ground(f.mesh.position.x,f.mesh.position.z);if(!f.groundDust&&f.mesh.position.y-f.halfHeight<floor){f.groundDust=true;for(let n=0;n<3;n++)cloud(new T.Vector3(f.mesh.position.x+(Math.random()-.5)*10,floor+1,f.mesh.position.z+(Math.random()-.5)*10),4+Math.random()*3);}
   // Keep solid silhouettes until the complete tumbling section is below ground.
   if(f.mesh.position.y+f.radius<-.5){dispose(f.mesh);falling.splice(i,1);}}
  stats.colliderMs=0;stats.structuralBodies=0;stats.visualSections=falling.length;
  // Damage remains until an explicit city reset; debris still cleans up naturally.
  stats.activeBuildings=active.size;
  const rebuildStart=performance.now();stats.rebuiltThisFrame=0;stats.rebuiltCells=0;
  // Immediate facade masks keep impact feedback independent of this queue.
  if(dirty.size){const b=dirty.values().next().value;dirty.delete(b);if(!b.rebuilding){b.rebuilding=true;visualJobs.push((function*(){yield* rebuildBand(b);b.rebuilding=false;if(b.dirtyBands?.size)dirty.add(b);})());}}
  let units=0;while(visualJobs.length&&units++<96&&performance.now()-rebuildStart<1.5){const next=visualJobs[0].next();if(next.done){visualJobs.shift();stats.rebuiltThisFrame++;}}
  stats.pendingVisualJobs=visualJobs.length;
  if(!visualJobs.length&&!urgent.size&&!pending.length&&!dirty.size)for(const b of active)if(impactVisuals.has(b))impactVisuals.retire(b);
  stats.pendingRenderBands=[...dirty].reduce((n,b)=>n+b.dirtyBands.size,0);stats.rebuildMs=performance.now()-rebuildStart;stats.rebuildPeakMs=Math.max(stats.rebuildPeakMs||0,stats.rebuildMs);
  let live=0;for(const d of debris){d.age+=dt;if(d.age<=7)debris[live++]=d;}debris.length=live;
  for(let i=0;i<debris.length;i++){const d=debris[i];if(!d.rest){d.v.y-=24*dt;d.p.addScaledVector(d.v,dt);const ground=world.ground(d.p.x,d.p.z)+d.size.length()*.5;if(d.p.y<ground){d.p.y=ground;d.v.y=Math.abs(d.v.y)*.15;d.v.x*=.55;d.v.z*=.55;if(d.v.length()<1.8)d.rest=true;}d.v.x*=Math.exp(-dt*(d.glass?.65:.12));d.v.z*=Math.exp(-dt*(d.glass?.65:.12));d.q.multiply(spinStep.setFromAxisAngle(d.axis,d.spin*dt));}
   dummy.position.copy(d.p);dummy.quaternion.copy(d.q);dummy.scale.copy(d.size).multiplyScalar(d.age>5?(7-d.age)/2:1);dummy.updateMatrix();debrisMesh.setMatrixAt(i,dummy.matrix);debrisMesh.setColorAt(i,d.color);
  }debrisMesh.count=debris.length;upload(debrisMesh.instanceMatrix,debris.length*16);if(debrisMesh.instanceColor)upload(debrisMesh.instanceColor,debris.length*3);stats.debris=debris.length;
  live=0;for(const d of dust){d.age+=dt;if(d.age<=d.life)dust[live++]=d;}dust.length=live;
  for(let i=0;i<dust.length;i++){const d=dust[i];d.v.multiplyScalar(Math.exp(-1.2*dt));d.p.addScaledVector(d.v,dt);d.p.y+=dt*1.6;dummy.position.copy(d.p);if(camera)dummy.quaternion.copy(camera.quaternion);else dummy.quaternion.identity();dummy.rotateZ(d.rotation);dummy.scale.setScalar(d.scale*(.6+d.age*.8));dummy.updateMatrix();dustMesh.setMatrixAt(i,dummy.matrix);dustAlpha.setX(i,d.opacity*Math.min(1,d.age*12)*(1-d.age/d.life));}dustMesh.count=dust.length;upload(dustMesh.instanceMatrix,dust.length*16);upload(dustAlpha,dust.length);stats.dust=dust.length;

 }
 function upload(attribute,count){attribute.clearUpdateRanges();if(count){attribute.addUpdateRange(0,count);attribute.needsUpdate=true;}}
 function reset(){
  for(const [b] of prepared){impactVisuals.dispose(b);for(const r of b.ranges){if(r.originalPositions){const p=r.b.geometry.attributes.position;p.array.set(r.originalPositions,r.start*3);p.addUpdateRange(r.start*3,(r.end-r.start)*3);p.needsUpdate=true;}}world.removeFragments(b);clearRenderBands(b);b.cells=b.layers=b.supportLayers=null;b.pendingCuts=null;b.detaching=b.rebuilding=false;for(const r of b.ranges)delete r.originalPositions;}prepared.clear();preparationTargets=[];preparationClock=1;
  urgent.clear();visualJobs.length=0;pending.length=waves.length=pressure.length=0;stats.pendingCollapses=stats.collapsesThisFrame=stats.pendingPreparations=stats.pendingVisualJobs=stats.pendingRenderBands=0;
  for(const f of falling)dispose(f.mesh);falling.length=0;world.setHeroSections([]);stats.heroColliders=0;
  for(const r of rings){r.mesh.material.dispose();dispose(r.mesh);}rings.length=0;
  for(const b of [...active])restore(b);
  debris.length=dust.length=0;debrisMesh.count=dustMesh.count=0;
  stats.activeBuildings=stats.visualSections=stats.debris=stats.dust=0;
 }
 return {prepareNearby,reset,hit,heat,update,stats,burst,shockwave,radialBlast,punch,punchFalling,roadBurst,plume:(p,size,v)=>cloud(p,Math.min(7,size*.06),v,1.4,.25)};
}
