import {encodeCombatAttack,decodeCombatAttack} from './combat-packet.js';
import {createPeerTransport} from './peer-transport.js';
import {createMotionBuffer,validSnapshot} from './network-motion.js';
import * as T from './vendor/three.module.js';
import {createHero} from './hero.js';
import {createDefenseFX} from './defense-fx.js';
const storageKey='meridian-room-v1',vector=a=>new T.Vector3().fromArray(a||[0,0,0]);
export function createMultiplayer({scene,mat,combat,buildings,destruction,groundDamage,groundHeight,camera,collisionWorld=null,getState,onPause,onGrab=()=>{},onClash=()=>{}}){
 let session=null,cursor=0,busy=false,timer=null,stopped=false,received=[],outbox=[],applying=false,backlog=false,online=false,latency=0,resetting=false;
 let poseTimer=null,signalCursor=0,netSeq=0,lastBroadcast=-Infinity,nextBroadcast=0,lastActionKey='',syncBusy=false;const netVersion=crypto.randomUUID();
 const peers=new Map(),ids=new Map(buildings.map((b,i)=>[b,i]));
 try{session=JSON.parse(sessionStorage.getItem(storageKey));}catch{}
 const panel=document.createElement('section');panel.id='multiplayer-panel';panel.hidden=true;panel.innerHTML=`<h2>Play with friends</h2><p>Up to four heroes in one city.</p><label>Your name<input id="mp-name" maxlength="20" placeholder="Hero" autocomplete="off"></label><div class="mp-actions"><button id="mp-create">CREATE ROOM</button><input id="mp-code" maxlength="8" placeholder="ROOM CODE" autocomplete="off" aria-label="Room code"><button id="mp-join">JOIN ROOM</button></div><p id="mp-status" role="status">Solo city</p><div class="mp-actions"><button id="mp-copy" hidden>Copy invite link</button><button id="mp-leave" hidden>Leave room</button><button id="mp-close">Back</button></div><p class="mp-note">Shared heroes, combat, buildings and ground damage. Traffic and pedestrians run locally. Rooms expire after 24 hours.</p>`;document.body.append(panel);
 const $=id=>panel.querySelector('#'+id),button=document.createElement('button');button.textContent='Multiplayer';button.onclick=()=>{onPause();panel.hidden=false;};document.querySelector('#pause-options').append(button);
 const menuButton=document.createElement('button');menuButton.id='menu-multiplayer';menuButton.textContent='PLAY WITH FRIENDS';menuButton.onclick=button.onclick;document.querySelector('.menu-bottom').append(menuButton);
 for(const event of ['pointerdown','pointerup','pointermove','keydown','keyup'])panel.addEventListener(event,e=>e.stopPropagation());
 // The character menu captures keyboard events; this panel owns text input while open.
 window.addEventListener('keydown',e=>{if(!panel.hidden&&panel.contains(e.target))e.stopPropagation();},true);
 try{$('mp-name').value=localStorage.getItem('meridian-player-name')||'';}catch{}
 $('mp-code').value=new URL(location.href).searchParams.get('room')||session?.code||'';
 function status(message){$('mp-status').textContent=message;button.textContent=session?'Room '+session.code:'Multiplayer';$('mp-copy').hidden=$('mp-leave').hidden=!session;}
 async function api(action,body){const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);try{const r=await fetch('/api/rooms/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:abort.signal});let data;try{data=await r.json();}catch{throw Error('Multiplayer server unavailable. Please retry.');}if(!r.ok)throw Object.assign(Error(data.error||'Connection failed'),{status:r.status});return data;}finally{clearTimeout(timeout);}}
 async function join(action){if(busy)return;busy=true;$('mp-create').disabled=$('mp-join').disabled=true;status('Connecting…');try{const name=$('mp-name').value||'Hero',next=await api(action,{name,code:$('mp-code').value});if(session)await api('leave',session).catch(()=>{});sessionStorage.setItem(storageKey,JSON.stringify(next));localStorage.setItem('meridian-player-name',name);location.reload();}catch(e){status(e.message);busy=false;$('mp-create').disabled=$('mp-join').disabled=false;}}
 $('mp-create').onclick=()=>join('create');$('mp-join').onclick=()=>join('join');$('mp-close').onclick=()=>panel.hidden=true;
 $('mp-copy').onclick=async()=>{const u=new URL(location.href);u.searchParams.set('room',session.code);try{await navigator.clipboard.writeText(u.href);status('Invite link copied · '+session.code);}catch{status('Share this room code: '+session.code);}};
 $('mp-leave').onclick=async()=>{stopped=true;clearTimeout(timer);clearTimeout(poseTimer);transport?.close();if(session)await api('leave',session).catch(()=>{});sessionStorage.removeItem(storageKey);const u=new URL(location.href);u.searchParams.delete('room');location.href=u.href;};
 const emit=(type,data)=>{if(!session||applying||stopped||resetting)return;const event={type,...data,id:crypto.randomUUID()};outbox.push(event);if(['combat','grab','impact','clash'].includes(type))setTimeout(()=>{if(!stopped&&!syncBusy){clearTimeout(timer);sync();}},0);if(type==='combat'||type==='impact'||type==='grab'||type==='clash')transport?.event(event);};
 const encodeAttack=a=>encodeCombatAttack(a,session.id);
 function addPeer(row,state){const hero=createHero(mat);hero.setAppearance(state.character);scene.add(hero.root);const fx=createDefenseFX(scene,hero),p={hero,fx,state,position:vector(state.p),received:performance.now(),name:row.name,motion:createMotionBuffer(),serverSeen:0};hero.root.position.copy(p.position);p.motion.push(state,performance.now());
 const label=document.createElement('span');label.className='mp-player-label';label.textContent=row.name;document.body.append(label);p.label=label;
 const beamGeo=new T.CylinderGeometry(.045,.045,1,6),beamMat=new T.MeshBasicMaterial({color:'#fff0c4',toneMapped:false});p.beams=[0,1].map(()=>{const mesh=new T.Mesh(beamGeo,beamMat);scene.add(mesh);return mesh;});p.beamGeo=beamGeo;p.beamMat=beamMat;
 p.unregister=combat.register({id:row.id,type:'hero',character:()=>hero.character.id,health:{get value(){return p.state.health??1000;},get dead(){return p.state.health===0;}},active:()=>!!p.state.active&&p.state.health!==0,position:()=>p.position,height:()=>2.2*hero.character.height,radius:()=>.6*hero.character.height,defense:{get parrying(){return p.state.defense?.phase==='parry';}},forwardHit:attack=>{if(p.state.active)emit('combat',{target:row.id,attack:encodeAttack(attack)});}});peers.set(row.id,p);return p;}
 function removePeer(id){const p=peers.get(id);if(!p)return;p.unregister();p.label.remove();p.fx.dispose();p.hero.root.removeFromParent();const geometries=new Set(),materials=new Set();p.hero.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const beam of p.beams)beam.removeFromParent();p.beamGeo.dispose();p.beamMat.dispose();peers.delete(id);}
 const handledEvents=new Map();
 function receiveEvent(data,sender,seq=0){
  if(!data||typeof data.id!=='string'||handledEvents.has(data.id))return;
  handledEvents.set(data.id,performance.now());
  // Combat cannot sit behind a backlog of building rebuilds.
  if(data.type==='combat'||data.type==='impact'||data.type==='grab'||data.type==='clash')apply({data,sender,seq});else received.push({data,sender,seq});
 }
 function acceptState(id,state,source='server',seen=0){const p=peers.get(id);if(!p||!validSnapshot(state))return;if(source==='server'&&transport?.fresh(id))return;if(source==='server'&&seen&&seen<=p.serverSeen)return;if(source==='server')p.serverSeen=seen;
  if(p.motion.push(state,performance.now(),source)){p.state=state;p.received=performance.now();}}
 const transport=session?createPeerTransport({id:session.id,sendSignal:(target,signal)=>api('signal',{...session,target,signal}),onState:(id,state)=>acceptState(id,state,'direct'),onEvent:(sender,event)=>{
  if(event.type==='grab'||event.type==='clash'){receiveEvent(event,sender);}else if(event.type==='combat'&&event.attack){event.attack.attacker=sender;receiveEvent(event,sender);}else if(event.type==='impact')receiveEvent({...event,target:sender},sender);
 }}):null;
 function wireState(){return {...getState(),netVersion,netSeq:++netSeq,netTime:Math.round(performance.now()*10)/10};}
 function receivePlayers(rows){const present=[];for(const row of rows){present.push(row.id);let state;try{state=JSON.parse(row.state);}catch{continue;}if(!validSnapshot(state))continue;if(!peers.has(row.id))addPeer(row,state);acceptState(row.id,state,'server',row.seen);}
  for(const id of peers.keys())if(!present.includes(id)&&!transport?.fresh(id))removePeer(id);transport?.discover(present);
 }
 function updateStatus(){const links=transport?.stats||[],direct=links.filter(p=>p.direct),pings=direct.filter(p=>p.rttMs!==null).map(p=>p.rttMs),rates=direct.map(p=>p.receiveHz);status('Room '+session.code+' · '+(peers.size+1)+'/4 heroes · '+(direct.length?'Direct '+direct.length+'/'+peers.size+(pings.length?' · '+Math.round(Math.max(...pings))+' ms peer ping':' · measuring ping')+' · '+Math.round(Math.min(...rates))+' updates/s':'Server fallback · '+latency+' ms request')+(backlog||received.length?' · syncing city…':''));}
 async function poseSync(){if(stopped||!session)return;const started=performance.now();try{const result=await api('pose',{...session,state:wireState()});latency=Math.round(performance.now()-started);receivePlayers(result.players);updateStatus();}catch(e){if(e.status===401){stopped=true;transport?.close();sessionStorage.removeItem(storageKey);status(e.message);}else status('Movement connection interrupted · retrying');}finally{if(!stopped)poseTimer=setTimeout(poseSync,document.hidden?1500:peers.size&&[...peers.keys()].every(id=>transport?.fresh(id))?500:Math.max(20,125-(performance.now()-started)));}}
 async function sync(){if(stopped||!session||syncBusy)return;syncBusy=true;const urgent=e=>['combat','grab','impact','clash'].includes(e.type),sent=[...outbox.filter(urgent),...outbox.filter(e=>!urgent(e))].slice(0,40),started=performance.now();try{const result=await api('sync',{...session,cursor,signalCursor,control:true,state:wireState(),events:sent});const delivered=new Set(sent.map(e=>e.id));outbox=outbox.filter(e=>!delivered.has(e.id));online=true;backlog=result.more;receivePlayers(result.players);
  for(const signal of result.signals||[]){signalCursor=Math.max(signalCursor,signal.seq);try{transport?.accept(signal.sender,JSON.parse(signal.payload));}catch{}}
  const reset=result.events.findLast(event=>{try{return JSON.parse(event.payload).type==='reset';}catch{return false;}});if(reset){received=[];sessionStorage.setItem('meridian-reset-cursor',String(reset.seq));location.reload();return;}
  for(const event of result.events){cursor=Math.max(cursor,event.seq);let data;try{data=JSON.parse(event.payload);}catch{continue;}if(data.type==='reset'||event.sender!==session.id||['building','heat','shockwave','terrain','clash'].includes(data.type)&&!sent.some(e=>e.id===data.id)&&!seenLocal.has(data.id))receiveEvent(data,event.sender,event.seq);}
  for(const event of result.events){try{seenLocal.delete(JSON.parse(event.payload).id);}catch{}}updateStatus();
 }catch(e){online=false;status(e.message+' · retrying');if(e.status===401){stopped=true;sessionStorage.removeItem(storageKey);transport?.close();status(e.message);}}
 finally{syncBusy=false;if(!stopped)timer=setTimeout(sync,backlog?60:document.hidden?1500:outbox.length?60:400);}}
 const seenLocal=new Set();const send=(type,data)=>{const before=outbox.length;emit(type,data);if(outbox.length>before)seenLocal.add(outbox.at(-1).id);};
 // Replicate destructive operations, not individual debris particles or physics bodies.
 const originals={};function wrap(object,key,pack,condition=()=>true){const fn=object[key];originals[key]=fn;object[key]=function(...args){const data=session&&!applying?pack(...args):null;const result=fn.apply(this,args);if(data&&condition(result))send(data.type,data);return result;};}
 wrap(destruction,'punch',(b,p,d,kind,cone)=>({type:'building',method:'punch',b:ids.get(b),p:p.toArray(),d:d.toArray(),kind,cone:cone?{...cone,origin:cone.origin.toArray()}:null}));
 wrap(destruction,'hit',(c,p,v,options)=>c.solid?.building?({type:'building',method:'hit',b:ids.get(c.solid.building),p:p.toArray(),v:v.toArray(),normal:c.normal.toArray(),offset:c.offset.toArray(),powered:!!options?.powered}):null,r=>!!r);
 wrap(destruction,'heat',(o,d,reach)=>({type:'heat',o:o.toArray(),d:d.toArray(),reach}),r=>r>0);
 wrap(destruction,'shockwave',(p,r)=>({type:'shockwave',p:p.toArray(),radius:r}));
 groundDamage.onNetworkStamp=(x,z,radius,depth,guard)=>send('terrain',{x,z,radius,depth,guard});
 function apply({data:e,sender,seq}){applying=true;try{
 if(e.type==='clash'){applying=false;onClash(e,sender);}
 else if(e.type==='grab'){applying=false;if(e.target===session.id)onGrab(e,sender);}
 else if(e.type==='building'){const b=buildings[e.b];if(!b)return;if(e.method==='punch')originals.punch(b,vector(e.p),vector(e.d),e.kind,e.cone?{...e.cone,origin:vector(e.cone.origin)}:null);else if(e.method==='hit')originals.hit({solid:{building:b},normal:vector(e.normal),offset:vector(e.offset)},vector(e.p),vector(e.v),{powered:e.powered});}
 else if(e.type==='heat')originals.heat(vector(e.o),vector(e.d),e.reach);
 else if(e.type==='shockwave')originals.shockwave(vector(e.p),e.radius);
 else if(e.type==='terrain')groundDamage.applyNetworkStamp(e.x,e.z,e.radius,e.depth,e.guard);
 else if(e.type==='combat'&&e.target===session.id){const a=decodeCombatAttack(e.attack,session.id);applying=false;combat.hit('player',{...a,id:e.id});}
 else if(e.type==='impact'){const p=peers.get(e.target);if(p)p.fx.impact(vector(e.p),vector(e.d),e.kind,e.blocked);}
 else if(e.type==='reset'){sessionStorage.setItem('meridian-reset-cursor',String(seq));location.reload();}
 }finally{applying=false;}}
 function update(dt,time){if(!session)return;const now=performance.now();for(const [id,t]of handledEvents)if(now-t>120000)handledEvents.delete(id);const budget=performance.now()+2;for(let n=0;received.length&&n<4&&performance.now()<budget;n++)apply(received.shift());
 for(const [id,p]of peers){const s=p.motion.sample(performance.now())||p.state,age=(performance.now()-p.received)/1000;p.hero.root.visible=!!s.active&&age<5;p.label.hidden=!p.hero.root.visible;p.beams.forEach(b=>b.visible=false);if(!p.hero.root.visible)continue;
 p.position.fromArray(s.p);collisionWorld?.confine(p.position,null,3);p.hero.root.position.copy(p.position);if(p.hero.character.id!==s.character)p.hero.setAppearance(s.character);
 const punch=s.punch?{...s.punch,age:s.punch.age+Math.min(age,.12),direction:vector(s.punch.direction)}:null;
 p.hero.update(dt,time,{health:s.health??1000,...s.pose,held:s.held,grab:s.grab?{...s.grab,direction:vector(s.grab.direction)}:null,vx:s.v[0],vy:s.v[1],vz:s.v[2],defense:s.defense,punch,heatAim:s.heat?vector(s.heat):null,groundY:groundHeight(p.position.x,p.position.z)});p.fx.update(dt,{age:s.defense?.age||0,parrying:s.defense?.phase==='parry',vulnerable:s.defense?.phase==='vulnerable'});
 const screen=p.position.clone().add(new T.Vector3(0,3.1*p.hero.character.height,0)).project(camera);p.label.hidden=screen.z>1||Math.abs(screen.x)>1||Math.abs(screen.y)>1;p.label.style.left=(screen.x*.5+.5)*innerWidth+'px';p.label.style.top=(-screen.y*.5+.5)*innerHeight+'px';
 if(s.heat){const direction=vector(s.heat),eyes=p.hero.eyePositions();for(let i=0;i<2;i++){const beam=p.beams[i];beam.visible=true;beam.position.copy(eyes[i]).addScaledVector(direction,59.0625);beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);beam.scale.y=118.125;}}
 }}
 function flush(){if(!session||stopped||!transport?.connected)return;const now=performance.now(),state=getState();
  const key=[state.active,state.pose.flying,state.pose.moving,state.defense?.phase,state.defense?.blocking,state.punch?.kind,state.punch?.variant,state.grab?.phase,state.held?.mode,!!state.heat].join('|');
  const changed=key!==lastActionKey;if(!changed&&now+.5<nextBroadcast)return;if(now-lastBroadcast<12)return;
  lastActionKey=key;lastBroadcast=now;nextBroadcast=changed?now+1000/30:Math.max(now,nextBroadcast+1000/30);
  transport.broadcast({...state,netVersion,netSeq:++netSeq,netTime:Math.round(now*10)/10});
 }
 const startCursor=sessionStorage.getItem('meridian-reset-cursor');if(startCursor){cursor=Number(startCursor)||0;sessionStorage.removeItem('meridian-reset-cursor');}
 if(session){status('Connecting to room '+session.code+'…');poseSync();sync();}else{status('Solo city');if(new URL(location.href).searchParams.has('room'))panel.hidden=false;}
 function syncHolds(localHero,localTarget,carry){
  for(const [id,p]of peers){
   let held=p.state.held,holder;
   if(id===localTarget&&carry){held={mode:carry.tackle?'tackle':'grab',direction:carry.direction,moving:carry.flightCarry,age:carry.age};holder=localHero;}
   else if(held?.by&&held.by!==session?.id)holder=peers.get(held.by)?.hero;
   if(!holder||!held)continue;
   p.hero.update(0,performance.now()/1000,{flying:false,moving:false,grounded:false,vx:0,vy:0,vz:0,held});
   p.hero.pinHeld(holder.grappleAnchor(held.mode),held.mode);collisionWorld?.confine(p.hero.root.position,null,3);p.position.copy(p.hero.root.position);
  }
 }
 return {update,flush,syncHolds,emit:send,peer(id){const p=peers.get(id);return p&&p.state.active&&performance.now()-p.received<1800?{position:p.position,hand:p.hero.grabHand(),height:p.hero.character.height,anchor:mode=>p.hero.grappleAnchor(mode),direction:vector(p.state.grab?.direction||p.state.v).normalize(),velocity:vector(p.state.v),controlledFlight:!!p.state.pose.controlledFlight&&!p.state.held&&!p.state.grab&&!(p.state.defense?.stun>0)&&p.state.health>0,grounded:p.state.pose.grounded,flying:p.state.pose.flying,fast:p.state.pose.boost,held:!!p.state.held,airborne:!p.state.pose.grounded,moving:p.state.pose.moving,flightCarry:!!p.state.grab?.flightCarry,grabAge:p.state.grab?.age||0}:null;},get connected(){return !!session;},get id(){return session?.id;},get ready(){return !session||online&&!backlog&&!received.length;},get stats(){return {room:session?.code||null,players:peers.size+1,latency,directPeers:transport?.connected||0,links:transport?.stats||[],motion:[...peers.values()].map(p=>p.motion.stats),online,pending:received.length+outbox.length};},resetCity(){if(!session){location.reload();return;}send('reset',{});status('Resetting shared city…');},impact(point,direction,kind,blocked){send('impact',{target:session?.id,p:point.toArray(),d:direction.toArray(),kind,blocked});}};
}
