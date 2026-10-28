import * as T from './vendor/three.module.js';
// Damped angular springs give the limbs inertia with momentum-driven flips and staggered air twists.
export function createFallMotion(){
 const pose={},rates={};let blend=0,landing=0,lastY=0,wasFalling=false,airTime=0,tumbling=false,flip=0,barrel=0,twist=0,pitchRate=0,rollRate=0,twistRate=0,urgency=0,impactTime=0,reaction=0,reactionBlend=0,buckle=0,legTrail=0;const bend=new T.Vector3();const impactRates=new T.Vector3(),impactAngles=new T.Vector3(),recoil=new T.Vector3();
 function spring(key,target,dt){
  const head=key.startsWith('head'),elbow=key.endsWith('Elbow'),limits=head?[-.65,.65]:elbow?[-2.35,-.18]:key.endsWith('Spread')?[-1.55,1.55]:key.endsWith('Arm')?[-2.1,1.6]:key.endsWith('Knee')?[.08,2.2]:key==='chest'?[-.65,.95]:key==='chestSide'?[-.55,.55]:key==='chestTwist'?[-.4,.4]:key.endsWith('Hip')?[-1.45,.95]:key.endsWith('HipSide')?[-.55,.55]:null;
  if(limits)target=T.MathUtils.clamp(target,...limits);
  let p=pose[key]??target,v=rates[key]??0;const stiffness=head?42:elbow?54:65,damping=head?7:elbow?8:10,steps=Math.max(1,Math.ceil(dt/.008)),h=dt/steps;
  for(let i=0;i<steps;i++){v+=((target-p)*stiffness-v*damping)*h;p+=v*h;if(limits&&(p<limits[0]||p>limits[1])){p=T.MathUtils.clamp(p,...limits);v*=-.12;}}
  pose[key]=p;rates[key]=v;
 }

 return {impact({angular,closing,localImpulse,localPoint}){const force=Math.min(1.4,closing/65);if(localImpulse)recoil.addScaledVector(localImpulse,1/80).clampLength(0,1.8);
 const height=localPoint?.y??1.5,feet=1-T.MathUtils.smoothstep(height,.35,1.2),upper=T.MathUtils.smoothstep(height,1.0,1.9);
 reaction=Math.max(reaction,Math.min(1,closing/35));
 // A front torso strike folds the waist; a side strike bends sideways.
 // Feet-first contacts buckle the knees while upper-body hits leave legs trailing.
 bend.set(T.MathUtils.clamp(-recoil.z*(.55+upper*.25)+feet*.35,-.58,.88),T.MathUtils.clamp(recoil.x*.22,-.35,.35),T.MathUtils.clamp(recoil.x*.40,-.48,.48));
 buckle=Math.max(buckle,force*(.35+feet*.9));legTrail=T.MathUtils.clamp(-recoil.z*(.18+upper*.5),-.7,.7);
 rates.chest=(rates.chest||0)+bend.x*5;rates.chestSide=(rates.chestSide||0)+bend.z*5;
 for(const [name,side] of [['left',-1],['right',1]]){const near=localPoint?T.MathUtils.clamp(1+side*localPoint.x,.65,1.35):1;rates[name+'Hip']=(rates[name+'Hip']||0)+(legTrail-buckle*.65)*3*near;rates[name+'Knee']=(rates[name+'Knee']||0)+buckle*4*near;}
 // The head and distal joints lag behind the torso impulse, then settle on springs.
 rates.head=(rates.head||0)+T.MathUtils.clamp(-recoil.z*4-angular.x*.35,-5,5);
 rates.headYaw=(rates.headYaw||0)+T.MathUtils.clamp(-recoil.x*3-angular.y*.25,-4,4);
 rates.headRoll=(rates.headRoll||0)+T.MathUtils.clamp(recoil.x*3-angular.z*.3,-4,4);
 for(const [name,side] of [['left',-1],['right',1]]){rates[name+'Elbow']=(rates[name+'Elbow']||0)-force*(4.8+side*.8);rates[name+'Spread']=(rates[name+'Spread']||0)+side*force*3.8;rates[name+'Arm']=(rates[name+'Arm']||0)-recoil.z*3+side*angular.z*.22;}
 impactRates.add(angular).clampLength(0,12);impactTime=Math.min(1.2,.3+closing*.009);urgency=Math.max(urgency,Math.min(1,closing/55));if(closing>16)tumbling=true;},update(dt,time,{flying,grounded,vx,vy,vz,heading}){
 const falling=!flying&&!grounded,speed=Math.hypot(vx,vz),drift=Math.min(1,speed/65),drop=T.MathUtils.clamp(-vy/50,0,1),rise=T.MathUtils.clamp(vy/35,0,1);
 const totalSpeed=Math.hypot(speed,vy);
 if(falling){airTime+=dt;if(airTime>.22&&totalSpeed>32&&(vy<-7||speed>35))tumbling=true;}
 else{airTime=0;tumbling=false;flip=barrel=twist=0;pitchRate=rollRate=twistRate=0;}
 reactionBlend=T.MathUtils.damp(reactionBlend,reaction,18,dt);reaction*=Math.exp(-dt*3);bend.multiplyScalar(Math.exp(-dt*2.4));buckle*=Math.exp(-dt*2.5);legTrail*=Math.exp(-dt*2.1);
 impactTime=Math.max(0,impactTime-dt);recoil.multiplyScalar(Math.exp(-dt*3.2));
 impactAngles.addScaledVector(impactRates,dt);impactRates.multiplyScalar(Math.exp(-dt*(flying?5:grounded?8:1.2)));
 if(!falling)impactAngles.multiplyScalar(Math.exp(-dt*6));
 const intensity=tumbling?T.MathUtils.clamp((totalSpeed-18)/95,0,1):0;
 urgency=T.MathUtils.damp(urgency,falling?Math.max(drop*.25,intensity,Math.min(1,impactTime)):0,5,dt);
 // Integrate changing angular velocity: no reset, pause, or upright pose between turns.
 const flow=.5+.5*Math.sin(airTime*1.05);
 const angularResponse=impactTime>0?.45:3;
 pitchRate=T.MathUtils.damp(pitchRate,tumbling?(2.1+intensity*3.2)*(.65+.35*flow)*Math.min(1,totalSpeed/24):0,angularResponse,dt);
 rollRate=T.MathUtils.damp(rollRate,tumbling?(1.3+intensity*2.8)*Math.sin(airTime*.83+.5):0,angularResponse,dt);
 twistRate=T.MathUtils.damp(twistRate,tumbling?(.55+intensity)*Math.sin(airTime*1.27+1):0,angularResponse,dt);
 flip+=pitchRate*dt;barrel+=rollRate*dt;twist+=twistRate*dt;
 const tuck=urgency*(.5+.5*Math.sin(airTime*3.4));
 if(wasFalling&&grounded)landing=Math.min(.19,Math.max(0,-lastY)*.004);else landing=T.MathUtils.damp(landing,0,10,dt);
 blend=T.MathUtils.damp(blend,falling?1:0,flying?11:8,dt);wasFalling=falling;lastY=vy;
 const sideways=T.MathUtils.clamp((vx*Math.cos(heading)-vz*Math.sin(heading))/50,-1,1);
 spring('pitch',.04+drift*.55+drop*.14-rise*.04,dt);spring('roll',-sideways*.35+Math.sin(time*1.7)*.07*drop,dt);
 const hit=Math.min(1,impactTime),angularX=pitchRate+impactRates.x,angularZ=rollRate+impactRates.z;
 spring('head',-.08-drop*.10-angularX*.055-recoil.z*.30+Math.sin(time*4.1)*urgency*.22,dt);
 spring('headYaw',-recoil.x*.28+Math.sin(time*3.3+.6)*urgency*.25,dt);
 spring('headRoll',-angularZ*.07+recoil.x*.22+Math.sin(time*4.7)*urgency*.19,dt);
 spring('chest',bend.x,dt);
 spring('chestSide',bend.z,dt);
 spring('chestTwist',bend.y,dt);
 for(const [name,side] of [['left',-1],['right',1]]){const flutter=Math.sin(time*2.3+side*1.1)*(.025+drop*.035),flail=urgency*(Math.sin(airTime*6.1+side*1.4)*.58+Math.sin(airTime*10.3-side)*.18),kick=urgency*Math.sin(airTime*5.2+side*1.8);
  spring(name+'Arm',.12+drift*.32-rise*.22+flutter+flail*1.4-recoil.z*.65-hit*(.35+side*.18),dt);
  spring(name+'Spread',side*(.30+drop*.28+Math.abs(sideways)*.08+urgency*.40+flail*.38+hit*.30),dt);
  spring(name+'Elbow',-.40-drop*.35-urgency*(.60+.40*Math.sin(airTime*5.6+side*1.6))-hit*.55+flail*.30,dt);
  spring(name+'ShoulderTwist',side*(urgency*.18+hit*.20)+recoil.x*.25+flail*.22,dt);
  spring(name+'Hip',-.10-rise*.14+drift*.13+side*.04+flutter-tuck*.32+kick*.52-hit*.20+legTrail-buckle*.65,dt);
  spring(name+'Knee',.22+drop*.30+rise*.17+side*.055+flutter+tuck*.65+kick*.32+hit*.30+buckle,dt);
  spring(name+'HipSide',side*(.035+hit*.12)+bend.z*.55,dt);
  spring(name+'Ankle',.12+drop*.12+flail*.20,dt);
 }
 return {pose:{...pose,pitch:pose.pitch+flip+impactAngles.x,roll:pose.roll+barrel+impactAngles.z,twist:twist+impactAngles.y},blend,reactionBlend,landing,tumbling,urgency,angularSpeed:Math.hypot(pitchRate+impactRates.x,rollRate+impactRates.z,twistRate+impactRates.y)};
 }};
}
export const airborneControl=(grounded,flying)=>flying||!grounded;
