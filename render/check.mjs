import assert from 'node:assert/strict';
import {server} from './server.mjs';
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function post(action, body, expected=200) {
 const response = await fetch(base+'/api/rooms/'+action, {method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});
 const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
}
try {
 const html = await (await fetch(base)).text();
 assert.ok(html.includes('COLLATERAL')); assert.ok(!html.includes('chatgpt.site'));
 assert.equal((await fetch(base+'/.openai/hosting.json')).status,404);
 assert.equal((await fetch(base+'/server/index.js')).status,404);
 const a = await post('create',{name:'A'}), b = await post('join',{code:a.code,name:'B'});
 const state = {p:[0,10,0],v:[0,0,0],character:'original'};
 const pose = await post('pose',{...a,state}); assert.equal(pose.players.length,1);
 await post('pose',{...a,token:'wrong',state},401);
 await post('sync',{...a,state,control:true,events:[{id:'test',type:'reset'}]});
 const sync = await post('sync',{...b,state,control:true,events:[]}); assert.equal(sync.events.length,1);
 await post('signal',{...a,target:b.id,signal:{kind:'offer',generation:'test',description:{type:'offer',sdp:'test'}}});
 const signals = await post('sync',{...b,state,control:true,events:[]}); assert.equal(signals.signals.length,1);
 await post('join',{code:a.code,name:'C'}); await post('join',{code:a.code,name:'D'});
 await post('join',{code:a.code,name:'E'},409);
 await post('leave',b);
 await post('join',{code:a.code,name:'E'});
 console.log('PASS: standalone assets, protected paths, room creation/join/limit, pose, authentication, event sync, signaling, leave');
} finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
