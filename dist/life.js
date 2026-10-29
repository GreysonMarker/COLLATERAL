import {punchResponse,launchForRange,addLaunchMomentum} from './combat-rules.js';
import {explosiveLanding} from './throw-impact.js';
import {createNPCFragments} from './npc-fragments.js';
import {createNPCRagdolls} from './npc-ragdoll.js';
import {planesOverlapBox} from './heat-cut.js';
import {createHeatWrecks} from './heat-wrecks.js';
import {convexCollider} from './collision.js';
import * as T from './vendor/three.module.js';
import {BLOCK,RADIUS,PARK,isParkBlock} from './map-layout.js';
import {createPedestrianRoutes} from './pedestrians.js';
import {gait,gaitRate} from './gait.js';
const TAU=Math.PI*2;
// Continuous sidewalk and right-hand traffic circuits, with tangent-preserving corners.
export function circuit(distance,radius,corner){
 const straight=2*(radius-corner),arc=Math.PI*corner/2,quarter=straight+arc,total=quarter*4;
 const u=((distance%total)+total)%total,q=Math.floor(u/quarter),s=u-q*quarter;
 let x,z,dx,dz;
 if(s<straight){x=-radius+corner+s;z=-radius;dx=1;dz=0;}
 else{const a=(s-straight)/corner-Math.PI/2;x=radius-corner+Math.cos(a)*corner;z=-radius+corner+Math.sin(a)*corner;dx=-Math.sin(a);dz=Math.cos(a);}
 for(let i=0;i<q;i++){[x,z]=[-z,x];[dx,dz]=[-dz,dx];}
 return {x,z,dx,dz,total,corner:s>=straight};
}
export function createCityLife(scene,material,mobile,world,{onThrowImpact=null,onProjectileContact=null}={}){
 let seed=19117;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const cap=mobile?300:500,carCap=mobile?140:220,bodyCapacity=cap+56;
 const sphere=new T.SphereGeometry(1,8,6),box=new T.BoxGeometry(1,1,1),limb=new T.CapsuleGeometry(1,1,2,6);
 const fragments=createNPCFragments(world,24);
 const deaths=createNPCRagdolls(world,{maxActive:mobile?24:40,maxVisible:32});
 const wrecks=createHeatWrecks(scene,world);let capture=null,heatPoint=null,heatPasses=[];
 const batches=[];
 function batch(geo,capacity){const mesh=new T.InstancedMesh(geo,material('#ffffff'),capacity);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.count=0;scene.add(mesh);const b={mesh,n:0};batches.push(b);return b;}
 const particles=[];let vanished=0,injured=0,panicClock=0;
 function burst(at,velocity,large=false){const count=large?28:10;for(let i=0;i<count;i++){if(particles.length>=256)particles.shift();particles.push({p:at.clone(),v:new T.Vector3((random()-.5)*5,random()*4,(random()-.5)*5).addScaledVector(velocity,.025),age:0,life:.3+random()*.25,size:(large?.12:.065)*( .6+random()),color:i%3?'#a62c42':'#d95660'});}}
 function category(bone){const b=bone[0];return /^[lr][sew]$/.test(b)?b[0]+'Arm':/^[lr][hkf]$/.test(b)?b[0]+'Leg':b==='neck'?'head':'torso';}
 function present(p,a){return !p.missing?.has(category(a.bone));}
 function frighten(at,radius=100){for(const p of people){if(p.cut||(p.x-at.x)**2+(p.z-at.z)**2>radius*radius)continue;p.fear={x:at.x,z:at.z,time:12};p.wait=0;}}
 const bodies=batch(limb,bodyCapacity*9),heads=batch(sphere,bodyCapacity*5),details=batch(box,bodyCapacity*9),vehicles=batch(box,carCap*15),tires=batch(sphere,carCap*8);
 const fires=[];const flames=batch(sphere,72);flames.mesh.material=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.85,depthWrite:false});flames.mesh.castShadow=flames.mesh.receiveShadow=false;
 const effects=batch(sphere,256);effects.mesh.castShadow=false;effects.mesh.receiveShadow=false;
 const parts=[],root=new T.Group(),torso=new T.Group();root.add(torso);torso.userData.bone=['pelvis','neck'];
 function joint(parent,x,y,z){const g=new T.Object3D();g.position.set(x,y,z);parent.add(g);return g;}
 function part(parent,b,color,x,y,z,sx,sy,sz){const p=joint(parent,x,y,z);p.scale.set(sx,sy,sz);let owner=parent;while(owner&&!owner.userData.bone)owner=owner.parent;parts.push({p,b,color,bone:owner?.userData.bone||['pelvis','neck']});return p;}
 part(torso,bodies,'shirt',0,1.15,0,.23,.19,.15);
 part(torso,details,'pants',0,.89,0,.36,.22,.27);
 part(torso,heads,'skin',0,1.51,0,.075,.12,.075);
 const head=joint(torso,0,1.65,.01);head.userData.bone=['neck','head'];
 part(head,heads,'skin',0,0,0,.16,.205,.15);
 part(head,heads,'hair',0,.11,-.03,.169,.12,.155);
 part(head,details,'skin',0,-.015,.147,.055,.065,.035);
 for(const side of [-1,1])part(head,details,'ink',side*.061,.031,.143,.025,.018,.018);
 const limbs=[];
 for(const side of [-1,1]){
 const shoulder=joint(torso,side*.26,1.34,0),elbow=joint(shoulder,0,-.27,0),prefix=side<0?'l':'r';shoulder.userData.bone=[prefix+'s',prefix+'e'];elbow.userData.bone=[prefix+'e',prefix+'w'];
 part(shoulder,bodies,'shirt',0,-.135,0,.085,.09,.09);
 part(elbow,bodies,'skin',0,-.13,0,.057,.087,.06);
 part(elbow,heads,'skin',0,-.27,0,.068,.086,.06);
 const hip=joint(torso,side*.115,.89,0),knee=joint(hip,0,-.40,0),ankle=joint(knee,0,-.42,0);hip.userData.bone=[prefix+'h',prefix+'k'];knee.userData.bone=[prefix+'k',prefix+'f'];
 part(hip,bodies,'pants',0,-.20,0,.095,.133,.10);
 part(knee,bodies,'pants',0,-.20,0,.075,.132,.08);
 part(ankle,details,'shoes',0,0,.053,.165,.12,.29);
 limbs.push({side,shoulder,elbow,hip,knee,ankle});
 }
 const bag=part(torso,details,'bag',0,1.17,-.20,.32,.38,.14);
 // The joints animate; each attached body mesh has a fixed local transform.
 for(const a of parts)if(a.p!==bag){a.p.updateMatrix();a.p.matrixAutoUpdate=false;}
 const jacket=['#c64951','#e6b950','#387a91','#66508a','#d67f51','#3a7464','#d5d4be','#344c75','#d797ac'];
 const skins=['#f1c5a2','#ca936d','#9b6449','#684635','#e5ae89'];
 const hair=['#25252f','#50352b','#b58b4d','#79777c'];
 const blocks=[],cars=[];let population=0;
 for(let ix=-RADIUS;ix<=RADIUS;ix++)for(let iz=-RADIUS;iz<=RADIUS;iz++){
  if(isParkBlock(ix,iz))continue;
  const b={x:ix*BLOCK,z:iz*BLOCK,people:[]};
  const ring=Math.max(Math.abs(ix),Math.abs(iz));const count=ring<6?24:ring>13?6:14;
  for(let n=0;n<count;n++){
   const dir=n%2?1:-1,r=dir>0?42.45:41.75;
   b.people.push({distance:random()*circuit(0,r,2).total,r,dir,speed:1.15+random()*.8,phase:random()*TAU,scale:1.20+random()*.14,width:.85+random()*.3,seed:random()*100,bag:random()<.3,colors:{shirt:jacket[Math.floor(random()*jacket.length)],skin:skins[Math.floor(random()*skins.length)],hair:hair[Math.floor(random()*hair.length)],pants:random()<.5?'#29384e':'#626274',shoes:'#242635',ink:'#272333',bag:'#8b6346'}});
  }
  population+=count;blocks.push(b);
  if((ix+iz)%2===0){const pace=7+random()*5;
   for(let k=0;k<2;k++)cars.push({bx:b.x,bz:b.z,distance:random()*20+k*circuit(0,50,6).total/2,speed:pace,current:pace,color:['#d7564c','#ddbd62','#d7e1df','#3b688f','#4b525e','#74a997'][Math.floor(random()*6)],van:random()<.22,wheel:random()*TAU});
  }
 }
 // Park walkers use the paved spine and turn before the fountain and benches.
 const parkPeople=[];
 for(let i=0;i<42;i++){const template=blocks[i%blocks.length].people[0];parkPeople.push({...template,colors:{...template.colors},distance:i*6,phase:i,park:true,r:0,dir:i%2?1:-1});}population+=parkPeople.length;
 const routes=createPedestrianRoutes(world,random);const people=blocks.flatMap(b=>b.people);for(const b of blocks)for(const p of b.people)routes.init(p,b.x,b.z);for(const p of parkPeople)routes.init(p,PARK.x,PARK.z,true);people.push(...parkPeople);
 const matrix=new T.Matrix4(),base=new T.Matrix4(),dummy=new T.Object3D(),color=new T.Color(),point=new T.Vector3();
 const colorCache=new Map();let nearby=[],clock=1,visiblePeople=0,visibleCars=0;
 function put(b,m,c){if(capture){capture.push({geometry:b.mesh.geometry,matrix:m.clone(),color:c});return;}if(b.n>=b.mesh.instanceMatrix.count)return;b.mesh.setMatrixAt(b.n,m);let tint=c;if(typeof c==='string'){tint=colorCache.get(c);if(!tint){tint=new T.Color(c);colorCache.set(c,tint);}}b.mesh.setColorAt(b.n,tint);b.n++;}
 function pedestrian(p,x,z,heading,speed,time,player){
  const stride=Math.min(1,speed/.8),pose=p.phase,legs=Number(p.missing?.has('lLeg'))+Number(p.missing?.has('rLeg'));const crawling=legs===2;
  root.position.set(x,p.y,z);root.rotation.set(p.reaction?.pitch||0,heading,p.reaction?.roll||0);root.scale.set(p.scale*p.width,p.scale,p.scale);
  torso.position.set(0,0,0);head.rotation.set(0,0,0);
  torso.position.y=-.04*stride+Math.cos(pose*2)*.012*stride;
  torso.rotation.set(.025*stride,Math.sin(pose)*.035*stride,Math.sin(pose)*.015*stride);
  head.rotation.y=Math.sin(time*.55+p.seed)*.12;
  bag.scale.set(p.bag?.32:0,p.bag?.38:0,p.bag?.14:0);
  for(const l of limbs){const phase=pose+(l.side>0?Math.PI:0),g=gait(phase,stride,p.fear&&!legs?.8:0,.4,.42);
   l.hip.rotation.x=g.hip;l.knee.rotation.x=g.knee;l.ankle.rotation.x=g.ankle;
   l.shoulder.rotation.x=g.arm;l.shoulder.rotation.z=-l.side*.07;
   l.elbow.rotation.x=-.18-Math.max(0,g.arm)*.25;
   if(speed<.05){l.shoulder.rotation.x=Math.sin(time*.8+p.seed)*.035;if(l.side>0&&Math.sin(p.seed)>0){l.elbow.rotation.x=-1.6;l.shoulder.rotation.x=-.28;}}
  }
  if(p.fear&&!p.reaction){torso.rotation.x+=legs===1?.18:.11;if(legs===1){root.position.y+=Math.abs(Math.sin(pose))*.09;torso.rotation.z+=Math.sin(pose)*.11;}if(crawling){torso.position.set(0,.4,.85);torso.rotation.x=1.25;head.rotation.x=-.85;for(const l of limbs){l.shoulder.rotation.x=-1.65+Math.sin(pose+l.side*Math.PI*.5)*.35;l.elbow.rotation.x=-.6-Math.max(0,Math.sin(pose+l.side*Math.PI*.5))*.4;}}}
  if(p.reaction){const r=p.reaction;torso.rotation.x+=.16;for(const l of limbs){l.shoulder.rotation.x=-.6+Math.sin(time*7+l.side)*.25;l.shoulder.rotation.z=l.side*.65;l.elbow.rotation.x=-.85;l.hip.rotation.x=-.35+Math.sin(time*5+l.side)*.2;l.knee.rotation.x=.8;}}
  if(p.held){torso.rotation.set(-.06,0,0);head.rotation.x=.12;for(const l of limbs){l.shoulder.rotation.x=-1.6;l.shoulder.rotation.z=l.side*.15;l.elbow.rotation.x=-1.2;l.hip.rotation.x=Math.sin(time*5+l.side)*.12;l.knee.rotation.x=.22;}}
  root.updateMatrixWorld(true);for(const a of parts)if(present(p,a))put(a.b,a.p.matrixWorld,p.colors[a.color]);
 }
 function carPart(x,y,z,sx,sy,sz,c,b=vehicles,angle=0){dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(angle,0,0);dummy.updateMatrix();matrix.multiplyMatrices(base,dummy.matrix);put(b,matrix,c);}
 function renderCar(c,p){
  dummy.position.set(c.reaction?c.reaction.x:c.bx+p.x,c.reaction?c.reaction.y:world.ground(c.bx+p.x,c.bz+p.z)+.04,c.reaction?c.reaction.z:c.bz+p.z);dummy.rotation.set(c.reaction?.pitch||0,c.reaction?c.reaction.heading:Math.atan2(p.dx,p.dz),c.reaction?.roll||0);dummy.scale.set(1,1,1);dummy.updateMatrix();base.copy(dummy.matrix);
  const length=c.van?5.4:4.6;
  carPart(0,.70,0,1.95,.65,length,c.color);carPart(0,1.27,-.24,1.67,c.van?1.05:.69,c.van?3.2:2.45,c.color);
  carPart(0,1.36,1.02,1.46,.48,.055,'#253f57');carPart(0,1.36,c.van?-1.87:-1.5,1.46,.43,.055,'#253f57');
  for(const s of [-1,1]){carPart(s*.845,1.37,-.18,.025,.43,c.van?2.4:1.94,'#344f67');carPart(s*.70,.73,length/2+.025,.4,.18,.06,'#fff1c7');carPart(s*.72,.75,-length/2-.025,.36,.17,.06,c.current<2?'#ff3935':'#a93437');
   for(const z of [-1.48,1.42]){carPart(s*.99,.40,z,.19,.40,.40,'#252938',tires);carPart(s*1.18,.4,z,.035,.22,.22,'#a9b1bd',tires);carPart(s*1.20,.4,z,.04,.33,.055,'#697584',vehicles,c.wheel);}}
  carPart(0,.44,length/2+.03,1.7,.13,.09,'#454f63');
 }
 function kill(p,velocity){
  if(p.cut)return false;
  capture=[];pedestrian(p,p.x,p.z,p.heading,0,0,root.position);capture=null;
  const points={pelvis:torso.localToWorld(new T.Vector3(0,.89,0)),neck:torso.localToWorld(new T.Vector3(0,1.48,0)),head:head.getWorldPosition(new T.Vector3())};
  for(const l of limbs){const side=l.side<0?'l':'r';points[side+'s']=l.shoulder.getWorldPosition(new T.Vector3());points[side+'e']=l.elbow.getWorldPosition(new T.Vector3());points[side+'w']=l.elbow.localToWorld(new T.Vector3(0,-.27,0));points[side+'h']=l.hip.getWorldPosition(new T.Vector3());points[side+'k']=l.knee.getWorldPosition(new T.Vector3());points[side+'f']=l.ankle.getWorldPosition(new T.Vector3());}
  deaths.add(points,parts.filter(a=>present(p,a)).map(a=>({b:a.b,bone:a.bone,matrix:a.p.matrixWorld.clone(),color:p.colors[a.color]})),velocity,p.seed);p.cut=p.dead=true;p.reaction=null;return true;
 }

 function pose(p){capture=[];pedestrian(p,p.x,p.z,p.heading,p.current||0,panicClock,root.position);capture=null;}
 function damagePart(p,kind,at,velocity,separate=false){
  if(p.cut)return false;
  if(kind==='head'||kind==='torso'){burst(at,velocity);return kill(p,velocity);}
  p.missing??=new Set();if(p.missing.has(kind))return false;
  if(separate){pose(p);fragments.add(parts.filter(a=>present(p,a)&&category(a.bone)===kind).map(a=>({b:a.b,matrix:a.p.matrixWorld.clone(),color:p.colors[a.color]})),velocity,p.seed);}
  if(!p.missing.size)injured++;p.missing.add(kind);p.fear={x:at.x,z:at.z,time:12};p.wait=0;burst(at,velocity);return true;
 }
 function disappear(p,at,velocity){if(p.cut)return;p.cut=p.dead=true;p.reaction=null;vanished++;burst(at,velocity,true);}
 function nearestLimb(p,at){pose(p);let best=null,distance=Infinity;for(const a of parts){const kind=category(a.bone);if(!kind.endsWith('Arm')&&!kind.endsWith('Leg')||!present(p,a))continue;const pos=new T.Vector3().setFromMatrixPosition(a.p.matrixWorld),d=pos.distanceToSquared(at);if(d<distance){best={kind,at:pos};distance=d;}}return best;}
 const limbRay=new T.Ray(),partBox=new T.Box3(),partHit=new T.Vector3();
 function rayPart(p,origin,direction,reach){pose(p);limbRay.set(origin,direction);let closest=null,distance=reach;for(const a of parts){if(!present(p,a)||a.p.scale.lengthSq()<.00001)continue;const geo=a.b.mesh.geometry;if(!geo.boundingBox)geo.computeBoundingBox();partBox.copy(geo.boundingBox).applyMatrix4(a.p.matrixWorld);if(limbRay.intersectBox(partBox,partHit)){const d=partHit.distanceTo(origin);if(d<distance){distance=d;const end=origin.clone().addScaledVector(direction,reach),exit=partBox.containsPoint(end)?end:new T.Ray(end,direction.clone().negate()).intersectBox(partBox,new T.Vector3());closest={kind:category(a.bone),at:partHit.clone(),exit:exit||partHit.clone()};}}}return closest;}
 const launched=new Set();
 const reactionStats={peopleHit:0,carsHit:0,punchHits:0};const collisionBox=new T.BoxGeometry(2,1.8,5),reactionMatrix=new T.Matrix4(),carCenterOffset=new T.Matrix4().makeTranslation(0,.9,0),reactionDummy=new T.Object3D();
 function heat(origin,direction,reach,sweep=null){
  heatPoint=null;heatPasses=[];wrecks.heat(origin,direction,reach,sweep);const ray=new T.Ray(origin,direction);let hits=0;
  const intersects=(x,y,z,h,w)=>{const box=new T.Box3(new T.Vector3(x-w,y,z-w),new T.Vector3(x+w,y+h,z+w)),at=ray.intersectBox(box,new T.Vector3());return sweep?planesOverlapBox(sweep.planes,box):box.containsPoint(origin)||(at&&at.distanceTo(origin)<=reach);};
  const actorRange=reach+8;
  let alarm=null;
  for(const p of people){if(p.cut||p.held||(p.x-origin.x)**2+(p.z-origin.z)**2>actorRange*actorRange||!intersects(p.x,p.y-.5,p.z,4,2.4))continue;const hit=rayPart(p,origin,direction,reach);if(hit&&damagePart(p,hit.kind,hit.at,direction.clone().multiplyScalar(.8),true)){if(!heatPoint)heatPoint=hit.at;if(heatPasses.length<16)heatPasses.push({entry:hit.at.clone(),exit:hit.exit.clone()});alarm=hit.at;hits++;reactionStats.peopleCut=(reactionStats.peopleCut||0)+1;}}
  if(alarm)frighten(alarm);


  for(const c of cars){if(c.cut||c.held)continue;const cx=c.reaction?.x??c.bx,cz=c.reaction?.z??c.bz;if((cx-origin.x)**2+(cz-origin.z)**2>(actorRange+72)**2)continue;const path=circuit(c.distance,50,6),x=c.reaction?.x??c.bx+path.x,z=c.reaction?.z??c.bz+path.z,y=c.reaction?.y??world.ground(x,z);if(!intersects(x,y,z,2,3))continue;capture=[];renderCar(c,path);const parts=capture;capture=null;if(wrecks.hitNew(parts,origin,direction,reach,false,sweep)){c.cut=true;c.current=0;if(!heatPoint)heatPoint=new T.Vector3(x,y+1,z);hits++;reactionStats.carsCut=(reactionStats.carsCut||0)+1;}}
  return hits;
 }
 function shock(point,radius,power,incoming,{peopleEnabled=true}={}){
  frighten(point,Math.min(160,Math.max(65,radius*3)));
  const personTargets=peopleEnabled?people.filter(p=>!p.cut&&!p.held&&!p.reaction?.punched&&(p.x-point.x)**2+(p.z-point.z)**2+(p.y-point.y)**2<radius*radius).sort((a,b)=>(a.x-point.x)**2+(a.z-point.z)**2-(b.x-point.x)**2-(b.z-point.z)**2).slice(0,mobile?24:40):[];
  for(const p of personTargets){const dist=Math.hypot(p.x-point.x,p.z-point.z,p.y-point.y),strength=Math.max(0,1-dist/radius);if(strength<.06)continue;const direction=new T.Vector3(p.x-point.x,0,p.z-point.z);if(direction.lengthSq()<.01)direction.set(1,0,0);direction.normalize();if(power*strength>=16){const impulse=direction.clone().multiplyScalar(power*strength*.75).addScaledVector(incoming,.045*strength);impulse.y=3+power*strength*.4;if(power*strength>=55)disappear(p,new T.Vector3(p.x,p.y+1.1,p.z),impulse);else if(power*strength>=35){burst(new T.Vector3(p.x,p.y+1.2,p.z),impulse);kill(p,impulse);}else{const hit=nearestLimb(p,point);if(hit)damagePart(p,hit.kind,hit.at,impulse);p.reaction={x:p.x,y:p.y+.2,z:p.z,v:impulse,pitch:0,roll:0,spin:.6,heading:p.heading,age:0,rest:0};}reactionStats.peopleHit++;continue;}p.reaction={x:p.x,y:p.y+.2,z:p.z,v:direction.multiplyScalar(power*strength*.75).addScaledVector(incoming,.045*strength),pitch:0,roll:0,spin:power*strength*.04,heading:p.heading,age:0,rest:0};p.reaction.v.y=3+power*strength*.4;reactionStats.peopleHit++;}
  let count=0;for(const c of cars){if(c.cut||c.held)continue;if(count>=(mobile?12:20))break;const path=circuit(c.distance,50,6),x=c.reaction?c.reaction.x:c.bx+path.x,z=c.reaction?c.reaction.z:c.bz+path.z,y=c.reaction?c.reaction.y:world.ground(x,z)+.25,dist=Math.hypot(x-point.x,z-point.z,y-point.y);if(dist>radius)continue;const strength=1-dist/radius;if(strength<.08)continue;const direction=new T.Vector3(x-point.x,0,z-point.z);if(direction.lengthSq()<.01)direction.set(1,0,0);direction.normalize();c.reaction={x,y,z,v:direction.multiplyScalar(power*strength*.38).addScaledVector(incoming,.035*strength),pitch:0,roll:0,spin:power*strength*.025,heading:Math.atan2(path.dx,path.dz),age:0,rest:0};c.reaction.v.y=1+power*strength*.25;c.current=0;reactionStats.carsHit++;count++;}
 }

 // Punches launch intact bodies. Each travelling wave owns a hit set, so
 // overlapping visual/road pulses cannot apply the same punch repeatedly.
 function punch(origin,direction,kind,spec,hitSet=new Set()){
  const response=punchResponse(kind),launch=addLaunchMomentum(launchForRange(response.distance,direction),spec.momentum);let hits=0;
  for(const p of people){if(p.cut||p.held||hitSet.has(p))continue;
   const delta=new T.Vector3(p.x,p.y+1.1*p.scale,p.z).sub(origin),along=delta.dot(direction);
   if(along<Math.max(-.8,spec.minDistance??-.8)||along>Math.min(spec.reach,spec.maxDistance??spec.reach))continue;
   const width=spec.width+(spec.spread||0)*Math.max(0,along)+.55;
   if(delta.addScaledVector(direction,-along).lengthSq()>width*width)continue;
   hitSet.add(p);p.current=0;p.thrown=true;p.throwImpactTime=-Infinity;p.impactUntil=panicClock+2;
   p.reaction={x:p.x,y:p.y+.35,z:p.z,v:launch.clone(),pitch:0,roll:0,spin:kind==='serious'?2:1,heading:p.heading,age:0,rest:0,punched:true,attacker:'player'};
   launched.add(p);p.fear={x:origin.x,z:origin.z,time:12};reactionStats.peopleHit++;reactionStats.punchHits++;hits++;
  }
  if(hits)frighten(origin,100);return hits;
 }

 // Only one actor is held; existing reaction physics handles the released throw.
 function acquireGrab(origin,direction,reach){
  let best=null,score=Infinity;
  const consider=(actor,kind,point,radius)=>{
   if(actor.cut||actor.held)return;const delta=point.clone().sub(origin),along=delta.dot(direction);
   if(along<-.25||along>reach||delta.length()>reach+radius||delta.addScaledVector(direction,-along).length()>radius+1)return;
   const ray=new T.Ray(origin,point.clone().sub(origin).normalize()),length=origin.distanceTo(point);
   for(const solid of world.nearby(origin.x,origin.z,reach+3)){if(solid.disabled||solid.actor===actor||!solid.building)continue;const hit=ray.intersectBox(new T.Box3(new T.Vector3(solid.x1,solid.y1,solid.z1),new T.Vector3(solid.x2,solid.y2,solid.z2)),new T.Vector3());if(hit&&hit.distanceTo(origin)<length-.35)return;}
   if(length<score){score=length;best={actor,kind};}
  };
  for(const p of nearby)consider(p,'person',new T.Vector3(p.x,p.y+1.5*p.scale,p.z),.4);
  for(const c of cars){const path=circuit(c.distance,50,6),r=c.reaction;consider(c,'car',new T.Vector3(r?.x??c.bx+path.x,r?.y??world.ground(c.bx+path.x,c.bz+path.z),r?.z??c.bz+path.z).add(new T.Vector3(0,1,0)),1.6);}
  if(!best)return null;
  const a=best.actor,path=best.kind==='car'?circuit(a.distance,50,6):null;
  a.held=true;a.current=0;
  a.reaction={x:a.reaction?.x??(path?a.bx+path.x:a.x),y:a.reaction?.y??(path?world.ground(a.bx+path.x,a.bz+path.z):a.y),z:a.reaction?.z??(path?a.bz+path.z:a.z),v:new T.Vector3(),pitch:0,roll:0,spin:.7,heading:path?Math.atan2(path.dx,path.dz):a.heading,age:0,rest:0};
  // Remove the held vehicle's previous-frame collider immediately.
  for(const list of world.dynamic.values())for(const solid of list)if(solid.actor===a)solid.disabled=true;
  frighten(origin,35);return best;
 }
 function positionGrab(handle,anchor,direction){
  const a=handle.actor;if(!a.held||a.cut)return;const r=a.reaction;
  r.x=anchor.x;r.z=anchor.z;r.y=anchor.y-(handle.kind==='person'?1.51*a.scale:.6);
  r.heading=Math.atan2(direction.x,direction.z)+(handle.kind==='person'?Math.PI:Math.PI/2);r.pitch=0;r.roll=0;r.v.set(0,0,0);
  world.confine?.(r,r.v,handle.kind==='person'?1:3);
  if(handle.kind==='person'){a.x=r.x;a.y=r.y;a.z=r.z;a.heading=r.heading;}
 }
 function releaseGrab(handle,velocity){
  const a=handle.actor;a.held=false;if(a.cut||!a.reaction)return;
  a.reaction.v.copy(velocity);a.thrown=velocity.length()>20;a.reaction.attacker='player';a.reaction.ignorePlayerUntil=panicClock+.35;a.throwImpactTime=-Infinity;a.reaction.age=0;a.reaction.rest=0;a.reaction.spin=velocity.length()>80?(handle.kind==='car'?2.4:2):handle.kind==='car'?1.4:1;
  a.impactUntil=panicClock+.8;
 }
 function throwImpact(actor,person,r,ground,normal,solid=null){
  if(!actor.thrown)return false;
  const incoming=r.v.clone(),point=new T.Vector3(r.x,ground?world.ground(r.x,r.z):r.y+.8,r.z);
  const explosion=!person&&ground&&!actor.burned&&explosiveLanding(incoming,r.pitch,r.roll);
  if(person||panicClock-actor.throwImpactTime>.25||explosion){actor.throwImpactTime=panicClock;onThrowImpact?.({point,velocity:incoming,person,ground,explosion,solid});}
  world.confine?.(r,r.v,person?1:3);
  if(person){actor.x=r.x;actor.y=r.y;actor.z=r.z;actor.heading=r.heading;kill(actor,incoming.multiplyScalar(.3));reactionStats.throwDeaths=(reactionStats.throwDeaths||0)+1;return true;}
  if(explosion){actor.burned=true;actor.color='#25262b';fires.push({actor,age:0});if(fires.length>12)fires.shift();reactionStats.carExplosions=(reactionStats.carExplosions||0)+1;}
  if(ground)actor.thrown=false;
  return false;
 }
 function carClearance(r){const e=new T.Matrix4().makeRotationFromEuler(new T.Euler(r.pitch,r.heading,r.roll)).elements;return Math.abs(e[1])+Math.abs(e[5])*.9+Math.abs(e[9])*2.5-e[5]*.9+.04;}
 function react(actor,dt,person){const r=actor.reaction;if(!r||actor.held)return;if(r.rest>0){r.rest+=dt;if(person){const rise=T.MathUtils.clamp((r.rest-3)/1.2,0,1);r.pitch=T.MathUtils.lerp(1.35,0,rise);r.roll*=Math.exp(-5*dt);r.y=world.ground(r.x,r.z)+.3*(1-rise);if(rise>=1){actor.reaction=null;actor.current=0;actor.y=world.ground(actor.x,actor.z);return;}}}else{
   r.age+=dt;
   if(onProjectileContact&&r.v.length()>12&&(!r.ignorePlayerUntil||panicClock>=r.ignorePlayerUntil)){
    const start=new T.Vector3(r.x,r.y+(person?.6:.9),r.z),end=start.clone().addScaledVector(r.v,dt);
    const result=onProjectileContact({actor,person,velocity:r.v,start,end,attacker:r.attacker||null});
    if(result?.parried){r.v.copy(result.direction).multiplyScalar(Math.max(30,r.v.length()));r.attacker=result.defender||'player';r.ignorePlayerUntil=panicClock+.12;actor.thrown=true;}
    else if(result&&!result.ignored){r.v.multiplyScalar(-.35);r.ignorePlayerUntil=panicClock+.6;}
   }
   r.v.y-=18*dt;const steps=Math.max(1,Math.ceil(r.v.length()*dt/.45));for(let j=0;j<steps;j++){r.x+=r.v.x*dt/steps;r.y+=r.v.y*dt/steps;r.z+=r.v.z*dt/steps;const radius=person?.3:1,center=new T.Vector3(r.x,r.y+(person?.6:.9),r.z),hit=world.contactAt(center,[new T.Vector3()],radius,actor);if(hit){if(hit.solid?.kind==='arena')world.confine(r,null,person?1:3);if(throwImpact(actor,person,r,!hit.solid&&hit.normal.y>.5,hit.normal,hit.solid))return;r.x+=hit.normal.x*(hit.depth+.01);r.z+=hit.normal.z*(hit.depth+.01);r.y+=hit.normal.y*(hit.depth+.01);const n=r.v.dot(hit.normal);if(n<0)r.v.addScaledVector(hit.normal,-n*1.15);r.v.multiplyScalar(.75);}}
   const floor=world.ground(r.x,r.z)+(person?.3:carClearance(r));if(r.y<=floor+.03){if(throwImpact(actor,person,r,true,new T.Vector3(0,1,0)))return;r.y=floor;r.v.y=Math.max(0,-r.v.y*.12);r.v.x*=Math.exp(-4*dt);r.v.z*=Math.exp(-4*dt);if(r.v.length()<1.2){r.rest=.001;r.v.set(0,0,0);if(person)r.pitch=1.35;}}
   if(person){if(r.punched&&!r.rest){r.pitch+=r.spin*dt;r.roll=Math.sin(r.age*2)*.65;}else{r.pitch=T.MathUtils.damp(r.pitch,1.35,3,dt);r.roll=Math.sin(r.age*3)*Math.min(.55,r.spin*.3);}}else{r.pitch+=r.spin*dt;r.roll+=r.spin*.8*dt;r.y=Math.max(r.y,world.ground(r.x,r.z)+carClearance(r));}
  }
  world.confine?.(r,r.v,person?1:3);
  if(person){actor.x=r.x;actor.z=r.z;actor.y=r.y;actor.heading=r.heading;}
 }
 const lastPlayer=new T.Vector3();let playerKnown=false;
 function contactPlayer(player,velocity){
  if(!playerKnown){lastPlayer.copy(player);playerKnown=true;return;}
  const travel=new T.Line3(lastPlayer.clone().add(new T.Vector3(0,1,0)),player.clone().add(new T.Vector3(0,1,0))),length=lastPlayer.distanceTo(player),speed=velocity?.length()||0;lastPlayer.copy(player);
  if(speed<=12||length>25)return;
  for(const p of nearby){if(p.cut||p.held||p.impactUntil>panicClock)continue;const center=new T.Vector3(p.x,p.y+1.15,p.z),nearest=travel.closestPointToPoint(center,true,new T.Vector3());
   if(nearest.distanceToSquared(center)>1.4**2)continue;p.impactUntil=panicClock+.6;frighten(center);if(speed>=100)disappear(p,center,velocity);else{const hit=nearestLimb(p,nearest);if(hit)damagePart(p,hit.kind,hit.at,velocity);p.reaction={x:p.x,y:p.y+.2,z:p.z,v:velocity.clone().multiplyScalar(.18),pitch:0,roll:0,spin:.7,heading:p.heading,age:0,rest:0};p.reaction.v.y+=2;}reactionStats.peopleHit++;
  }
 }
 function update(dt,time,player,velocity=null){
  panicClock+=dt;contactPlayer(player,velocity);
  for(const p of launched){if(p.cut||!p.reaction){launched.delete(p);continue;}react(p,dt,true);if(p.cut||!p.reaction)launched.delete(p);}

  for(const b of batches)b.n=0;
  clock+=dt;if(clock>.5){clock=0;nearby=people.filter(p=>!p.cut&&(p.x-player.x)**2+(p.z-player.z)**2<340**2).sort((a,b)=>(a.x-player.x)**2+(a.z-player.z)**2-(b.x-player.x)**2-(b.z-player.z)**2).slice(0,cap);}
  const traffic=cars.filter(c=>!c.cut&&(c.bx-player.x)**2+(c.bz-player.z)**2<420**2).map(c=>{const p=circuit(c.distance,50,6);return {x:c.bx+p.x,z:c.bz+p.z,speed:c.current}});
  // A small local grid separates walkers without an all-pairs crowd calculation.
  const cells=new Map();for(const p of nearby){const key=Math.floor(p.x/2)+','+Math.floor(p.z/2);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);}
  visiblePeople=0;
  for(const p of nearby){if(p.cut||(player.y>=240&&!p.held&&!p.reaction))continue;const neighbors=[];for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)neighbors.push(...(cells.get((Math.floor(p.x/2)+x)+','+(Math.floor(p.z/2)+z))||[]));
   if(p.fear){p.fear.time-=dt;if(p.fear.time<=0&&!p.missing?.size)p.fear=null;}
   let pace=0;if(p.reaction){if(!launched.has(p))react(p,dt,true);}else pace=routes.advance(p,dt,time,player,neighbors,traffic);if(p.cut)continue;world.confine?.(p,null,1);p.phase+=gaitRate(pace)*dt*Math.min(1,pace/.6);
   pedestrian(p,p.x,p.z,p.heading,pace,time,player);visiblePeople++;
  }
  visibleCars=0;const solids=[];
  const activeCars=cars.filter(c=>!c.cut&&(c.held||(c.reaction?((c.reaction.x-player.x)**2+(c.reaction.z-player.z)**2<650**2):((c.bx-player.x)**2+(c.bz-player.z)**2<650**2)))).sort((a,b)=>Number(!!b.held)-Number(!!a.held)||((a.reaction?.x??a.bx)-player.x)**2+((a.reaction?.z??a.bz)-player.z)**2-((b.reaction?.x??b.bx)-player.x)**2-((b.reaction?.z??b.bz)-player.z)**2);
  // Following checks only compare cars on the same circuit, in the same order.
  const circuits=new Map();for(const c of activeCars){const k=c.bx+','+c.bz;if(!circuits.has(k))circuits.set(k,[]);circuits.get(k).push(c);}
  for(const c of activeCars){if(c.reaction){react(c,dt,false);const r=c.reaction;if(visibleCars<carCap){renderCar(c,{x:0,z:0,dx:Math.sin(r.heading),dz:Math.cos(r.heading)});visibleCars++;reactionDummy.position.set(r.x,r.y,r.z);reactionDummy.rotation.set(r.pitch,r.heading,r.roll);reactionDummy.scale.set(1,1,1);reactionDummy.updateMatrix();reactionMatrix.copy(reactionDummy.matrix).multiply(carCenterOffset);if(!c.reactionCollider||!c.colliderMatrix.equals(reactionMatrix)){c.reactionCollider=convexCollider(collisionBox,reactionMatrix);c.reactionCollider.actor=c;(c.colliderMatrix??=new T.Matrix4()).copy(reactionMatrix);}if(!c.held)solids.push(c.reactionCollider);}continue;}const p=circuit(c.distance,50,6),x=c.bx+p.x,z=c.bz+p.z,dx=player.x-x,dz=player.z-z;
   const ahead=dx*p.dx+dz*p.dz,across=Math.abs(dx*p.dz-dz*p.dx);
   const walkerAhead=nearby.some(o=>{if(!o.crossing||world.ground(o.x,o.z)>.2)return false;const ox=o.x-x,oz=o.z-z;return ox*p.dx+oz*p.dz>-1&&ox*p.dx+oz*p.dz<10&&Math.abs(ox*p.dz-oz*p.dx)<2.4});
   const blocked=(player.y<2.5&&ahead>-1&&ahead<9&&across<2.2)||walkerAhead;
   let target=blocked?0:p.corner?c.speed*.5:c.speed;if(world.ground(x+p.dx*7,z+p.dz*7)<world.ground(x,z)-.35)target=0;
   // Keep a safe following gap on each local circuit.
   for(const other of circuits.get(c.bx+','+c.bz))if(other!==c){const gap=((other.distance-c.distance)%p.total+p.total)%p.total;if(gap<9)target=0;}
   c.current=T.MathUtils.damp(c.current,target,blocked?9:2.4,dt);c.distance+=c.current*dt;c.wheel+=c.current*dt/.4;
   if(visibleCars<carCap){const next=circuit(c.distance,50,6),bounded={x:c.bx+next.x,y:1,z:c.bz+next.z};world.confine?.(bounded,null,3);next.x=bounded.x-c.bx;next.z=bounded.z-c.bz;renderCar(c,next);visibleCars++;
    const x=c.bx+next.x,z=c.bz+next.z;
    for(const [w,l,y1,y2,offset] of [[.98,c.van?2.7:2.3,.39,1.065,0],[.835,c.van?1.6:1.225,1.02,c.van?1.835:1.655,-.24]]){const cx=x+next.dx*offset,cz=z+next.dz*offset;solids.push({actor:c,kind:'vehicle',x:cx,z:cz,dx:next.dx,dz:next.dz,w,l,x1:cx-3,x2:cx+3,z1:cz-3,z2:cz+3,y1,y2});}
   }
  }
  for(let i=fires.length-1;i>=0;i--){const fire=fires[i];fire.age+=dt;const r=fire.actor.reaction;if(fire.age>12||!r||fire.actor.cut){fires.splice(i,1);continue;}
   const fade=Math.min(1,(12-fire.age)/2);
   for(let j=0;j<6;j++){const core=j%2===1,height=(core?.7:1.2)*(1+Math.sin(time*17+j*2.7)*.22)*fade;
    dummy.position.set(r.x+Math.sin(j*2.4)*.65,r.y+1+height*.5,r.z+Math.cos(j*2.4)*1.25);dummy.rotation.set(0,0,Math.sin(time*8+j)*.15);dummy.scale.set(core?.24:.42,height,core?.24:.42);dummy.updateMatrix();put(flames,dummy.matrix,core?'#fff2a3':'#ff590d');
   }
  }
  deaths.update(dt,player,put);
  fragments.update(dt,player,put);
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=dt;if(p.age>=p.life){particles.splice(i,1);continue;}p.p.addScaledVector(p.v,dt);p.v.y-=3*dt;dummy.position.copy(p.p);dummy.rotation.set(0,0,0);dummy.scale.setScalar(p.size*(1-p.age/p.life));dummy.updateMatrix();put(effects,dummy.matrix,p.color);}

  solids.push(...wrecks.update(dt));world.setDynamic(solids);
  for(const b of batches){b.mesh.count=b.n;
   // Upload only visible instances rather than the whole reserved city batch.
   for(const [attribute,stride] of [[b.mesh.instanceMatrix,16],[b.mesh.instanceColor,3]]){if(!attribute)continue;attribute.clearUpdateRanges();if(b.n){attribute.addUpdateRange(0,b.n*stride);attribute.needsUpdate=true;}}
  }
 }
 function crushVehicles(position,offsets,radius,emit){
  const p=new T.Vector3(),hit=new Set();
  for(const o of offsets){p.addVectors(position,o);for(const solid of world.nearby(p.x,p.z,radius,p.y,true)){
   const car=solid.actor;if(solid.kind!=='vehicle'||!car||!cars.includes(car)||car.held||car.cut||!world.sphereSolid(p,radius,solid))continue;
   car.cut=true;car.current=0;hit.add(car);emit?.(new T.Vector3(solid.x,solid.y2,solid.z));
  }}
  for(const list of world.dynamic.values())for(const solid of list)if(hit.has(solid.actor))solid.disabled=true;
  return hit.size;
 }
 return {crushVehicles,update,shock,punch,heat,frighten,acquireGrab,positionGrab,releaseGrab,get heatPoint(){return heatPoint;},get heatPasses(){return heatPasses;},get stats(){return {...reactionStats,...deaths.stats,...fragments.stats,dead:deaths.stats.dead+vanished,vanished,injured,activeParticles:particles.length,panicked:nearby.filter(p=>!p.cut&&p.fear).length,population,trafficCount:cars.length,visiblePeople,visibleCars}}};
}
