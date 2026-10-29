import assert from 'node:assert/strict';
import {createDesktopLook} from './dist/desktop-look.js';
import {graphicsProfile} from './dist/device-mode.js';
import {createAdaptiveQuality} from './dist/adaptive-quality.js';
function harness(enabled=true){
 const listeners={},moves=[],errors=[];let playing=true,released=0,requests=0;
 const doc={pointerLockElement:null,body:{classList:{toggle(){}}},addEventListener(k,f){listeners[k]=f;},exitPointerLock(){this.pointerLockElement=null;listeners.pointerlockchange();}};
 const canvas={requestPointerLock(){requests++;doc.pointerLockElement=canvas;listeners.pointerlockchange();return Promise.resolve();}};
 const look=createDesktopLook({canvas,doc,enabled,isPlaying:()=>playing,onMove:(x,y)=>moves.push([x,y]),onRelease:()=>{released++;playing=false;},onError:e=>errors.push(e)});
 return {look,canvas,doc,listeners,moves,errors,get released(){return released},get requests(){return requests},play(){playing=true}};
}
const h=harness();h.look.request();assert(h.look.locked);
// Movement relies only on relative deltas; no pressed button or screen coordinates.
for(let i=0;i<100;i++)h.listeners.mousemove({movementX:40,movementY:-2,buttons:0,clientX:9999});
assert.equal(h.moves.reduce((n,m)=>n+m[0],0),4000);
h.look.request();assert.equal(h.requests,1);
h.look.release();assert.equal(h.released,1);h.listeners.mousemove({movementX:30,movementY:30});assert.equal(h.moves.length,100);
h.play();h.look.request();assert(h.look.locked);assert.equal(h.requests,2);
const mobile=harness(false);mobile.look.request();assert.equal(mobile.requests,0);
const denied=harness();denied.canvas.requestPointerLock=()=>Promise.reject(Error('denied'));denied.look.request();await new Promise(r=>setImmediate(r));assert.equal(denied.errors.length,1);assert(!denied.look.locked);
const oldBrowser=harness();delete oldBrowser.canvas.requestPointerLock;oldBrowser.look.request();assert.equal(oldBrowser.errors.length,1);
for(const phone of [true,false]){const p=graphicsProfile(phone,2);const auto=createAdaptiveQuality(p.maxRatio,p.minRatio);for(let i=0;i<1500;i++)auto.update(35);assert.equal(auto.ratio,p.minRatio);for(let i=0;i<10000;i++)auto.update(16);assert.equal(auto.ratio,p.maxRatio);}
assert(graphicsProfile(true,2).shadowSize<graphicsProfile(false,2).shadowSize);
assert.equal(graphicsProfile(false,1).maxRatio,1);
console.log('PASS: unlimited relative look without holding, pause/release/resume, mobile isolation, capture failure handling, separate bounded graphics profiles.');
