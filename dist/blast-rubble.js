import * as T from './vendor/three.module.js';
// Persistent, static instancing: debris is decorative, never thousands of rigid bodies.
export function createBlastRubble(scene,height,{mobile=false}={}){
 const capacity=mobile?12000:20000,counts=[0,0,0,0],records=[[],[],[],[]],meshes=[],dummy=new T.Object3D();let total=0;
 const geometries=[new T.IcosahedronGeometry(1,0),new T.BoxGeometry(1,1,1),new T.BoxGeometry(1,1,1),new T.IcosahedronGeometry(1,1)];
 for(let i=0;i<4;i++){const mesh=new T.InstancedMesh(geometries[i],new T.MeshStandardMaterial({roughness:i===2?.65:1,metalness:i===2?.35:0}),capacity/4);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;scene.add(mesh);meshes.push(mesh);}
 function add(kind,x,z,sx,sy,sz,angle,color,random){const mesh=meshes[kind],index=counts[kind]++%(capacity/4);dummy.position.set(x,height(x,z)+sy*.38,z);dummy.rotation.set((random()-.5)*.4,angle,(random()-.5)*.4);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();records[kind][index]={x,z,sy,matrix:dummy.matrix.clone()};mesh.setMatrixAt(index,dummy.matrix);mesh.setColorAt(index,new T.Color(color).multiplyScalar(.78+random()*.32));mesh.count=Math.min(capacity/4,counts[kind]);total++;}
 function blast(point,radius,buildings=[]){
  let seed=((point.x*73856093)^(point.z*19349663)^(point.y*83492791))>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const altitude=Math.max(0,point.y-height(point.x,point.z));
  if(altitude<radius){const footprint=Math.sqrt(radius*radius-altitude*altitude),count=Math.min(1800,Math.ceil(footprint*7));
   for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*footprint,x=point.x+Math.cos(a)*r,z=point.z+Math.sin(a)*r,s=.35+random()**2*3.8;
    add(i%5===0?1:0,x,z,s,.2+s*.28,s*(.6+random()),a,i%5===0?'#45484b':'#827c71',random);
   }
  }
  for(const b of buildings){const amount=Math.min(100,Math.max(20,Math.ceil(b.width*b.depth*b.damage*.08))),spread=Math.max(8,Math.min(48,Math.sqrt(b.width*b.depth)*.85)),dir=Math.atan2(b.z-point.z,b.x-point.x);
   // Large uneven deposits near damaged footprints, with an outward street fan.
   for(let pile=0;pile<5;pile++){const a=random()*Math.PI*2,r=spread*(.35+random()*.7),x=b.x+Math.cos(a)*r,z=b.z+Math.sin(a)*r;
    add(3,x,z,3+random()*6,1+random()*2.8,3+random()*6,a,'#777369',random);
   }
   for(let i=0;i<amount;i++){const a=dir+(random()-.5)*Math.PI*1.8,r=spread*Math.sqrt(random())*(1+random()),x=b.x+Math.cos(a)*r,z=b.z+Math.sin(a)*r,kind=i%9===0?2:i%3===0?1:0,s=.8+random()**2*5;
    add(kind,x,z,kind===2?.18:s,kind===2?.22:.25+random()*1.1,kind===2?3+random()*7:s*(.5+random()),a,kind===2?'#414951':kind===1&&i%2?b.color:'#a29c8e',random);
   }
  }
  for(let k=0;k<meshes.length;k++){const mesh=meshes[k];for(let i=0;i<records[k].length;i++){const r=records[k][i];r.matrix.elements[13]=height(r.x,r.z)+r.sy*.38;mesh.setMatrixAt(i,r.matrix);}mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
 }
 return {blast,get stats(){return {rubblePieces:meshes.reduce((sum,m)=>sum+m.count,0),rubbleCreated:total,rubbleDrawCalls:4,rubbleCapacity:capacity};}};
}
