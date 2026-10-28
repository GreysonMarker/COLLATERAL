import * as T from './vendor/three.module.js';
import {BLOCK,RADIUS,PARK,isParkBlock} from './map-layout.js';
// A connected sidewalk graph with frontage detours and crosswalk links.
export function createPedestrianRoutes(world,random){
 const nodes=[],blocks=new Map();
 const clear=(x,z)=>!world.sphereHit(new T.Vector3(x,world.ground(x,z)+.65,z),.34,false)&&!world.sphereHit(new T.Vector3(x,world.ground(x,z)+1.7,z),.34,false);
 function node(x,z,stop=false){const n={x,z,stop,links:[]};nodes.push(n);return n;}
 function link(a,b,crossing=false){a.links.push({node:b,crossing});b.links.push({node:a,crossing});}
 function segmentClear(a,b){const steps=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/1.5);for(let i=0;i<=steps;i++){const t=i/steps;if(!clear(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}return true;}
 const r=42.55;
 for(let ix=-RADIUS;ix<=RADIUS;ix++)for(let iz=-RADIUS;iz<=RADIUS;iz++){
  if(isParkBlock(ix,iz))continue;
  const x=ix*BLOCK,z=iz*BLOCK,ring=[[-r,-r],[0,-r],[r,-r],[r,0],[r,r],[0,r],[-r,r],[-r,0]].map(([a,b])=>node(x+a,z+b));
  for(let i=0;i<8;i++)link(ring[i],ring[(i+1)%8]);
  for(const i of [1,3,5,7]){const n=ring[i],inset=4+random()*5,dx=(x-n.x)/r,dz=(z-n.z)/r;const destination={x:n.x+dx*inset,z:n.z+dz*inset};
   if(segmentClear(n,destination)){const stop=node(destination.x,destination.z,true);link(n,stop);}
  }
  blocks.set(ix+','+iz,ring);
 }
 for(let ix=-RADIUS;ix<=RADIUS;ix++)for(let iz=-RADIUS;iz<=RADIUS;iz++){
  const ring=blocks.get(ix+','+iz);if(!ring)continue;
  const east=blocks.get((ix+1)+','+iz),south=blocks.get(ix+','+(iz+1));
  if(east){link(ring[2],east[0],true);link(ring[4],east[6],true);}
  if(south){link(ring[4],south[2],true);link(ring[6],south[0],true);}
 }
 // Park paths meet at a loop around the fountain, with short rest destinations.
 const parkRing=[[-17,-17],[0,-17],[17,-17],[17,0],[17,17],[0,17],[-17,17],[-17,0]].map(([x,z])=>node(PARK.x+x,PARK.z+z));
 for(let i=0;i<8;i++)link(parkRing[i],parkRing[(i+1)%8]);
 const parkNodes=[...parkRing];
 for(const [i,dx,dz,length] of [[1,0,-1,140],[3,1,0,88],[5,0,1,140],[7,-1,0,88]]){
  let prev=parkRing[i];for(let d=40;d<=length;d+=25){const n=node(PARK.x+dx*d,PARK.z+dz*d);link(prev,n);prev=n;parkNodes.push(n);const rest=node(n.x+(dx?0:2.4),n.z+(dz?0:2.4),true);link(n,rest);parkNodes.push(rest);}
 }
 function init(p,x,z,park=false){
  const ring=park?parkNodes:blocks.get(Math.round(x/BLOCK)+','+Math.round(z/BLOCK));
  const a=ring[Math.floor(random()*ring.length)],edge=a.links[Math.floor(random()*a.links.length)],t=random();
  p.x=a.x+(edge.node.x-a.x)*t;p.z=a.z+(edge.node.z-a.z)*t;p.from=a;p.target=edge.node;p.crossing=edge.crossing;p.wait=0;p.heading=Math.atan2(edge.node.x-a.x,edge.node.z-a.z);p.lane=(random()-.5)*1.8;p.turns=0;p.y=world.ground(p.x,p.z);
 }
 function advance(p,dt,time,player,neighbors,traffic){
  if(p.fear){p.wait=0;const a=(p.target.x-p.fear.x)**2+(p.target.z-p.fear.z)**2,b=(p.from.x-p.fear.x)**2+(p.from.z-p.fear.z)**2;if(b>a+4)[p.from,p.target]=[p.target,p.from];}
  if(p.wait>0)p.wait=Math.max(0,p.wait-dt);
  let dx=p.target.x-p.x,dz=p.target.z-p.z,d=Math.hypot(dx,dz);
  if(d<.6){
   const reached=p.target,choices=reached.links.filter(e=>e.node!==p.from),options=choices.length?choices:reached.links;
   let edge=options[Math.floor(random()*options.length)];
   if(p.fear)edge=options.reduce((best,e)=>(e.node.x-p.fear.x)**2+(e.node.z-p.fear.z)**2>(best.node.x-p.fear.x)**2+(best.node.z-p.fear.z)**2?e:best,edge);
   if(!p.fear&&edge.crossing&&random()<.35)edge=options.find(e=>!e.crossing)||edge;
   p.from=reached;p.target=edge.node;p.crossing=edge.crossing;p.turns++;
   if(!p.fear&&(reached.stop||random()<.10))p.wait=1.5+random()*5;
   dx=p.target.x-p.x;dz=p.target.z-p.z;d=Math.hypot(dx,dz);
  }
  const fx=dx/Math.max(d,.01),fz=dz/Math.max(d,.01);
  const lostLegs=Number(p.missing?.has('lLeg'))+Number(p.missing?.has('rLeg')),lostArms=Number(p.missing?.has('lArm'))+Number(p.missing?.has('rArm'));
  let pace=p.fear?(lostLegs===2?(lostArms===2?0:lostArms===1?.35:.7):lostLegs===1?1.1:4.6):p.wait>0?0:p.speed;
  // Wait at the curb for moving traffic; stopped cars let walkers cross.
  if(p.crossing&&Math.hypot(p.x-p.from.x,p.z-p.from.z)<1.5&&traffic.some(c=>c.speed>1&&Math.hypot(c.x-p.x,c.z-p.z)<10))pace=0;
  let sx=0,sz=0;
  for(const o of neighbors){if(o===p)continue;const ax=p.x-o.x,az=p.z-o.z,sep=Math.hypot(ax,az);if(sep<1.25&&sep>.01){const push=(1.25-sep)*.8;sx+=ax/sep*push;sz+=az/sep*push;if(-ax*fx-az*fz>.2&&sep<.85)pace*=.35;}}
  if(player.y<3.2){const ax=p.x-player.x,az=p.z-player.z,sep=Math.hypot(ax,az);if(sep<1.9){sx+=ax/Math.max(sep,.01)*(1.9-sep);sz+=az/Math.max(sep,.01)*(1.9-sep);if(sep<.85)pace=0;}}
  p.current=T.MathUtils.damp(p.current??p.speed,pace,6,dt);
  // Gentle lane variation disappears at corners, so people enter each junction cleanly.
  const edgeX=p.target.x-p.from.x,edgeZ=p.target.z-p.from.z,edgeLength=Math.hypot(edgeX,edgeZ),nx=-edgeZ/Math.max(edgeLength,.01),nz=edgeX/Math.max(edgeLength,.01);
  const lateral=(p.x-p.from.x)*nx+(p.z-p.from.z)*nz;
  const desired=(p.lane+Math.sin(time*.34+p.seed)*.38)*Math.min(1,d/5)*Math.min(1,Math.hypot(p.x-p.from.x,p.z-p.from.z)/4);
  const steer=T.MathUtils.clamp(desired-lateral,-.9,.9);
  let vx=fx*p.current+sx+nx*steer,vz=fz*p.current+sz+nz*steer;
  if(p.wait>0){vx=0;vz=0;}
  const oldX=p.x,oldZ=p.z;
  const tx=p.x+vx*dt,tz=p.z+vz*dt;
  if(clear(tx,tz)){p.x=tx;p.z=tz;}
  else{const ax=p.x+fx*p.current*dt,az=p.z+fz*p.current*dt;if(clear(ax,az)){p.x=ax;p.z=az;}else if(p.current>.1){
   const side=Math.sin(p.seed)>0?1:-1;for(const sign of [side,-side]){const bx=p.x-fz*sign*p.current*dt,bz=p.z+fx*sign*p.current*dt;if(clear(bx,bz)){p.x=bx;p.z=bz;break;}}
  }}
  const speed=Math.hypot(p.x-oldX,p.z-oldZ)/Math.max(dt,.001);
  if(speed>.08){const heading=Math.atan2(p.x-oldX,p.z-oldZ),diff=Math.atan2(Math.sin(heading-p.heading),Math.cos(heading-p.heading));p.heading+=diff*(1-Math.exp(-dt*7));}
  p.y=T.MathUtils.damp(p.y,world.ground(p.x,p.z),18,dt);
  return speed;
 }
 return {init,advance,nodes};
}
