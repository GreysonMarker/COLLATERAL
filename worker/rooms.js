const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>alphabet[x%alphabet.length]).join('');
const finiteTree=(v,depth=0)=>depth<9&&(v===null||typeof v==='boolean'||typeof v==='string'&&v.length<200||typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1e8||Array.isArray(v)&&v.length<=40&&v.every(x=>finiteTree(x,depth+1))||v&&typeof v==='object'&&Object.keys(v).length<=35&&Object.entries(v).every(([k,x])=>k.length<40&&!['__proto__','constructor','prototype'].includes(k)&&(['at','expires'].includes(k)&&typeof x==='number'?Number.isFinite(x)&&Math.abs(x)<1e15:finiteTree(x,depth+1))));
export async function rooms(request,env){
 try{
  if(request.method!=='POST')return json({error:'POST required'},405);
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)fail('Invalid origin',403);
  const raw=await request.text();if(raw.length>65000)fail('Request too large',413);
  let b;try{b=JSON.parse(raw);}catch{fail('Invalid JSON');}
  const db=env.DB;if(!db)fail('Multiplayer service is unavailable',503);
  const now=Date.now(),action=new URL(request.url).pathname.split('/').pop();
  if(action==='create'||action==='join'){
   const code=action==='create'?roomCode():String(b.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
   if(code.length!==8)fail('Enter the eight-character room code');
   if(action==='create')await db.prepare('INSERT INTO mp_rooms(code,created) VALUES (?,?)').bind(code,now).run();
   const room=await db.prepare('SELECT * FROM mp_rooms WHERE code=? AND created>?').bind(code,now-86400000).first();if(!room)fail('Room not found or expired',404);
   const id=crypto.randomUUID(),secret=token(),name=String(b.name||'Hero').trim().slice(0,20)||'Hero';
   const result=await db.prepare('INSERT INTO mp_players(id,room,token,name,seen) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM mp_players WHERE room=? AND seen>?)<4').bind(id,code,await hash(secret),name,now,code,now-20000).run();
   if(!result.meta.changes)fail('This room already has four players',409);
   // Remove expired sessions and their world history in bounded, indexed operations.
   if(action==='create')await db.batch([db.prepare('DELETE FROM mp_events WHERE room IN (SELECT code FROM mp_rooms WHERE created<?)').bind(now-86400000),db.prepare('DELETE FROM mp_players WHERE room IN (SELECT code FROM mp_rooms WHERE created<?)').bind(now-86400000),db.prepare('DELETE FROM mp_rooms WHERE created<?').bind(now-86400000)]);
   return json({code,id,token:secret,epoch:room.epoch,name});
  }
  if(typeof b.id!=='string'||typeof b.token!=='string'||b.token.length>100)fail('Session required',401);
  // Motion has its own single database round trip, independent of damage history.
  if(action==='pose'){
   const state=b.state;if(!state||!Array.isArray(state.p)||state.p.length!==3||!Array.isArray(state.v)||state.v.length!==3||!finiteTree(state)||JSON.stringify(state).length>5000||state.p.some(n=>!Number.isFinite(n)||Math.abs(n)>100000)||state.v.some(n=>!Number.isFinite(n)||Math.abs(n)>5000))fail('Invalid player state');
   const digest=await hash(b.token);
   const results=await db.batch([
    db.prepare('UPDATE mp_players SET state=?,seen=? WHERE id=? AND token=? AND room IN (SELECT code FROM mp_rooms WHERE created>?) AND (seen>? OR (SELECT COUNT(*) FROM mp_players active WHERE active.room=mp_players.room AND active.seen>?)<4)').bind(JSON.stringify(state),now,b.id,digest,now-86400000,now-20000,now-20000),
    db.prepare('SELECT peer.id,peer.name,peer.state,peer.seen FROM mp_players peer JOIN mp_players self ON peer.room=self.room JOIN mp_rooms room ON room.code=self.room WHERE self.id=? AND self.token=? AND room.created>? AND peer.id<>self.id AND peer.seen>? ORDER BY peer.id').bind(b.id,digest,now-86400000,now-20000)
   ]);
   if(!results[0].meta.changes)fail('Room session expired or room full. Join again.',401);
   return json({players:results[1].results,now});
  }
  const player=await db.prepare('SELECT p.*,r.epoch FROM mp_players p JOIN mp_rooms r ON r.code=p.room WHERE p.id=? AND p.token=? AND r.created>?').bind(b.id,await hash(b.token),now-86400000).first();if(!player)fail('Room session expired. Join again.',401);
  if(action==='leave'){await db.prepare('DELETE FROM mp_players WHERE id=?').bind(b.id).run();return json({ok:true});}
  if(action==='signal'){
   const signal=b.signal;if(typeof b.target!=='string'||!signal||!['offer','answer','candidate'].includes(signal.kind)||typeof signal.generation!=='string'||signal.generation.length>50||JSON.stringify(signal).length>24000)fail('Invalid connection message');
   if(signal.kind==='candidate'){if(!signal.candidate||typeof signal.candidate.candidate!=='string'||signal.candidate.candidate.length>3000)fail('Invalid candidate');}
   else if(!signal.description||signal.description.type!==signal.kind||typeof signal.description.sdp!=='string'||signal.description.sdp.length>20000)fail('Invalid description');
   const inserted=await db.prepare('INSERT INTO mp_signals(room,sender,target,payload,created) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM mp_players WHERE id=? AND room=?)').bind(player.room,b.id,b.target,JSON.stringify(signal),now,b.target,player.room).run();
   if(!inserted.meta.changes)fail('Peer left the room',404);
   if(signal.kind==='offer')await db.prepare('DELETE FROM mp_signals WHERE created<?').bind(now-120000).run();
   return json({ok:true});
  }
  if(action!=='sync')fail('Unknown action',404);
  if(!b.state||!Array.isArray(b.state.p)||b.state.p.length!==3||b.state.p.some(n=>!Number.isFinite(n)||Math.abs(n)>100000)||!Array.isArray(b.state.v)||b.state.v.length!==3||!finiteTree(b.state)||JSON.stringify(b.state).length>5000)fail('Invalid player state');
  if(!Array.isArray(b.events)||b.events.length>100)fail('Too many events');
  if(b.state.v.some(n=>!Number.isFinite(n)||Math.abs(n)>5000)||!['original','obsidian','gold','violet','lanky','teal'].includes(b.state.character))fail('Invalid hero state');
  if(b.state.pose&&Object.values(b.state.pose).some(v=>!['number','boolean','string'].includes(typeof v)))fail('Invalid pose');
  if(b.state.punch&&(!['quick','normal','serious'].includes(b.state.punch.kind)||!Array.isArray(b.state.punch.direction)))fail('Invalid punch pose');

  const allowed=new Set(['building','heat','shockwave','terrain','combat','impact','grab','clash','reset']);
  if(!b.control&&now-player.seen<55)fail('Please wait before syncing again',429);
  if(now-player.seen>20000){const active=await db.prepare('SELECT COUNT(*) AS n FROM mp_players WHERE room=? AND seen>? AND id<>?').bind(player.room,now-20000,b.id).first();if(active.n>=4)fail('Room filled while you were disconnected. Join another room.',401);}
  const writes=b.control?[]:[db.prepare('UPDATE mp_players SET state=?,seen=? WHERE id=?').bind(JSON.stringify(b.state),now,b.id)];
  for(const e of b.events){if(!e||typeof e.id!=='string'||e.id.length>80||!allowed.has(e.type)||!finiteTree(e)||JSON.stringify(e).length>3500)fail('Invalid room event');if(e.type==='terrain'&&(!(e.radius>0&&e.radius<=30)||!(e.depth>=0&&e.depth<=20)||Math.abs(e.x)>10000||Math.abs(e.z)>10000))fail('Invalid terrain edit');if(e.type==='building'&&(!Number.isInteger(e.b)||e.b<0||e.b>20000||!['punch','hit'].includes(e.method)))fail('Invalid building edit');if(e.type==='heat'&&(!(e.reach>=0&&e.reach<=120)))fail('Invalid beam');if(e.type==='shockwave'&&e.radius!==undefined&&(!(e.radius>0&&e.radius<=40)))fail('Invalid shockwave');if(e.type==='combat'&&(!e.attack||!['quick','normal','serious','heat','grab','flight','projectile','tackle','collision','clash'].includes(e.attack.kind)))fail('Invalid attack');if(e.type==='grab'&&(!['request','accept','reject','cancel','release'].includes(e.action)||typeof e.target!=='string'||typeof e.token!=='string'||e.token.length>80||!Number.isFinite(e.expires)||(e.velocity!==undefined&&e.velocity!==null&&(!Array.isArray(e.velocity)||e.velocity.length!==3||e.velocity.some(v=>!Number.isFinite(v)||Math.abs(v)>600)))))fail('Invalid grab');if(e.type==='clash'&&(!Array.isArray(e.heroes)||e.heroes.length!==2||e.heroes[0]!==b.id||typeof e.heroes[1]!=='string'||e.heroes[0]>=e.heroes[1]||typeof e.clashId!=='string'||e.clashId.length>80||!Number.isFinite(e.at)||Math.abs(e.at-now)>10000||!Array.isArray(e.p)||e.p.length!==3||e.p.some(n=>!Number.isFinite(n)||Math.abs(n)>10000)))fail('Invalid clash');writes.push(db.prepare('INSERT OR IGNORE INTO mp_events(room,sender,event_id,payload) VALUES (?,?,?,?)').bind(player.room,b.id,b.id+':'+e.id,JSON.stringify(e)));}
  if(writes.length)await db.batch(writes);
  const cursor=Number.isSafeInteger(b.cursor)&&b.cursor>=0?b.cursor:0;
  const [peers,events,signals]=await Promise.all([db.prepare('SELECT id,name,state,seen FROM mp_players WHERE room=? AND seen>? AND id<>? ORDER BY id').bind(player.room,now-20000,b.id).all(),db.prepare('SELECT seq,sender,payload FROM mp_events WHERE room=? AND seq>? ORDER BY seq LIMIT 256').bind(player.room,cursor).all(),db.prepare('SELECT seq,sender,payload FROM mp_signals WHERE target=? AND seq>? AND created>? ORDER BY seq LIMIT 128').bind(b.id,Number.isSafeInteger(b.signalCursor)?b.signalCursor:0,now-120000).all()]);
  return json({players:peers.results,events:events.results,more:events.results.length===256,epoch:player.epoch,signals:signals.results,now});
 }catch(e){return json({error:e.status?e.message:'Multiplayer connection failed. Please retry.'},e.status||500);}
}
