import * as T from './vendor/three.module.js';
const EPS=1e-5;
export function beamPlanes(origin,direction,reach,radius=.18){
 const d=direction.clone().normalize(),u=new T.Vector3().crossVectors(d,Math.abs(d.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).normalize(),v=new T.Vector3().crossVectors(d,u);
 return [new T.Plane(d,-d.dot(origin)-reach),new T.Plane(d.clone().negate(),d.dot(origin)),... [u,v].flatMap(n=>[new T.Plane(n,-n.dot(origin)-radius),new T.Plane(n.clone().negate(),n.dot(origin)-radius)])];
}
export function clipFace(poly,plane){
 const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=plane.normal.x*a[0]+plane.normal.y*a[1]+plane.normal.z*a[2]+plane.constant,db=plane.normal.x*b[0]+plane.normal.y*b[1]+plane.normal.z*b[2]+plane.constant;if(da<=EPS)out.push(a);if(da>EPS&&db< -EPS||da< -EPS&&db>EPS){const t=da/(da-db);out.push(a.map((x,j)=>x+(b[j]-x)*t));}}return out;
}
export function outsideFace(poly,planes){let inside=poly;const result=[];for(const p of planes){const outside=clipFace(inside,p.clone().negate());if(outside.length>=3)result.push(outside);inside=clipFace(inside,p);if(inside.length<3)break;}return result;}
function clipSolid(faces,plane){
 const clipped=[],edge=[];for(const f of faces){const poly=clipFace(f.p,plane);if(poly.length>=3){clipped.push({...f,p:poly});for(const a of poly)if(Math.abs(plane.distanceToPoint(new T.Vector3(...a.slice(0,3))))<EPS*3&&!edge.some(b=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<EPS))edge.push(a);}}
 if(edge.length>=3){const center=new T.Vector3();for(const p of edge)center.add(new T.Vector3(...p.slice(0,3)));center.multiplyScalar(1/edge.length);const n=plane.normal,u=new T.Vector3().crossVectors(n,Math.abs(n.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).normalize(),v=new T.Vector3().crossVectors(n,u);edge.sort((a,b)=>{const aa=new T.Vector3(...a.slice(0,3)).sub(center),bb=new T.Vector3(...b.slice(0,3)).sub(center);return Math.atan2(aa.dot(v),aa.dot(u))-Math.atan2(bb.dot(v),bb.dot(u));});clipped.push({cap:true,p:edge.map(a=>[...a.slice(0,3),n.x,n.y,n.z,a[0]*.4,a[2]*.4])});}return clipped;
}
export function boxFaces(s){const {x1:a,x2:b,y1:c,y2:d,z1:e,z2:f}=s;return [ [[b,c,e],[b,d,e],[b,d,f],[b,c,f]],[[a,c,f],[a,d,f],[a,d,e],[a,c,e]],[[a,d,e],[a,d,f],[b,d,f],[b,d,e]],[[a,c,f],[a,c,e],[b,c,e],[b,c,f]],[[a,c,f],[b,c,f],[b,d,f],[a,d,f]],[[b,c,e],[a,c,e],[a,d,e],[b,d,e]] ].map(p=>{const n=new T.Plane().setFromCoplanarPoints(...p.slice(0,3).map(v=>new T.Vector3(...v))).normal;return {cap:false,p:p.map(v=>[...v,...n.toArray(),0,0])};});}
export function cutSolid(s,planes){
 if(planes.some(p=>p.normal.x*(p.normal.x>0?s.x1:s.x2)+p.normal.y*(p.normal.y>0?s.y1:s.y2)+p.normal.z*(p.normal.z>0?s.z1:s.z2)+p.constant> -EPS))return null;
 let faces=s.cutFaces||boxFaces(s);if(!s.cutFaces&&s.kind==='convex')for(const p of s.planes)faces=clipSolid(faces,p);faces=faces.map(f=>({...f,cap:false}));
 let overlap=faces;for(const p of planes){overlap=clipSolid(overlap,p);if(!overlap.length)return null;}
 if(volume(overlap)<1e-6)return null;
 const pieces=[];let inside=faces;
 for(const p of planes){const outside=clipSolid(inside,p.clone().negate());if(volume(outside)>1e-6){const box=new T.Box3();for(const f of outside)for(const v of f.p)box.expandByPoint(new T.Vector3(...v.slice(0,3)));const ps=[];for(const f of outside){if(f.p.length<3)continue;const plane=new T.Plane().setFromCoplanarPoints(...f.p.slice(0,3).map(v=>new T.Vector3(...v.slice(0,3))));if(plane.normal.lengthSq()>.5&&!ps.some(q=>q.normal.distanceToSquared(plane.normal)<1e-8&&Math.abs(q.constant-plane.constant)<EPS))ps.push(plane);}pieces.push({...s,disabled:false,kind:'convex',planes:ps,cutFaces:outside,x1:box.min.x,x2:box.max.x,y1:box.min.y,y2:box.max.y,z1:box.min.z,z2:box.max.z});}inside=clipSolid(inside,p);if(!inside.length)break;}
 return pieces;
}
export function volume(faces){let v=0;for(const f of faces)for(let i=1;i<f.p.length-1;i++){const a=new T.Vector3(...f.p[0].slice(0,3)),b=new T.Vector3(...f.p[i].slice(0,3)),c=new T.Vector3(...f.p[i+1].slice(0,3));v+=a.dot(b.cross(c))/6;}return Math.abs(v);}
export function facesGeometry(faces){const p=[],n=[],uv=[];for(const f of faces)for(let i=1;i<f.p.length-1;i++)for(const a of [f.p[0],f.p[i],f.p[i+1]]){p.push(...a.slice(0,3));n.push(...a.slice(3,6));uv.push(...a.slice(6,8));}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeBoundingSphere();return g;}
export function geometryFaces(g,matrix){const geo=g.index?g.toNonIndexed():g,p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv,nm=new T.Matrix3().getNormalMatrix(matrix),faces=[];for(let i=0;i<p.count;i+=3){const poly=[];for(let j=0;j<3;j++){const v=new T.Vector3().fromBufferAttribute(p,i+j).applyMatrix4(matrix),normal=new T.Vector3().fromBufferAttribute(n,i+j).applyMatrix3(nm).normalize();poly.push([...v.toArray(),...normal.toArray(),uv?uv.getX(i+j):0,uv?uv.getY(i+j):0]);}faces.push({p:poly});}if(geo!==g)geo.dispose();return faces;}
// Convex swept ribbon between consecutive beam positions; thickness stays narrow.
export function sweptBeamPlanes(origin,direction,reach,previous,radius=.18){
 if(!previous)return beamPlanes(origin,direction,reach,radius);
 const a=previous.origin,b=a.clone().addScaledVector(previous.direction,previous.reach),c=origin,d=c.clone().addScaledVector(direction,reach),normal=new T.Vector3().crossVectors(b.clone().sub(a),d.clone().sub(a));
 if(normal.lengthSq()<1e-6)return beamPlanes(origin,direction,reach,radius);normal.normalize();
 const points=[a,b,c,d].flatMap(p=>[p.clone().addScaledVector(normal,radius),p.clone().addScaledVector(normal,-radius)]),planes=[];
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)for(let k=j+1;k<points.length;k++){const p=new T.Plane().setFromCoplanarPoints(points[i],points[j],points[k]);if(p.normal.lengthSq()<.5)continue;const values=points.map(v=>p.distanceToPoint(v));if(values.every(v=>v>=-1e-5))p.negate();else if(!values.every(v=>v<=1e-5))continue;if(!planes.some(q=>q.normal.distanceToSquared(p.normal)<1e-8&&Math.abs(q.constant-p.constant)<1e-4))planes.push(p);}
 return planes.length>=4?planes:beamPlanes(origin,direction,reach,radius);
}
export function planesOverlapBox(planes,box){return !planes.some(p=>p.normal.x*(p.normal.x>0?box.min.x:box.max.x)+p.normal.y*(p.normal.y>0?box.min.y:box.max.y)+p.normal.z*(p.normal.z>0?box.min.z:box.max.z)+p.constant>0);}
