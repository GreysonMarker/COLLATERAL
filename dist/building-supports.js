import * as T from './vendor/three.module.js';
import {cutSolid} from './heat-cut.js';
// Columns are generated only when damage exposes the interior. Intact buildings
// retain their shared city batches, with no extra per-frame structural simulation.
export function createSupports(b){for(const _ of prepareSupports(b)){} }
export function* prepareSupports(b){
 const positions=new Map();
 for(const s of b.solids)for(const u of [.2,.5,.8])for(const v of [.2,.5,.8]){
  const x=s.x1+(s.x2-s.x1)*u,z=s.z1+(s.z2-s.z1)*v;
  positions.set(x.toFixed(3)+','+z.toFixed(3),{x,z});
 }
 b.supportLayers=new Map();
 let work=0;for(const c of b.cells.values()){if(++work%32===0)yield;
  c.beams=[];
  for(const {x,z} of positions.values())for(const p of c.parts){
   const r=.14;if(x+r<=p.x1||x-r>=p.x2||z+r<=p.z1||z-r>=p.z2)continue;
   if(p.planes&&[p.y1+.001,p.y2-.001].some(y=>p.planes.some(plane=>plane.distanceToPoint(new T.Vector3(x,y,z))>0)))continue;
   const box={x1:Math.max(x-r,p.x1),x2:Math.min(x+r,p.x2),y1:p.y1,y2:p.y2,z1:Math.max(z-r,p.z1),z2:Math.min(z+r,p.z2)};
   const beam={x:(box.x1+box.x2)*.5,z:(box.z1+box.z2)*.5,box,parts:[box],cell:c,broken:false};c.beams.push(beam);
   if(!b.supportLayers.has(c.y))b.supportLayers.set(c.y,[]);b.supportLayers.get(c.y).push(beam);
  }
 }
}
export function cutSupports(c,planes){for(const beam of c.beams||[]){
 let changed=false;beam.parts=beam.parts.flatMap(p=>{const pieces=cutSolid(p,planes);if(pieces){changed=true;return pieces;}return [p];});
 // Geometry only changes when struck. Cache the continuity result until then.
 if(changed)beam.broken=!intact(beam);
}}
function intact(beam){
 if(beam.cell.removed)return false;
 const intervals=[];
 for(const p of beam.parts){let lo=p.y1,hi=p.y2;
  for(const plane of p.planes||[]){const a=plane.normal.x*beam.x+plane.normal.z*beam.z+plane.constant,n=plane.normal.y;
   if(Math.abs(n)<1e-8){if(a>1e-5){hi=-Infinity;break;}}else if(n>0)hi=Math.min(hi,-a/n);else lo=Math.max(lo,-a/n);
  }if(hi>=lo)intervals.push([lo,hi]);
 }
 intervals.sort((a,b)=>a[0]-b[0]);let end=beam.box.y1;
 for(const [lo,hi] of intervals){if(lo>end+.001)return false;end=Math.max(end,hi);}
 return end>=beam.box.y2-.001;
}
export function failedSupportLevel(b,cellSize){
 let level=Infinity;
 for(const [y,beams] of b.supportLayers||[]){
  const broken=beams.reduce((n,beam)=>n+(beam.cell.removed||beam.broken?1:0),0);
  if(broken/beams.length>=.67)level=Math.min(level,y*cellSize);
 }
 return level;
}

// A blast-weakened floor needs both capacity and a reasonably centered load path.
export function blastOverloaded(areaLeft,coreLeft,offset,upperLoad,originalFloor){
 return upperLoad>originalFloor*2&&(areaLeft<.65||(coreLeft<.5&&areaLeft<.85)||(areaLeft<.85&&offset>.28));
}
