import {validSnapshot} from './network-motion.js';
import {packMotion,unpackMotion} from './network-codec.js';
export function createPeerTransport({id,sendSignal,onState,onEvent,PeerConnection=globalThis.RTCPeerConnection,now=()=>performance.now()}){
 const peers=new Map(),early=new Map();let closed=false;
 function safeSignal(target,data){Promise.resolve().then(()=>sendSignal(target,data)).catch(()=>{});}
 function installChannel(record,channel){
  if(channel.label==='motion')record.motion=channel;else if(channel.label==='actions')record.actions=channel;else{channel.close();return;}
  channel.onmessage=event=>{if(typeof event.data!=='string'||event.data.length>10000)return;let data;try{data=JSON.parse(event.data);}catch{return;}
   if(data.k==='ping'&&Number.isFinite(data.t)){send(record.motion,JSON.stringify({k:'pong',t:data.t}),2048);return;}
   if(data.k==='pong'&&Number.isFinite(data.t)&&data.t===record.pingSent){const rtt=now()-data.t;if(rtt>=0&&rtt<5000){record.rtt=record.rtt===null?rtt:record.rtt*.75+rtt*.25;}return;}
   if(data.k==='m'){data={k:'state',s:unpackMotion(data.s)};}
   if(data.k==='state'&&validSnapshot(data.s)){const arrival=now();if(Number.isFinite(record.lastState)){const gap=arrival-record.lastState;if(gap>0)record.interval=record.interval*.9+Math.min(1000,gap)*.1;}record.lastState=arrival;record.received++;record.rxBytes+=event.data.length;onState(record.id,data.s);}
   else if(data.k==='event'&&data.e&&['combat','impact','grab','clash'].includes(data.e.type)&&typeof data.e.id==='string')onEvent(record.id,data.e);
  };
  channel.onerror=()=>{};
 }
 function make(peerId,generation){
  const previous=peers.get(peerId);previous?.pc.close();
  const pc=new PeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.l.google.com:19302'}],iceCandidatePoolSize:1});
  const record={id:peerId,generation,pc,started:now(),lastState:-Infinity,rtt:null,pingSent:null,nextPing:0,received:0,interval:1000/30,rxBytes:0,txBytes:0,skipped:0,candidates:early.get(generation)||[],chain:Promise.resolve()};early.delete(generation);peers.set(peerId,record);
  pc.onicecandidate=event=>{if(event.candidate)safeSignal(peerId,{kind:'candidate',generation,candidate:event.candidate.toJSON()});};
  pc.ondatachannel=event=>installChannel(record,event.channel);pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected')record.started=now();};return record;
 }
 async function offer(peerId){if(closed||!PeerConnection)return;const generation=crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');let r;try{r=make(peerId,generation);installChannel(r,r.pc.createDataChannel('motion',{ordered:false,maxRetransmits:0}));installChannel(r,r.pc.createDataChannel('actions',{ordered:true}));await r.pc.setLocalDescription(await r.pc.createOffer());safeSignal(peerId,{kind:'offer',generation:r.generation,description:r.pc.localDescription.toJSON()});}catch{r?.pc.close();}}
 async function accept(peerId,data){if(closed||!PeerConnection||!data||typeof data.generation!=='string')return;
  let r=peers.get(peerId);
  if(data.kind==='offer'){
   if(id<peerId)return; // Only the lower ID offers; no simultaneous-offer glare.
   if(!r||r.generation!==data.generation){try{r=make(peerId,data.generation);}catch{return;}}
  }else if(!r||r.generation!==data.generation){if(data.kind==='candidate'){if(!early.has(data.generation)&&early.size<8)early.set(data.generation,[]);const q=early.get(data.generation);if(q&&q.length<32)q.push(data.candidate);}return;}
  r.chain=r.chain.then(async()=>{
   if(data.kind==='offer'){await r.pc.setRemoteDescription(data.description);await r.pc.setLocalDescription(await r.pc.createAnswer());safeSignal(peerId,{kind:'answer',generation:r.generation,description:r.pc.localDescription.toJSON()});}
   else if(data.kind==='answer')await r.pc.setRemoteDescription(data.description);
   else if(data.kind==='candidate'){if(!r.pc.remoteDescription){if(r.candidates.length<32)r.candidates.push(data.candidate);return;}await r.pc.addIceCandidate(data.candidate);}
   if(r.pc.remoteDescription){for(const candidate of r.candidates.splice(0))await r.pc.addIceCandidate(candidate);}
  }).catch(()=>{});return r.chain;
 }
 function send(channel,data,limit){if(channel?.readyState!=='open'||channel.bufferedAmount>limit)return false;try{channel.send(data);return true;}catch{return false;}}
 return {discover(ids){if(closed||!PeerConnection)return;for(const peerId of ids){const r=peers.get(peerId);if(id<peerId&&(!r||r.pc.connectionState!=='connected'&&now()-r.started>15000))offer(peerId);}for(const [peerId,r]of peers)if(!ids.includes(peerId)){r.pc.close();peers.delete(peerId);}},accept,
  broadcast(state){if(![...peers.values()].some(r=>r.motion?.readyState==='open'))return;const data=JSON.stringify({k:'m',s:packMotion(state)});for(const r of peers.values()){if(send(r.motion,data,Math.max(1024,data.length*2)))r.txBytes+=data.length;else r.skipped++;if(r.motion?.readyState==='open'&&now()>=r.nextPing){r.pingSent=now();r.nextPing=now()+2000;send(r.motion,JSON.stringify({k:'ping',t:r.pingSent}),2048);}}},
  event(event){const data=JSON.stringify({k:'event',e:event});for(const r of peers.values())if(!event.target||event.target===r.id||event.type==='impact')send(r.actions,data,32768);},
  fresh(peerId){return now()-(peers.get(peerId)?.lastState??-Infinity)<800;},
  get stats(){return [...peers.values()].map(r=>({id:r.id,direct:r.motion?.readyState==='open',rttMs:r.rtt,received:r.received,receiveHz:r.received>1&&now()-r.lastState<500?1000/r.interval:0,rxBytes:r.rxBytes,txBytes:r.txBytes,skipped:r.skipped,bufferedBytes:r.motion?.bufferedAmount||0,ageMs:Math.max(0,now()-r.lastState)}));},
  get connected(){return [...peers.values()].filter(r=>r.motion?.readyState==='open').length;},
  close(){closed=true;for(const r of peers.values())r.pc.close();peers.clear();early.clear();}
 };
}
