import assert from 'node:assert/strict';
import * as T from './dist/vendor/three.module.js';
import {setVisualProfile,detailMap,finishSurface,finishCharacterMaterial,pressureMaterial,vaporMap} from './dist/visual-polish.js';
import {createCinematicRenderer} from './dist/cinematic-renderer.js';
import {createHero} from './dist/hero.js';
const mobileHero=createHero(c=>new T.MeshStandardMaterial({color:c}));
setVisualProfile(false);
const hero=createHero(c=>new T.MeshStandardMaterial({color:c}));
assert(hero.meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0)>mobileHero.meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0));
for(const id of ['original','obsidian','gold','violet','lanky','teal']){
 hero.setAppearance(id);hero.update(1/60,0,{flying:false,grounded:true,moving:false,boost:false,vx:0,vy:0,vz:0,groundY:0});hero.root.updateWorldMatrix(true,true);
 for(const mesh of hero.meshes.filter(m=>m.visible))assert(mesh.matrixWorld.elements.every(Number.isFinite));
 assert(hero.eyePositions().every(p=>p.toArray().every(Number.isFinite)));
}
assert.equal(detailMap('cloth'),detailMap('cloth'));assert.equal(vaporMap(),vaporMap());
const skin=finishCharacterMaterial(new T.MeshStandardMaterial(),'skin');assert.equal(skin.metalness,0);assert(skin.bumpMap);
const concrete=finishSurface(new T.MeshStandardMaterial(),'concrete');const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};concrete.onBeforeCompile(shader);assert.equal(shader.vertexShader,T.ShaderLib.standard.vertexShader);assert.equal(shader.fragmentShader,T.ShaderLib.standard.fragmentShader);
assert(pressureMaterial().transparent);
// Exercise render-target sizing, draw order, Smooth fallback and cleanup without requiring a GPU.
let supported=true,draws=0,output=null,fail=false;const calls=[],r={extensions:{has:()=>supported},capabilities:{maxSamples:4},info:{autoReset:true,reset(){}},getDrawingBufferSize:v=>v.set(1920,1080),setRenderTarget:t=>{output=t;},render:(s,c)=>{if(fail)throw Error('test');draws++;calls.push(output);}};
const fx=createCinematicRenderer(r,true);fx.render(new T.Scene(),new T.Camera());assert.equal(draws,5);assert.equal(calls[0].width,1920);assert.equal(calls[0].samples,0);assert.equal(calls[1].width,480);assert.equal(calls[1].height,270);assert.equal(output,null);assert(r.info.autoReset);
fx.render(new T.Scene(),new T.Camera(),false);assert.equal(draws,6);
fail=true;assert.throws(()=>fx.render(new T.Scene(),new T.Camera()));assert.equal(output,null);assert(r.info.autoReset);fail=false;fx.dispose();
supported=false;createCinematicRenderer(r,true).render(new T.Scene(),new T.Camera());assert.equal(draws,7);
setVisualProfile(true);assert.equal(finishCharacterMaterial(new T.MeshStandardMaterial()).bumpMap,null);
console.log('PASS: detailed heroes, finite poses/eye anchors, shared textures, skin/metal separation, baked surface shaders, HDR passes, quarter-size bloom, Smooth/no-HDR fallback and renderer-state cleanup.');
