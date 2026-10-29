import {desktopVisuals,pressureMaterial,vaporMap,finishSurface} from './visual-polish.js';
import {createPunchVariationPicker} from './punch-variants.js';
import * as T from './vendor/three.module.js';
export const PUNCHES={quick:{windup:.065,duration:.23,cooldown:.32,reach:4,width:2.2,shake:.12},normal:{windup:.30,duration:.78,cooldown:.425,reach:5,width:2.8,shake:.6},serious:{windup:1.1,duration:2,cooldown:5,reach:337.5,width:10.5,spread:12/337.5,roadReach:450,shake:1}};
export function punchEffectDirection(kind,direction){return direction.clone().normalize();}
export function cameraBlastAim(camera,origin,reach){
 const forward=camera.getWorldDirection(new T.Vector3());
 const depth=Math.max(.1,origin.clone().sub(camera.position).dot(forward))+reach;
 const target=camera.position.clone().addScaledVector(forward,depth);
 return {direction:target.clone().sub(origin).normalize(),target};
}
export function punchTarget(origin,direction,box,reach,width,spread=0){
 const center=box.getCenter(new T.Vector3()),along=T.MathUtils.clamp(center.clone().sub(origin).dot(direction),0,reach);
 const point=box.clampPoint(origin.clone().addScaledVector(direction,along),new T.Vector3()),delta=point.clone().sub(origin),forward=delta.dot(direction);
 if(forward<-.3||forward>reach)return null;
 return delta.addScaledVector(direction,-forward).length()<=width+spread*forward?{point,distance:forward}:null;
}
export function createPunchState(onImpact){
 const pickVariation=createPunchVariationPicker();let current=null;const cooldowns={quick:0,normal:0,serious:0};
 function canPress(kind){return !!PUNCHES[kind]&&cooldowns[kind]<=0&&(!current||kind==='quick'||kind==='normal'&&current.kind==='normal'&&current.hit);}
 return {get current(){return current;},cooldowns,canPress,press(kind,direction){if(!canPress(kind))return false;current={kind,variant:pickVariation(kind),age:0,hit:false,direction:direction.clone().normalize()};cooldowns[kind]=PUNCHES[kind].cooldown;return true;},update(dt){for(const k in cooldowns)cooldowns[k]=Math.max(0,cooldowns[k]-dt);if(!current)return null;const attack=current,spec=PUNCHES[attack.kind];attack.age+=dt;if(!attack.hit&&attack.age>=spec.windup){attack.hit=true;onImpact(attack);}if(attack.age>=spec.duration)current=null;return current;},cancel(){current=null;},reset(){current=null;for(const k in cooldowns)cooldowns[k]=0;}};
}
export function createPunches(scene,{buildings,destruction,groundDamage,cityLife,groundHeight,camera,audio=null,hero=null,combat=null,targetPoint=()=>null,onPunchThrown=()=>{},getVelocity=()=>new T.Vector3(),actorId='player'}){
 let position=new T.Vector3(),shake=0;const events=[],rings=[],stats={quick:0,normal:0,serious:0,buildingsHit:0};
 const targets=buildings.map(b=>{const box=new T.Box3();for(const s of b.solids)box.union(new T.Box3(new T.Vector3(s.x1,s.y1,s.z1),new T.Vector3(s.x2,s.y2,s.z2)));return {b,box};});
 const ringGeo=new T.RingGeometry(desktopVisuals()?.78:.88,1,desktopVisuals()?96:48);
 function ring(origin,dir,size,reach=0){const mesh=new T.Mesh(ringGeo,pressureMaterial('#e9f7ff'));mesh.position.copy(origin);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir);scene.add(mesh);rings.push({mesh,age:0,size,dir:dir.clone(),origin:origin.clone(),reach});}
 let attackId=0;
 function impact(attack){onPunchThrown(attack.kind);const id='punch-'+actorId+'-'+(++attackId),hitSet=new Set();audio?.punch(attack.kind);const momentum=getVelocity().clone(),spec=PUNCHES[attack.kind],origin=position.clone().add(new T.Vector3(0,1.45*(hero?.character?.height||1),0)),dir=punchEffectDirection(attack.kind,attack.direction),horizontal=dir.clone().setY(0).normalize();if(horizontal.lengthSq()<.5)horizontal.set(0,0,1);const guard={x:position.x,z:position.z,dx:horizontal.x,dz:horizontal.z};const actorOrigin=origin.clone();origin.addScaledVector(horizontal,2.5);const locked=targetPoint();if(locked)dir.copy(locked.sub(attack.kind==='serious'?origin:actorOrigin).normalize());else if(camera&&attack.kind==='serious')dir.copy(cameraBlastAim(camera,origin,spec.reach).direction);if(attack.kind!=='serious')combat?.punch(actorOrigin,dir,attack.kind,{...spec,reach:spec.reach+2.5,momentum},actorId,id);if(attack.kind!=='serious')cityLife.punch?.(actorOrigin,dir,attack.kind,{...spec,reach:spec.reach+2.5,momentum},hitSet);stats[attack.kind]++;shake=Math.max(shake,spec.shake);ring(origin.clone().addScaledVector(dir,1.1),dir,attack.kind==='serious'?144:attack.kind==='normal'?14:3,attack.kind==='serious'?spec.reach:0);
  destruction.punchFalling?.(origin,dir,attack.kind,spec);
  const hits=[],bound=spec.reach+spec.width+(attack.kind==='serious'?spec.spread*spec.reach:0)+1;for(const {b,box} of targets){if(b.falling)continue;const dx=Math.max(box.min.x-origin.x,0,origin.x-box.max.x),dy=Math.max(box.min.y-origin.y,0,origin.y-box.max.y),dz=Math.max(box.min.z-origin.z,0,origin.z-box.max.z);if(dx*dx+dy*dy+dz*dz>bound*bound)continue;const hit=punchTarget(origin,dir,box,spec.reach,spec.width,attack.kind==='serious'?spec.spread:0);if(hit)hits.push({b,...hit});}hits.sort((a,b)=>a.distance-b.distance);
  for(const hit of (attack.kind==='serious'?hits:hits.slice(0,1)))events.push({type:'building',kind:attack.kind,...hit,dir:dir.clone(),cone:attack.kind==='serious'?{origin:origin.clone(),reach:spec.reach,width:spec.width,spread:spec.spread}:null,delay:attack.kind==='serious'?hit.distance/210:0});
  if(attack.kind==='serious'){for(let distance=3;distance<=spec.roadReach;distance+=6)events.push({type:'wave',kind:attack.kind,id,hitSet,actorOrigin,momentum:momentum.clone(),point:origin.clone().addScaledVector(dir,distance),dir:dir.clone(),distance,radius:Math.min(22.5,spec.width+distance*spec.spread),guard,delay:distance/210});}
  else{const point=hits[0]?.point||origin.clone().addScaledVector(dir,spec.reach-1);destruction.burst(point,dir.clone().multiplyScalar(attack.kind==='quick'?20:110),attack.kind==='quick'?8:28,attack.kind==='quick'?1.5:5);groundDamage.punch(point,attack.kind,guard);cityLife.shock(point,attack.kind==='quick'?3.5:12,attack.kind==='quick'?7:42,dir.clone().multiplyScalar(attack.kind==='quick'?15:120),{peopleEnabled:false});}
 }
 const state=createPunchState(impact);
 function update(dt,player,aim=null){position.copy(player);if(state.current&&aim)state.current.direction.copy(aim).normalize();state.update(dt);shake=Math.max(0,shake-dt*1.8);for(const e of events)e.delay-=dt;
  // At most one building and one terrain pulse per frame, even for a whole block.
  for(const type of ['building','wave']){const index=events.findIndex(e=>e.type===type&&e.delay<=0);if(index<0)continue;const e=events.splice(index,1)[0];if(type==='building'){destruction.punch(e.b,e.point,e.dir,e.kind,e.cone);stats.buildingsHit++;}else{e.point.y=Math.max(e.point.y,groundHeight(e.point.x,e.point.z)+.5);const radius=e.radius;groundDamage.punch(e.point,'serious',e.guard,radius);combat?.punch(e.actorOrigin,e.dir,'serious',{...PUNCHES.serious,momentum:e.momentum,minDistance:e.distance-6,maxDistance:e.distance+6},actorId,e.id);cityLife.punch?.(e.actorOrigin,e.dir,'serious',{...PUNCHES.serious,momentum:e.momentum,minDistance:e.distance-6,maxDistance:e.distance+6},e.hitSet);cityLife.shock(e.point,radius,65,e.dir.clone().multiplyScalar(180),{peopleEnabled:false});destruction.plume(e.point,radius,e.dir.clone().multiplyScalar(60));if(e.point.y-groundHeight(e.point.x,e.point.z)<8)destruction.roadBurst(e.point,e.dir,radius);}}
  for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.age+=dt;const lifetime=r.reach?r.reach/210+.2:.6;if(r.age>lifetime){scene.remove(r.mesh);r.mesh.material.dispose();rings.splice(i,1);continue;}if(r.reach){const distance=Math.min(r.reach,r.age*210);r.mesh.position.copy(r.origin).addScaledVector(r.dir,distance);r.mesh.position.y=Math.max(r.mesh.position.y,groundHeight(r.mesh.position.x,r.mesh.position.z)+.8);r.mesh.scale.setScalar(PUNCHES.serious.width+distance*PUNCHES.serious.spread);r.mesh.material.opacity=.22*(1-r.age/lifetime);continue;}r.mesh.position.addScaledVector(r.dir,dt*r.size*1.6);r.mesh.scale.setScalar(1+r.size*r.age/.6);r.mesh.material.opacity=.65*(1-r.age/.6)**2;}
  return state.current;
 }
 return {state,update,stats,get shake(){return shake;},reset(){state.reset();events.length=0;shake=0;for(const r of rings){scene.remove(r.mesh);r.mesh.material.dispose();}rings.length=0;}};
}
