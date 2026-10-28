import * as T from './vendor/three.module.js';
export function damageStage(health){return Math.max(0,Math.min(10,Math.floor((1000-Math.max(0,health))/100)));}
// Surface damage follows each animated mesh. Shared uniforms avoid new meshes,
// textures, draw calls or shader recompilation at each health threshold.
export function createBattleDamage(meshes,cape){
 const stage={value:0},skin={value:new T.Color('#bc896d')},materials=new Set();
 for(const mesh of meshes)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(m?.isMeshStandardMaterial)materials.add(m);
 function install(m,cloth=false){const prior=m.onBeforeCompile.bind(m),key=m.customProgramCacheKey.bind(m);m.onBeforeCompile=shader=>{prior(shader);shader.uniforms.battleStage=stage;shader.uniforms.battleSkin=skin;
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBattlePoint;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBattlePoint=position;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 uniform float battleStage;uniform vec3 battleSkin;varying vec3 vBattlePoint;
 float battleHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float battleNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(battleHash(i),battleHash(i+vec3(1,0,0)),f.x),mix(battleHash(i+vec3(0,1,0)),battleHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(battleHash(i+vec3(0,0,1)),battleHash(i+vec3(1,0,1)),f.x),mix(battleHash(i+vec3(0,1,1)),battleHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 `).replace('#include <color_fragment>',`#include <color_fragment>
 if(battleStage>0.){
 vec3 bp=vBattlePoint;float s=battleStage/10.;
 float coarse=battleNoise(bp*12.+vec3(4.,1.,7.)),fine=battleNoise(bp*75.);
 float slash=abs(sin(bp.y*35.+bp.x*18.+coarse*7.));
 float tear=(1.-smoothstep(.03,.13,slash))*smoothstep(.48-s*.12,.68-s*.14,coarse)*step(1.,battleStage);
 float exposed=smoothstep(.80-s*.23,.90-s*.23,coarse)*step(2.,battleStage);
 vec3 torn=mix(vec3(.024,.018,.02),battleSkin*.65,exposed);
 diffuseColor.rgb=mix(diffuseColor.rgb,torn,max(tear*.85,exposed*.88));
 float bruise=smoothstep(.54,.78,coarse)*step(3.,battleStage)*s;
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.07,.115),bruise*.65);
 float blood=smoothstep(.84-s*.31,.94-s*.31,coarse+fine*.12)*step(4.,battleStage);
 float streak=(1.-smoothstep(.025,.10,abs(sin(bp.x*68.+coarse*2.))))*smoothstep(.6,.85,coarse)*step(6.,battleStage)*s;
 diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.12,.008,.014),vec3(.42,.022,.028),fine),max(blood,streak)*.94);
 ${cloth?'if(battleStage>=2.&&vUv.y<.06+s*.23&&coarse>.72-s*.2)discard;':''}
 }
 `);};m.customProgramCacheKey=()=>key()+'-battle-damage-v1-'+cloth;m.needsUpdate=true;}
 for(const m of materials)install(m);if(cape?.mesh?.material){cape.mesh.material.defines={...cape.mesh.material.defines,USE_UV:''};install(cape.mesh.material,true);}
 return {setHealth(value){stage.value=damageStage(value);},setSkin(color){skin.value.set(color);},get stage(){return stage.value;},get materialCount(){return materials.size;}};
}
