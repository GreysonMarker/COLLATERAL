import {createBackgroundMusic} from './music.js';
import {createImpactBank} from './impact-audio.js';
// Original procedural effects: no downloads, sampled media, or per-frame audio nodes.
export const AUDIO_ACTIONS={parry:'Parry / block',step:'Footsteps',landing:'Landings',quick:'Quick punch',normal:'Normal punch',serious:'Serious punch',clash:'Hero collision shockwave',charge:'Punch charging',boost:'Fast-flight boom',heat:'Heat vision',debris:'Debris impacts',collapse:'Building collapse',wind:'Flight wind',traffic:'City ambience'};
export function createGameAudio({contextFactory=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),storage}={}){
 let context,master,mix,noiseBuffer,impactBank,volume=.6,muted=false,hidden=false,loops,charge=false,heatWas=false,stepClock=0,lastAirSpeed=0,wasGrounded=true;
 const actionVolumes=Object.fromEntries(Object.keys(AUDIO_ACTIONS).map(key=>[key,1])),buses={};
 const voices=new Set(),lastEvent=new Map(),listener={x:0,y:0,z:0,yaw:0};
 try{storage??=globalThis.localStorage;const saved=JSON.parse(storage?.getItem('meridian-audio')||'null');if(saved){volume=Math.max(0,Math.min(1,Number(saved.volume)||0));muted=!!saved.muted;for(const key of Object.keys(actionVolumes)){const v=saved.actions?.[key];if(typeof v==='number'&&Number.isFinite(v))actionVolumes[key]=Math.max(0,Math.min(1,v));}}}catch{}
 const music=createBackgroundMusic({storage});
 const save=()=>{try{storage?.setItem('meridian-audio',JSON.stringify({volume,muted,actions:actionVolumes}));}catch{}};
 function level(){music.setMuted(muted||hidden);if(context)master.gain.setTargetAtTime(muted||hidden?0:volume*.65,context.currentTime,.025);}
 function loop(noise,type,frequency,action){const source=noise?context.createBufferSource():context.createOscillator(),filter=context.createBiquadFilter(),gain=context.createGain();if(noise){source.buffer=noiseBuffer;source.loop=true;}else{source.type=type;source.frequency.value=frequency;}filter.type=noise?type:'lowpass';filter.frequency.value=noise?frequency:1800;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(buses[action]);source.start();return {source,filter,gain};}
 async function unlock(){
  try{if(!context){context=contextFactory();master=context.createGain();const limiter=context.createDynamicsCompressor();limiter.threshold.value=-16;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.18;mix=context.createGain();mix.connect(limiter);limiter.connect(master);master.connect(context.destination);master.gain.value=0;for(const key of Object.keys(actionVolumes)){const bus=context.createGain();bus.gain.value=actionVolumes[key];bus.connect(mix);buses[key]=bus;}
   noiseBuffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const data=noiseBuffer.getChannelData(0);let seed=4271;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
   impactBank=createImpactBank(context);
   loops={wind:loop(true,'lowpass',900,'wind'),traffic:loop(true,'lowpass',230,'traffic'),heat:loop(true,'bandpass',620,'heat'),sizzle:loop(true,'bandpass',2600,'heat'),charge:loop(true,'lowpass',220,'charge')};
  }if(!hidden){music.setMuted(muted||hidden);if(context.state!=='running')await context.resume();level();}}catch{context?.close?.().catch(()=>{});context=null;loops=null;/* Sound failure never prevents gameplay. */}
 }
 function spatial(point){if(!point)return {gain:1,pan:0};const x=point.x-listener.x,y=point.y-listener.y,z=point.z-listener.z,d=Math.hypot(x,y,z);return {gain:d>220?0:1/(1+(d/38)**2),pan:Math.max(-.85,Math.min(.85,(x*Math.cos(listener.yaw)-z*Math.sin(listener.yaw))/Math.max(8,d)))};}
 function sound({noise=false,type='sine',frequency=80,end=30,duration=.3,gain=.2,delay=0,filter='lowpass',cutoff=1400,point=null,priority=false,action='heat'}){
  if(!context||context.state!=='running'||muted||hidden||volume===0||voices.size>=(priority?24:18))return;
  const position=spatial(point);if(position.gain<.015)return;const start=context.currentTime+delay,source=noise?context.createBufferSource():context.createOscillator(),envelope=context.createGain(),eq=context.createBiquadFilter();
  if(noise)source.buffer=noiseBuffer;else{source.type=type;source.frequency.setValueAtTime(frequency,start);source.frequency.exponentialRampToValueAtTime(Math.max(10,end),start+duration);}
  eq.type=filter;eq.frequency.value=cutoff;eq.Q.value=.6;envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,gain*position.gain),start+.004);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
  source.connect(eq);eq.connect(envelope);const pan=context.createStereoPanner?.();if(pan){pan.pan.value=position.pan;envelope.connect(pan);pan.connect(buses[action]);}else envelope.connect(buses[action]);
  voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();eq.disconnect();envelope.disconnect();pan?.disconnect();};source.start(start);source.stop(start+duration+.015);
 }
 function playImpact(kind,gain=1,point=null,priority=false,action=kind){
  if(!context||context.state!=='running'||muted||hidden||volume===0||voices.size>=(priority?24:18))return;
  const location=spatial(point);if(location.gain<.015)return;
  const source=context.createBufferSource(),envelope=context.createGain(),pan=context.createStereoPanner?.();source.buffer=impactBank[kind][Math.random()<.5?0:1];envelope.gain.value=gain*location.gain;source.connect(envelope);if(pan){pan.pan.value=location.pan;envelope.connect(pan);pan.connect(buses[action]);}else envelope.connect(buses[action]);
  voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();envelope.disconnect();pan?.disconnect();};source.start();
 }
 function punch(kind){playImpact(kind,kind==='quick'?.55:kind==='normal'?.8:1.1,null,true);}
 function clash(point){
  // City-scale attenuation: the pressure boom remains audible across its damage radius.
  const distance=point?Math.hypot(point.x-listener.x,point.y-listener.y,point.z-listener.z):0;
  if(distance>900)return;
  playImpact('clash',1.25/(1+(distance/300)**2),null,true);
 }
 function parry(){
  // Short metal strike: inharmonic resonances over a brief broadband impact.
  for(const [frequency,gain,duration]of [[920,.13,.23],[1477,.085,.19],[2381,.05,.12]])sound({frequency,end:frequency*.995,duration,gain,cutoff:7000,action:'parry',priority:true});
  sound({noise:true,filter:'highpass',cutoff:1900,duration:.045,gain:.08,action:'parry',priority:true});
 }
 function boost(){playImpact('boost',1,null,true);}
 function destruction(point,severe=false){if(!context)return;const key=severe?'collapse':'debris',now=context.currentTime;if(now-(lastEvent.get(key)??-10)<(severe?.5:.14))return;lastEvent.set(key,now);playImpact(key,severe?.8:.4,point);}
 function update(dt,{position,yaw=0,speed=0,flying=false,fast=false,grounded=true,vertical=0,heat=false,heatContact=false,punch=null}={}){
  if(position)Object.assign(listener,{x:position.x,y:position.y,z:position.z,yaw});if(!context||context.state!=='running'||hidden)return;
  const t=context.currentTime,set=(loop,gain)=>loop.gain.gain.setTargetAtTime(gain,t,.07),ratio=Math.min(1,speed/142.5);
  set(loops.wind,flying?.025+ratio*ratio*(fast?.32:.20):.008);loops.wind.filter.frequency.setTargetAtTime(500+ratio*1800,t,.15);
  set(loops.traffic,.025/(1+Math.max(0,listener.y)/25));
  set(loops.heat,heat?.035:0);set(loops.sizzle,heat?(heatContact?.035:.012):0);loops.heat.filter.frequency.setTargetAtTime(620+Math.sin(t*7)*70,t,.1);
  if(heat&&!heatWas)sound({noise:true,filter:'bandpass',duration:.14,gain:.12,cutoff:1800});heatWas=heat;
  charge=punch?.kind==='serious'&&!punch.hit;set(loops.charge,charge?.018+Math.min(1,punch.age/1.1)*.022:0);if(charge)loops.charge.filter.frequency.setTargetAtTime(220+Math.min(1,punch.age/1.1)**2*850,t,.1);
  if(!grounded)lastAirSpeed=Math.abs(vertical);if(grounded&&!wasGrounded&&lastAirSpeed>4){playImpact('normal',Math.min(.55,lastAirSpeed*.012),null,false,'landing');}wasGrounded=grounded;
  if(grounded&&!flying&&speed>.7){stepClock+=dt;if(stepClock>Math.max(.22,.55-speed*.025)){stepClock=0;playImpact('step',.10+Math.min(1,speed/12)*.025);}}else stepClock=0;
 }
 function setHidden(value){if(hidden===value)return;hidden=value;music.setHidden(value);level();if(context){if(hidden)context.suspend().catch(()=>{});else context.resume().then(level).catch(()=>{});}}
 return {unlock,startMusic(){unlock();music.start(context);},stopMusic(){music.stop();},update,punch,clash,parry,boost,destruction,setHidden,getActionVolume(key){return actionVolumes[key];},setActionVolume(key,value){if(!Object.hasOwn(actionVolumes,key))return;actionVolumes[key]=Math.max(0,Math.min(1,Number(value)||0));save();if(context)buses[key]?.gain.setTargetAtTime(actionVolumes[key],context.currentTime,.025);},setMusicVolume(value){music.setVolume(value);},get musicVolume(){return music.volume;},setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));save();level();},setMuted(value){muted=!!value;save();level();},get volume(){return volume;},get muted(){return muted;},get stats(){return {ready:!!context,state:context?.state||'locked',voices:voices.size,muted,volume};}};
}
