import * as T from './vendor/three.module.js';
import {TITAN_ZONES,titanDirection} from './titan-reactions.js';
export function createTitanHitZones({root,rig,head,upperBody,thorax,arms,legs,meshes}){
 const raycaster=new T.Raycaster(),triangle=new T.Triangle(),v=new T.Vector3(),p=new T.Vector3(),axis=new T.Vector3();
 function anchor(z){
  const s=z.side,a=arms.find(a=>a.side===s),l=legs.find(l=>l.side===s);
  if(z.type==='head')return [head,[0,2.12,0]];
  if(z.type==='shoulder'||z.type==='arm')return [a.shoulder,[s*.40,1.81,0]];
  if(z.type==='forearm')return [a.elbow,[s*.40,1.38,0]];
  if(z.type==='thigh')return [l.hip,[s*.19,1.05,0]];
  if(z.type==='knee'||z.type==='shin')return [l.knee,[s*.19,.59,0]];
  return z.center[1]>1.55?[thorax,[0,1.55,0]]:z.center[1]>1.15?[upperBody,[0,1.15,0]]:[rig,[0,0,0]];
 }
 function classify(point,direction,distance,direct){
  let chosen=null,best=Infinity;
  for(const z of TITAN_ZONES){const [bone,base]=anchor(z),local=bone.worldToLocal(point.clone());
   let score=0;for(let k=0;k<3;k++)score+=((local.getComponent(k)-(z.center[k]-base[k]))/z.size[k])**2;
   if(score<best){best=score;chosen=z;}
  }
  const local=direction.clone().transformDirection(new T.Matrix4().copy(rig.matrixWorld).invert());
  return {zone:chosen.id,direction:titanDirection(local,chosen.face),distance,direct,point:point.toArray()};
 }
 function hit(origin,direction,spec){
  root.updateWorldMatrix(true,true);const visible=meshes.filter(m=>m.visible&&m.name==='monolith-concept'),dir=direction.clone().normalize();
  raycaster.set(origin,dir);raycaster.near=0;raycaster.far=spec.reach;
  const exact=raycaster.intersectObjects(visible,false)[0];
  if(exact)return classify(exact.point,dir,exact.distance,true);
  // The centerline missed: find the closest actual triangle in the expanding
  // punch volume. Ranking by normalized miss prevents a peripheral arm beating
  // a more directly struck chest. No actor-center or giant capsule proxy.
  let best=Infinity,contact=null,range=0;
  for(const mesh of visible){
   mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld),center=box.getCenter(new T.Vector3());
   const along=T.MathUtils.clamp(center.sub(origin).dot(dir),0,spec.reach);axis.copy(origin).addScaledVector(dir,along);
   if(box.distanceToPoint(axis)>(spec.width||0)+(spec.spread||0)*along+box.getSize(v).length()*.5)continue;
   const ps=mesh.geometry.attributes.position;
   for(let i=0;i<ps.count;i+=3){triangle.a.fromBufferAttribute(ps,i).applyMatrix4(mesh.matrixWorld);triangle.b.fromBufferAttribute(ps,i+1).applyMatrix4(mesh.matrixWorld);triangle.c.fromBufferAttribute(ps,i+2).applyMatrix4(mesh.matrixWorld);
    triangle.getMidpoint(p);let d=T.MathUtils.clamp(p.sub(origin).dot(dir),0,spec.reach);
    for(let j=0;j<2;j++){axis.copy(origin).addScaledVector(dir,d);triangle.closestPointToPoint(axis,p);d=T.MathUtils.clamp(v.copy(p).sub(origin).dot(dir),0,spec.reach);}
    const projection=v.copy(p).sub(origin).dot(dir);if(projection<-.3||projection>spec.reach)continue;
    axis.copy(origin).addScaledVector(dir,d);const width=(spec.width||0)+(spec.spread||0)*d,miss=p.distanceTo(axis);
    if(miss>width)continue;const score=miss/Math.max(width,.001)+d/Math.max(spec.reach,1)*.00001;
    if(score<best){best=score;contact=p.clone();range=d;}
   }
  }
  return contact?classify(contact,dir,range,false):null;
 }
 return {hit,classify,centers(){root.updateWorldMatrix(true,true);return TITAN_ZONES.map(z=>{const [bone,base]=anchor(z);return {...z,point:bone.localToWorld(new T.Vector3(...z.center).sub(new T.Vector3(...base)))};});}};
}
