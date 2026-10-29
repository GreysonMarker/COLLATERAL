import {desktopVisuals,finishCharacterMaterial} from './visual-polish.js';
import {createBattleDamage} from './battle-damage.js';
import {defensePose} from './defense-pose.js';
import {throwPose} from './grab-pose.js';
import {installAppearance} from './character-styles.js';
import * as T from './vendor/three.module.js';
import {activeRecoveryPose} from './active-recovery.js';
import {createRagdoll} from './ragdoll.js';
import {createFallMotion} from './falling.js';
import {walkingGait,gaitRate,sprintGait} from './gait.js';
import {createCape} from './cape.js';
import {seriousPunchPose,regularPunchPose} from './punch-pose.js';

// Jointed, game-native hero. Local +Z is forward; all animation pivots are anatomical joints.
export function createHero(materialFactory) {
  const detailed=desktopVisuals();
  const toon=color=>finishCharacterMaterial(materialFactory(color).clone());
  const root = new T.Group(); root.name='Meridian caped hero';
  const orientation=new T.Group();orientation.position.y=1.2;root.add(orientation);const rig=new T.Group();rig.position.y=-1.2;orientation.add(rig);rig.scale.set(.74,1,.70);
  const navy=toon('#17233e'), blue=toon('#306ac7'), ivory=toon('#e6e1cc'), red=toon('#db3e57'), gold=toon('#ffc65e');
  const black=toon('#151728');
  const energy=new T.MeshBasicMaterial({color:'#83ffff',toneMapped:false});
  const ink=new T.MeshBasicMaterial({color:'#101626',side:T.BackSide});
  const skin=toon('#bc896d'),hair=toon('#232039');
  finishCharacterMaterial(skin,'skin');finishCharacterMaterial(hair,'hair');finishCharacterMaterial(gold,'metal');
  const all=[];
  function part(parent,geometry,material,x,y,z,sx=1,sy=1,sz=1,outline=true){
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);all.push(mesh);
    if(outline&&!detailed){const shell=new T.Mesh(geometry,ink);shell.scale.setScalar(1.045);mesh.add(shell)}return mesh;
  }
  const sphere=new T.SphereGeometry(1,detailed?24:10,detailed?16:7),gem=new T.IcosahedronGeometry(1,detailed?2:0),cube=new T.BoxGeometry(1,1,1);
  function armor(parent,m,x,y,z,sx,sy,sz){return part(parent,gem,m,x,y,z,sx,sy,sz)}
  function group(parent,x,y,z){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g}
  function taper(parent,m,x,y,z,top,bottom,height,depth){return part(parent,new T.CylinderGeometry(top,bottom,height,detailed?24:12),m,x,y,z,1,1,depth)}
  taper(rig,navy,0,1.43,0,.43,.27,.67,.64);
  taper(rig,blue,0,1.69,0,.48,.32,.38,.68);
  part(rig,sphere,blue,-.19,1.73,.16,.21,.20,.12);
  part(rig,sphere,blue,.19,1.73,.16,.21,.20,.12);
  for(const side of [-1,1]){const stripe=part(rig,cube,gold,side*.19,1.56,.256,.065,.39,.035,false);stripe.rotation.z=side*-.65;}
  for(let i=0;i<3;i++)part(rig,detailed?sphere:cube,blue,0,1.24+i*.105,.20,detailed?(.32-i*.027)/2:.32-i*.027,detailed?.047:.075,detailed?.065:.085);
  taper(rig,black,0,1.08,0,.28,.30,.21,.8);
  part(rig,cube,gold,0,1.145,.225,.24,.095,.055);
  // Embroidered sunburst emblem and tailored contrast panels, not powered armor.
  const crest=part(rig,new T.CylinderGeometry(.14,.14,.035,8),gold,0,1.70,.35);crest.rotation.x=Math.PI/2;
  const jewel=part(rig,new T.OctahedronGeometry(.09),red,0,1.70,.385,1,1,.35);
  for(const side of [-1,1]){part(rig,cube,red,side*.29,1.34,.05,.085,.40,.30);for(let j=0;j<3;j++)part(rig,cube,gold,side*.30,1.27+j*.09,.22,.06,.018,.015,false);}
  taper(rig,skin,0,1.98,0,.125,.15,.20,.88);
  const neck=group(rig,0,1.98,0);const head=group(neck,0,.14,0);head.scale.set(1.08,.96,1.08);
  part(head,sphere,skin,0,.035,.025,.205,.25,.19);
  part(head,sphere,skin,0,-.105,.075,.155,.115,.145);
  part(head,sphere,hair,0,.16,-.03,.217,.16,.205);
  for(let j=0;j<5;j++){const tuft=armor(head,hair,-.14+j*.07,.23,.015,.07,.09,.15);tuft.rotation.x=-.35;}
  // Open lower face, separate eye mask, brows, nose, ears and hair silhouette.
  for(const side of [-1,1]){part(head,sphere,skin,side*.201,.01,0,.045,.07,.045);const mask=part(head,sphere,navy,side*.087,.066,.185,.105,.065,.031,false);mask.rotation.z=side*.12;part(head,sphere,ivory,side*.085,.067,.214,.055,.025,.012,false);part(head,sphere,black,side*.084,.066,.224,.013,.019,.006,false);const brow=part(head,cube,hair,side*.09,.111,.212,.10,.019,.018,false);brow.rotation.z=side*.12;}
  armor(head,skin,0,.005,.205,.033,.060,.054);part(head,cube,red,0,-.09,.193,.075,.013,.008,false);
// Raised collar, shoulder plating, elbow and knee joints.
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const shoulder=group(rig,side*.40,1.81,0);shoulder.name=side<0?'leftShoulder':'rightShoulder';
    part(shoulder,sphere,blue,side*.015,-.035,0,.17,.20,.16);
    part(shoulder,sphere,red,side*.02,.07,-.04,.175,.075,.165);
    part(shoulder,new T.CapsuleGeometry(.105,.18,detailed?6:3,detailed?16:8),navy,0,-.24,0);
    if(detailed){part(shoulder,sphere,blue,0,-.22,.045,.115,.17,.10,false);part(shoulder,sphere,navy,0,-.24,-.045,.105,.15,.095,false);}
    const elbow=group(shoulder,0,-.43,0);elbow.name=side<0?'leftElbow':'rightElbow';
    part(elbow,sphere,black,0,0,0,.11,.11,.11);
    taper(elbow,blue,0,-.16,0,.125,.145,.29,.85);
    part(elbow,cube,gold,0,-.25,.13,.23,.06,.04);
    part(elbow,cube,red,0,-.11,.145,.07,.15,.018,false);
    part(elbow,sphere,navy,0,-.36,.01,.115,.13,.12);
    if(detailed){for(let finger=0;finger<4;finger++)part(elbow,sphere,navy,-.075+finger*.05,-.365,.10,.027,.038,.03,false);part(elbow,sphere,navy,side*.095,-.335,.045,.043,.065,.045,false);}
    arms.push({shoulder,elbow,side});
    const hip=group(rig,side*.19,1.05,0);
    taper(hip,navy,0,-.22,0,.135,.115,.43,.90);
    part(hip,sphere,blue,side*.015,-.19,.02,.14,.27,.14);
    const knee=group(hip,0,-.46,0);
    part(knee,sphere,black,0,0,0,.125,.125,.125);
    part(knee,sphere,blue,0,0,.025,.135,.13,.15);
    taper(knee,red,0,-.225,0,.12,.125,.40,.85);
    part(knee,cube,gold,0,-.20,.12,.045,.28,.025,false);
    part(knee,cube,gold,0,-.35,.13,.19,.065,.04);
    const ankle=group(knee,0,-.47,0);
    part(ankle,cube,navy,0,0,.06,.25,.18,.38);
    part(ankle,cube,black,0,-.095,.075,.26,.045,.40);
    legs.push({hip,knee,ankle,side});
  }
  const cape=createCape(root,rig,new T.MeshStandardMaterial({color:'#d43157',roughness:.93,metalness:0,bumpMap:detailed?blue.bumpMap:null,bumpScale:.016}));
  for(const side of [-1,1]){part(rig,new T.SphereGeometry(.075,10,8),gold,side*.33,1.87,.14);}
  const collar=part(rig,new T.TorusGeometry(.185,.045,6,16),red,0,1.96,0);collar.rotation.x=Math.PI/2;
  const appearance=installAppearance({root,rig,head,arms,legs,materials:{navy,blue,ivory,red,gold,black,skin,hair},part,cube,gem,all,cape,toon});
  const battleDamage=createBattleDamage(all,cape);
  const upperBody=group(rig,0,1.15,0);for(const child of [...rig.children])if(child!==upperBody&&child.position.y>1.15){rig.remove(child);upperBody.add(child);child.position.y-=1.15;}
  // Two spine pivots spread the bend through the waist and upper back.
  const thorax=group(upperBody,0,.40,0);for(const child of [...upperBody.children])if(child!==thorax&&child.position.y>.40){upperBody.remove(child);thorax.add(child);child.position.y-=.40;}
  const fallMotion=createFallMotion(),ragdoll=createRagdoll();
  const ragBones=[upperBody,thorax,neck,...arms.flatMap(a=>[a.shoulder,a.elbow]),...legs.flatMap(l=>[l.hip,l.knee,l.ankle])];let savedAnimation=null;
  function snapshot(){root.updateWorldMatrix(true,true);const p={pelvis:upperBody.getWorldPosition(new T.Vector3()),chest:thorax.getWorldPosition(new T.Vector3()),neck:neck.getWorldPosition(new T.Vector3()),head:head.localToWorld(new T.Vector3(0,.10,0))};
   for(const a of arms){const side=a.side<0?'left':'right';p[side+'Shoulder']=a.shoulder.getWorldPosition(new T.Vector3());p[side+'Elbow']=a.elbow.getWorldPosition(new T.Vector3());p[side+'Hand']=a.elbow.localToWorld(new T.Vector3(0,-.36,0));}
   for(const l of legs){const side=l.side<0?'left':'right';p[side+'Hip']=l.hip.getWorldPosition(new T.Vector3());p[side+'Knee']=l.knee.getWorldPosition(new T.Vector3());p[side+'Foot']=l.ankle.getWorldPosition(new T.Vector3());}return p;
  }
  function poseBone(bone,start,end,axis,weight){bone.parent.updateWorldMatrix(true,false);const a=bone.parent.worldToLocal(start.clone()),b=bone.parent.worldToLocal(end.clone());bone.position.lerp(a,weight);const direction=b.sub(a).normalize();if(direction.lengthSq()>.5)bone.quaternion.slerp(new T.Quaternion().setFromUnitVectors(axis,direction),weight);bone.updateWorldMatrix(false,true);}

  function plantArm(a,target,pole,weight,reachMargin=.015){
    if(weight<=0)return;
    a.shoulder.parent.updateWorldMatrix(true,false);
    const start=a.shoulder.position.clone(),goal=a.shoulder.parent.worldToLocal(target.clone()),bend=a.shoulder.parent.worldToLocal(pole.clone()).sub(start),direction=goal.clone().sub(start),raw=direction.length(),upper=.43,lower=.36;
    if(raw<.001)return;direction.divideScalar(raw);const reach=T.MathUtils.clamp(raw,.12,upper+lower-reachMargin),along=(upper*upper-lower*lower+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,upper*upper-along*along));
    bend.addScaledVector(direction,-bend.dot(direction)).normalize();const elbow=start.clone().addScaledVector(direction,along).addScaledVector(bend,height),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,-1,0),elbow.sub(start).normalize());a.shoulder.quaternion.slerp(q,weight);a.shoulder.updateWorldMatrix(false,true);
    const end=a.shoulder.worldToLocal(target.clone()).sub(a.elbow.position).normalize();a.elbow.quaternion.slerp(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,-1,0),end),weight);a.elbow.updateWorldMatrix(false,true);
  }
  function plantLeg(l,target,heading,weight){
    l.hip.parent.updateWorldMatrix(true,false);
    const start=l.hip.position.clone(),goal=l.hip.parent.worldToLocal(target.clone()),direction=goal.clone().sub(start),distance=direction.length();
    if(distance<.001)return;direction.divideScalar(distance);
    const reach=T.MathUtils.clamp(distance,.15,.925),along=(.46*.46-.47*.47+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,.46*.46-along*along));
    const pole=new T.Vector3(l.side*.1,.45,.9).applyAxisAngle(yAxis,heading).add(root.position),bend=l.hip.parent.worldToLocal(pole).sub(start);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
    const elbow=direction.clone().multiplyScalar(along).addScaledVector(bend,height).normalize();
    l.hip.quaternion.slerp(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,-1,0),elbow),weight);l.hip.updateWorldMatrix(false,true);
    const shin=l.hip.worldToLocal(target.clone()).sub(l.knee.position).normalize();l.knee.quaternion.slerp(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,-1,0),shin),weight);l.knee.updateWorldMatrix(false,true);
    const parentQ=l.knee.getWorldQuaternion(new T.Quaternion()).invert(),flat=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),heading+l.side*.12);
    l.ankle.quaternion.slerp(parentQ.multiply(flat),weight);
  }
  const capeForce=new T.Vector3(),capeTarget=new T.Vector3();
  const facing=new T.Quaternion(),yawQ=new T.Quaternion(),tiltQ=new T.Quaternion(),xAxis=new T.Vector3(1,0,0),yAxis=new T.Vector3(0,1,0),wind=new T.Vector3();
let flightBlend=0,walkPhase=0,facingHeading=Math.PI,strideBlend=0,runBlend=0,briskBlend=0,hoverTravel=0,groundPoseBlend=0;const bankQ=new T.Quaternion(),zAxis=new T.Vector3(0,0,1);
  function update(dt,time,{onTitanStep=null,health=1000,flying,levitating=false,jumpCharge=0,ambientWind=null,collisionWorld=null,groundRecovery=null,recovery=0,groundMode='slow',moving,boost,vx,vy=0,vz,grounded,yaw=0,pitch=0,groundY=.47,bank=0,punch=null,heatAim=null,grab=null,held=null,defense=null}){
    head.quaternion.identity();
    if(flying||held){ragdoll.reset();groundPoseBlend=0;}
    if(savedAnimation){for(let i=0;i<ragBones.length;i++){ragBones[i].position.copy(savedAnimation[i].p);ragBones[i].quaternion.copy(savedAnimation[i].q);}savedAnimation=null;}
    battleDamage.setHealth(health);battleDamage.setSkin(appearance.style.colors[6]);
    const fall=fallMotion.update(dt,time,{flying,grounded,vx,vy,vz,heading:facingHeading});
    const speed=Math.hypot(vx,vz);strideBlend=T.MathUtils.damp(strideBlend,Math.min(1,speed/2.0),10,dt);const stride=strideBlend;flightBlend=T.MathUtils.damp(flightBlend,flying?1:0,7,dt);
    runBlend=T.MathUtils.damp(runBlend,!flying&&boost?1:0,7,dt);
    briskBlend=T.MathUtils.damp(briskBlend,!flying&&groundMode!=='slow'?1:0,7,dt);
    const titan=appearance.style.id==='monolith',oldStep=Math.floor(walkPhase/Math.PI);
    walkPhase+=titan?dt*Math.min(3.0,speed/4.5):dt*T.MathUtils.lerp(gaitRate(speed,0)+briskBlend*.55,Math.PI*2*(1.45+Math.min(speed,12)*.045),runBlend)*Math.min(1,speed/.6);
    const travelSpeed=Math.hypot(vx,vy,vz);const cruising=flying&&!levitating&&moving&&travelSpeed>.15;
    const hovering=flying&&!cruising;hoverTravel=T.MathUtils.damp(hoverTravel,hovering?Math.min(1,speed/8):0,6,dt);
    const heading=speed>.15?Math.atan2(vx,vz):facingHeading;facingHeading=heading;
    if(heading!==null){yawQ.setFromAxisAngle(yAxis,heading);tiltQ.setFromAxisAngle(xAxis,cruising?Math.atan2(speed,vy):flying?0:fall.pose.pitch*fall.blend);facing.copy(yawQ).multiply(tiltQ);if(flying){bankQ.setFromAxisAngle(yAxis,bank*2.5);facing.multiply(bankQ);}else{bankQ.setFromAxisAngle(yAxis,fall.pose.twist*fall.blend);facing.multiply(bankQ);bankQ.setFromAxisAngle(zAxis,fall.pose.roll*fall.blend);facing.multiply(bankQ);}orientation.quaternion.slerp(facing,1-Math.exp(-dt*(flying&&recovery>0?T.MathUtils.lerp(2.5,11,1-Math.min(1,recovery/1.15)):!flying&&!grounded?8:11)));}
    rig.position.y=-1.2+(flying?(hovering?.045*Math.sin(time*1.8):.025*Math.sin(time*2.8)):T.MathUtils.lerp(-.005+Math.cos(walkPhase*2)*(.009+briskBlend*.005),-.04+Math.cos(walkPhase*2)*.054,runBlend)*stride);
    rig.position.y-=jumpCharge*.22;
    upperBody.position.z=T.MathUtils.damp(upperBody.position.z,hovering?.055*hoverTravel:0,7,dt);upperBody.rotation.x=T.MathUtils.damp(upperBody.rotation.x,hovering?-.06*hoverTravel:0,7,dt);
    rig.rotation.x=T.MathUtils.damp(rig.rotation.x,hovering?.11*hoverTravel:jumpCharge>0?.08+jumpCharge*.10:flying?0:(.012+briskBlend*.018+runBlend*.135)*stride,8,dt);
    rig.rotation.y=T.MathUtils.damp(rig.rotation.y,flying?0:Math.sin(walkPhase)*(.04+briskBlend*.025+runBlend*.045)*stride,8,dt);
    rig.rotation.z=T.MathUtils.damp(rig.rotation.z,hovering?Math.sin(time*1.3)*.012*(1-hoverTravel):flying?0:Math.cos(walkPhase)*(.018+.007*runBlend)*stride,12,dt);
    neck.rotation.y=T.MathUtils.damp(neck.rotation.y,hovering?Math.sin(time*.65)*.04*(1-hoverTravel):flying?0:-rig.rotation.y*.7,12,dt);
    neck.rotation.x=T.MathUtils.damp(neck.rotation.x,cruising?-Math.PI*.46+Math.sin(time*2.2)*.018:0,10,dt);
for(const a of arms){a.elbow.rotation.y=T.MathUtils.damp(a.elbow.rotation.y,0,18,dt);a.elbow.rotation.z=T.MathUtils.damp(a.elbow.rotation.z,0,18,dt);const phase=a.side===-1?0:Math.PI,walk=T.MathUtils.lerp(walkingGait(walkPhase+phase,stride,briskBlend).arm,sprintGait(walkPhase+phase,stride).arm,runBlend);const pose=jumpCharge>0?.18+jumpCharge*.35:hovering?.02+.30*hoverTravel+Math.sin(time*1.7+phase)*.025:flying?(moving?(a.side===-1?-Math.PI:-2.85):-.12):walk;
      a.shoulder.rotation.x=T.MathUtils.damp(a.shoulder.rotation.x,pose,flying?10:28,dt);a.shoulder.rotation.z=T.MathUtils.damp(a.shoulder.rotation.z,a.side*(cruising?-.055:hovering?.18+.02*hoverTravel:.11+runBlend*.03),10,dt);a.elbow.rotation.x=T.MathUtils.damp(a.elbow.rotation.x,cruising?-.06:hovering?-.12:flying?-.3:T.MathUtils.lerp(-.20-Math.max(0,-walk)*(.35+briskBlend*.10),-.22-(.60+.32*Math.cos(walkPhase+phase+.6))-Math.max(0,-walk)*.28,runBlend),24,dt);}
    for(const l of legs){for(const bone of [l.hip,l.knee,l.ankle]){bone.rotation.y=T.MathUtils.damp(bone.rotation.y,0,18,dt);bone.rotation.z=T.MathUtils.damp(bone.rotation.z,0,18,dt);}const phase=l.side===-1?0:Math.PI,step=walkingGait(walkPhase+phase,stride,briskBlend),run=sprintGait(walkPhase+phase,stride);for(const key of ['hip','knee','ankle'])step[key]=T.MathUtils.lerp(step[key],run[key],runBlend);if(jumpCharge>0){step.hip=-.15-jumpCharge*.38;step.knee=.30+jumpCharge*.76;step.ankle=-step.hip-step.knee;}l.hip.rotation.x=T.MathUtils.damp(l.hip.rotation.x,hovering?(l.side===-1?.025+.115*hoverTravel:.055+.135*hoverTravel):flying?(moving?(l.side===-1?0:.04):(l.side===-1?.10:.25)):grounded?step.hip:-.3,30,dt);l.knee.rotation.x=T.MathUtils.damp(l.knee.rotation.x,hovering?.075+.045*hoverTravel:flying?(moving?.06:.25):grounded?step.knee:.6,30,dt);l.ankle.rotation.x=T.MathUtils.damp(l.ankle.rotation.x,hovering?.48:!flying&&grounded?step.ankle:0,30,dt);l.hip.rotation.z=l.side*.035;}
    if(titan&&grounded&&!flying&&!held){
      const weight=Math.min(1,speed/2),phase=walkPhase;
      rig.position.y=-1.2-Math.abs(Math.sin(phase))*.025*weight;
      rig.rotation.x=.035*weight;rig.rotation.z=Math.sin(phase)*.022*weight;
      for(const l of legs){const p=phase+(l.side<0?0:Math.PI);l.hip.rotation.x=Math.cos(p)*.40*weight;l.knee.rotation.x=Math.max(0,Math.sin(p))*.48*weight;l.ankle.rotation.x=-l.hip.rotation.x-l.knee.rotation.x;l.hip.rotation.z=l.side*.055;}
      for(const a of arms){const p=phase+(a.side<0?0:Math.PI);a.shoulder.rotation.x=-Math.cos(p)*.20*weight;a.shoulder.rotation.z=a.side*.14;a.elbow.rotation.x=-.18;}
    }
    // Blend spring-driven body reactions over the locomotion poses.
    rig.position.y=T.MathUtils.lerp(rig.position.y,-1.2,fall.blend)-fall.landing;
    rig.rotation.x*=1-fall.blend;rig.rotation.y*=1-fall.blend;rig.rotation.z*=1-fall.blend;
    const bodyReaction=Math.max(fall.blend,fall.reactionBlend);
    neck.rotation.x=T.MathUtils.lerp(neck.rotation.x,fall.pose.head,bodyReaction);
    neck.rotation.y=T.MathUtils.lerp(neck.rotation.y,fall.pose.headYaw,bodyReaction);
    neck.rotation.z=T.MathUtils.damp(neck.rotation.z,fall.pose.headRoll*bodyReaction,16,dt);
    upperBody.rotation.x=T.MathUtils.lerp(upperBody.rotation.x,fall.pose.chest*.65,bodyReaction);
    upperBody.rotation.y=T.MathUtils.damp(upperBody.rotation.y,fall.pose.chestTwist*bodyReaction,12,dt);
    upperBody.rotation.z=T.MathUtils.damp(upperBody.rotation.z,fall.pose.chestSide*.65*bodyReaction,16,dt);
    thorax.rotation.set(fall.pose.chest*.35*bodyReaction,fall.pose.chestTwist*.35*bodyReaction+(!flying&&grounded?-Math.sin(walkPhase)*(.055+briskBlend*.025)*stride*(1-bodyReaction):0),fall.pose.chestSide*.35*bodyReaction);
    for(const a of arms){const name=a.side<0?'left':'right';a.shoulder.rotation.x=T.MathUtils.lerp(a.shoulder.rotation.x,fall.pose[name+'Arm'],bodyReaction);a.shoulder.rotation.z=T.MathUtils.lerp(a.shoulder.rotation.z,fall.pose[name+'Spread'],bodyReaction);a.elbow.rotation.x=T.MathUtils.lerp(a.elbow.rotation.x,fall.pose[name+'Elbow'],bodyReaction);a.shoulder.rotation.y=T.MathUtils.damp(a.shoulder.rotation.y,fall.pose[name+'ShoulderTwist']*bodyReaction,14,dt);}
    for(const l of legs){const name=l.side<0?'left':'right';l.hip.rotation.x=T.MathUtils.lerp(l.hip.rotation.x,fall.pose[name+'Hip'],bodyReaction)-fall.landing;l.knee.rotation.x=T.MathUtils.lerp(l.knee.rotation.x,fall.pose[name+'Knee'],bodyReaction)+fall.landing*2;l.hip.rotation.z=T.MathUtils.lerp(l.hip.rotation.z,fall.pose[name+'HipSide'],bodyReaction);l.ankle.rotation.x=T.MathUtils.lerp(l.ankle.rotation.x,fall.pose[name+'Ankle'],bodyReaction);}
    const down=groundRecovery&&groundRecovery.phase!=='none'&&groundRecovery.grounded;
    groundPoseBlend=T.MathUtils.damp(groundPoseBlend,down?1:0,down?9:12,dt);
    const rise=groundRecovery?.phase==='none'?1:down&&groundRecovery.phase==='rising'?groundRecovery.progress:0;
    const rp=activeRecoveryPose(rise,ragdoll.feedback),g=groundPoseBlend,effort=down&&groundRecovery.phase==='rising'?Math.sin(Math.PI*rise):0;
    orientation.position.y=T.MathUtils.lerp(1.2,rp.height,g);
    if(g>.001){const upright=new T.Quaternion().setFromAxisAngle(yAxis,facingHeading),tilt=new T.Quaternion().setFromEuler(new T.Euler(rp.pitch,0,rp.roll));orientation.quaternion.slerp(upright.multiply(tilt),g);
      rig.position.y=T.MathUtils.lerp(rig.position.y,-1.2,g);rig.rotation.x*=1-g;rig.rotation.y*=1-g;rig.rotation.z*=1-g;
      const tremor=Math.sin(time*18)*.005*effort;
      upperBody.rotation.x=T.MathUtils.lerp(upperBody.rotation.x,rp.chest+tremor,g);thorax.rotation.x=T.MathUtils.lerp(thorax.rotation.x,rp.chest*.3,g);
      neck.rotation.x=T.MathUtils.lerp(neck.rotation.x,rp.head,g);neck.rotation.z=T.MathUtils.lerp(neck.rotation.z,.07*(1-rise),g);
      for(const a of arms){const name=a.side<0?'left':'right';a.shoulder.rotation.x=T.MathUtils.lerp(a.shoulder.rotation.x,rp[name+'Arm']+tremor*a.side,g);a.shoulder.rotation.z=T.MathUtils.lerp(a.shoulder.rotation.z,a.side*(.31-.11*rise),g);a.elbow.rotation.x=T.MathUtils.lerp(a.elbow.rotation.x,rp[name+'Elbow']-Math.abs(tremor),g);}
      for(const l of legs){const name=l.side<0?'left':'right';l.hip.rotation.x=T.MathUtils.lerp(l.hip.rotation.x,rp[name+'Hip'],g);l.knee.rotation.x=T.MathUtils.lerp(l.knee.rotation.x,rp[name+'Knee'],g);l.ankle.rotation.x=T.MathUtils.lerp(l.ankle.rotation.x,.17*(1-rise),g);}
    }
    if(down&&rise<.46){root.updateWorldMatrix(true,true);const planted=g*(1-T.MathUtils.smoothstep(rise,.32,.46)),headingQ=new T.Quaternion().setFromAxisAngle(yAxis,facingHeading);
      const contacts=arms.map(a=>{const hand=new T.Vector3(a.side*.27,0,.62).applyQuaternion(headingQ).add(root.position);hand.y=groundY+.085;const pole=new T.Vector3(a.side*.7,.35,.30).applyQuaternion(headingQ).add(root.position);return {a,hand,pole};});
      // Keep the chest within arm reach while weight is supported on the hands.
      for(let pass=0;pass<4;pass++){let excess=0;for(const {a,hand} of contacts){a.shoulder.parent.updateWorldMatrix(true,false);const goal=a.shoulder.parent.worldToLocal(hand.clone());excess=Math.max(excess,goal.distanceTo(a.shoulder.position)-.775);}if(excess<=.001)break;orientation.position.y-=Math.min(.10,excess*.65)*planted;root.updateWorldMatrix(true,true);}
      for(const {a,hand,pole} of contacts)plantArm(a,hand,pole,planted);
    }
    capeTarget.set(0,0,0);
    if(punch&&flying&&moving&&travelSpeed>3){
      // Traveling strikes: retain a forward flight silhouette, tuck one knee and drive the fist through.
      const serious=punch.kind==='serious',p=serious?seriousPunchPose(punch.age,punch.variant):regularPunchPose(punch.kind,punch.age,punch.variant),w=p.weight,side=p.strikeSide;
      const heading=Math.atan2(punch.direction.x,punch.direction.z),pitch=-Math.asin(T.MathUtils.clamp(punch.direction.y,-1,1)),lean=levitating?.55:1.05;
      const aimQ=new T.Quaternion().setFromEuler(new T.Euler(pitch,heading,0,'YXZ'));
      orientation.quaternion.slerp(aimQ.clone().multiply(new T.Quaternion().setFromAxisAngle(xAxis,lean)),w);facingHeading=heading;
      rig.rotation.x=T.MathUtils.lerp(rig.rotation.x,p.lean*.22,w);rig.rotation.y=T.MathUtils.lerp(rig.rotation.y,p.hipYaw*.65,w);rig.rotation.z=T.MathUtils.lerp(rig.rotation.z,-side*.12,w);
      upperBody.rotation.x=T.MathUtils.lerp(upperBody.rotation.x,p.lean*.35,w);upperBody.rotation.y=T.MathUtils.lerp(upperBody.rotation.y,p.waistYaw*.85,w);
      thorax.rotation.x=T.MathUtils.lerp(thorax.rotation.x,p.lean*.2,w);thorax.rotation.y=T.MathUtils.lerp(thorax.rotation.y,p.chestYaw,w);
      neck.rotation.x=T.MathUtils.lerp(neck.rotation.x,-lean-p.lean*.45,w);neck.rotation.y=T.MathUtils.lerp(neck.rotation.y,-(p.hipYaw*.65+p.waistYaw*.85+p.chestYaw)*.65,w);
      root.updateWorldMatrix(true,true);
      const striking=arms.find(a=>a.side===side),guard=arms.find(a=>a.side!==side),shoulder=striking.shoulder.getWorldPosition(new T.Vector3()),extension=T.MathUtils.clamp((p.handZ+.46)/1.34,0,1);
      const hand=shoulder.clone().add(new T.Vector3(punch.variant?p.handX-side*.26:side*(.28-.22*extension),punch.variant?(p.handY-.42)*.8:.09,-.56+extension*1.24).applyQuaternion(aimQ));
      const pole=shoulder.clone().add(new T.Vector3(side*.7,punch.variant?(p.poleY-.4):-.25,-.15).applyQuaternion(aimQ));plantArm(striking,hand,pole,w,serious?.003:.008);
      const other=guard.shoulder.getWorldPosition(new T.Vector3());plantArm(guard,other.clone().add(new T.Vector3(-side*.10,-.18,.28).applyQuaternion(aimQ)),other.clone().add(new T.Vector3(-side*.6,-.3,.1).applyQuaternion(aimQ)),w);
      for(const l of legs){const tuck=l.side!==side;l.hip.rotation.x=T.MathUtils.lerp(l.hip.rotation.x,tuck?-.45-.22*(1-extension):.16,w);l.hip.rotation.z=T.MathUtils.lerp(l.hip.rotation.z,l.side*.12,w);l.knee.rotation.x=T.MathUtils.lerp(l.knee.rotation.x,tuck?.90:.24,w);l.ankle.rotation.x=T.MathUtils.lerp(l.ankle.rotation.x,.28,w);}
      capeTarget.copy(punch.direction).multiplyScalar(-p.gust*.6);capeTarget.y+=p.gust*.12;
    }else if(punch?.kind==='serious'){
      const p=seriousPunchPose(punch.age,punch.variant),w=p.weight,heading=Math.atan2(punch.direction.x,punch.direction.z),aimPitch=-Math.asin(T.MathUtils.clamp(punch.direction.y,-1,1));
      const q=new T.Quaternion().setFromEuler(new T.Euler(grounded?0:aimPitch,heading,0,'YXZ'));
      orientation.quaternion.slerp(q,w);facingHeading=heading;
      rig.position.y-=p.sink*w;rig.rotation.set(T.MathUtils.lerp(rig.rotation.x,p.lean*.28,w),T.MathUtils.lerp(rig.rotation.y,p.hipYaw,w),T.MathUtils.lerp(rig.rotation.z,p.side*.3,w));
      upperBody.rotation.set(T.MathUtils.lerp(upperBody.rotation.x,p.lean*.42+(grounded?aimPitch*.28:0),w),T.MathUtils.lerp(upperBody.rotation.y,p.waistYaw,w),T.MathUtils.lerp(upperBody.rotation.z,p.side*.4,w));
      thorax.rotation.set(T.MathUtils.lerp(thorax.rotation.x,p.lean*.30+(grounded?aimPitch*.24:0),w),T.MathUtils.lerp(thorax.rotation.y,p.chestYaw,w),T.MathUtils.lerp(thorax.rotation.z,p.side*.3,w));
      // Counterturn the head towards the target while the shoulders wind back.
      neck.rotation.set(T.MathUtils.lerp(neck.rotation.x,-p.lean*.65+(grounded?aimPitch*.35:0),w),T.MathUtils.lerp(neck.rotation.y,-(p.hipYaw+p.waistYaw+p.chestYaw)*.65,w),T.MathUtils.lerp(neck.rotation.z,-p.side*.65,w));
      root.updateWorldMatrix(true,true);
      const target=(x,y,z)=>orientation.localToWorld(new T.Vector3(x,y,z));
      const handY=p.handY+(grounded?punch.direction.y*.55:0);
      // Straight and crossing strikes reach back before driving; curved strikes retain their own arc.
      const side=p.strikeSide,strikingArm=arms.find(a=>a.side===side),hand=target(p.handX,handY,p.handZ);
      const pull=T.MathUtils.smoothstep(punch.age,.12,.65)*(1-T.MathUtils.smoothstep(punch.age,.96,1.045))*(p.longPull??1);
      strikingArm.shoulder.parent.updateWorldMatrix(true,false);
      const shoulder=strikingArm.shoulder.getWorldPosition(new T.Vector3()),back=new T.Vector3(side*.28,.04,-1).applyQuaternion(orientation.quaternion).add(shoulder);
      const parent=strikingArm.shoulder.parent,localBack=parent.worldToLocal(back).sub(strikingArm.shoulder.position).normalize().multiplyScalar(.787).add(strikingArm.shoulder.position);
      hand.lerp(parent.localToWorld(localBack),pull);
      plantArm(strikingArm,hand,target(side*.95,p.poleY??.25,-.55+p.drive*.95),w,T.MathUtils.lerp(.015,.003,pull));
      plantArm(arms.find(a=>a.side!==side),target(-side*.46,.44,p.guardZ),target(-side*.90,.12,.12),w);
      for(const l of legs){
        if(grounded){
          // The guard-side foot braces forward and the striking side drives from behind.
          const foot=new T.Vector3(l.side*.30,0,l.side!==side?.36:-.38).applyAxisAngle(yAxis,heading).add(root.position);foot.y=groundY+.145;
          plantLeg(l,foot,heading,w);
        }else{
          l.hip.rotation.x=T.MathUtils.lerp(l.hip.rotation.x,l.side!==side?-.45+p.drive*.25:.30+p.drive*.22,w);
          l.hip.rotation.z=T.MathUtils.lerp(l.hip.rotation.z,l.side*.18,w);
          l.knee.rotation.x=T.MathUtils.lerp(l.knee.rotation.x,l.side!==side?.65:.35,w);
          l.ankle.rotation.x=T.MathUtils.lerp(l.ankle.rotation.x,.24,w);
        }
      }
      capeTarget.copy(punch.direction).multiplyScalar(-p.gust);capeTarget.y+=p.gust*.32;
    }else if(punch){
      const p=regularPunchPose(punch.kind,punch.age,punch.variant),w=p.weight,heading=Math.atan2(punch.direction.x,punch.direction.z),aimPitch=-Math.asin(T.MathUtils.clamp(punch.direction.y,-1,1));
      orientation.quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(grounded?0:aimPitch,heading,0,'YXZ')),w);facingHeading=heading;
      rig.position.y-=p.sink*w;rig.rotation.z=T.MathUtils.lerp(rig.rotation.z,p.side*.4,w);upperBody.rotation.z=T.MathUtils.lerp(upperBody.rotation.z,p.side*.6,w);
      rig.rotation.x=T.MathUtils.lerp(rig.rotation.x,p.lean*.3,w);rig.rotation.y=T.MathUtils.lerp(rig.rotation.y,p.hipYaw,w);
      upperBody.rotation.x=T.MathUtils.lerp(upperBody.rotation.x,p.lean*.4+(grounded?aimPitch*.25:0),w);upperBody.rotation.y=T.MathUtils.lerp(upperBody.rotation.y,p.waistYaw,w);
      thorax.rotation.x=T.MathUtils.lerp(thorax.rotation.x,p.lean*.3+(grounded?aimPitch*.25:0),w);thorax.rotation.y=T.MathUtils.lerp(thorax.rotation.y,p.chestYaw,w);
      neck.rotation.x=T.MathUtils.lerp(neck.rotation.x,-p.lean*.7+(grounded?aimPitch*.3:0),w);neck.rotation.y=T.MathUtils.lerp(neck.rotation.y,-(p.hipYaw+p.waistYaw+p.chestYaw)*.7,w);
      root.updateWorldMatrix(true,true);const target=(x,y,z)=>orientation.localToWorld(new T.Vector3(x,y,z)),striking=arms.find(a=>a.side===p.strikeSide),guard=arms.find(a=>a.side!==p.strikeSide);
      plantArm(striking,target(p.handX,p.handY+(grounded?punch.direction.y*.5:0),p.handZ),target(p.strikeSide*.95,p.poleY??.22,.12),w,.006);
      plantArm(guard,target(-p.strikeSide*.43,.48,p.guardZ),target(-p.strikeSide*.80,.18,.12),w);
      if(grounded&&!moving)for(const l of legs){const foot=new T.Vector3(l.side*.23,0,l.side===p.strikeSide?-.18:.22).applyAxisAngle(yAxis,heading).add(root.position);foot.y=groundY+.145;plantLeg(l,foot,heading,w);}
      capeTarget.copy(punch.direction).multiplyScalar(-p.gust);capeTarget.y+=p.gust*.18;
    }

    if(grab){
      const heading=Math.atan2(grab.direction.x,grab.direction.z),aimPitch=-Math.asin(T.MathUtils.clamp(grab.direction.y,-1,1));
      if(!(grab.flightCarry||grab.tackle))orientation.quaternion.copy(new T.Quaternion().setFromEuler(new T.Euler(grounded?0:aimPitch,heading,0,'YXZ')));
      const charge=grab.phase==='windup',release=grab.phase==='throw',p=throwPose(grab.age);
      const weight=grab.phase==='recover'?Math.max(0,1-grab.age/.32):release?p.weight:1;
      upperBody.rotation.y=T.MathUtils.lerp(upperBody.rotation.y,release?p.twist*.38:charge?-.15:0,weight);
      thorax.rotation.y=T.MathUtils.lerp(thorax.rotation.y,release?p.twist*.62:charge?-.35:0,weight);
      if(release){rig.position.y-=p.sink;upperBody.rotation.x=T.MathUtils.lerp(upperBody.rotation.x,p.lean,weight);neck.rotation.y=-p.twist*.6;}
      root.updateWorldMatrix(true,true);
      const target=(x,y,z)=>orientation.localToWorld(new T.Vector3(x,y,z));
      plantArm(arms.find(a=>a.side===1),target(release?p.handX:.35,(release?p.handY:.75)+(grab.car?.10:0),charge?-.24:release?p.handZ:.63),target(1,.45,release?-.2:.1),weight,.006);
      plantArm(arms.find(a=>a.side===-1),target(-.45,release?.40+.15*p.load:.35,release?.5-.7*p.drive:grab.car?.55:.12),target(-.9,.2,.1),weight);
      if(release&&grounded&&!moving)for(const l of legs){const foot=new T.Vector3(l.side*.27,0,l.side>0?-.30:.28).applyAxisAngle(yAxis,heading).add(root.position);foot.y=groundY+.145;plantLeg(l,foot,heading,weight);}
      capeTarget.copy(grab.direction).multiplyScalar(release?-p.gust:0);
      if((grab.flightCarry||grab.tackle)&&!release&&!charge){
        // Keep the flight body horizontal. Right arm reaches below the chest;
        // tackle folds it around the victim instead of reaching for the neck.
        upperBody.rotation.set(grab.tackle?.12:.04,grab.tackle?-.16:0,0);thorax.rotation.y=grab.tackle?-.12:0;
        root.updateWorldMatrix(true,true);
        plantArm(arms.find(a=>a.side===1),target(grab.tackle?.32:.38,grab.tackle?.65:.24,grab.tackle?.48:.62),target(.85,.28,.30),1,.006);
        plantArm(arms.find(a=>a.side===-1),target(-.38,grab.tackle?.65:1.20,grab.tackle?.38:.10),target(-.8,.45,.16),1);
      }
    }
    if(heatAim){
      if(grounded||flying&&!moving){const heading=Math.atan2(heatAim.x,heatAim.z);orientation.quaternion.slerp(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),heading),1-Math.exp(-dt*16));}
      root.updateMatrixWorld(true);const eye=head.getWorldPosition(new T.Vector3()),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(eye.clone().add(heatAim),eye,new T.Vector3(0,1,0))),parent=head.parent.getWorldQuaternion(new T.Quaternion()).invert();head.quaternion.copy(parent.multiply(q));
    }
    const guard=defensePose(defense);
    if(guard){
      const heading=yaw+Math.PI;
      orientation.quaternion.copy(new T.Quaternion().setFromEuler(new T.Euler(0,heading,0,'YXZ')));
      rig.rotation.set(0,0,0);rig.position.y=-1.2;
      upperBody.rotation.set(guard.lean,guard.twist*.4,0);thorax.rotation.y=guard.twist*.6;
      neck.rotation.x=guard.open?.08:-.08;neck.rotation.y=-guard.twist*.5;
      root.updateWorldMatrix(true,true);
      const target=p=>orientation.localToWorld(new T.Vector3(...p));
      plantArm(arms.find(a=>a.side===1),target(guard.right),target([.90,.30,.15]),guard.weight,.006);
      plantArm(arms.find(a=>a.side===-1),target(guard.left),target([-.90,.30,.15]),guard.weight,.006);
      if(grounded){for(const l of legs){const foot=new T.Vector3(l.side*.25,0,l.side>0?-.23:.23).applyAxisAngle(yAxis,heading).add(root.position);foot.y=groundY+.145;plantLeg(l,foot,heading,guard.weight);}}
      capeTarget.set(0,0,0);
    }
    if(held&&(held.mode==='tackle'||held.moving||held.flightCarry)){
      const d=held.direction?.isVector3?held.direction:new T.Vector3().fromArray(held.direction||[0,0,1]);
      const heading=Math.atan2(d.x,d.z)+Math.PI,tackle=held.mode==='tackle',struggle=Math.sin(time*9),kick=Math.sin(time*6.5);
      orientation.quaternion.setFromEuler(new T.Euler(tackle?Math.asin(T.MathUtils.clamp(d.y,-1,1)):-.18,heading,0,'YXZ'));
      rig.position.y=-1.2;rig.rotation.set(0,0,0);
      upperBody.rotation.set(tackle?-.52:-.10,0,struggle*.035);thorax.rotation.set(tackle?-.38:-.08,0,0);neck.rotation.set(tackle?.28:.15,0,struggle*.035);
      for(const l of legs){l.hip.rotation.set(tackle?.65:-.22+kick*l.side*.15,0,l.side*.10);l.knee.rotation.x=tackle?.9:.35+(1-kick*l.side)*.16;l.ankle.rotation.x=.25;}
      root.updateWorldMatrix(true,true);
      const grip=neck.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,-.09,0));
      for(const a of arms){const hand=tackle?orientation.localToWorld(new T.Vector3(a.side*.38,.35,.50)):grip.clone().add(new T.Vector3(a.side*.10,struggle*a.side*.025,.10).applyAxisAngle(yAxis,heading));
        plantArm(a,hand,orientation.localToWorld(new T.Vector3(a.side*.72,.42,.35)),1,.006);}
    }
    if(ragdoll.active&&!guard&&!held){const targets=snapshot(),result=ragdoll.update(dt,targets,root.position,collisionWorld,{flying,grounded,vx,vy,vz,groundRecovery});if(result.points){savedAnimation=ragBones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));const p=result.points,w=result.weight,up=new T.Vector3(0,1,0),down=new T.Vector3(0,-1,0);
      poseBone(upperBody,p.pelvis,p.chest,up,w);poseBone(thorax,p.chest,p.neck,up,w);poseBone(neck,p.neck,p.head,up,w);
      for(const a of arms){const side=a.side<0?'left':'right';poseBone(a.shoulder,p[side+'Shoulder'],p[side+'Elbow'],down,w);poseBone(a.elbow,p[side+'Elbow'],p[side+'Hand'],down,w);}
      for(const l of legs){const side=l.side<0?'left':'right';poseBone(l.hip,p[side+'Hip'],p[side+'Knee'],down,w);poseBone(l.knee,p[side+'Knee'],p[side+'Foot'],down,w);l.ankle.rotation.x=T.MathUtils.lerp(l.ankle.rotation.x,.2,w);}
    }}
    if(titan&&onTitanStep&&grounded&&!flying&&!held&&!punch&&(!groundRecovery||groundRecovery.phase==='none')&&speed>1&&Math.floor(walkPhase/Math.PI)!==oldStep){root.updateWorldMatrix(true,true);const leg=legs.find(l=>l.side===(Math.floor(walkPhase/Math.PI)%2?1:-1));onTitanStep(leg.ankle.getWorldPosition(new T.Vector3()));}
    capeForce.lerp(capeTarget,1-Math.exp(-dt*12));wind.set(vx,vy,vz);if(cape.mesh.visible)cape.update(dt,time,wind,groundY,ambientWind,thorax,capeForce);
  }
  orientation.rotation.y=Math.PI;
  return {root,update,get damageStage(){return battleDamage.stage;},
    grappleAnchor(mode='grab'){root.updateWorldMatrix(true,true);return mode==='tackle'?arms.find(a=>a.side===1).shoulder.localToWorld(new T.Vector3(0,.02,.20)):this.grabHand();},
    pinHeld(anchor,mode='grab'){root.updateWorldMatrix(true,true);const contact=mode==='tackle'?thorax.localToWorld(new T.Vector3(.08,.10,.22)):neck.localToWorld(new T.Vector3(0,-.04,.10));root.position.add(anchor.clone().sub(contact));root.updateWorldMatrix(true,true);},
    grabHand(){root.updateWorldMatrix(true,true);return arms.find(a=>a.side===1).elbow.localToWorld(new T.Vector3(0,-.36,.01));},setAppearance:appearance.setAppearance,get character(){return appearance.style;},eyePositions(){root.updateMatrixWorld(true);return [-1,1].map(side=>head.localToWorld(new T.Vector3(side*.084,.066,.235)));},impact:hit=>ragdoll.trigger(hit),get collisionFeedback(){return ragdoll.feedback;},resetCollision(){ragdoll.reset();groundPoseBlend=0;},meshes:all,cape,orientation};
}
