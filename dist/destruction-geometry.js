import * as T from './vendor/three.module.js';
import {boxFaces} from './heat-cut.js';
function addVertex(target,v){target.p.push(v[0],v[1],v[2]);target.n.push(v[3],v[4],v[5]);target.uv.push(v[6],v[7]);}
export function addPoly(target,poly){for(let i=1;i<poly.length-1;i++){addVertex(target,poly[0]);addVertex(target,poly[i]);addVertex(target,poly[i+1]);}}
export function floatAttribute(values,start,end,size){const array=new Float32Array(end-start);for(let i=start;i<end;i++)array[i-start]=values[i];return new T.BufferAttribute(array,size);}

// Share unit-box topology instead of allocating planes and polygon arrays per column.
const boxTemplate={p:[],n:[],uv:[]};
for(const face of boxFaces({x1:0,x2:1,y1:0,y2:1,z1:0,z2:1}))addPoly(boxTemplate,face.p);
export function addBox(target,box){
 const dx=box.x2-box.x1,dy=box.y2-box.y1,dz=box.z2-box.z1;
 for(let i=0;i<boxTemplate.p.length;i+=3){target.p.push(box.x1+boxTemplate.p[i]*dx,box.y1+boxTemplate.p[i+1]*dy,box.z1+boxTemplate.p[i+2]*dz);target.n.push(boxTemplate.n[i],boxTemplate.n[i+1],boxTemplate.n[i+2]);target.uv.push(0,0);}
}
