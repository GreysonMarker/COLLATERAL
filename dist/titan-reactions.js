import * as T from './vendor/three.module.js';
// Anatomical coordinates in the unscaled rig. Every visible surface belongs to
// the nearest region; the anchors are partitions, not tiny target dots.
export const TITAN_ZONES=[];
function zone(face,name,type,x,y,z,sx,sy,sz,side=0){TITAN_ZONES.push({id:face+'-'+name,face,type,side,center:[x,y,z],size:[sx,sy,sz]});}
for(const face of ['front','back']){
 const z=face==='front'?1:-1;
 for(const s of [-1,0,1])zone(face,'head-'+s,'head',s*.15,2.17,z*.19,.085,.24,.18,s);
 for(const s of [-1,1]){
  zone(face,'collar-'+s,'collar',s*.24,1.93,z*.27,.16,.08,.16,s);
  zone(face,'shoulder-'+s,'shoulder',s*.48,1.78,z*.10,.18,.17,.20,s);
  zone(face,'upper-arm-'+s,'arm',s*.43,1.51,z*.10,.16,.14,.19,s);
  zone(face,'forearm-hand-'+s,'forearm',s*.44,1.14,z*.12,.18,.24,.20,s);
  zone(face,face==='front'?'chest-'+s:'scapula-'+s,'chest',s*.21,1.73,z*.23,.16,.16,.19,s);
  zone(face,face==='front'?'ribs-'+s:'lower-back-'+s,'ribs',s*.22,1.45,z*.21,.13,.13,.18,s);
  if(face==='front')zone(face,'abdomen-'+s,'abdomen',s*.15,1.29,.24,.11,.09,.17,s);
  zone(face,'waist-'+s,'waist',s*.23,1.12,z*.22,.13,.08,.18,s);
  zone(face,'thigh-'+s,'thigh',s*.21,.85,z*.16,.15,.19,.19,s);
  zone(face,'knee-'+s,'knee',s*.20,.56,z*.14,.15,.10,.18,s);
  zone(face,'shin-foot-'+s,'shin',s*.20,.25,z*.13,.15,.22,.22,s);
 }
 zone(face,face==='front'?'mid-chest':'spine','core',0,face==='front'?1.61:1.52,z*.30,.08,face==='front'?.20:.31,.16);
 zone(face,'waist-center','waist',0,1.12,z*.27,.10,.09,.16);
 if(face==='front')zone(face,'pelvis','pelvis',0,.86,.32,.11,.19,.17);
}
export const TITAN_DIRECTIONS=['left','left-diagonal','straight','right-diagonal','right'];
// Local push vectors: hits arrive from the named side of the selected surface.
export function titanDirection(localDirection,face){
 const a=Math.atan2(-localDirection.x,Math.abs(localDirection.z));
 return Math.max(0,Math.min(4,Math.round(a/(Math.PI/4))+2));
}
export function titanResponse(attack,hit){
 const zone=TITAN_ZONES.find(z=>z.id===hit?.zone)||TITAN_ZONES.find(z=>z.id==='front-mid-chest');
 const kind=attack.kind,serious=kind==='serious',direct=!!hit?.direct;
 const special=serious&&direct&&((zone.type==='head'&&hit.distance<=15)||(zone.type==='core'&&hit.distance<=10));
 return {zone:zone.id,direction:hit?.direction??2,kind,special,duration:special?2.8:serious?1.35:kind==='quick'?.48:.72,
  distance:special?(zone.type==='head'?14:10):0,worldDirection:attack.direction?.toArray()||[0,0,-1]};
}
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
function pulse(t,delay,peak,end){if(t<delay||t>=end)return 0;return t<peak?smooth((t-delay)/(peak-delay)):1-smooth((t-peak)/(end-peak));}
// Each region selects an anatomical choreography; five direction keys change
// twist, bend, counterbalancing arm and which leg takes the load.
export function sampleTitanReaction(state,age){
 const z=TITAN_ZONES.find(z=>z.id===state.zone);if(!z)return null;
 const t=age/state.duration,a=(state.direction-2)*Math.PI/4,side=z.side||(-Math.sign(Math.sin(a))||1);
 const x=-Math.sin(a),push=(z.face==='front'?-1:1)*Math.cos(a),strength=state.special?1.3:state.kind==='serious'?1:state.kind==='normal'?.27:.13;
 const contact=pulse(t,0,.12,.72)*strength,body=pulse(t,.045,.25,1)*strength,settle=pulse(t,.32,.58,1)*strength;
 const p={rig:[0,0,0],waist:[0,0,0],chest:[0,0,0],neck:[0,0,0],arms:{},legs:{},drop:0,lift:0};
 const limb=(map,s)=>map[s]??=[0,0,0];
 p.waist=[push*.07*body,z.side*.025*body,-x*.07*body];
 p.chest=[push*.06*body,-x*.06*body,-x*.04*body];
 p.neck=[-push*.055*settle,x*.06*settle,0];
 if(z.type==='head'){
  p.neck=[push*.34*contact,(-x*.47+z.side*push*.12)*contact,-x*.18*contact];
  p.chest=[push*.14*body,(-x*.16+z.side*push*.05)*body,-x*.09*body];
 }else if(['core','chest','collar','ribs','abdomen'].includes(z.type)){
  const low=['ribs','abdomen'].includes(z.type),bend=low?.36:z.type==='core'?.30:.21;
  p.waist=[-push*bend*body,(-x*.13+z.side*push*.13)*body,-x*.20*body];
  p.chest=[push*(low?.07:.20)*contact,(-x*.16+z.side*push*.10)*contact,-x*.14*contact];
  p.neck=[-push*.17*body,x*.18*body,z.side*.06*body];p.drop=.035*body;
 }else if(['shoulder','arm','forearm'].includes(z.type)){
  const k=z.type==='forearm'?1:z.type==='arm'?.7:.45;
  p.arms[side]=[push*.43*contact,-x*.22*contact,side*.30*contact];
  p.arms['elbow'+side]=[-k*.62*contact,z.side*push*.13*contact,0];
  p.chest=[push*.10*body,side*push*.22*body,-x*.11*body];
 }else if(z.type==='waist'||z.type==='pelvis'){
  const lateral=z.side!==0;
  p.waist=[-push*(lateral?.22:.32)*contact,side*push*(lateral?.20:.04)*body,-x*.19*body];
  p.chest=[push*.15*body,-side*push*.08*settle,x*.07*settle];
  p.legs[side]=[-push*.20*body,side*.07*body,-z.side*.06*body];
  p.legs['knee'+side]=[.26*body,0,0];p.drop=.065*body;
 }else{
  const low=z.type==='shin'||z.type==='knee';
  p.legs[side]=[push*(low?.15:.28)*contact,0,-x*.16*contact];
  p.legs['knee'+side]=[(low?.42:.22)*contact,0,0];
  p.legs[-side]=[-push*.12*body,0,-side*.08*body];
  p.waist=[-push*.16*body,side*.10*contact,-side*.12*body];p.drop=.045*body;
 }
 // Delayed counterweight and a small balancing step, never an uncontrolled fall.
 for(const s of [-1,1]){
  const arm=limb(p.arms,s);arm[0]+=-push*.10*body;arm[2]+=s*.10*body;
  const leg=limb(p.legs,s);leg[0]+=push*s*side*.10*settle;
  limb(p.legs,'knee'+s)[0]+=.10*settle;
 }
 if(state.special){p.lift=.9*pulse(t,0,.13,.34);p.rig=[push*.30*body,0,-x*.18*body];p.drop+=.10*settle;for(const s of [-1,1]){limb(p.legs,'knee'+s)[0]+=.35*settle;limb(p.arms,s)[0]-=.32*body;}}
 return p;
}
export function createTitanReactions(){
 let state=null,age=0,lastPose=null,transition=null;const motion=new T.Vector3();
 return {get active(){return !!state;},get locked(){return !!state?.special;},get state(){return state?{...state,age}:null;},
 trigger(next){if(state?.special)return false;if(state&&age<.24&&next.kind==='heat')return false;if(state&&age<.16&&state.kind==='serious'&&next.kind!=='serious')return false;transition=lastPose;state={...next};age=0;return true;},
 sync(next){transition=null;state=next?{...next}:null;age=next?.age||0;motion.set(0,0,0);},
 update(dt){if(!state)return null;const prev=age;age=Math.min(state.duration,age+dt);
  if(state.special){const d=new T.Vector3().fromArray(state.worldDirection).setY(0);if(d.lengthSq()<.001)d.set(0,0,state.zone.startsWith('front')?-1:1);d.normalize();motion.addScaledVector(d,state.distance*(smooth(age/.75)-smooth(prev/.75)));}
  let pose=sampleTitanReaction(state,age);
  if(transition&&age<.12&&pose){const w=smooth(age/.12),mix=(a,b)=>b.map((v,i)=>(a?.[i]||0)*(1-w)+v*w);
   for(const key of ['rig','waist','chest','neck'])pose[key]=mix(transition[key],pose[key]);
   for(const key of ['arms','legs'])for(const joint of new Set([...Object.keys(transition[key]),...Object.keys(pose[key])]))pose[key][joint]=mix(transition[key][joint],pose[key][joint]||[0,0,0]);
   pose.drop=transition.drop*(1-w)+pose.drop*w;
  }else transition=null;
  lastPose=pose;if(age>=state.duration){state=null;lastPose=null;}return pose;
 },consumeMotion(){const delta=motion.clone();motion.set(0,0,0);return delta;},reset(){state=null;lastPose=transition=null;age=0;motion.set(0,0,0);}};
}
