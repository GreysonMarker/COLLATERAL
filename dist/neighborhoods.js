import * as T from './vendor/three.module.js';
import {convexCollider} from './collision.js';
// Local streets bend inside the established arterial grid, so traffic connections
// and pedestrian crossings stay continuous at every neighborhood boundary.
export function createNeighborhoodBuilder(api){
 const {box,addGeometry,buildingBox,tree,mat,materials,beginBuilding,endBuilding,colliders}=api;
 const {grass,pavement,road,trim,metal,brick}=materials;
 const siding=['#c1b49c','#9faeb1','#bc806c','#758f9d','#b9ae87','#cfbda8'].map(mat);
 const roofs=['#494e60','#795b56','#536766'].map(mat);
 const window=mat('#36556c'),door=mat('#534539');
 const gable=new T.BufferGeometry();
 gable.setAttribute('position',new T.Float32BufferAttribute([
 -1,0,-1,0,1,-1,1,0,-1, -1,0,1,1,0,1,0,1,1,
 -1,0,-1,-1,0,1,0,1,1, -1,0,-1,0,1,1,0,1,-1,
 1,0,-1,0,1,-1,0,1,1, 1,0,-1,0,1,1,1,0,1,
 -1,0,-1,1,0,-1,1,0,1, -1,0,-1,1,0,1,-1,0,1
 ],3));gable.computeVertexNormals();
 gable.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(24*2),2));
 function house(x,z,index,front,row=false){
  const w=row?11:12+(index%3)*1.5,d=15+(index%2)*3,h=row?9:6.3+(index%3)*1.1;
  const building=beginBuilding(x,z,'house');
  box(x,.7,z,w+1,.5,d+1,trim,true);
  box(x,.95+h/2,z,w,h,d,siding[index%siding.length],true);
  const y=.95+h,roof=roofs[index%roofs.length];
  if(row){box(x,y+.3,z,w+1,.6,d+1,roof,true);box(x,y+.8,z+d/2,w,.8,.3,trim);}
  else{addGeometry(gable,roof,x,y,z,w*.56,3.2,d*.56);colliders.push(convexCollider(gable,new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion(),new T.Vector3(w*.56,3.2,d*.56))));}
  box(x+w*.27,y+1.7,z-d*.2,1.2,3.4,1.2,brick,true);
  for(const side of [-1,1])for(let floor=0;floor<(row?3:2);floor++)for(const q of [-1,1]){
   const wy=2.2+floor*(row?2.7:3.1),wz=z+side*(d/2+.05);
   box(x+q*w*.27,wy,wz,2,1.9,.16,trim);box(x+q*w*.27,wy,wz+side*.1,1.55,1.5,.12,window);
  }
  box(x,2.1,z+front*(d/2+.08),1.8,2.6,.2,door);
  box(x,.8,z+front*(d/2+1.2),3.7,.6,2.4,trim,true);
  box(x,3.8,z+front*(d/2+1.4),4.2,.22,3,roof);
  for(const side of [-1,1])box(x+side*1.7,2.3,z+front*(d/2+2.2),.16,3,.16,trim);
  if(!row){box(x+w*.5+3,2.4,z-2,5,3.8,8,siding[index%siding.length],true);box(x+w*.5+3,4.4,z-2,5.6,.4,8.6,roof,true);box(x+w*.5+3,.53,z+front*10,4,.08,18,pavement);}
  endBuilding(building);
 }
 function block(ix,iz){
  const x=ix*112,z=iz*112,index=Math.abs(ix*17+iz*31),row=index%5===0;
  box(x,.49,z,83,.05,83,grass);
  // An offset dogleg lane links opposite sides; homes face into this quiet lane.
  const bend=(index%3-1)*6;
  for(let j=0;j<8;j++){const x0=-43+j*10.75,x1=x0+10.75,z0=bend*Math.sin((x0+43)/86*Math.PI),z1=bend*Math.sin((x1+43)/86*Math.PI),length=Math.hypot(x1-x0,z1-z0),angle=-Math.atan2(z1-z0,x1-x0);
   const unit=api.unit;addGeometry(unit,pavement,x+(x0+x1)/2,.53,z+(z0+z1)/2,length+.3,.08,13,angle);addGeometry(unit,road,x+(x0+x1)/2,.58,z+(z0+z1)/2,length+.35,.03,8,angle);
  }
  const offsets=row?[-30,-18,-6,6,18,30]:[-26,0,26];
  for(const side of [-1,1])for(let i=0;i<offsets.length;i++){
   const hx=x+offsets[i],hz=z+side*25;
   house(hx,hz,index+i+2*(side+1),-side,row);
   box(hx,.56,z+side*11,1.6,.08,12,pavement);
  }
  // Back gardens and low fences keep a human scale without tall collision walls.
  for(const side of [-1,1]){box(x,.9,z+side*39,78,.7,.16,trim);tree(x-37,z+side*30,.64);tree(x+37,z+side*30,.72);}
 }
 return {block};
}
