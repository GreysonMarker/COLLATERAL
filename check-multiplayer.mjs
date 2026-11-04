import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {rooms} from './worker/rooms.js';
import {createCombat,createDefense} from './dist/combat-rules.js';
import * as T from './dist/vendor/three.module.js';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('drizzle/0000_multiplayer.sql','utf8'));sqlite.exec(fs.readFileSync('drizzle/0001_peer_signaling.sql','utf8'));
const DB={prepare(sql){return {bind(...args){const query=sqlite.prepare(sql);return {async run(){return /^SELECT/i.test(sql)?{results:query.all(...args)}:{meta:{changes:query.run(...args).changes}};},async first(){return query.get(...args)||null;},async all(){return {results:query.all(...args)};}};}};},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
let now=Date.now();Date.now=()=>now+=150;
async function api(action,body,expected=200){const r=await rooms(new Request('https://test.local/api/rooms/'+action,{method:'POST',headers:{Origin:'https://test.local'},body:JSON.stringify(body)}),{DB});const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));return data;}
const a=await api('create',{name:'Host'}),b=await api('join',{code:a.code,name:'Guest'});assert.notEqual(a.id,b.id);
const state={p:[0,1,171],v:[0,0,0],character:'original',active:true,pose:{flying:false},defense:{phase:'idle'}};
const event={id:'one',type:'terrain',x:0,z:171,radius:2,depth:.4,guard:null};
await api('sync',{...a,state,cursor:0,events:[event]});
let result=await api('sync',{...b,state:{...state,p:[10,1,171]},cursor:0,events:[]});assert.equal(result.players[0].name,'Host');assert.equal(result.events.length,1);assert.equal(JSON.parse(result.events[0].payload).type,'terrain');
await api('sync',{...a,state,cursor:0,events:[event]});result=await api('sync',{...b,state,cursor:0,events:[]});assert.equal(result.events.length,1,'retried events must not duplicate');
const c=await api('join',{code:a.code,name:'Late'});result=await api('sync',{...c,state,cursor:0,events:[]});assert.equal(result.events.length,1,'late joins receive world history');
const d=await api('join',{code:a.code,name:'Fourth'});await api('join',{code:a.code},409);
await api('sync',{...a,token:'wrong',state,cursor:0,events:[]},401);
await api('sync',{...a,state,cursor:0,events:[{...event,id:'bad',radius:999999}]},400);
const other=await api('create',{name:'Other'});result=await api('sync',{...other,state,cursor:0,events:[]});assert.equal(result.players.length,0);assert.equal(result.events.length,0);
const hit={id:'hit',type:'combat',target:b.id,attack:{kind:'normal',punch:true,attacker:a.id,direction:[0,0,1]}};
await api('sync',{...a,state,cursor:0,events:[hit]});result=await api('sync',{...b,state,cursor:1,events:[]});assert.equal(JSON.parse(result.events[0].payload).target,b.id);
await api('leave',d);await api('join',{code:a.code,name:'Replacement'});
// Two isolated combat clients: defender decides the parry and returns it once.
const left=createCombat(),right=createCombat(),leftDefense=createDefense(),rightDefense=createDefense();let leftHit=0,rightHit=0;
left.register({id:'player',position:()=>new T.Vector3(),defense:leftDefense,onHit(){leftHit++;}});right.register({id:'player',position:()=>new T.Vector3(0,0,2),defense:rightDefense,onHit(){rightHit++;}});
left.register({id:'other',position:()=>new T.Vector3(0,0,2),forwardHit:attack=>right.hit('player',{...attack,attacker:'other'})});right.register({id:'other',position:()=>new T.Vector3(),forwardHit:attack=>left.hit('player',{...attack,attacker:'other'})});
rightDefense.parry();left.punch(new T.Vector3(),new T.Vector3(0,0,1),'normal',{width:3,reach:5},'player','p1');assert.equal(leftHit,1);assert.equal(rightHit,0);
left.punch(new T.Vector3(),new T.Vector3(0,0,1),'normal',{width:3,reach:5},'player','p1');assert.equal(leftHit,1,'same attack cannot be forwarded twice');
console.log('Multiplayer: four-player capacity, sessions, room isolation, snapshots, late-join damage replay, event retry deduplication, malformed edits, leave/rejoin, and cross-client parry passed.');

const pose=await api('pose',{...a,state:{...state,p:[30,1,171],netVersion:'test',netSeq:5}});assert(pose.players.some(p=>p.id===b.id));
let guestPose=await api('pose',{...b,state});assert.deepEqual(JSON.parse(guestPose.players.find(p=>p.id===a.id).state).p,[30,1,171]);
// A slow world-history request must never overwrite a newer motion snapshot.
await api('sync',{...a,control:true,state:{...state,p:[-99,0,0]},cursor:0,events:[]});guestPose=await api('pose',{...b,state});assert.equal(JSON.parse(guestPose.players.find(p=>p.id===a.id).state).p[0],30);
await api('pose',{...a,token:'wrong',state},401);
await api('signal',{...a,target:b.id,signal:{kind:'offer',generation:'g1',description:{type:'offer',sdp:'v=0'}}});
const signals=await api('sync',{...b,control:true,state,signalCursor:0,cursor:0,events:[]});assert.equal(signals.signals.length,1);assert.equal(signals.signals[0].sender,a.id);
const isolatedSignals=await api('sync',{...other,control:true,state,signalCursor:0,cursor:0,events:[]});assert.equal(isolatedSignals.signals.length,0);
await api('signal',{...a,target:other.id,signal:{kind:'offer',generation:'bad',description:{type:'offer',sdp:'v=0'}}},404);
console.log('Independent pose relay, stale-control-write prevention, authentication and room-scoped WebRTC signaling passed.');

const [clashOwner,clashOther]=[a,b].sort((a,b)=>a.id.localeCompare(b.id));
const clash={id:'clash-event',type:'clash',clashId:'test-clash',heroes:[clashOwner.id,clashOther.id],p:[0,40,0],at:Date.now()};
await api('sync',{...clashOwner,state,cursor:0,events:[clash]});
await api('sync',{...clashOwner,state,cursor:0,events:[clash]});
const clashResult=await api('sync',{...clashOther,state,cursor:0,events:[]});
assert.equal(clashResult.events.filter(e=>JSON.parse(e.payload).type==='clash').length,1);
await api('sync',{...clashOther,state,cursor:0,events:[{...clash,id:'wrong-owner'}]},400);
await api('sync',{...clashOwner,state,cursor:0,events:[{...clash,id:'bad-point',p:[NaN,0,0]}]},400);
await api('sync',{...clashOwner,state,cursor:0,events:[{...clash,id:'expired',at:0}]},400);
console.log('Clash event replication, duplicate retries, owner validation, coordinates and expiry passed.');
await api('sync',{...a,state,cursor:0,events:[{id:'grab-lease',type:'grab',target:b.id,action:'request',token:'lease',expires:Date.now()+7000}]});
console.log('Millisecond grab leases pass the same timestamp validator.');
await api('sync',{...a,state,cursor:0,events:[{id:'momentum-throw',type:'grab',target:b.id,action:'release',token:'lease',expires:Date.now()+7000,velocity:[0,20,277.5]}]});
await api('sync',{...a,state,cursor:0,events:[{id:'invalid-throw',type:'grab',target:b.id,action:'release',token:'lease',expires:Date.now()+7000,velocity:[0,0,601]}]},400);
console.log('Momentum-enhanced throws accepted; invalid launch speed rejected.');

const titanState={...state,character:'monolith',titanReaction:{zone:'front-head-0',direction:2,kind:'serious',special:true,duration:2.8,distance:14,age:.3,worldDirection:[0,0,1]}};
for(const character of ['monolith','pale-king','ghostshot'])await api('sync',{...a,state:{...titanState,character},cursor:0,events:[]});
await api('pose',{...a,state:titanState});const receivedTitan=await api('pose',{...b,state});assert.deepEqual(JSON.parse(receivedTitan.players.find(p=>p.id===a.id).state).titanReaction,titanState.titanReaction);
console.log('All three new characters accepted by the room service; titan reaction snapshot roundtrip passed.');
