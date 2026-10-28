import * as T from './vendor/three.module.js';
const vector=a=>new T.Vector3().fromArray(a||[0,0,0]);
export function encodeCombatAttack(a,selfId){return {damage:a.damage,kind:a.kind,punch:!!a.punch,attacker:a.attacker==='player'?selfId:a.attacker,direction:a.direction?.toArray()||[0,0,1],velocity:a.velocity?.toArray()||null,momentum:a.momentum?.toArray()||null,reflected:!!a.reflected};}
export function decodeCombatAttack(a,selfId){return {...a,direction:vector(a.direction),velocity:a.velocity?vector(a.velocity):null,momentum:a.momentum?vector(a.momentum):null,attacker:a.attacker===selfId?'player':a.attacker};}
