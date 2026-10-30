import * as T from './vendor/three.module.js';
export function convexCollider(geometry,matrix){
 const p=geometry.attributes.position,index=geometry.index,planes=[],bounds=new T.Box3();const vertices=[];
 for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix);vertices.push(v);bounds.expandByPoint(v)}
 const count=index?index.count:p.count;
 for(let i=0;i<count;i+=3){const a=vertices[index?index.getX(i):i],b=vertices[index?index.getX(i+1):i+1],c=vertices[index?index.getX(i+2):i+2],plane=new T.Plane().setFromCoplanarPoints(a,b,c);if(plane.normal.lengthSq()<.1)continue;if(!planes.some(q=>q.normal.distanceToSquared(plane.normal)<1e-8&&Math.abs(q.constant-plane.constant)<.001))planes.push(plane)}
 // Open-ended architectural cylinders still need physical roof and underside.
 planes.push(new T.Plane(new T.Vector3(0,1,0),-bounds.max.y),new T.Plane(new T.Vector3(0,-1,0),bounds.min.y));
 return {kind:'convex',planes,x1:bounds.min.x,x2:bounds.max.x,y1:bounds.min.y,y2:bounds.max.y,z1:bounds.min.z,z2:bounds.max.z};
}
export class CollisionWorld{
 constructor(solids,ground){this.grid=new Map();this.dynamic=new Map();this.structures=new Map();this.heroSections=new Map();this.fragments=new Map();this.fragmentColumns=new Map();this.ground=ground;this._maps=[this.grid,this.dynamic,this.structures];this._heroMaps=[...this._maps,this.heroSections];for(const s of solids){if(s.kind==='branch'){s.x1=Math.min(s.a.x,s.b.x)-s.r;s.x2=Math.max(s.a.x,s.b.x)+s.r;s.y1=Math.min(s.a.y,s.b.y)-s.r;s.y2=Math.max(s.a.y,s.b.y)+s.r;s.z1=Math.min(s.a.z,s.b.z)-s.r;s.z2=Math.max(s.a.z,s.b.z)+s.r}for(let x=Math.floor(s.x1/56);x<=Math.floor(s.x2/56);x++)for(let z=Math.floor(s.z1/56);z<=Math.floor(s.z2/56);z++){const key=x+','+z;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(s)}}}
 addStatic(s){if(s.cell){const x=s.cell.x,y=s.cell.y,z=s.cell.z,k=x+','+y+','+z,col=x+','+z;if(!this.fragments.has(k))this.fragments.set(k,[]);this.fragments.get(k).push(s);if(!this.fragmentColumns.has(col))this.fragmentColumns.set(col,[]);this.fragmentColumns.get(col).push(s);return;}for(let x=Math.floor(s.x1/56);x<=Math.floor(s.x2/56);x++)for(let z=Math.floor(s.z1/56);z<=Math.floor(s.z2/56);z++){const key=x+','+z;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(s);}}
 removeFragments(building){for(const map of [this.fragments,this.fragmentColumns])for(const [key,list] of map){const keep=list.filter(s=>s.building!==building);if(keep.length)map.set(key,keep);else map.delete(key);}}
 setStructures(solids){this.structures.clear();for(const s of solids)for(let x=Math.floor(s.x1/56);x<=Math.floor(s.x2/56);x++)for(let z=Math.floor(s.z1/56);z<=Math.floor(s.z2/56);z++){const key=x+','+z;if(!this.structures.has(key))this.structures.set(key,[]);this.structures.get(key).push(s);}}
 setHeroSections(solids){this.heroSections.clear();for(const s of solids)for(let x=Math.floor(s.x1/56);x<=Math.floor(s.x2/56);x++)for(let z=Math.floor(s.z1/56);z<=Math.floor(s.z2/56);z++){const key=x+','+z;if(!this.heroSections.has(key))this.heroSections.set(key,[]);this.heroSections.get(key).push(s);}}
 setDynamic(solids){this.dynamic.clear();for(const s of solids)for(let x=Math.floor(s.x1/56);x<=Math.floor(s.x2/56);x++)for(let z=Math.floor(s.z1/56);z<=Math.floor(s.z2/56);z++){const key=x+','+z;if(!this.dynamic.has(key))this.dynamic.set(key,[]);this.dynamic.get(key).push(s)}}
 // Query once for a swept camera segment or the complete hero capsule. Never
 // concatenate buckets: a dense downtown bucket is visited many times per frame.
 nearbyBounds(x1,z1,x2,z2,y1=null,y2=null,hero=false,result=new Set()){
  result.clear();
  if(this.fragments.size)for(let x=Math.floor(x1/4.2);x<=Math.floor(x2/4.2);x++)for(let z=Math.floor(z1/4.2);z<=Math.floor(z2/4.2);z++){
   if(y1===null){const list=this.fragmentColumns.get(x+','+z);if(list)for(const s of list)if(!s.disabled)result.add(s);}
   else for(let y=Math.floor(y1/4.2);y<=Math.floor(y2/4.2);y++){const list=this.fragments.get(x+','+y+','+z);if(list)for(const s of list)if(!s.disabled)result.add(s);}
  }
  for(let x=Math.floor(x1/56);x<=Math.floor(x2/56);x++)for(let z=Math.floor(z1/56);z<=Math.floor(z2/56);z++){
   const k=x+','+z;
   for(const map of hero?this._heroMaps:this._maps){const list=map.get(k);if(list)for(const s of list)if(!s.disabled&&s.x2>=x1&&s.x1<=x2&&s.z2>=z1&&s.z1<=z2&&(y1===null||s.y2>=y1&&s.y1<=y2))result.add(s);}
  }
  return result;
 }
 nearby(x,z,r,y=null,hero=false){return this.nearbyBounds(x-r,z-r,x+r,z+r,y===null?null:y-r,y===null?null:y+r,hero);}

 setArenaBounds(bounds){this.arena={...bounds};this.arenaSolid={kind:'arena',indestructible:true};}
 arenaContact(p,r=0){if(!this.arena)return null;let best=null;
  for(const axis of ['x','y','z'])for(const side of ['min','max']){const bound=this.arena[side+axis.toUpperCase()];if(!Number.isFinite(bound))continue;const sign=side==='min'?1:-1,depth=sign*(bound-p[axis])+r;if(depth>0&&(!best||depth>best.depth)){const normal=new T.Vector3();normal[axis]=sign;best={normal,depth,solid:this.arenaSolid};}}
  return best;
 }
 confine(position,velocity=null,radius=0,offsets=null){if(!this.arena)return false;let touched=false;
  for(const axis of ['x','y','z']){const lo=this.arena['min'+axis.toUpperCase()],hi=this.arena['max'+axis.toUpperCase()];let a=0,b=0;if(offsets?.length){a=Infinity;b=-Infinity;for(const o of offsets){a=Math.min(a,o[axis]);b=Math.max(b,o[axis]);}}
   const min=Number.isFinite(lo)?lo+radius-a:-Infinity,max=Number.isFinite(hi)?hi-radius-b:Infinity,value=Math.max(min,Math.min(max,position[axis]));
   if(value!==position[axis]){const outward=position[axis]<min?-1:1;position[axis]=value;if(velocity&&velocity[axis]*outward>0)velocity[axis]=0;touched=true;}
  }return touched;
 }
 sphereSolid(p,r,s){if(s.disabled||this.titanWalking&&s.fallingSection)return false;
 if(s.building?.pendingCuts)for(const cut of s.building.pendingCuts){if(cut.sphere){if(p.distanceToSquared(cut.p)<(cut.radius+r)**2)return false;continue;}const x=p.x-cut.p.x,y=p.y-cut.p.y,z=p.z-cut.p.z,a=x*cut.d.x+y*cut.d.y+z*cut.d.z;if(a>=-4.2&&a<=cut.depth&&x*x+y*y+z*z-a*a<(cut.radius+r)**2)return false;}
if(p.y+r<s.y1||p.y-r>s.y2||p.x+r<s.x1||p.x-r>s.x2||p.z+r<s.z1||p.z-r>s.z2)return false;
 if(s.kind==='vehicle'){const dx=p.x-s.x,dz=p.z-s.z,lateral=dx*s.dz-dz*s.dx,longitudinal=dx*s.dx+dz*s.dz;const a=Math.max(Math.abs(lateral)-s.w,0),b=Math.max(Math.abs(longitudinal)-s.l,0),c=Math.max(s.y1-p.y,0,p.y-s.y2);return a*a+b*b+c*c<(r-.003)**2;}
 if(s.kind==='convex')return s.planes.every(q=>q.distanceToPoint(p)<r-.003);
 if(s.kind==='branch'){const x=s.b.x-s.a.x,y=s.b.y-s.a.y,z=s.b.z-s.a.z,length=x*x+y*y+z*z,t=T.MathUtils.clamp(((p.x-s.a.x)*x+(p.y-s.a.y)*y+(p.z-s.a.z)*z)/(length||1),0,1);return (p.x-s.a.x-x*t)**2+(p.y-s.a.y-y*t)**2+(p.z-s.a.z-z*t)**2<(r+s.r-.003)**2;}
 const dx=Math.max(s.x1-p.x,0,p.x-s.x2),dy=Math.max(s.y1-p.y,0,p.y-s.y2),dz=Math.max(s.z1-p.z,0,p.z-s.z2);return dx*dx+dy*dy+dz*dz<(r-.003)**2;
 }
 sphereHit(p,r,ground=true,hero=false){if(this.arenaContact(p,r))return true;if(ground&&p.y-r<this.ground(p.x,p.z)-.004)return true;for(const s of this.nearby(p.x,p.z,r,p.y,hero))if(this.sphereSolid(p,r,s))return true;return false}
 contactAt(position,offsets,radius=.28,excludeActor=null,hero=excludeActor===null){
  let best=null;
  const add=(normal,depth,offset,solid=null)=>{if(!best||depth>best.depth)best={normal,depth,offset:offset.clone(),solid};};
  for(const o of offsets){const p=position.clone().add(o),groundDepth=this.ground(p.x,p.z)+radius-p.y;
   const boundary=this.arenaContact(p,radius);if(boundary)add(boundary.normal,boundary.depth,o,boundary.solid);
   if(groundDepth>.004)add(new T.Vector3(0,1,0),groundDepth,o);
   for(const s of this.nearby(p.x,p.z,radius,p.y,hero)){if((excludeActor&&s.actor===excludeActor)||!this.sphereSolid(p,radius,s))continue;
    let normal,depth;
    if(s.kind==='convex'){let plane=s.planes[0];for(const q of s.planes)if(q.distanceToPoint(p)>plane.distanceToPoint(p))plane=q;normal=plane.normal.clone();depth=radius-plane.distanceToPoint(p);}
    else if(s.kind==='branch'){const ab=new T.Vector3().subVectors(s.b,s.a),t=T.MathUtils.clamp(p.clone().sub(s.a).dot(ab)/ab.lengthSq(),0,1);normal=p.clone().sub(s.a.clone().addScaledVector(ab,t));depth=radius+s.r-normal.length();normal.normalize();}
    else{const vehicle=s.kind==='vehicle',local=vehicle?new T.Vector3((p.x-s.x)*s.dz-(p.z-s.z)*s.dx,p.y,(p.x-s.x)*s.dx+(p.z-s.z)*s.dz):p.clone();
     const low=new T.Vector3(vehicle?-s.w:s.x1,s.y1,vehicle?-s.l:s.z1),high=new T.Vector3(vehicle?s.w:s.x2,s.y2,vehicle?s.l:s.z2);
     normal=local.clone().sub(local.clone().clamp(low,high));depth=radius-normal.length();
     if(normal.lengthSq()<1e-10){let distance=Infinity;for(const axis of ['x','y','z'])for(const sign of [-1,1]){const d=sign<0?local[axis]-low[axis]:high[axis]-local[axis];if(d<distance){distance=d;normal.set(0,0,0);normal[axis]=sign;}}depth=radius+distance;}else normal.normalize();
     if(vehicle)normal.set(normal.x*s.dz+normal.z*s.dx,normal.y,-normal.x*s.dx+normal.z*s.dz);
    }
    if(normal.lengthSq()>.5)add(normal,depth,o,s);
   }
  }
  return best;
 }
 projectSphere(position,radius){let touched=false;for(let i=0;i<4;i++){const contact=this.contactAt(position,[new T.Vector3()],radius);if(!contact)break;position.addScaledVector(contact.normal,contact.depth+.004);touched=true;}return touched;}
 bodyOffsets(quaternion,flying,scale=1,width=1){const offsets=[];for(let i=0;i<10;i++){const v=new T.Vector3(0,.28*scale*width+i*((flying?2.40:2.16)*scale-.28*scale*width)/9-1.2*scale,0);if(flying)v.applyQuaternion(quaternion);v.y+=1.2*scale;offsets.push(v)}return offsets}
 bodyHit(position,offsets){
  if(!offsets.length)return false;const r=this.bodyRadius??.28,p=this._bodyPoint??=new T.Vector3();
  let x1=Infinity,y1=Infinity,z1=Infinity,x2=-Infinity,y2=-Infinity,z2=-Infinity;
  for(const o of offsets){x1=Math.min(x1,o.x);x2=Math.max(x2,o.x);y1=Math.min(y1,o.y);y2=Math.max(y2,o.y);z1=Math.min(z1,o.z);z2=Math.max(z2,o.z);}
  const candidates=this.nearbyBounds(position.x+x1-r,position.z+z1-r,position.x+x2+r,position.z+z2+r,position.y+y1-r,position.y+y2+r,true,this._bodyCandidates??=new Set());
  for(const o of offsets){p.addVectors(position,o);if(this.arenaContact(p,r))return true;if(p.y-r<this.ground(p.x,p.z)-.004)return true;for(const s of candidates)if(this.sphereSolid(p,r,s))return true;}
  return false;
 }
 // Pose changes can overlap the ground even when translation was swept safely.
 recover(position,offsets,{verticalOnly=false}={}){
  this.confine(position,null,this.bodyRadius??.28,offsets);
  if(!this.bodyHit(position,offsets))return true;
  const start=position.clone(),trial=start.clone();let lift=0;
  for(const o of offsets)lift=Math.max(lift,this.ground(start.x+o.x,start.z+o.z)+(this.bodyRadius??.28)+.002-start.y-o.y);
  trial.y+=lift;
  if(!this.bodyHit(trial,offsets)){position.copy(trial);return true;}
  // Prefer a small upward correction for roofs, then the closest free direction.
  const directions=[new T.Vector3(0,1,0)];for(let y=1;y>=-1;y--)for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)if((x||y||z)&&!(x===0&&y===1&&z===0))directions.push(new T.Vector3(x,y,z).normalize());
  for(const radius of [.025,.05,.1,.2,.35,.55,.8,1.2,1.8,2.5])for(const direction of directions){if(verticalOnly&&(direction.x||direction.z))continue;trial.copy(start).addScaledVector(direction,radius);trial.y+=lift;if(!this.bodyHit(trial,offsets)){position.copy(trial);return true;}}
  return false;
 }
 moveAxis(position,axis,amount,offsets){this.lastContact=null;if(!amount)return false;const start=position[axis];position[axis]+=amount;if(!this.bodyHit(position,offsets))return false;this.lastContact=this.contactAt(position,offsets,this.bodyRadius??.28);let lo=0,hi=1;for(let k=0;k<9;k++){const t=(lo+hi)/2;position[axis]=start+amount*t;if(this.bodyHit(position,offsets))hi=t;else lo=t}position[axis]=start+amount*lo;return true}
 floorAt(x,z,maxY,hero=false){let floor=this.ground(x,z);const origin=new T.Vector3(x,maxY+.002,z),down=new T.Vector3(0,-1,0);for(const s of this.nearby(x,z,.05,null,hero)){if(s.kind==='vehicle'&&(Math.abs((x-s.x)*s.dz-(z-s.z)*s.dx)>s.w||Math.abs((x-s.x)*s.dx+(z-s.z)*s.dz)>s.l))continue;if(s.kind==='branch'||x<s.x1||x>s.x2||z<s.z1||z>s.z2)continue;if(s.kind==='convex'){let lo=0,hi=Infinity;for(const p of s.planes){const d=p.distanceToPoint(origin),v=p.normal.dot(down);if(Math.abs(v)<1e-8){if(d>0){hi=-1;break}}else if(v<0)lo=Math.max(lo,-d/v);else hi=Math.min(hi,-d/v)}if(lo<=hi&&lo>=0&&lo<Infinity)floor=Math.max(floor,origin.y-lo)}else if(s.y2<=maxY+.003)floor=Math.max(floor,s.y2)}return floor}
 cameraFraction(start,end){
  const distance=start.distanceTo(end),steps=Math.max(1,Math.ceil(distance/.16)),point=this._cameraPoint??=new T.Vector3();
  const candidates=this.nearbyBounds(Math.min(start.x,end.x)-.16,Math.min(start.z,end.z)-.16,Math.max(start.x,end.x)+.16,Math.max(start.z,end.z)+.16,Math.min(start.y,end.y)-.16,Math.max(start.y,end.y)+.16,false,this._cameraCandidates??=new Set());
  if(!candidates.size)return 1;
  for(let i=1;i<=steps;i++){point.lerpVectors(start,end,i/steps);for(const s of candidates)if(this.sphereSolid(point,.16,s))return Math.max(0,(i-1)/steps);}
  return 1;
 }
}
