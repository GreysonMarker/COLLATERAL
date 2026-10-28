import {prepareSupports,failedSupportLevel} from './building-supports.js';
import {boxFaces} from './heat-cut.js';
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
function addPoly(target,poly){for(let i=1;i<poly.length-1;i++)for(const v of [poly[0],poly[i],poly[i+1]]){target.p.push(...v.slice(0,3));target.n.push(...v.slice(3,6));target.uv.push(...v.slice(6,8));}}
const bucket=()=>({p:[],n:[],uv:[]});
const key=(x,y,z)=>x+','+y+','+z;
function bounds(s){return new T.Box3(new T.Vector3(s.x1,s.y1,s.z1),new T.Vector3(s.x2,s.y2,s.z2));}

export function createDestruction(scene,world,{concrete,roofmat,mobile=false,camera=null,audio=null}){
 const supportMaterial=new T.MeshStandardMaterial({color:'#555c65',roughness:.72,metalness:.45});
 const active=new Set(),dirty=new Set(),falling=[],debris=[],dust=[],waves=[],pending=[],rings=[],pressure=[];
 const stats={damagedBuildings:0,removedSections:0,collapses:0,topShears:0,topBlasts:0,secondaryImpacts:0,fractures:0,structuralBodies:0,debris:0};
 let maxDebris=mobile?512:768,maxDust=mobile?128:192;let clock=0;
 let debrisMesh=new T.InstancedMesh(new T.IcosahedronGeometry(.62,0),concrete,maxDebris);debrisMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);debrisMesh.frustumCulled=false;debrisMesh.castShadow=false;debrisMesh.receiveShadow=true;debrisMesh.count=0;scene.add(debrisMesh);
 // One soft sprite batch, no transparent spheres or per-particle draw calls.
 const pixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const dx=(x-31.5)/31.5,dy=(y-31.5)/31.5,r=Math.sqrt(dx*dx+dy*dy),grain=.83+.17*Math.sin(x*.61+Math.sin(y*.48)*2);const i=(y*64+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.max(0,1-r)**2*grain*255;}
 const texture=new T.DataTexture(pixels,64,64);texture.needsUpdate=true;texture.magFilter=texture.minFilter=T.LinearFilter;
 const dustMat=new T.MeshBasicMaterial({color:'#b1aaa0',map:texture,transparent:true,opacity:.52,depthWrite:false});
 dustMat.onBeforeCompile=shader=>{shader.vertexShader='attribute float particleAlpha;varying float vParticleAlpha;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvParticleAlpha=particleAlpha;');shader.fragmentShader='varying float vParticleAlpha;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vParticleAlpha;');};dustMat.customProgramCacheKey=()=> 'meridian-soft-dust-v1';
 const dustGeometry=new T.PlaneGeometry(1,1);let dustAlpha=new T.InstancedBufferAttribute(new Float32Array(maxDust),1);dustAlpha.setUsage(T.DynamicDrawUsage);dustGeometry.setAttribute('particleAlpha',dustAlpha);
 let dustMesh=new T.InstancedMesh(dustGeometry,dustMat,maxDust);dustMesh.frustumCulled=false;dustMesh.count=0;scene.add(dustMesh);

 const spinStep=new T.Quaternion();
 const dummy=new T.Object3D(),fragmentColors=['#aaa396','#827d76','#c2b8a4','#6696aa','#a0c8ce'].map(c=>new T.Color(c));
 function spawn(point,velocity,size=1,glass=false){if(debris.length>=maxDebris){maxDebris*=2;const old=debrisMesh;debrisMesh=new T.InstancedMesh(old.geometry,old.material,maxDebris);debrisMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);debrisMesh.frustumCulled=false;debrisMesh.receiveShadow=true;scene.remove(old);old.dispose();scene.add(debrisMesh);}const axis=new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();debris.push({p:point.clone(),v:velocity.clone(),q:new T.Quaternion().setFromAxisAngle(axis,Math.random()*6.28),axis,spin:2+Math.random()*7,size:new T.Vector3(size*(.6+Math.random()*.8),glass?.035+size*.045:size*(.3+Math.random()*.5),size*(.4+Math.random()*.9)),age:0,rest:false,glass,color:glass?fragmentColors[3+Math.floor(Math.random()*2)]:fragmentColors[Math.floor(Math.random()*3)]});}
 function cloud(p,scale=1,velocity=null,lifetime=null,opacity=1){if(dust.length>=maxDust){maxDust*=2;const old=dustMesh;dustAlpha=new T.InstancedBufferAttribute(new Float32Array(maxDust),1);dustAlpha.setUsage(T.DynamicDrawUsage);dustGeometry.setAttribute("particleAlpha",dustAlpha);dustMesh=new T.InstancedMesh(dustGeometry,dustMat,maxDust);dustMesh.frustumCulled=false;scene.remove(old);old.dispose();scene.add(dustMesh);}dust.push({p:p.clone(),v:velocity?velocity.clone().multiplyScalar(.07):new T.Vector3(),opacity,scale:Math.min(lifetime?126:14,Math.max(1,scale)),age:0,life:lifetime??(1.6+Math.random()*.9),rotation:Math.random()*6.28});}
 function burst(point,velocity,count=35,spread=2){audio?.destruction(point);for(let i=0;i<count;i++){const offset=new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(spread),v=offset.clone().normalize().multiplyScalar(4+Math.random()*13).addScaledVector(velocity,.10+Math.random()*.16);v.y+=Math.random()*6;spawn(point.clone().add(offset),v,.08+Math.random()**2*1.3,i%3===0);}for(let i=0;i<2;i++)cloud(point.clone().add(new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(spread)),spread*.8+2,velocity);}
 function roadBurst(point,direction,radius){
  for(let i=0;i<8;i++){const angle=i*2.399,offset=new T.Vector3(Math.cos(angle),0,Math.sin(angle)).multiplyScalar(radius*(.18+Math.random()*.50)),p=point.clone().add(offset);p.y=world.ground(p.x,p.z)+.8;const v=direction.clone().multiplyScalar(18+Math.random()*24);v.y=15+Math.random()*18;spawn(p,v,2+Math.random()*2,false);const piece=debris[debris.length-1];piece.size.set(2+Math.random()*4,.35+Math.random()*.85,1.5+Math.random()*3);piece.color=new T.Color(i%3===0?'#aaa396':'#414958');}
 }
 const prepared=new Map();
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
  for(const r of b.ranges){const g=r.b.geometry,p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;r.originalPositions=p.array.slice(r.start*3,r.end*3);
   for(let i=r.start;i<r.end;i+=3){let tri=[];for(let j=0;j<3;j++)tri.push([p.getX(i+j),p.getY(i+j),p.getZ(i+j),n.getX(i+j),n.getY(i+j),n.getZ(i+j),u.getX(i+j),u.getY(i+j)]);
    const low=[0,1,2].map(a=>Math.floor(Math.min(...tri.map(v=>v[a]))/CELL)),high=[0,1,2].map(a=>Math.floor((Math.max(...tri.map(v=>v[a]))-1e-7)/CELL));for(let a=0;a<3;a++)high[a]=Math.max(low[a],high[a]);
    for(let x=low[0];x<=high[0];x++)for(let y=low[1];y<=high[1];y++)for(let z=low[2];z<=high[2];z++){
     const k=key(x,y,z);let c=b.cells.get(k);if(!c){c={x,y,z,k,parts:[],surfaces:new Map(),removed:false};b.cells.set(k,c);}
     let poly=tri;for(const [a,index] of [[0,x],[1,y],[2,z]]){poly=clip(poly,a,index*CELL,1);poly=clip(poly,a,(index+1)*CELL,-1);if(poly.length<3)break;}if(++work%32===0)yield;if(poly.length<3)continue;
     if(!c.surfaces.has(r.m))c.surfaces.set(r.m,bucket());addPoly(c.surfaces.get(r.m),poly);
    }
   }

  }
  for(const c of b.cells.values()){c.structural=!!c.parts.length;if(!c.parts.length&&!c.surfaces.size){b.cells.delete(c.k);continue;}const center=new T.Vector3((c.x+.5)*CELL,(c.y+.5)*CELL,(c.z+.5)*CELL);c.center=center;c.core=Math.abs(center.x-b.x)<(b.bounds.max.x-b.bounds.min.x)*.24&&Math.abs(center.z-b.z)<(b.bounds.max.z-b.bounds.min.z)*.24;let l=b.layers.get(c.y);if(!l){l={total:0,removed:0,coreTotal:0,coreRemoved:0};b.layers.set(c.y,l);}if(c.parts.length){l.total++;if(c.core)l.coreTotal++;}}
  yield* prepareSupports(b);
 }
 function activate(b){
  if(b.active)return;const job=prepared.get(b)||{iterator:prepare(b),done:false};
  while(!job.done)job.done=job.iterator.next().done;prepared.delete(b);b.active=true;
  for(const c of b.cells.values())for(const part of c.parts)world.addStatic(part);
  for(const s of b.solids)s.disabled=true;
  for(const r of b.ranges){const p=r.b.geometry.attributes.position;for(let i=r.start;i<r.end;i++)p.setXYZ(i,0,-10000,0);p.addUpdateRange(r.start*3,(r.end-r.start)*3);p.needsUpdate=true;}
  active.add(b);stats.damagedBuildings++;dirty.add(b);
 }
 let preparationClock=1,preparationTargets=[];
 function prepareNearby(dt,position,velocity,buildings){
  preparationClock+=dt;
  if(preparationClock>.25){preparationClock=0;const speed=velocity.length(),dx=speed>1?velocity.x/speed:0,dz=speed>1?velocity.z/speed:0;
   preparationTargets=buildings.filter(b=>!b.active).map(b=>{const x=b.x-position.x,z=b.z-position.z,d=x*x+z*z,a=x*dx+z*dz;return {b,d,score:d*(a>0?.35:1)};}).filter(t=>t.d<500*500).sort((a,b)=>a.score-b.score).slice(0,8).map(t=>t.b);
   for(const [b] of prepared)if(!preparationTargets.includes(b)){prepared.delete(b);b.cells=b.layers=b.supportLayers=null;for(const r of b.ranges)delete r.originalPositions;}
  }
  const start=performance.now();let units=0;
  for(const b of preparationTargets){if(b.active)continue;let job=prepared.get(b);if(!job){job={iterator:prepare(b),done:false};prepared.set(b,job);}while(!job.done){job.done=job.iterator.next().done;units++;if(units>=80||performance.now()-start>1.5){stats.preparationMs=performance.now()-start;return;}}}
  stats.preparationMs=performance.now()-start;stats.preparedBuildings=[...prepared.values()].filter(j=>j.done).length;
 }
 function geometryFor(b,cells,cut=true,section=false){
  const selected=section?new Set(cells.map(c=>c.k)):null;
  const groups=new Map();for(const c of cells){for(const [m,s] of c.surfaces){if(!groups.has(m))groups.set(m,bucket());const g=groups.get(m);for(const k of ['p','n','uv'])for(const v of s[k])g[k].push(v);}
   for(const beam of c.beams||[])for(const part of beam.parts){if(!groups.has(supportMaterial))groups.set(supportMaterial,bucket());for(const face of part.cutFaces||boxFaces(part))addPoly(groups.get(supportMaterial),face.p);}
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
  const root=new T.Group();for(const [m,g] of groups){if(!g.p.length)continue;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(g.p,3));geo.setAttribute('normal',new T.Float32BufferAttribute(g.n,3));geo.setAttribute('uv',new T.Float32BufferAttribute(g.uv,2));geo.computeBoundingSphere();const mesh=new T.Mesh(geo,m);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}return root;
 }
 function dispose(root){root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.userData.ownedMaterial)o.material.dispose();});root.removeFromParent();}
 function rebuild(b){if(b.mesh)dispose(b.mesh);b.mesh=geometryFor(b,[...b.cells.values()].filter(c=>!c.removed));scene.add(b.mesh);}
 function remove(b,c){if(c.removed)return;c.removed=true;for(const p of c.parts)p.disabled=true;const l=b.layers.get(c.y);if(c.parts.length){l.removed+=c.supportFraction??1;if(c.core)l.coreRemoved+=c.supportFraction??1;}stats.removedSections++;dirty.add(b);}
 function visualShockwave(point,radius,direction=new T.Vector3(0,1,0)){
  if(rings.length>=8)return;const mesh=new T.Mesh(new T.RingGeometry(.84,1,64),new T.MeshBasicMaterial({color:'#d5efff',transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false}));mesh.position.copy(point);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction.clone().normalize());scene.add(mesh);rings.push({mesh,age:0,radius});
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
 function chunks(cells,divisions){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const c of cells)for(const [i,k] of ['x','y','z'].entries()){min[i]=Math.min(min[i],c[k]);max[i]=Math.max(max[i],c[k]);}
  const sizes=min.map((v,i)=>Math.max(1,Math.ceil((max[i]-v+1)/divisions[i]))),groups=new Map();for(const c of cells){const k=['x','y','z'].map((axis,i)=>Math.max(0,Math.min(divisions[i]-1,Math.floor((c[axis]-min[i]+(i===1?(c.x-min[0])*.23+(c.z-min[2])*.17+Math.sin(c.x*3.1+c.z*2.3)*.6:0))/sizes[i])))).join(',');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);}return [...groups.values()];
 }
 function restore(b){
  if(b.mesh){dispose(b.mesh);b.mesh=null;}
  for(const r of b.ranges){if(!r.originalPositions)continue;const p=r.b.geometry.attributes.position;p.array.set(r.originalPositions,r.start*3);p.addUpdateRange(r.start*3,(r.end-r.start)*3);p.needsUpdate=true;delete r.originalPositions;}
  world.removeFragments(b);for(const solid of b.solids)solid.disabled=false;
  b.supportLayers=null;b.lastHeat=null;b.cells=null;b.layers=null;b.active=b.falling=b.pending=false;dirty.delete(b);active.delete(b);stats.respawns=(stats.respawns||0)+1;
 }
 function assessSupports(b,velocity){
  const live=[],rows=new Map();let maxY=-Infinity,baseY=Infinity;
  for(const c of b.cells.values()){if(!c.parts.length)continue;baseY=Math.min(baseY,c.y);if(c.removed)continue;live.push(c);maxY=Math.max(maxY,c.y);let row=rows.get(c.y);if(!row){row={count:0,center:new T.Vector3()};rows.set(c.y,row);}row.count++;row.center.add(c.center);}
  if(!live.length)return;
  // Connection to the foundation prevents disconnected islands hanging in space.
  const connected=new Set(),queue=live.filter(c=>c.y===baseY);for(const c of queue)connected.add(c.k);
  for(let i=0;i<queue.length;i++){const c=queue[i];for(const [x,y,z] of NEIGHBORS){const n=b.cells.get(key(c.x+x,c.y+y,c.z+z));if(n&&!n.removed&&n.parts.length&&!connected.has(n.k)){connected.add(n.k);queue.push(n);}}}
  const loose=new Set(live.filter(c=>!connected.has(c.k)).map(c=>c.k));
  let level=failedSupportLevel(b,CELL),lean=new T.Vector3();
  for(const [y,l] of b.layers){
   if(y>=maxY||!l.total||!l.removed)continue;
   const row=rows.get(y),coreLeft=l.coreTotal?1-l.coreRemoved/l.coreTotal:1,areaLeft=1-l.removed/l.total;
   const centroid=row?row.center.multiplyScalar(1/row.count):new T.Vector3();
   const eccentricity=row?Math.hypot((centroid.x-b.x)/Math.max(CELL,(b.bounds.max.x-b.bounds.min.x)*.5),(centroid.z-b.z)/Math.max(CELL,(b.bounds.max.z-b.bounds.min.z)*.5)):1;
   // Core loss, missing floor area and off-center support act together.
   const failed=areaLeft<.42||(coreLeft<.35&&areaLeft<.78)||(areaLeft<.70&&eccentricity>.32);
   if(failed&&y*CELL<level){level=y*CELL;lean.set(b.x-centroid.x,0,b.z-centroid.z);}
  }
  if(level===Infinity&&!loose.size)return;
  let event=pending.find(e=>e.b===b&&!e.topOnly);
  if(!event){event={b,level,loose,topOnly:false,velocity:velocity.clone(),lean,delay:.22};pending.push(event);
   // Low-opacity drifting plumes mark the failing floor before its sections fall.
   const y=Number.isFinite(level)?Math.max(b.bounds.min.y,level):b.bounds.min.y;
   for(let i=0;i<4;i++){const a=i*Math.PI*.5,dx=Math.cos(a),dz=Math.sin(a),p=new T.Vector3(b.x+dx*(b.bounds.max.x-b.bounds.min.x)*.48,y+1,b.z+dz*(b.bounds.max.z-b.bounds.min.z)*.48);cloud(p,2.5,new T.Vector3(dx*30,8,dz*30),1.6,.32);}
  }else{event.level=Math.min(event.level,level);for(const k of loose)event.loose.add(k);if(lean.lengthSq())event.lean.copy(lean);}
  b.pending=true;
 }
 function detach(b,level,topOnly,velocity,loose=new Set(),lean=new T.Vector3()){
  if(b.falling)return;if(topOnly){topBlast(b,velocity);return;}b.pending=false;
  const cells=[...b.cells.values()].filter(c=>!c.removed&&(c.y*CELL>=level||loose.has(c.k)));if(!cells.length)return;
  const groups=chunks(cells,[1,Math.min(4,Math.max(1,Math.ceil((Math.max(...cells.map(c=>c.y))-Math.min(...cells.map(c=>c.y)))*CELL/28))),1]);for(const c of cells)remove(b,c);
  b.falling=![...b.cells.values()].some(c=>!c.removed&&c.parts.length);
  for(let i=0;i<groups.length;i++){
   const mesh=geometryFor(b,groups[i],true,true);if(!mesh.children.length)continue;
   const box=new T.Box3().setFromObject(mesh),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),emitters=[];
   for(const c of groups[i])if(c.surfaces.size&&emitters.length<96)emitters.push(c.center.clone().sub(center));
   for(const child of mesh.children){child.geometry.translate(-center.x,-center.y,-center.z);child.castShadow=false;child.material=child.material.clone();child.material.clippingPlanes=[new T.Plane(new T.Vector3(0,1,0),-.25)];child.userData.ownedMaterial=true;}
   mesh.position.copy(center);scene.add(mesh);
   const lateral=new T.Vector3(velocity.z,0,-velocity.x).normalize().multiplyScalar((i%2?1:-1)*2);
   const v=velocity.clone().multiplyScalar(.018+i*.004).add(lateral.multiplyScalar(.35)).addScaledVector(lean.clone().normalize(),3);v.y=-1-i*.35;
   const tilt=lean.lengthSq()>.01?lean:velocity;const axis=new T.Vector3(tilt.z,.025*tilt.length(),-tilt.x).normalize();
   // All active sections remain visible until their natural cleanup below ground.
   falling.push({mesh,building:b,cells:groups[i],sourceCenter:center.clone(),v,axis,spin:.12+i*.035,age:0,radius:size.length()*.5,halfHeight:size.y*.5,halfSize:size.clone().multiplyScalar(.5),emitters,nextEmit:.35,groundDust:false});
  }stats.collapses++;audio?.destruction({x:b.x,y:level,z:b.z},true);
 }
 function strike(b,point,velocity,profile){
  if(b.falling)return false;
  activate(b);const direction=velocity.clone().normalize(),changed=[];
  for(const c of b.cells.values()){
   if(c.removed)continue;const dx=c.center.x-point.x,dy=c.center.y-point.y,dz=c.center.z-point.z,along=dx*direction.x+dy*direction.y+dz*direction.z;if(along< -CELL||along>profile.depth+CELL)continue;
   const px=dx-direction.x*along,py=dy-direction.y*along,pz=dz-direction.z*along;if(px*px+py*py+pz*pz>(profile.radius+CELL*.65)**2)continue;remove(b,c);changed.push(c);
  }
  if(!changed.length)return false;
  burst(point,velocity,profile.fast>.5?32:20,Math.min(8,profile.radius*1.3));

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
 function hit(contact,position,velocity,{powered=false}={}){
  // A contact queued earlier in the frame must not catch the hero after detachment.
  if(contact.solid?.fallingSection||contact.solid?.disabled)return {pass:true};
  const b=contact.solid?.building;if(!b)return null;
  const speed=velocity.length(),closing=Math.max(0,-velocity.dot(contact.normal));
  const top=Math.max(...b.solids.map(s=>s.y2)),bottom=Math.min(...b.solids.map(s=>s.y1));
  const point=position.clone().add(contact.offset).addScaledVector(contact.normal,-.28);
  const profile=damageProfile(speed,closing/Math.max(.001,speed),powered,(point.y-bottom)/(top-bottom));if(!profile.destructive)return null;
  if(profile.topOnly&&profile.severe&&!b.falling){activate(b);topBlast(b,velocity,point.y);velocity.multiplyScalar(profile.retention);return {pass:true};}
  if(!strike(b,point,velocity,profile))return null;
  if(profile.fast>.5&&!profile.graze){if(rings.length<6){const ring=new T.Mesh(new T.RingGeometry(.82,1,40),new T.MeshBasicMaterial({color:'#c8e4ef',transparent:true,opacity:.4,side:T.DoubleSide,depthWrite:false}));ring.position.copy(point);ring.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),velocity.clone().normalize());scene.add(ring);rings.push({mesh:ring,age:0,radius:profile.radius});}waves.push({b,p:point.clone(),v:velocity.clone(),profile:{...profile,severe:false,radius:profile.radius*1.45,depth:profile.depth*1.3},delay:.08});}
  // Direct breakthroughs retain momentum. A graze still uses the ordinary
  // collision response, which strips inward velocity while preserving the slide.
  velocity.multiplyScalar(profile.retention);return {pass:!profile.graze};
 }
 function punch(b,point,direction,kind,cone=null){
  if(b.falling)return;
  const velocity=direction.clone().multiplyScalar(kind==='quick'?40:150);
  if(kind!=='serious'){strike(b,point,velocity,{destructive:true,graze:false,fast:kind==='quick'?0:1,severe:kind==='normal',topOnly:false,radius:kind==='quick'?1.5:NORMAL_DAMAGE_RADIUS,depth:kind==='quick'?4:32});return;}
  // Cut only the force cone out of the facade; support loss drives the collapse.
  activate(b);const removed=[];
  const shape=cone||{origin:point,reach:337.5,width:10.5,spread:12/337.5};
  for(const c of b.cells.values()){
   if(c.removed)continue;const delta=c.center.clone().sub(shape.origin),along=delta.dot(direction);
   if(along<0||along>shape.reach)continue;
   if(delta.addScaledVector(direction,-along).length()>shape.width+shape.spread*along)continue;
   removed.push(c);remove(b,c);
  }
  if(!removed.length)return;
  // Original textured surfaces become moving fragments, not invisible geometry.
  for(const group of chunks(removed,[2,2,2])){
   const mesh=geometryFor(b,group,true,true);if(!mesh.children.length)continue;
   const box=new T.Box3().setFromObject(mesh),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
   for(const child of mesh.children){child.geometry.translate(-center.x,-center.y,-center.z);child.castShadow=false;}
   mesh.position.copy(center);scene.add(mesh);
   const axis=new T.Vector3(direction.z,.3,-direction.x).normalize(),v=direction.clone().multiplyScalar(22+Math.random()*16);v.y+=8+Math.random()*8;
   falling.push({mesh,building:b,cells:group,sourceCenter:center.clone(),v,axis,spin:.4+Math.random()*.6,age:0,radius:size.length()*.5,halfHeight:size.y*.5,halfSize:size.clone().multiplyScalar(.5),emitters:[],nextEmit:0,groundDust:false});
  }
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
   if(processed>=1)break;const wasActive=b.active;activate(b);b.lastHeat={o:origin.clone(),end:end.clone()};let removed=0;
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

  clock+=dt;const workStart=performance.now();let collapsesThisFrame=0;
  for(const event of pressure)event.delay-=dt;const ready=pressure.findIndex(event=>event.delay<=0);if(ready>=0){const event=pressure.splice(ready,1)[0];strike(event.b,event.point,event.velocity,event.profile);stats.shockwaveHits=(stats.shockwaveHits||0)+1;}
  // Direct hits remain synchronous. Secondary collapses are staged, oldest first,
  // rather than rebuilding every destabilized tower during the same frame.
  for(const event of pending)event.delay-=dt;
  for(let i=0;i<pending.length;){const event=pending[i];if(event.delay>0){i++;continue;}if(collapsesThisFrame>=(mobile?1:2)||collapsesThisFrame&&performance.now()-workStart>3)break;detach(event.b,event.level,event.topOnly,event.velocity,event.loose,event.lean);pending.splice(i,1);collapsesThisFrame++;}
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
  const rebuildStart=performance.now();stats.rebuiltThisFrame=dirty.size;for(const b of dirty)rebuild(b);dirty.clear();stats.rebuildMs=performance.now()-rebuildStart;stats.rebuildPeakMs=Math.max(stats.rebuildPeakMs||0,stats.rebuildMs);
  let live=0;for(const d of debris){d.age+=dt;if(d.age<=7)debris[live++]=d;}debris.length=live;
  for(let i=0;i<debris.length;i++){const d=debris[i];if(!d.rest){d.v.y-=24*dt;d.p.addScaledVector(d.v,dt);const ground=world.ground(d.p.x,d.p.z)+d.size.length()*.5;if(d.p.y<ground){d.p.y=ground;d.v.y=Math.abs(d.v.y)*.15;d.v.x*=.55;d.v.z*=.55;if(d.v.length()<1.8)d.rest=true;}d.v.x*=Math.exp(-dt*(d.glass?.65:.12));d.v.z*=Math.exp(-dt*(d.glass?.65:.12));d.q.multiply(spinStep.setFromAxisAngle(d.axis,d.spin*dt));}
   dummy.position.copy(d.p);dummy.quaternion.copy(d.q);dummy.scale.copy(d.size).multiplyScalar(d.age>5?(7-d.age)/2:1);dummy.updateMatrix();debrisMesh.setMatrixAt(i,dummy.matrix);debrisMesh.setColorAt(i,d.color);
  }debrisMesh.count=debris.length;upload(debrisMesh.instanceMatrix,debris.length*16);if(debrisMesh.instanceColor)upload(debrisMesh.instanceColor,debris.length*3);stats.debris=debris.length;
  live=0;for(const d of dust){d.age+=dt;if(d.age<=d.life)dust[live++]=d;}dust.length=live;
  for(let i=0;i<dust.length;i++){const d=dust[i];d.v.multiplyScalar(Math.exp(-1.2*dt));d.p.addScaledVector(d.v,dt);d.p.y+=dt*1.6;dummy.position.copy(d.p);if(camera)dummy.quaternion.copy(camera.quaternion);else dummy.quaternion.identity();dummy.rotateZ(d.rotation);dummy.scale.setScalar(d.scale*(.6+d.age*.8));dummy.updateMatrix();dustMesh.setMatrixAt(i,dummy.matrix);dustAlpha.setX(i,d.opacity*Math.min(1,d.age*12)*(1-d.age/d.life));}dustMesh.count=dust.length;upload(dustMesh.instanceMatrix,dust.length*16);upload(dustAlpha,dust.length);stats.dust=dust.length;

 }
 function upload(attribute,count){attribute.clearUpdateRanges();if(count){attribute.addUpdateRange(0,count);attribute.needsUpdate=true;}}
 function reset(){
  for(const [b] of prepared){b.cells=b.layers=b.supportLayers=null;for(const r of b.ranges)delete r.originalPositions;}prepared.clear();preparationTargets=[];preparationClock=1;
  pending.length=waves.length=pressure.length=0;stats.pendingCollapses=stats.collapsesThisFrame=0;
  for(const f of falling)dispose(f.mesh);falling.length=0;world.setHeroSections([]);stats.heroColliders=0;
  for(const r of rings){r.mesh.material.dispose();dispose(r.mesh);}rings.length=0;
  for(const b of [...active])restore(b);
  debris.length=dust.length=0;debrisMesh.count=dustMesh.count=0;
  stats.activeBuildings=stats.visualSections=stats.debris=stats.dust=0;
 }
 return {prepareNearby,reset,hit,heat,update,stats,burst,shockwave,punch,punchFalling,roadBurst,plume:(p,size,v)=>cloud(p,Math.min(7,size*.06),v,1.4,.25)};
}
