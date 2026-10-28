import * as T from './vendor/three.module.js';

// Stylized, closed character meshes: no cut surfaces or wound geometry.
// Share the crowd's batches; bounded short-lived simulation adds no draw calls.
export function createNPCFragments(world,limit=24){
 const pieces=[],matrix=new T.Matrix4(),box=new T.Box3(),localBox=new T.Box3();
 const axis=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(1,1,1);
 const offsets=[new T.Vector3()];let total=0;
 function add(parts,velocity,seed=0){
  if(!parts.length)return;
  const center=new T.Vector3();for(const part of parts)center.add(new T.Vector3().setFromMatrixPosition(part.matrix));center.multiplyScalar(1/parts.length);
  const inverse=new T.Matrix4().makeTranslation(-center.x,-center.y,-center.z);
  const piece={position:center,quaternion:new T.Quaternion(),velocity:velocity.clone(),spin:new T.Vector3(Math.sin(seed)*2,.6,Math.cos(seed)*2),age:0,quiet:0,sleeping:false,parts:[]};
  piece.velocity.y+=.25;
  for(const part of parts){const geometry=part.b.mesh.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();piece.parts.push({...part,offset:new T.Matrix4().multiplyMatrices(inverse,part.matrix),matrix:part.matrix.clone(),bounds:geometry.boundingBox});}
  if(pieces.length>=limit)pieces.shift();pieces.push(piece);total++;
 }
 function bounds(piece){
  matrix.compose(piece.position,piece.quaternion,scale);box.makeEmpty();
  for(const part of piece.parts){part.matrix.multiplyMatrices(matrix,part.offset);localBox.copy(part.bounds).applyMatrix4(part.matrix);box.union(localBox);}
  return box;
 }
 function update(dt,player,put){
  dt=Math.min(dt,.05);
  for(let i=pieces.length-1;i>=0;i--){const p=pieces[i];p.age+=dt;if(p.age>10){pieces.splice(i,1);continue;}
   scale.setScalar(p.age>8?(10-p.age)/2:1);
   if(!p.sleeping){
    p.velocity.y-=18*dt;p.position.addScaledVector(p.velocity,dt);
    const angular=p.spin.length();if(angular>.001){axis.copy(p.spin).divideScalar(angular);rotation.setFromAxisAngle(axis,angular*dt);p.quaternion.premultiply(rotation).normalize();}
    const contact=world.contactAt(p.position,offsets,.12,p,false);if(contact){p.position.addScaledVector(contact.normal,contact.depth+.002);const into=p.velocity.dot(contact.normal);if(into<0)p.velocity.addScaledVector(contact.normal,-into*1.1);}
    bounds(p);const floor=world.ground(p.position.x,p.position.z)+.015;
    if(box.min.y<=floor){p.position.y+=floor-box.min.y;p.velocity.y=Math.max(0,-p.velocity.y*.08);p.velocity.x*=Math.exp(-12*dt);p.velocity.z*=Math.exp(-12*dt);p.spin.multiplyScalar(Math.exp(-10*dt));p.quiet+=dt;}else p.quiet=0;
    if(p.quiet>.5&&p.velocity.lengthSq()<.04&&p.spin.lengthSq()<.04)p.sleeping=true;
   }
   if(p.position.distanceToSquared(player)>340**2)continue;
   bounds(p);for(const part of p.parts)put(part.b,part.matrix,part.color);
  }
 }
 return {add,update,get stats(){return {detachedLimbs:total,visibleFragments:pieces.length,activeFragments:pieces.filter(p=>!p.sleeping).length};}};
}
