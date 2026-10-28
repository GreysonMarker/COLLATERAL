import * as T from './vendor/three.module.js';
import {findBrace,motorStrength} from './body-support.js';
// Collision-activated articulated body with bounded muscle forces and contact feedback.
// Animation supplies intent; contacts and joint constraints determine the resulting pose.
export function createRagdoll(){
 let nodes=null,links=[],age=10,weight=0,pending=null,shock=0,settled=0,feedback={active:false,stable:true,energy:0,error:0,supports:0},origin=new T.Vector3(),restCenter=new T.Vector3();
 const impactNormal=new T.Vector3();const braces={};let lastStep=1/120;
 const topology=[['pelvis','chest'],['chest','neck'],['neck','head']];
 for(const side of ['left','right'])topology.push(['chest',side+'Shoulder'],['neck',side+'Shoulder'],[side+'Shoulder',side+'Elbow'],[side+'Elbow',side+'Hand'],['pelvis',side+'Hip'],[side+'Hip',side+'Knee'],[side+'Knee',side+'Foot']);
 topology.push(['leftShoulder','rightShoulder'],['leftHip','rightHip']);
 const hinges=[['pelvis','chest','neck',.55],['chest','neck','head',.42]];for(const side of ['left','right'])hinges.push([side+'Shoulder',side+'Elbow',side+'Hand',1.95],[side+'Hip',side+'Knee',side+'Foot',1.75]);
 function trigger(hit){if(hit.closing>6&&(!nodes||age>.12))pending=hit;}
 function update(dt,targets,root,world,state={}){
  if(pending){const hit=pending;pending=null;if(!nodes){nodes={};for(const [name,p] of Object.entries(targets))nodes[name]={p:p.clone(),old:p.clone(),r:name==='head'?.18:name.includes('Hand')||name.includes('Foot')?.10:.125,invMass:name==='pelvis'?.25:name==='chest'?.35:name==='neck'?.6:1};links=topology.map(([a,b])=>[a,b,targets[a].distanceTo(targets[b])]);origin.copy(root);restCenter.copy(targets.pelvis).add(targets.chest).multiplyScalar(.5).sub(root);}
   const contact=hit.point||targets.chest,impulse=hit.impulse||new T.Vector3();
   for(const n of Object.values(nodes)){const proximity=Math.exp(-n.p.distanceToSquared(contact)*2),kick=impulse.clone().multiplyScalar((proximity-.22)*.035).clampLength(0,5);n.old.addScaledVector(kick,-1/120);}
   age=0;settled=0;shock=Math.max(shock,T.MathUtils.clamp(hit.closing/90,.12,1));if(hit.normal)impactNormal.copy(hit.normal);else impactNormal.copy(impulse).normalize();for(const key of Object.keys(braces))delete braces[key];
  }
  if(!nodes)return {weight:0,points:null};
  age+=dt;const speed=Math.hypot(state.vx||0,state.vz||0),sliding=state.grounded&&speed>2.2;
  shock*=Math.exp(-dt*(sliding?.35:state.flying?2.3:1.3));
  const strength=motorStrength({shock,grounded:state.grounded,sliding,flying:state.flying});
  const desired=Object.fromEntries(Object.entries(targets).map(([key,p])=>[key,p.clone()]));
  let supportCount=0;
  for(const side of ['left','right']){
   const shoulder=nodes[side+'Shoulder'].p,hand=side+'Hand';let brace=braces[hand];
   if(brace&&(shoulder.distanceTo(brace.point)>.72||speed>12||!world?.sphereHit(brace.point,.115,true,true)))brace=null;
   if(!brace&&shock>.08){brace=findBrace(world,shoulder,impactNormal.clone().negate());if(!brace&&state.grounded&&speed<5)brace=findBrace(world,shoulder,new T.Vector3(0,-1,0));}
   if(brace){braces[hand]=brace;desired[hand].copy(brace.point);}else delete braces[hand];
   const foot=side+'Foot';if(state.grounded&&speed<4&&world){const goal=desired[foot],floor=world.floorAt(goal.x,goal.z,goal.y+.25,true);if(Math.abs(goal.y-floor)<.45){goal.y=floor+.10;}}
  }
  // Recover authority as energy falls. Sustained motion or another impact delays recovery.
  const stable=feedback.energy<1.6&&!sliding&&shock<.16;
  settled=stable?settled+dt:Math.max(0,settled-dt*3);
  const groundBusy=state.groundRecovery&&state.groundRecovery.phase!=='none';
  const release=!groundBusy&&settled>.25&&feedback.error<.28;
  weight=T.MathUtils.damp(weight,release?0:1,release?3.5:24,dt);
  if(release&&weight<.012){nodes=null;feedback={...feedback,active:false,stable:true};return {weight:0,points:null};}
  const shift=root.clone().sub(origin);origin.copy(root);for(const n of Object.values(nodes)){n.p.add(shift);n.old.add(shift);}
  const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
  restCenter.lerp(targets.pelvis.clone().add(targets.chest).multiplyScalar(.5).sub(root),1-Math.exp(-dt*5));
  for(let step=0;step<steps;step++){
   for(const [name,n] of Object.entries(nodes)){const previous=n.p.clone(),velocity=n.p.clone().sub(n.old).multiplyScalar(h/lastStep),perSecond=velocity.clone().divideScalar(h);
    const bracing=!!braces[name],gain=bracing?85:45*strength,drag=bracing?13:6*strength+1.2;
    const acceleration=desired[name].clone().sub(n.p).multiplyScalar(gain).addScaledVector(perSecond,-drag).clampLength(0,bracing?70:45);
    n.p.add(velocity).addScaledVector(acceleration,h*h);if(state.grounded)n.p.y-=6*h*h;n.old.copy(previous);
   }
   lastStep=h;
   for(let pass=0;pass<12;pass++){
    // Keep bulk translation with the existing hero momentum solver, while all
    // internal rotations and joint positions remain free to respond to contact.
    const center=nodes.pelvis.p.clone().add(nodes.chest.p).multiplyScalar(.5),delta=root.clone().add(restCenter).sub(center);
    for(const n of Object.values(nodes)){n.p.add(delta);n.old.add(delta);}
    for(const [a,b,length] of links){const na=nodes[a],nb=nodes[b],d=nb.p.clone().sub(na.p),distance=d.length();if(distance>.0001){d.multiplyScalar((distance-length)/distance/(na.invMass+nb.invMass));na.p.addScaledVector(d,na.invMass);nb.p.addScaledVector(d,-nb.invMass);}}
    // Limit the actual segment angle, not just endpoint distance: shortening
    // bones must never let the neck or spine fold beyond their anatomical cone.
    for(const [a,b,c,limit] of hinges){
     const x=nodes[a].p,y=nodes[b].p,z=nodes[c].p,first=y.clone().sub(x).normalize(),second=z.clone().sub(y),length=second.length();if(length<.0001)continue;second.divideScalar(length);
     const angle=Math.acos(T.MathUtils.clamp(first.dot(second),-1,1));
     if(angle>limit){let axis=new T.Vector3().crossVectors(first,second);if(axis.lengthSq()<1e-8)axis.crossVectors(first,new T.Vector3(1,0,0));if(axis.lengthSq()<1e-8)axis.crossVectors(first,new T.Vector3(0,0,1));axis.normalize();
      const limited=first.clone().applyAxisAngle(axis,limit).multiplyScalar(length).add(y),correction=limited.sub(z);z.add(correction);nodes[c].old.addScaledVector(correction,.75);
      if(c==='neck'){nodes.head.p.add(correction);nodes.head.old.add(correction);}
     }
    }
    // A tapered torso capsule keeps hands, elbows and legs outside the body.
    const lower=nodes.pelvis.p,spine=nodes.neck.p.clone().sub(lower),spineLength=spine.lengthSq(),lateral=nodes.rightShoulder.p.clone().sub(nodes.leftShoulder.p).normalize();
    function exclusion(point,radius,side){const t=T.MathUtils.clamp(point.clone().sub(lower).dot(spine)/Math.max(spineLength,.001),0,1),center=lower.clone().addScaledVector(spine,t),away=point.clone().sub(center),clearance=.17+Math.sin(t*Math.PI)*.065+radius,distance=away.length();if(distance>=clearance)return null;if(distance<.001)away.copy(lateral).multiplyScalar(side);else away.divideScalar(distance);return away.multiplyScalar(clearance-distance);}
    for(const [side,sign] of [['left',-1],['right',1]]){
     for(const part of ['Elbow','Hand','Knee','Foot']){const n=nodes[side+part],correction=exclusion(n.p,n.r,sign);if(correction){n.p.add(correction);n.old.addScaledVector(correction,.8);}}
     // Sample the forearm too: endpoints outside a chest are not sufficient.
     const elbow=nodes[side+'Elbow'],hand=nodes[side+'Hand'],shoulder=nodes[side+'Shoulder'];
     for(const t of [.3,.6,.85]){const sample=shoulder.p.clone().lerp(elbow.p,t),correction=exclusion(sample,.10,sign);if(correction){elbow.p.addScaledVector(correction,1/t);elbow.old.addScaledVector(correction,.8/t);}}
     for(const t of [.25,.5,.75]){const sample=elbow.p.clone().lerp(hand.p,t),correction=exclusion(sample,.10,sign);if(correction){elbow.p.addScaledVector(correction,1-t);hand.p.addScaledVector(correction,t);elbow.old.addScaledVector(correction,(1-t)*.8);hand.old.addScaledVector(correction,t*.8);}}
    }
    for(const n of Object.values(nodes))if(world?.projectSphere(n.p,n.r)){n.old.lerp(n.p,.3);}
   }
  }
  if(world)for(const side of ['left','right'])for(const part of ['Hand','Foot']){const n=nodes[side+part];if(world.sphereHit(n.p,n.r+.035,true,true))supportCount++;}
  let energy=0,error=0;for(const [name,n] of Object.entries(nodes)){energy+=n.p.distanceToSquared(n.old)/(h*h);error+=n.p.distanceToSquared(desired[name]);}
  energy=Math.sqrt(energy/Object.keys(nodes).length);error=Math.sqrt(error/Object.keys(nodes).length);
  feedback={active:true,stable:energy<1.6&&!sliding&&shock<.16,energy,error,supports:supportCount,shock,strength,sliding,bracing:Object.keys(braces).length};
  return {weight,points:Object.fromEntries(Object.entries(nodes).map(([key,n])=>[key,n.p]))};
 }
 return {trigger,update,reset(){nodes=null;pending=null;weight=shock=settled=0;feedback={active:false,stable:true,energy:0,error:0,supports:0};},get feedback(){return feedback;},get active(){return !!nodes||!!pending;}};
}
