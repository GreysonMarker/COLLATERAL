import * as T from './vendor/three.module.js';
const UP=new T.Vector3(0,1,0),ZERO=[new T.Vector3()];
// Small position-based ragdolls share the crowd's instance batches. Settled bodies
// retain their pose without further physics; only 24 can simulate on phones.
export function createNPCRagdolls(world,{maxActive=24,maxVisible=32}={}){
 const bodies=[],matrix=new T.Matrix4(),inverse=new T.Matrix4(),quat=new T.Quaternion(),scale=new T.Vector3(1,1,1),axis=new T.Vector3(),xAxis=new T.Vector3(),zAxis=new T.Vector3(),basis=new T.Matrix4(),delta=new T.Vector3();
 function frame(body,a,b){const pa=body.nodes[a].p,pb=body.nodes[b].p;axis.subVectors(pb,pa).normalize();xAxis.subVectors(body.nodes.rs.p,body.nodes.ls.p);xAxis.addScaledVector(axis,-xAxis.dot(axis));if(xAxis.lengthSq()<.001)xAxis.set(1,0,0).addScaledVector(axis,-axis.x);if(xAxis.lengthSq()<.001)xAxis.set(0,0,1);xAxis.normalize();zAxis.crossVectors(xAxis,axis).normalize();xAxis.crossVectors(axis,zAxis).normalize();basis.makeBasis(xAxis,axis,zAxis);quat.setFromRotationMatrix(basis);return matrix.compose(pa,quat,scale);}
 function add(points,parts,velocity,seed=0){
  const body={nodes:{},links:[],parts:[],age:0,settled:false,quiet:0};
  for(const [name,p] of Object.entries(points)){const n={p:p.clone(),old:p.clone(),radius:name==='head'?.18:name==='pelvis'||name==='neck'?.18:.085};
   const kick=new T.Vector3(Math.sin(seed+name.length)*.5,0,Math.cos(seed+name.length)*.5);n.old.addScaledVector(velocity,-1/60).addScaledVector(kick,-1/60);body.nodes[name]=n;
  }
  function link(a,b,min=1,max=1){const length=points[a].distanceTo(points[b]);body.links.push({a,b,min:length*min,max:length*max});}
  for(const pair of [['pelvis','neck'],['ls','rs'],['lh','rh'],['ls','pelvis'],['rs','pelvis'],['ls','rh'],['rs','lh'],['neck','ls'],['neck','rs'],['pelvis','lh'],['pelvis','rh'],['neck','head']])link(...pair);
  link('pelvis','head',.9,1.01); // Prevent a right-angle neck fold.
  for(const side of ['l','r']){link(side+'s',side+'e');link(side+'e',side+'w');link(side+'h',side+'k');link(side+'k',side+'f');link(side+'s',side+'w',.35,.99);link(side+'h',side+'f',.4,.99);}
  for(const part of parts){inverse.copy(frame(body,...part.bone)).invert();body.parts.push({...part,offset:new T.Matrix4().multiplyMatrices(inverse,part.matrix),matrix:part.matrix.clone()});}
  bodies.push(body);const active=bodies.filter(b=>!b.settled);if(active.length>maxActive){const old=active[0];settle(old,true);}
  return body;
 }
 function settle(body,force=false){
  if(force){const center=body.nodes.pelvis.p.clone(),spine=delta.subVectors(body.nodes.neck.p,center).clone().normalize();
   if(Math.abs(spine.y)>.5){const rotation=new T.Quaternion().setFromUnitVectors(spine,new T.Vector3(0,.05,1).normalize());for(const n of Object.values(body.nodes))n.p.sub(center).applyQuaternion(rotation).add(center);}
  }
  // Preserve the final joint pose and rest the rendered body on the surface.
  let lift=-Infinity;const box=new T.Box3();
  for(const part of body.parts){const geo=part.b.mesh.geometry;if(!geo.boundingBox)geo.computeBoundingBox();part.matrix.multiplyMatrices(frame(body,...part.bone),part.offset);box.copy(geo.boundingBox).applyMatrix4(part.matrix);const floor=world.ground((box.min.x+box.max.x)*.5,(box.min.z+box.max.z)*.5);lift=Math.max(lift,floor+.015-box.min.y);}
  if(!Number.isFinite(lift))lift=0;if(!force)lift=Math.max(0,lift);
  for(const n of Object.values(body.nodes)){n.p.y+=lift;n.old.copy(n.p);}for(const part of body.parts)part.cached=false;body.settled=true;
 }
 function step(body,dt){
  body.age+=dt;let motion=0;
  for(const n of Object.values(body.nodes)){delta.subVectors(n.p,n.old).multiplyScalar(.985);n.old.copy(n.p);n.p.add(delta);n.p.y-=18*dt*dt;motion+=delta.lengthSq();}
  for(let iteration=0;iteration<5;iteration++){
   for(const link of body.links){const a=body.nodes[link.a].p,b=body.nodes[link.b].p;delta.subVectors(b,a);const length=delta.length();if(length<1e-6)continue;const target=T.MathUtils.clamp(length,link.min,link.max),correction=(length-target)/length*.5;a.addScaledVector(delta,correction);b.addScaledVector(delta,-correction);}
   // Keep wrists and elbows outside the chest, with natural bent joints.
   for(const name of ['le','re','lw','rw'])for(const anchor of ['neck','pelvis']){const n=body.nodes[name],c=body.nodes[anchor];delta.subVectors(n.p,c.p);const d=delta.length(),r=.23;if(d<r&&d>.001)n.p.addScaledVector(delta,(r-d)/d);}
   for(const n of Object.values(body.nodes)){const floor=world.ground(n.p.x,n.p.z)+n.radius;if(n.p.y<floor){n.p.y=floor;n.old.x=T.MathUtils.lerp(n.old.x,n.p.x,.35);n.old.z=T.MathUtils.lerp(n.old.z,n.p.z,.35);n.old.y=n.p.y;}}
  }
  for(const name of ['pelvis','neck','head']){const n=body.nodes[name],hit=world.contactAt(n.p,ZERO,n.radius,body,false);if(hit){delta.copy(hit.normal).multiplyScalar(hit.depth+.002);n.p.add(delta);n.old.addScaledVector(delta,.85);}}
  for(const n of Object.values(body.nodes)){if(world.confine?.(n.p,null,n.radius))world.confine(n.old,null,n.radius);}
  const grounded=Object.values(body.nodes).some(n=>n.p.y-world.ground(n.p.x,n.p.z)<.25);body.quiet=grounded&&motion<.0005?body.quiet+dt:0;if(body.quiet>.6||body.age>6)settle(body,body.age>6);
 }
 let accumulator=0;
 function update(dt,player,put){accumulator=Math.min(accumulator+dt,3/60);while(accumulator>=1/60){for(const body of bodies)if(!body.settled)step(body,1/60);accumulator-=1/60;}
  const visible=bodies.filter(b=>b.nodes.pelvis.p.distanceToSquared(player)<340**2).sort((a,b)=>a.nodes.pelvis.p.distanceToSquared(player)-b.nodes.pelvis.p.distanceToSquared(player)).slice(0,maxVisible);
  for(const body of visible)for(const part of body.parts){if(!body.settled||!part.cached){part.matrix.multiplyMatrices(frame(body,...part.bone),part.offset);part.cached=body.settled;}put(part.b,part.matrix,part.color);}
 }
 return {add,update,get stats(){return {dead:bodies.length,activeRagdolls:bodies.filter(b=>!b.settled).length};}};
}
