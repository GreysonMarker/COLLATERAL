export function validSnapshot(s){return !!s&&(s.health===undefined||(Number.isFinite(s.health)&&s.health>=0&&s.health<=1000))&&['p','v'].every(k=>Array.isArray(s[k])&&s[k].length===3&&s[k].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))&&!!s.pose&&typeof s.pose==='object'&&['yaw','pitch'].every(k=>s.pose[k]===undefined||Number.isFinite(s.pose[k]))&&typeof s.character==='string';}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Timestamped motion history, with a small adaptive jitter buffer. Action state
// always comes from the latest packet, rather than waiting in the motion buffer.
export function createMotionBuffer(){
 const samples=[],retiredVersions=new Set();let version=null,sequence=-1,interval=100,jitter=0,last=null,lastSent=null,offset=null,sourceType=null;
 function delay(){return sourceType==='direct'?clamp(interval*.45+jitter*1.5,20,55):clamp(interval*.35,60,160);}
 return {push(state,now,source='server'){
  if(!validSnapshot(state))return false;
  if(state.netVersion&&state.netVersion!==version){if(retiredVersions.has(state.netVersion))return false;if(version)retiredVersions.add(version);samples.length=0;version=state.netVersion;sequence=-1;last=null;offset=null;lastSent=null;}
  if(Number.isFinite(state.netSeq)&&state.netSeq<=sequence)return false;
  if(Number.isFinite(state.netSeq))sequence=state.netSeq;
  if(source!==sourceType){samples.length=0;last=null;offset=null;lastSent=null;interval=source==='direct'?1000/30:125;jitter=0;sourceType=source;}
  const sent=source==='direct'&&Number.isFinite(state.netTime)?state.netTime:null;
  if(last!==null){const gap=clamp(now-last,1,1000),expected=sent!==null&&lastSent!==null?clamp(sent-lastSent,1,1000):interval;jitter=jitter*.9+Math.abs(gap-expected)*.1;interval=interval*.9+(sent===null?gap:expected)*.1;}
  let time=now;
  if(sent!==null){const observed=now-sent;offset=offset===null?observed:Math.min(offset+.02,observed);time=sent+offset;}
  last=now;lastSent=sent;
  // A reset or a large discontinuity must not interpolate through the city.
  const previous=samples.at(-1);if(previous){const dt=clamp((time-previous.time)/1000,0,.6),error=Math.hypot(...state.p.map((v,i)=>v-previous.state.p[i]-previous.state.v[i]*dt));if(error>Math.max(15,Math.hypot(...state.v)*.2))samples.length=0;}
  samples.push({state,time,arrival:now,source});if(samples.length>24)samples.shift();return true;
 },sample(now){
  if(!samples.length)return null;const newest=samples.at(-1),at=now-delay();
  let a=samples[0],b=null;for(let i=1;i<samples.length;i++){if(samples[i].time>=at){b=samples[i];break;}a=samples[i];}
  if(b){const f=clamp((at-a.time)/Math.max(1,b.time-a.time),0,1),p=a.state.p.map((x,i)=>x+(b.state.p[i]-x)*f),pose={...newest.state.pose};for(const k of ['yaw','pitch','bank']){const x=a.state.pose[k]||0,y=b.state.pose[k]||0;pose[k]=x+Math.atan2(Math.sin(y-x),Math.cos(y-x))*f;}return {...newest.state,p,pose};}
  const age=Math.max(0,(at-a.time)/1000),cap=newest.source==='direct'?.15:.6,t=Math.min(age,cap);return {...newest.state,p:a.state.p.map((x,i)=>x+a.state.v[i]*t)};
 },get age(){return last;},get size(){return samples.length;},get stats(){return {bufferMs:delay(),jitterMs:jitter,source:sourceType};}};
}
