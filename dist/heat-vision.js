import {createHeatBudget} from './health.js';
import {createHeatFX,heatContact} from './heat-fx.js';
import * as T from './vendor/three.module.js';
import {PUNCHES} from './punches.js';
export const HEAT_RANGE=PUNCHES.serious.reach*7/20;
// Fixed screen aim point sits just above the head in the normal upright camera view.
export const HEAT_RETICLE=new T.Vector2(0,.27);
export function heatReticleAim(camera,origin,reticle=HEAT_RETICLE){
 const ray=new T.Raycaster();ray.setFromCamera(reticle,camera);
 const target=ray.ray.intersectSphere(new T.Sphere(origin,HEAT_RANGE),new T.Vector3())||ray.ray.at(HEAT_RANGE,new T.Vector3());
 return {target,direction:target.clone().sub(origin).normalize()};
}
export function createHeatVision(scene,{camera,hero,destruction,cityLife,groundHeight,collisionWorld=null,combat=null,actorId='player',targetPoint=()=>null,inCombat=()=>true}){
 const reticle=HEAT_RETICLE.clone();
 const effects=createHeatFX(scene,camera);
 const root=new T.Group();root.visible=false;scene.add(root);const geo=new T.CylinderGeometry(1,1,1,7),up=new T.Vector3(0,1,0),beams=[];
 for(let eye=0;eye<2;eye++)for(const glow of [true,false]){const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({color:glow?'#ff541a':'#fff8da',toneMapped:false,fog:false,transparent:glow,opacity:glow?.65:1,blending:glow?T.AdditiveBlending:T.NormalBlending,depthWrite:!glow}));mesh.frustumCulled=false;mesh.renderOrder=glow?3:2;root.add(mesh);beams.push({mesh,eye,glow});}
 const glowGeo=new T.SphereGeometry(.065,8,6),eyes=[-1,1].map(()=>{const m=new T.Mesh(glowGeo,new T.MeshBasicMaterial({color:'#ff3820',toneMapped:false}));root.add(m);return m;});
 const reflectedBeams=[0,1].map(()=>{const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({color:'#fff8b0',toneMapped:false}));mesh.visible=false;root.add(mesh);return mesh;});
 const budget=createHeatBudget();let tick=0;
 let held=false,clock=0;const stats={range:HEAT_RANGE,cuts:0,npcPiercings:0,ticks:0};
 function aimed(origin){const target=targetPoint();return target?{target,direction:target.clone().sub(origin).normalize()}:heatReticleAim(camera,origin,reticle);}
 function stop(){held=false;root.visible=false;clock=0;}
 function update(dt,allowed=true){const limited=inCombat(),used=budget.update(dt,held&&allowed&&limited),fired=limited?used:(held&&allowed&&budget.cooldown===0?dt:0);stats.charge=budget.charge;stats.cooldown=budget.cooldown;root.visible=fired>0;if(!root.visible){stats.contact=false;clock=0;effects.update(dt,false);stats.particles=effects.particles;return;}
  const origins=hero.eyePositions(),center=origins[0].clone().add(origins[1]).multiplyScalar(.5),dir=aimed(center).direction;let reach=HEAT_RANGE;
  // A beam stops at terrain rather than drilling a road trench or cutting through the earth.
  let groundStep=0;for(let d=0;d<=HEAT_RANGE;d=Math.min(HEAT_RANGE,d+3)){const p=center.clone().addScaledVector(dir,d);if(p.y<=groundHeight(p.x,p.z)){let lo=groundStep,hi=d;for(let i=0;i<8;i++){const mid=(lo+hi)/2,q=center.clone().addScaledVector(dir,mid);if(q.y<=groundHeight(q.x,q.z))hi=mid;else lo=mid;}reach=lo;break;}if(d===HEAT_RANGE)break;groundStep=d;}
  for(const mesh of reflectedBeams)mesh.visible=false;
  const heroContact=combat?.trace(center,dir,reach,.18,actorId);let reflection=null;
  if(heroContact){reach=heroContact.distance;if(!combat.actors.get(heroContact.id)?.forwardHit&&combat.actors.get(heroContact.id)?.defense?.parrying)reflection=dir.clone().negate();
   // One beam hit per 0.1s; a parry reroutes this tick at the shooter.
   tick+=fired;while(tick>=.1-1e-8){tick=Math.max(0,tick-.1);combat.hit(heroContact.id,{id:'heat-'+actorId+'-'+stats.ticks++,continuous:true,kind:'heat',attacker:actorId,direction:dir,redirect(direction){reflection=direction;combat.hit(actorId,{kind:"heat",attacker:heroContact.id,direction,reflected:true});}});}
  }
  const end=center.clone().addScaledVector(dir,reach);
  if(reflection){const back=center.clone().sub(end),length=back.length();for(let i=0;i<2;i++){const mesh=reflectedBeams[i];mesh.visible=true;mesh.position.copy(end).lerp(center,.5);mesh.position.x+=(i?1:-1)*.045;mesh.quaternion.setFromUnitVectors(up,back.clone().normalize());mesh.scale.set(.055,length,.055);}

  }for(let i=0;i<2;i++)eyes[i].position.copy(origins[i]);
  for(const {mesh,eye,glow} of beams){const start=origins[eye],delta=end.clone().sub(start);mesh.position.copy(start).lerp(end,.5);mesh.quaternion.setFromUnitVectors(up,delta.clone().normalize());mesh.scale.set(glow?.14:.047,delta.length(),glow?.14:.047);}
  let freshContact=null;clock-=dt;if(clock<=0){clock=.10;freshContact=heatContact(collisionWorld,center,dir,reach);if(!freshContact&&reach<HEAT_RANGE-.1)freshContact=end.clone();stats.cuts+=destruction.heat(center,dir,reach);stats.cuts+=cityLife.heat(center,dir,reach);const passes=cityLife.heatPasses||[];effects.pierce(passes,dir);stats.npcPiercings+=passes.length;stats.contact=!!freshContact;if(freshContact)cityLife.frighten?.(freshContact,90);}
  effects.update(dt,true,origins,end,freshContact);stats.particles=effects.particles;
 }
 return {update,stop,stats,reset(){stop();budget.reset();tick=0;},setForwardFlight(forward,dt){reticle.y=T.MathUtils.damp(reticle.y,forward?.008:HEAT_RETICLE.y,12,dt);},get reticleTop(){return (1-reticle.y)*50;},set held(value){if(value&&!held)clock=0;held=value;if(!value)stop();},get active(){return held&&budget.cooldown===0;},aimAt(origin){return aimed(origin);},aim(){const center=hero.root.position.clone().add(new T.Vector3(0,2.1,0));return aimed(center).direction;}};
}
