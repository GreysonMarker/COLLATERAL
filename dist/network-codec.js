import {validSnapshot} from './network-motion.js';
const round=(x,p=1000)=>Math.round((x||0)*p)/p;
const vec=(v,p=1000)=>v?.map(x=>round(x,p));
// Self-contained packets: losing a packet never breaks a later delta chain.
export function packMotion(s){const p=s.pose,d=s.defense,g=s.grab,a=s.punch;
 return [1,s.netVersion,s.netSeq,s.netTime,vec(s.p),vec(s.v,100),s.character,s.active?1:0,
  [p.flying?1:0,p.levitating?1:0,p.moving?1:0,p.boost?1:0,p.grounded?1:0,round(p.yaw,10000),round(p.pitch,10000),round(p.bank,10000),p.groundMode,p.controlledFlight?1:0],
  d?[d.phase,round(d.age),d.blocking?1:0,round(d.stun)]:null,
  a?[a.kind,a.variant,round(a.age),vec(a.direction,10000)]:null,
  vec(s.heat,10000)||null,g?[g.phase,round(g.age),vec(g.direction,10000),g.car?1:0,g.flightCarry?1:0,g.tackle?1:0]:null,s.held?[s.held.mode,vec(s.held.direction,10000),s.held.moving?1:0,round(s.held.age),s.held.by||null]:null,s.health??1000];
}
export function unpackMotion(a){if(!Array.isArray(a)||a[0]!==1||!Array.isArray(a[8]))return null;const p=a[8],d=a[9],attack=a[10],g=a[12],h=a[13];
 const s={health:Number.isFinite(a[14])?Math.max(0,Math.min(1000,a[14])):1000,netVersion:a[1],netSeq:a[2],netTime:a[3],p:a[4],v:a[5],character:a[6],active:!!a[7],pose:{flying:!!p[0],levitating:!!p[1],moving:!!p[2],boost:!!p[3],grounded:!!p[4],yaw:p[5],pitch:p[6],bank:p[7],groundMode:p[8],controlledFlight:p[9]===1},defense:d?{phase:d[0],age:d[1],blocking:!!d[2],stun:d[3]}:null,punch:attack?{kind:attack[0],variant:attack[1],age:attack[2],direction:attack[3]}:null,heat:a[11],grab:g?{phase:g[0],age:g[1],direction:g[2],car:!!g[3],flightCarry:!!g[4],tackle:!!g[5]}:null,held:h?{mode:h[0],direction:h[1],moving:!!h[2],age:h[3],...(h[4]?{by:h[4]}:{})}:null};return validSnapshot(s)?s:null;
}
