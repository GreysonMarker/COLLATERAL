import * as T from './vendor/three.module.js';
import {PUNCHES} from './punches.js';
import {launchForRange,punchResponse,PUNCH_LAUNCH_ANGLE} from './combat-rules.js';
import {FLIGHT_SPEEDS} from './flight-modes.js';
export const CLASH_RADIUS=PUNCHES.serious.reach*.75;
export function clashRecoil(backward){
 const speed=launchForRange(punchResponse('serious',{hero:true}).distance,backward,24).length(),direction=backward.clone().normalize();
 if(!direction.lengthSq())direction.set(0,0,1);
 const lift=new T.Vector3(0,1,0).addScaledVector(direction,-direction.y);
 if(lift.lengthSq()>1e-6)direction.multiplyScalar(Math.cos(PUNCH_LAUNCH_ANGLE)).addScaledVector(lift.normalize(),Math.sin(PUNCH_LAUNCH_ANGLE));
 return direction.multiplyScalar(speed);
}
export const CLASH_MIN_SPEED=FLIGHT_SPEEDS.fast*1.5;
// Relative swept collision catches two fast bodies crossing between frames.
// A short look-back accommodates the remote interpolation buffer.
export function headOnContact(position,velocity,other,dt,height=1,controlledFlight=true){
 if(!controlledFlight||!other?.controlledFlight||!other.flying||other.held||other.launched||other.grounded)return null;
 const relative=velocity.clone().sub(other.velocity);
 if(relative.lengthSq()<CLASH_MIN_SPEED**2)return null;
 // Both pilots must contribute toward the impact, excluding overtaking and hovering.
 if(velocity.dot(relative)<=0||other.velocity.dot(relative)>=0)return null;
 const p=position.clone().add(new T.Vector3(0,1.2*height,0)),q=other.position.clone().add(new T.Vector3(0,1.2*other.height,0));
 const delta=q.clone().sub(p),t=delta.dot(relative)/relative.lengthSq();
 if(t<-.08||t>Math.min(.06,dt))return null;
 const miss=delta.clone().addScaledVector(relative,-t),contactRadius=.7*(height+other.height);
 if(miss.lengthSq()>contactRadius*contactRadius)return null;
 return p.addScaledVector(velocity,t).add(q.addScaledVector(other.velocity,t)).multiplyScalar(.5);
}
export function createHeroClash(scene,{destruction,groundDamage,cityLife,forest,combat,audio,localId=()=>null,emit=()=>{},now=()=>Date.now()}){
 const pairs=new Map(),seen=new Set(),effects=[];let shake=0;
 const ringGeo=new T.RingGeometry(.89,1,96),sphereGeo=new T.SphereGeometry(1,24,12);
 const stats={collisions:0,radius:CLASH_RADIUS};
 function pair(a,b){return [a,b].sort().join(':');}
 function available(id){return (pairs.get(pair(localId(),id))||0)<=now();}
 function apply(e,sender){
  if(!e||!Array.isArray(e.p)||e.p.length!==3||!e.p.every(n=>Number.isFinite(n)&&Math.abs(n)<=10000)||!Array.isArray(e.heroes)||e.heroes.length!==2||!e.heroes.includes(sender)||e.heroes[0]!==sender||typeof e.heroes[1]!=='string'||e.heroes[0]>=e.heroes[1]||!Number.isFinite(e.at)||typeof e.clashId!=='string'||seen.has(e.clashId))return false;
  seen.add(e.clashId);pairs.set(pair(...e.heroes),now()+3000);
  const origin=new T.Vector3().fromArray(e.p),fresh=Math.abs(now()-e.at)<3000;
  const affected=destruction.radialBlast(origin,CLASH_RADIUS);groundDamage.radialBlast(origin,CLASH_RADIUS,affected||[]);forest.damage(origin,CLASH_RADIUS);stats.collisions++;
  if(!fresh)return true; // Late joiners reconstruct damage without replaying hits.
  cityLife.shock(origin,CLASH_RADIUS,220,new T.Vector3());audio?.clash?.(origin);
  for(const [id,a]of combat.actors){if(id!=='player'&&id!=='practice-dummy'||a.active&&!a.active())continue;
   const delta=a.position().clone().add(new T.Vector3(0,(a.height?.()||2.2)*.5,0)).sub(origin),distance=delta.length(),participant=e.heroes.indexOf(id==='player'?localId():id);if(distance>CLASH_RADIUS&&participant<0)continue;
   if(delta.lengthSq()<.01)delta.set(0,1,0);delta.normalize();let launch;if(participant>=0){const backward=e.recoil?.[participant];launch=clashRecoil(Array.isArray(backward)&&backward.length===3&&backward.every(Number.isFinite)?new T.Vector3().fromArray(backward):delta);}else{launch=delta.clone().multiplyScalar(170*(.45+.55*(1-distance/CLASH_RADIUS)));launch.y+=25;}
   combat.hit(id,{id:'clash-'+e.clashId,kind:'clash',attacker:'clash',direction:delta,velocity:launch});
   if(id==='player')shake=Math.max(shake,1.6*(1-distance/CLASH_RADIUS));
  }
  const group=new T.Group();group.position.copy(origin);scene.add(group);
  const core=new T.Mesh(sphereGeo,new T.MeshBasicMaterial({color:0xf4fbff,transparent:true,opacity:1,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending}));group.add(core);
  const ring=new T.Mesh(ringGeo,new T.MeshBasicMaterial({color:0xd5e7ef,transparent:true,opacity:1,side:T.DoubleSide,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending}));ring.rotation.x=-Math.PI/2;group.add(ring);
  // Fresnel pressure shell stays readable from inside and outside the blast.
  const shell=new T.Mesh(sphereGeo,new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{fade:{value:1}},vertexShader:`varying vec3 n;varying vec3 eye;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=-p.xyz;gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 n;varying vec3 eye;uniform float fade;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),2.5);gl_FragColor=vec4(.77,.87,.94,(.035+rim*.8)*fade);}`}));group.add(shell);
  // One instanced draw for a wide, irregular rolling vapor/dust front.
  const dust=new T.InstancedMesh(sphereGeo,new T.MeshBasicMaterial({color:origin.y<30?0xa49f94:0xd1dce3,transparent:true,opacity:.35,depthWrite:false}),72),dummy=new T.Object3D();
  for(let i=0;i<72;i++){const angle=i/72*Math.PI*2,tilt=Math.sin(i*2.39)*.25,r=.87+.09*Math.sin(i*8.7);dummy.position.set(Math.cos(angle)*r,tilt,Math.sin(angle)*r);dummy.scale.set(.065+.035*(1+Math.sin(i*7.3)),.035+.035*(1+Math.cos(i*4.1)),.065);dummy.rotation.set(i*.31,i*.73,0);dummy.updateMatrix();dust.setMatrixAt(i,dummy.matrix);}group.add(dust);
  effects.push({group,core,ring,shell,dust,age:0});destruction.burst(origin,new T.Vector3(0,80,0),90,22);return true;
 }
 function collide(id,origin,velocity=null,otherVelocity=null){if(!available(id))return false;const self=localId();if(!self)return false;
  // Exactly one participant owns the replicated blast. The other waits for it
  // instead of issuing a competing tackle or second blast.
  if(self>id)return true;
  const e={clashId:crypto.randomUUID(),heroes:[self,id],p:origin.toArray(),recoil:[velocity?.clone().normalize().negate().toArray()||[-1,0,0],otherVelocity?.clone().normalize().negate().toArray()||[1,0,0]],at:now()};apply(e,self);emit(e);return true;
 }
 function update(dt){shake=Math.max(0,shake-dt*1.4);for(const [key,end]of pairs)if(end<=now())pairs.delete(key);
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.age+=dt;if(e.age>=3.8){e.group.removeFromParent();for(const m of e.group.children){m.material.dispose();if(m.isInstancedMesh)m.dispose();}effects.splice(i,1);continue;}
   const t=e.age,r=CLASH_RADIUS*Math.min(1,t/.85),fade=Math.max(0,1-t/1.6);
   e.core.scale.setScalar(3+Math.min(t,.25)*100);e.core.material.opacity=Math.max(0,1-t/.25);
   e.ring.scale.setScalar(Math.max(1,r));e.ring.material.opacity=fade*.9;
   e.shell.scale.setScalar(Math.max(1,r));e.shell.material.uniforms.fade.value=fade;
   e.dust.scale.setScalar(Math.max(1,CLASH_RADIUS*Math.min(1,t/1.15))*(1+Math.max(0,t-1.15)*.045));e.dust.material.opacity=.42*Math.min(1,t/.12)*Math.max(0,1-t/3.8);
  }
 }
 return {apply,collide,available,update,stats,get shake(){return shake;}};
}
