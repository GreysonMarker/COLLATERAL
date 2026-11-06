import * as T from './vendor/three.module.js';
import {TITAN_POWER,steerTitan} from './titan-powers.js';
import {createHeatBudget} from './health.js';
// One bounded GPU particle buffer, reused for the entire channel.
export function createTitanBeam(scene,{hero,combat,actorId,destruction,cityLife,groundHeight,aimed,visualOnly=false}){
 const root=new T.Group();root.visible=false;scene.add(root);
 const geo=new T.CylinderGeometry(1,1,1,16),beams=[];
 for(const [radius,color,opacity]of [[1,'#15aaff',.17],[.62,'#36cfff',.32],[.23,'#d9faff',.9]]){const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));mesh.frustumCulled=false;root.add(mesh);beams.push({mesh,radius});}
 const orb=new T.Mesh(new T.SphereGeometry(1,16,12),new T.MeshBasicMaterial({color:'#57dfff',transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));root.add(orb);
 const count=160,positions=new Float32Array(count*3),pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(positions,3));const particles=new T.Points(pg,new T.PointsMaterial({color:'#70e9ff',size:1.1,transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));particles.frustumCulled=false;root.add(particles);
 const budget=createHeatBudget(),direction=new T.Vector3(0,0,1),up=new T.Vector3(0,1,0);let held=false,age=0,tick=0,clock=0,serial=0,firing=false;const stats={charge:3,cooldown:0,contact:false,range:TITAN_POWER.beamRange,particles:0,cuts:0};
 function stop(){held=false;age=tick=0;firing=false;root.visible=false;}
 function update(dt,allowed){clock+=dt;const ready=held&&allowed&&budget.cooldown===0;if(!ready){age=0;root.visible=false;firing=false;budget.update(dt,false);stats.cooldown=budget.cooldown;stats.charge=budget.charge;stats.particles=0;return;}
 const origin=hero.grabHand(),wanted=aimed(origin).direction;if(age===0)direction.copy(wanted);else steerTitan(direction,wanted,dt,TITAN_POWER.beamTurnRate);const old=age;age+=dt;const fireTime=Math.max(0,age-TITAN_POWER.beamWindup)-Math.max(0,old-TITAN_POWER.beamWindup),used=visualOnly?fireTime:budget.update(fireTime,true);firing=used>0;root.visible=true;stats.cooldown=budget.cooldown;stats.charge=budget.charge;
 let reach=TITAN_POWER.beamRange;for(let d=0;d<=reach;d+=3){const p=origin.clone().addScaledVector(direction,d);if(p.y<=groundHeight(p.x,p.z)){reach=d;break;}}
 const end=origin.clone().addScaledVector(direction,reach),q=new T.Quaternion().setFromUnitVectors(up,direction),charge=Math.min(1,age/TITAN_POWER.beamWindup);
 orb.position.copy(origin);orb.scale.setScalar((firing?TITAN_POWER.beamRadius:charge*6)*(1+Math.sin(clock*35)*.06));
 for(const {mesh,radius} of beams){mesh.visible=firing;mesh.position.copy(origin).lerp(end,.5);mesh.quaternion.copy(q);mesh.scale.set(TITAN_POWER.beamRadius*radius,reach,TITAN_POWER.beamRadius*radius);}
 const side=new T.Vector3(1,0,0).applyQuaternion(q),other=new T.Vector3(0,0,1).applyQuaternion(q);
 for(let i=0;i<count;i++){const fraction=(i/count+clock*.8)%1,angle=i*2.399+clock*7,r=(firing?TITAN_POWER.beamRadius:6*charge)*(1+.3*Math.sin(i+clock*9)),p=origin.clone().addScaledVector(direction,firing?fraction*reach:(fraction-.5)*8*charge).addScaledVector(side,Math.cos(angle)*r).addScaledVector(other,Math.sin(angle)*r);p.toArray(positions,i*3);}pg.attributes.position.needsUpdate=true;stats.particles=count;
 tick+=visualOnly?0:used;while(tick>=.1-1e-8){tick=Math.max(0,tick-.1);const id='titan-beam-'+actorId+'-'+serial++;stats.contact=false;
 for(const [target,a]of combat?.actors||[]){if(target===actorId||a.active?.()===false)continue;const hit=combat.trace(origin,direction,reach,TITAN_POWER.beamRadius,actorId,actor=>actor===a);if(hit){combat.hit(target,{id,kind:'heat',titanBeam:true,continuous:true,attacker:actorId,origin,direction:direction.clone(),titanHit:hit.titanHit});stats.contact=true;}}
 // A single wide cut per damage tick; destruction budgets one building per call.
 stats.cuts+=(destruction?.heat(origin,direction,reach,TITAN_POWER.beamRadius)||0);cityLife?.heat(origin,direction,reach);
 }
 }
 return {update,stop,stats,remote(remoteAge,dir,dt){held=true;age=Math.max(0,remoteAge-dt);direction.copy(dir);update(dt,true);},dispose(){root.removeFromParent();geo.dispose();orb.geometry.dispose();pg.dispose();for(const child of root.children)child.material.dispose();},reset(){stop();budget.reset();},get active(){return held&&budget.cooldown===0;},get firing(){return firing;},get age(){return age;},get direction(){return direction.clone();},set held(value){if(!value)stop();else held=true;}};
}
