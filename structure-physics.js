import * as T from './vendor/three.module.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),axes=[V(1,0,0),V(0,1,0),V(0,0,1)];
export function rigidSection(position,size,velocity=V(),angular=V()){
 const mass=Math.max(1,size.x*size.y*size.z),invI=V(12/(mass*(size.y**2+size.z**2)),12/(mass*(size.x**2+size.z**2)),12/(mass*(size.x**2+size.y**2)));
 const b={p:position.clone(),q:new T.Quaternion(),h:size.clone().multiplyScalar(.5),v:velocity.clone(),w:angular.clone(),mass,invMass:1/mass,invI,rest:0,sleep:false,age:0};syncSection(b);return b;
}
export function syncSection(b){b.axes=axes.map(a=>a.clone().applyQuaternion(b.q));b.vertices=[];b.box=new T.Box3();for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const p=V(x*b.h.x,y*b.h.y,z*b.h.z).applyQuaternion(b.q).add(b.p);b.vertices.push(p);b.box.expandByPoint(p);}return b;}
function support(b,n,sign){let best=-Infinity,points=[];for(const p of b.vertices){const d=p.dot(n)*sign;if(d>best+1e-5){best=d;points=[p];}else if(Math.abs(d-best)<1e-5)points.push(p);}return points.reduce((a,p)=>a.add(p),V()).multiplyScalar(1/points.length);}
function radius(b,n){return Math.abs(n.dot(b.axes[0]))*b.h.x+Math.abs(n.dot(b.axes[1]))*b.h.y+Math.abs(n.dot(b.axes[2]))*b.h.z;}
// Full box/box separating-axis test, including the nine edge cross-products.
export function boxContact(a,b){if(!a.box.intersectsBox(b.box))return null;let depth=Infinity,normal=null;const delta=a.p.clone().sub(b.p),candidates=[...a.axes,...b.axes];for(const x of a.axes)for(const y of b.axes)candidates.push(x.clone().cross(y));
 for(const axis of candidates){if(axis.lengthSq()<1e-10)continue;const n=axis.clone().normalize(),distance=delta.dot(n),overlap=radius(a,n)+radius(b,n)-Math.abs(distance);if(overlap<=0)return null;if(overlap<depth){depth=overlap;normal=n.multiplyScalar(distance<0?-1:1);}}
 const pa=support(a,normal,-1),pb=support(b,normal,1),point=pa.add(pb).multiplyScalar(.5);point.clamp(new T.Vector3().max(a.box.min,b.box.min),new T.Vector3().min(a.box.max,b.box.max));return {normal,depth,point};
}
function staticBox(s){if(!s._rigidBox){s._rigidBox=rigidSection(V((s.x1+s.x2)/2,(s.y1+s.y2)/2,(s.z1+s.z2)/2),V(s.x2-s.x1,s.y2-s.y1,s.z2-s.z1));}return s._rigidBox;}
function staticContact(b,s){const contact=boxContact(b,staticBox(s));if(!contact)return null;if(s.kind==='convex'){// Convex facade planes reject empty corners of tapered towers.
 for(const plane of s.planes){const d=plane.distanceToPoint(b.p),overlap=radius(b,plane.normal)-d;if(overlap<=0)return null;if(overlap<contact.depth){contact.normal=plane.normal.clone();contact.depth=overlap;contact.point=support(b,contact.normal,-1);}}}return contact;}
function invInertia(b,v){return v.clone().applyQuaternion(b.q.clone().invert()).multiply(b.invI).applyQuaternion(b.q);}
function pointVelocity(b,r){return b.v.clone().add(b.w.clone().cross(r));}
function impulse(b,j,r){b.v.addScaledVector(j,b.invMass);b.w.add(invInertia(b,r.clone().cross(j)));b.w.clampLength(0,2.8);}
function denominator(b,r,n){return b.invMass+n.dot(invInertia(b,r.clone().cross(n)).cross(r));}
function resolve(a,b,c){const n=c.normal,ra=c.point.clone().sub(a.p),rb=b?c.point.clone().sub(b.p):V(),relative=pointVelocity(a,ra).sub(b?pointVelocity(b,rb):V()),closing=-relative.dot(n),sum=a.invMass+(b?b.invMass:0),depth=Math.max(0,c.depth-.002);
 a.p.addScaledVector(n,depth*a.invMass/sum*.85);if(b)b.p.addScaledVector(n,-depth*b.invMass/sum*.85);
 if(closing>0){const j=(closing*1.035)/(denominator(a,ra,n)+(b?denominator(b,rb,n):0));impulse(a,n.clone().multiplyScalar(j),ra);if(b)impulse(b,n.clone().multiplyScalar(-j),rb);const tangent=relative.clone().addScaledVector(n,closing);if(tangent.lengthSq()>1e-8){const speed=tangent.length();tangent.normalize();const friction=Math.min(j*.65,speed/(denominator(a,ra,tangent)+(b?denominator(b,rb,tangent):0)));impulse(a,tangent.clone().multiplyScalar(-friction),ra);if(b)impulse(b,tangent.clone().multiplyScalar(friction),rb);}}
 if(n.y>.35)a.supported=true;if(b&&n.y<-.35)b.supported=true;syncSection(a);if(b)syncSection(b);return closing;
}
export function sectionCollider(b){const planes=[];for(let i=0;i<3;i++)for(const sign of [-1,1]){const n=b.axes[i].clone().multiplyScalar(sign);planes.push(new T.Plane(n,-n.dot(b.p)-b.h.getComponent(i)));}return {kind:'convex',planes,x1:b.box.min.x,x2:b.box.max.x,y1:b.box.min.y,y2:b.box.max.y,z1:b.box.min.z,z2:b.box.max.z,structureBody:b};}
export function stepSections(bodies,world,dt,onImpact=()=>{}){
 const steps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/steps,events=new Map();
 for(let k=0;k<steps;k++){
  for(const b of bodies){b.age+=h;b.supported=false;if(b.sleep)continue;b.v.y-=18*h;b.p.addScaledVector(b.v,h);const angular=b.w.length();if(angular>1e-6)b.q.premultiply(new T.Quaternion().setFromAxisAngle(b.w.clone().normalize(),angular*h)).normalize();b.w.multiplyScalar(Math.exp(-.15*h));syncSection(b);}
  for(let iteration=0;iteration<5;iteration++){
   for(const b of bodies){if(b.sleep)continue;let ground=0;const low=b.vertices.reduce((best,p)=>p.y<best.y?p:best,b.vertices[0]);for(const p of b.vertices)if(p.y<b.box.min.y+.1)ground=Math.max(ground,world.ground(p.x,p.z));if(low.y<ground){const c={normal:V(0,1,0),depth:ground-low.y,point:support(b,V(0,1,0),-1)};record(b,null,c,resolve(b,null,c));}
    const r=Math.max(b.box.max.x-b.box.min.x,b.box.max.z-b.box.min.z)/2+.05;
    for(const s of world.nearby(b.p.x,b.p.z,r)){if(s.disabled||s.structureBody||s.kind==='branch'||s.kind==='vehicle'||s.y2<b.box.min.y||s.y1>b.box.max.y)continue;const c=staticContact(b,s);if(c)record(b,s,c,resolve(b,null,c));}
   }
   for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const a=bodies[i],b=bodies[j];if(a.sleep&&b.sleep)continue;const c=boxContact(a,b);if(!c)continue;if(a.sleep||b.sleep){a.sleep=b.sleep=false;a.rest=b.rest=0;}const speed=resolve(a,b,c);record(a,null,c,speed);record(b,null,{...c,normal:c.normal.clone().negate()},speed);}
  }
  for(const b of bodies){if(b.sleep)continue;if(b.supported&&b.v.lengthSq()<.09&&b.w.lengthSq()<.008)b.rest+=h;else b.rest=0;if(b.rest>.65){b.sleep=true;b.v.set(0,0,0);b.w.set(0,0,0);}}
 }
 function record(b,solid,c,speed){if(speed<8)return;const previous=events.get(b);if(!previous||speed>previous.speed)events.set(b,{solid,speed,point:c.point.clone(),normal:c.normal.clone()});}
 for(const [b,e] of events)onImpact(b,e);
}
