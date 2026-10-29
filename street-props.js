import * as T from './vendor/three.module.js';
// Static street furniture stays in its existing render batches until crushed.
export function createStreetProps(){
 const grid=new Map(),point=new T.Vector3();
 function add(b,start,end){
  const prop={b,start,end,solids:[],broken:false,x1:Infinity,y1:Infinity,z1:Infinity,x2:-Infinity,y2:-Infinity,z2:-Infinity};
  for(let i=start*3;i<end*3;i+=3)for(const [axis,k] of [['x',0],['y',1],['z',2]]){prop[axis+'1']=Math.min(prop[axis+'1'],b.p[i+k]);prop[axis+'2']=Math.max(prop[axis+'2'],b.p[i+k]);}
  for(let x=Math.floor(prop.x1/56);x<=Math.floor(prop.x2/56);x++)for(let z=Math.floor(prop.z1/56);z<=Math.floor(prop.z2/56);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(prop);}
  return prop;
 }
 function crush(position,offsets,radius,world,emit){
  let count=0;
  for(const offset of offsets){point.addVectors(position,offset);
   for(let x=Math.floor((point.x-radius)/56);x<=Math.floor((point.x+radius)/56);x++)for(let z=Math.floor((point.z-radius)/56);z<=Math.floor((point.z+radius)/56);z++)for(const prop of grid.get(x+','+z)||[]){
    if(prop.broken||!world.sphereSolid(point,radius,prop))continue;
    prop.broken=true;for(const solid of prop.solids)solid.disabled=true;
    const a=prop.b.geometry.attributes.position;
    // Degenerate only this prop's triangles; never touch its shared batch neighbors.
    for(let i=prop.start;i<prop.end;i++)a.setXYZ(i,prop.x1,prop.y1,prop.z1);
    a.addUpdateRange(prop.start*3,(prop.end-prop.start)*3);a.needsUpdate=true;
    emit?.(new T.Vector3((prop.x1+prop.x2)/2,(prop.y1+prop.y2)/2,(prop.z1+prop.z2)/2));count++;
   }
  }return count;
 }
 return {add,crush};
}
