import {titanLocomotionSafe} from './titan-physics.js';
import {setVisualProfile,finishSurface} from './visual-polish.js';
import {createCinematicRenderer} from './cinematic-renderer.js';
import {polishFacade} from './facade-polish.js';
import {createDesktopSpeed} from './desktop-speed.js';
import {chooseDevice,graphicsProfile} from './device-mode.js';
import {createDesktopLook} from './desktop-look.js';
import {terrainCameraFraction} from './terrain-camera.js';
import {lockedHitAngles,steadyTargetCamera} from './locked-hit-camera.js';
import {CHARACTERS} from './character-styles.js';
import {createLockOn} from './lock-on.js';
import {createPracticeDummy} from './practice-dummy.js';
import {createMultiplayer} from './multiplayer.js';
import {createHealth} from './health.js';
import {createHealthHUD} from './health-hud.js';
import {createDefense,createCombat,launchForRange,MAX_LAUNCH_SPEED} from './combat-rules.js';
import {createDefenseFX} from './defense-fx.js';
import {createAdaptiveQuality} from './adaptive-quality.js';
import {createGrab} from './grab.js';
import {createAirRecovery} from './air-recovery.js';
import {createHeroClash,headOnContact} from './hero-clash.js';
import {createHeroGrapple} from './hero-grapple.js';
import {createMainMenu} from './main-menu.js';
import {createSonicWake} from './sonic-wake.js';
import {createGameAudio,AUDIO_ACTIONS} from './audio.js';
import {createFrameProfiler} from './frame-profiler.js';
import {gameViewport} from './viewport.js';
import {createHeatVision} from './heat-vision.js';
import {createPunches,PUNCHES} from './punches.js';
import {createNeighborhoodBuilder} from './neighborhoods.js';
import {createGroundDamage} from './ground-damage.js';
import {createDestruction} from './destruction.js';
import {GROUND_SPEEDS,groundLabel,nextGroundMode} from './ground-modes.js';
import * as T from './vendor/three.module.js';
import {FLIGHT_SPEEDS,RISE_SPEED,nextFlightMode} from './flight-modes.js';
import {airborneControl} from './falling.js';
import {followYaw} from './camera-follow.js';
import {createFlightCamera} from './flight-camera.js';
import {createGroundRecovery,restingOnSolid} from './ground-recovery.js';
import {coast} from './air-momentum.js';
import {resolveImpact,recoveryRate} from './impact.js';
import {chargeAmount,jumpImpulse} from './jump-charge.js';
import {JumpHold} from './levitation.js';
import {createWind} from './wind.js';
import {createCityLife} from './life.js';
import { createHero } from './hero.js';
import { createForest } from './forest.js';
import { movementVector } from './flight.js';
import {createBoostEffect,responseRate} from './boost.js';
import {CollisionWorld,convexCollider} from './collision.js';
import {BLOCK,RADIUS,EDGE,PARK,isParkBlock,zoneAt,districtAt,transitionHeight,residentialSurface} from './map-layout.js';
const $=id=>document.getElementById(id);
try { await main(); } catch(e) { console.error(e); $('loading').style.display='flex';$('loadText').textContent='Could not start 3D. Please reload in Safari or Chrome.'; }
async function main(){
const mobile=await chooseDevice();
setVisualProfile(mobile);
const graphics=graphicsProfile(mobile,devicePixelRatio);
let desktopLook=null;
const desktopSpeed=createDesktopSpeed();
const actionKeys=mobile?{lock:'KeyL',grab:'KeyG',heat:'KeyE'}:{lock:'Tab',grab:'KeyE',heat:'KeyR'};
const audio=createGameAudio();
addEventListener('pointerdown',()=>audio.unlock(),{capture:true});addEventListener('keydown',()=>audio.unlock(),{capture:true});
document.addEventListener('visibilitychange',()=>audio.setHidden(document.hidden));addEventListener('pageshow',()=>audio.setHidden(document.hidden));
const mute=$('audio-mute'),volume=$('audio-volume'),musicVolume=$('music-volume');
function soundLabels(){mute.textContent=audio.muted?'Sound: Off':'Sound: On';mute.setAttribute('aria-pressed',String(audio.muted));volume.value=String(Math.round(audio.volume*100));$('audio-level').textContent=volume.value+'%';musicVolume.value=String(Math.round(audio.musicVolume*100));$('music-level').textContent=musicVolume.value+'%';}
mute.onclick=()=>{audio.setMuted(!audio.muted);soundLabels();};volume.oninput=()=>{audio.setVolume(Number(volume.value)/100);soundLabels();};
musicVolume.oninput=()=>{audio.setMusicVolume(Number(musicVolume.value)/100);soundLabels();};
const actionControls=document.createElement('div');actionControls.id='action-volumes';$('audio-controls').append(actionControls);
for(const [key,name] of Object.entries(AUDIO_ACTIONS)){const row=document.createElement('label'),slider=document.createElement('input'),caption=document.createElement('span'),output=document.createElement('output');row.className='audio-action';caption.textContent=name;slider.type='range';slider.min='0';slider.max='100';slider.value=String(Math.round(audio.getActionVolume(key)*100));slider.setAttribute('aria-label',name+' volume');output.textContent=slider.value+'%';slider.oninput=()=>{audio.setActionVolume(key,Number(slider.value)/100);output.textContent=slider.value+'%';};row.append(caption,slider,output);actionControls.append(row);}
for(const event of ['pointerdown','keydown','keyup'])$('audio-controls').addEventListener(event,e=>e.stopPropagation());soundLabels();

const renderer=new T.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(graphics.maxRatio);renderer.setSize(innerWidth,innerHeight,false);
renderer.localClippingEnabled=true;
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=mobile?1.05:1.08;
const cinematic=createCinematicRenderer(renderer,!mobile);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=mobile;let lastShadowUpdate=-Infinity;
const scene=new T.Scene();scene.matrixAutoUpdate=false;scene.background=new T.Color('#8099cf');scene.fog=new T.FogExp2(mobile?'#aeb8da':'#b7c7d3',mobile?.00022/.85:.00017);
const camera=new T.PerspectiveCamera(62,innerWidth/innerHeight,.25,6120);
const sunDir=new T.Vector3(-.65,.53,-.4).normalize();
const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,depthTest:false,uniforms:{sun:{value:sunDir}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 v;uniform vec3 sun;void main(){vec3 d=normalize(v);float h=max(d.y,0.0);vec3 c=mix(vec3(.85,.78,.81),vec3(.17,.32,.66),pow(h,.42));float s=max(dot(d,sun),0.0);c+=vec3(1.,.69,.34)*pow(s,12.)*.28;c+=vec3(3.,2.4,1.5)*smoothstep(.99965,.9999,s);gl_FragColor=vec4(c,1.);}'});
const sky=new T.Mesh(new T.SphereGeometry(6800,32,16),skyMat);sky.scale.setScalar(camera.far*.95/6800);sky.renderOrder=-1000;scene.add(sky);
const envScene=new T.Scene();envScene.add(new T.Mesh(new T.SphereGeometry(100,24,12),skyMat));
const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(envScene,.04,.1,200).texture;pmrem.dispose();
scene.add(new T.HemisphereLight('#8bc5ff','#554579',1.65));
const sunlight=new T.DirectionalLight('#ffdfab',2.7);sunlight.position.copy(sunDir).multiplyScalar(500);sunlight.castShadow=true;sunlight.shadow.mapSize.set(graphics.shadowSize,graphics.shadowSize);Object.assign(sunlight.shadow.camera,{left:-150,right:150,top:150,bottom:-150,near:1,far:1100});sunlight.shadow.normalBias=.45;sunlight.shadow.bias=-.00015;scene.add(sunlight,sunlight.target);
let seed=82461;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}function range(a,b){return a+rand()*(b-a)}
const anis=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
function texCanvas(draw,size=256){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=anis;return t;}
function facade(style,base,glass){return texCanvas((g,s)=>{g.fillStyle=base;g.fillRect(0,0,s,s);if(style==='brick'){for(let y=0;y<s;y+=12){g.fillStyle='#392e292a';g.fillRect(0,y,s,1.5);for(let x=-30;x<s;x+=43){g.fillRect(x+(y%24?21:0),y,1,12)}}}for(let i=0;i<1900;i++){const a=rand()*.025;g.fillStyle=rand()>.5?`rgba(0,0,0,${a})`:`rgba(255,255,255,${a})`;g.fillRect(rand()*s,rand()*s,18,2)}const pad=style==='glass'?3:style==='brick'?45:32;const y=style==='glass'?3:35;g.fillStyle='#17262c';g.fillRect(pad-4,y-4,s-pad*2+8,s-y-30);let grad=g.createLinearGradient(0,y,s,s);grad.addColorStop(0,glass);grad.addColorStop(.5,'#96d5dd');grad.addColorStop(.53,glass);grad.addColorStop(1,'#253858');g.fillStyle=grad;g.fillRect(pad,y,s-pad*2,s-y-34);g.save();g.beginPath();g.rect(pad,y,s-pad*2,s-y-34);g.clip();g.fillStyle='#d1f6ff24';g.beginPath();g.moveTo(0,s*.7);g.lineTo(s,s*.1);g.lineTo(s,s*.32);g.lineTo(0,s*.92);g.fill();g.restore();g.fillStyle='#b3c6cc35';g.fillRect(pad+6,y+3,8,s-y-42);g.fillStyle=style==='glass'?'#263d47':'#8d8b7e';g.fillRect(s/2-2,y,4,s-y-34);g.fillRect(pad,s/2,s-pad*2,3);if(style!=='glass'){g.fillStyle='#151d2450';g.fillRect(pad-8,s-31,s-pad*2+16,9);g.fillStyle='#c2bba9';g.fillRect(pad-7,s-34,s-pad*2+14,4)}else{g.fillStyle='#aac4ce55';g.fillRect(0,0,2,s);g.fillRect(0,s-4,s,3)}});}
// Mobile keeps stepped comic lighting; desktop adds material highlights and sky reflections.
const ramp=new T.DataTexture(new Uint8Array([48,85,155,215,255]),5,1,T.RedFormat);ramp.minFilter=ramp.magFilter=T.NearestFilter;ramp.generateMipmaps=false;ramp.needsUpdate=true;
function mat(c,rough=.8,metal=0){const m=mobile?new T.MeshToonMaterial({color:c,gradientMap:ramp}):new T.MeshStandardMaterial({color:c,roughness:rough,metalness:metal,envMapIntensity:.45});m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float edgeLight=pow(1.0-clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0),3.0);outgoingLight+=vec3(0.025,0.055,0.09)*edgeLight;
#include <opaque_fragment>`)};m.customProgramCacheKey=()=> mobile?'meridian-comic-v2':'collateral-desktop-lit-v1';return m;}
const facadeStyles=[['glass','#233b65','#319bb3'],['glass','#425283','#798ed0'],['glass','#31595e','#50a8a5'],['stone','#cbb795','#3b6583'],['stone','#e3c8a0','#6372a7'],['brick','#b45d54','#3a6683'],['brick','#855276','#4b91a3'],['stone','#91aaa8','#344f7d']];
const walls=facadeStyles.map(([s,b,g])=>{const m=new T.MeshStandardMaterial({color:'#ffffff',roughness:s==='glass'?(mobile?.24:.19):.79,metalness:s==='glass'?.48:.02});m.map=facade(s,b,g);m.envMapIntensity=s==='glass'?(mobile?.85:1.15):.22;if(!mobile)polishFacade(m,s);return m});
const concrete=mat('#c1b9a4'),roofmat=mat('#526985'),darkmetal=mat('#283d60',.5,.4),white=mat('#d0cbb9'),roadmat=mat('#3c4864'),curbmat=mat('#a4aaa9'),grassmat=mat('#468579'),bark=mat('#645344'),leafmat=mat('#298477'),leaf2=mat('#76ad79'),markmat=mat('#c5c4ad');
roadmat.map=texCanvas((g,s)=>{g.fillStyle='#969a9e';g.fillRect(0,0,s,s);for(let i=0;i<26000;i++){g.fillStyle=rand()>.5?'#ffffff06':'#00000006';g.fillRect(rand()*s,rand()*s,1,1)}});
if(!mobile){roadmat.bumpMap=roadmat.map;roadmat.bumpScale=.035;}
const pavement=mat('#b8b5a8');pavement.map=texCanvas((g,s)=>{g.fillStyle='#dfddd1';g.fillRect(0,0,s,s);g.strokeStyle='#888f8855';g.lineWidth=2;g.strokeRect(0,0,s,s);for(let i=0;i<12000;i++){g.fillStyle='#00000004';g.fillRect(rand()*s,rand()*s,1,1)}});
const coralAccent=new T.MeshStandardMaterial({color:'#e35c61',roughness:.5}),cyanAccent=new T.MeshStandardMaterial({color:'#20b9ce',emissive:'#167b93',emissiveIntensity:.18,roughness:.28,metalness:.4}),goldAccent=new T.MeshStandardMaterial({color:'#f4b544',roughness:.28,metalness:.6}),greenAccent=new T.MeshStandardMaterial({color:'#428265',roughness:.9});
let tallestBuilding=0;
const buildings=[];
for(const [material,kind] of [[concrete,'concrete'],[roofmat,'concrete'],[roadmat,'asphalt'],[pavement,'concrete'],[curbmat,'concrete'],[grassmat,'grass'],[bark,'bark']])finishSurface(material,kind);
let batchRegion='global';const renderDistricts=[],districtLods=new Map();const batches=new Map(),colliders=[],unit=new T.BoxGeometry(1,1,1).toNonIndexed();
function addGeometry(geo,m,x,y,z,sx=1,sy=1,sz=1,rot=0,uvx=1,uvy=1){if(!geo.boundingBox)geo.computeBoundingBox();tallestBuilding=Math.max(tallestBuilding,y+geo.boundingBox.max.y*sy);const key=batchRegion+':'+m.id;let b=batches.get(key);if(!b){b={m,region:batchRegion,p:[],n:[],uv:[]};batches.set(key,b)}const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv,c=Math.cos(rot),s=Math.sin(rot);for(let i=0;i<p.count;i++){let px=p.getX(i)*sx,pz=p.getZ(i)*sz;b.p.push(x+px*c+pz*s,y+p.getY(i)*sy,z-px*s+pz*c);let nx=n.getX(i)/sx,ny=n.getY(i)/sy,nz=n.getZ(i)/sz,l=Math.hypot(nx,ny,nz);b.n.push((nx*c+nz*s)/l,ny/l,(-nx*s+nz*c)/l);b.uv.push((uv?uv.getX(i):0)*uvx,(uv?uv.getY(i):0)*uvy)}}
function box(x,y,z,w,h,d,m,collision=false){addGeometry(unit,m,x,y,z,w,h,d,0,Math.max(w,d)/4,h/4);if(collision||([roofmat,concrete,white,darkmetal,greenAccent,bark].includes(m)&&h>.18&&w>1&&d>1))colliders.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2,y1:y-h/2,y2:y+h/2});}
// Facade faces use their actual width, preserving human-scale windows on every elevation.
function buildingBox(x,bottom,z,w,h,d,m){const top=bottom+h;const corners=[[[w/2,0,-d/2],[w/2,0,d/2],[w/2,h,d/2],[w/2,h,-d/2]],[[-w/2,0,d/2],[-w/2,0,-d/2],[-w/2,h,-d/2],[-w/2,h,d/2]],[[w/2,0,d/2],[-w/2,0,d/2],[-w/2,h,d/2],[w/2,h,d/2]],[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,h,-d/2],[-w/2,h,-d/2]]];const norms=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];const key=batchRegion+':'+m.id;let b=batches.get(key);if(!b){b={m,region:batchRegion,p:[],n:[],uv:[]};batches.set(key,b)}corners.forEach((cs,f)=>{const u=(f<2?d:w)/4.2,v=h/4.2;const uv=[[0,0],[u,0],[u,v],[0,v]];for(const i of [0,2,1,0,3,2]){b.p.push(x+cs[i][0],bottom+cs[i][1],z+cs[i][2]);b.n.push(...norms[f]);b.uv.push(...uv[i])}});box(x,top-.3,z,w,.6,d,roofmat);colliders.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2,y1:bottom,y2:top});return top;}
const treeSpecs=[];
const sphere=new T.IcosahedronGeometry(1,1).toNonIndexed(),cylinder=new T.CylinderGeometry(1,1,1,7).toNonIndexed();
function tree(x,z,scale=1){treeSpecs.push({x,z,h:range(7,12)*scale})}
const S=BLOCK,N=RADIUS,edge=EDGE;
box(0,-2,0,edge*2,4,edge*2,roadmat);
let count=0,houseCount=0;
function beginBuilding(x,z,kind='urban'){const region=batchRegion;batchRegion+=':buildings';return {region,id:buildings.length,x,z,kind,ranges:[],solids:[],active:false,starts:new Map([...batches].map(([k,b])=>[k,b.p.length/3])),solidStart:colliders.length};}
function endBuilding(building){for(const [key,b] of batches){const start=building.starts.get(key)||0;if(b.p.length/3>start)building.ranges.push({m:b.m,b,start,end:b.p.length/3});}building.solids=colliders.slice(building.solidStart);for(const solid of building.solids)solid.building=building;delete building.starts;delete building.solidStart;buildings.push(building);count++;if(building.kind==='house')houseCount++;batchRegion=building.region;}
const neighborhoods=createNeighborhoodBuilder({box,addGeometry,buildingBox,tree,mat,unit,colliders,beginBuilding,endBuilding,materials:{grass:grassmat,pavement,road:roadmat,trim:white,metal:darkmetal,brick:concrete}});

for(let ix=-N;ix<=N;ix++)for(let iz=-N;iz<=N;iz++){
batchRegion=Math.floor(ix/5)+','+Math.floor(iz/5);const x=ix*S,z=iz*S;const park=isParkBlock(ix,iz);const zone=zoneAt(ix,iz);box(x,.13,z,86,.65,86,pavement);
if(zone==='residential'){neighborhoods.block(ix,iz);continue;}
if(zone==='outer'&&!park){box(x,.50,z-32,72,.12,14,grassmat);box(x,.50,z+32,72,.12,14,grassmat)}
if(park){box(x,.51,z,80,.15,80,grassmat);box(x,.62,z,7,.12,82,pavement);box(x,.62,z,82,.12,7,pavement);for(let j=0;j<11;j++){const tx=x+range(-36,36),tz=z+range(-36,36);if(Math.abs(tx-x)>7&&Math.abs(tz-z)>7)tree(tx,tz,1.2)}continue;}
const center=Math.exp(-(ix**2+iz**2)/15);const dist=Math.hypot(ix,iz);
const landmark=ix===0&&iz===0;const split=zone==='outer'||(rand()>.2&&!landmark);const plots=zone==='outer'?[[-21,0],[21,0]]:split?[[-21,-21],[21,-21],[-21,21],[21,21]]:[[0,0]];
for(const [ox,oz] of plots){if(!landmark&&rand()<.025)continue;const bx=x+ox,bz=z+oz,w=split?range(25,36):range(49,67),d=split?range(25,36):range(47,67);let h=zone==='outer'?Math.round(range(8.4,25.2)/4.2)*4.2:zone==='core'?Math.round(range(180,275)/4.2)*4.2:Math.round((range(14,30)+center*range(40,170))/4.2)*4.2;if(zone!=='core')h=Math.max(h,transitionHeight(bx,bz));const modern=landmark||h>75||rand()<(zone==='outer'?.07:.24);const material=modern?walls[Math.floor(rand()*3)]:walls[3+Math.floor(rand()*5)];if(!split&&zone!=='core')h*=1.3;if(landmark)h=360;
const variant=landmark?4:Math.floor(Math.abs(Math.sin(bx*12.9898+bz*78.233))*10000)%6;
const baseRegion=batchRegion;batchRegion+=':buildings';const building={region:baseRegion,id:buildings.length,x:bx,z:bz,ranges:[],solids:[],active:false};const starts=new Map([...batches].map(([m,b])=>[m,b.p.length/3]));const solidStart=colliders.length;
const baseH=modern?8.4:4.2;buildingBox(bx,.5,bz,w+2,baseH,d+2,modern?walls[1]:material);
let top;
if(variant===4&&h>45){
  const geo=new T.CylinderGeometry(.78,1,1,landmark?8:20,1,true).toNonIndexed();const uv=geo.attributes.uv;for(let k=0;k<uv.count;k++){uv.setXY(k,uv.getX(k)*Math.PI*(w+d)/2/4.2,uv.getY(k)*h/4.2)}
  addGeometry(geo,material,bx,baseH+.5+h/2,bz,w/2,h,d/2);top=baseH+.5+h;
  colliders.push(convexCollider(geo,new T.Matrix4().compose(new T.Vector3(bx,baseH+.5+h/2,bz),new T.Quaternion(),new T.Vector3(w/2,h,d/2))));
  const cap=new T.CylinderGeometry(1,1,1,landmark?8:20).toNonIndexed();addGeometry(cap,roofmat,bx,top,bz,w*.39,.8,d*.39);colliders.push(convexCollider(cap,new T.Matrix4().compose(new T.Vector3(bx,top,bz),new T.Quaternion(),new T.Vector3(w*.39,.8,d*.39))));
  for(let f=16;f<h;f+=16.8){const t=1-.22*f/h;addGeometry(cap,landmark?goldAccent:cyanAccent,bx,baseH+f,bz,w*.5*t,.45,d*.5*t)}
  if(landmark){const crown=new T.CylinderGeometry(.12,1,1,8).toNonIndexed();addGeometry(crown,goldAccent,bx,top+20,bz,w*.4,40,d*.4);colliders.push(convexCollider(crown,new T.Matrix4().compose(new T.Vector3(bx,top+20,bz),new T.Quaternion(),new T.Vector3(w*.4,40,d*.4))));box(bx,top+54,bz,.8,30,.8,cyanAccent);top+=40;}
}else if(variant===3&&h>42){
  const wing=w*.35;top=buildingBox(bx-w*.31,baseH+.5,bz,wing,h,d,material);buildingBox(bx+w*.31,baseH+.5,bz,wing,h*.84,d,walls[1]);
  buildingBox(bx,baseH+h*.64,bz,w*.3,8,d*.42,walls[0]);
  box(bx-w*.31,top+.35,bz,wing+1,.7,d+1,coralAccent);
}else if(variant===2){
  let y=baseH+.5;for(let level=0;level<4;level++){const sw=w*(1-level*.15),sd=d*(1-level*.13);y=buildingBox(bx-level*w*.035,y,bz,sw,h/4,sd,material);box(bx-level*w*.035,y+.3,bz,sw+1,.6,sd+1,white);box(bx+sw*.32-level*w*.035,y+.8,bz,2,1,sd*.7,greenAccent);}top=y;
}else{
  top=buildingBox(bx,baseH+.5,bz,w,h,d,material);
  if(h>60){const levels=h>120?3:2;let sw=w,sd=d;for(let j=0;j<levels;j++){sw*=.79;sd*=.8;const hh=range(8,19);top=buildingBox(bx,top,bz,sw,hh,sd,material);box(bx,top+.18,bz,sw+.9,.4,sd+.9,variant===1?goldAccent:white)}if(h>130){box(bx,top+3,bz,6,6,6,darkmetal);box(bx,top+15,bz,.35,25,.35,white)}}else{box(bx,top+.5,bz,w+1.3,1,d+1.3,concrete);if(variant===5){const roof=new T.CylinderGeometry(0,1,1,4).toNonIndexed();addGeometry(roof,coralAccent,bx,top+4,bz,w*.7,8,d*.7,Math.PI/4);colliders.push(convexCollider(roof,new T.Matrix4().compose(new T.Vector3(bx,top+4,bz),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/4),new T.Vector3(w*.7,8,d*.7))));}else if(rand()<.35){buildingBox(bx+3,top+.7,bz,w*.62,5,d*.62,material)}}
  if(modern){for(let q=-1;q<=1;q++){box(bx+q*w*.33,baseH+h/2,bz+d/2+.12,.5,h,.45,variant===1?goldAccent:darkmetal);box(bx+w/2+.12,baseH+h/2,bz+q*d*.33,.45,h,.5,darkmetal)}}else{for(let f=12;f<h;f+=12.6){box(bx,.5+baseH+f,bz,w+.65,.32,d+.65,white);if(variant===0||variant===5){for(let q=-1;q<=1;q++){box(bx+q*w*.29,baseH+f,bz+d/2+1.3,w*.22,.35,3,white);box(bx+q*w*.29,baseH+f+.65,bz+d/2+2.65,w*.22,1,.14,variant===0?coralAccent:cyanAccent);}}}}
}
const accent=[coralAccent,cyanAccent,goldAccent,greenAccent][Math.abs(ix+iz)%4];
box(bx,4.5,bz+d/2+1.55,w*.67,.8,.35,accent);
box(bx,.7,bz+d/2+1.6,10,.5,3,concrete);box(bx,3.2,bz+d/2+1.4,10,.25,3.6,darkmetal);
for(let j=0;j<2;j++){box(bx+range(-w*.23,w*.23),top+1.3,bz+range(-d*.22,d*.22),range(2,5),2,range(2,5),roofmat)}
for(const [m,b] of batches){const start=starts.get(m)||0;if(b.p.length/3>start)building.ranges.push({m:b.m,b,start,end:b.p.length/3});}building.solids=colliders.slice(solidStart);for(const solid of building.solids)solid.building=building;buildings.push(building);count++;batchRegion=baseRegion;
}
for(let t=-1;t<=1;t+=2){tree(x+t*37,z+36,.75);tree(x+t*37,z-36,.75)}
}
for(const sign of [-1,1])for(let i=-13;i<=13;i++){
 batchRegion=Math.floor(i/5)+','+Math.floor(sign*13/5);
 box(i*S,.19,sign*13.5*S,72,.38,3.2,grassmat);tree(i*S-22,sign*13.5*S,.75);tree(i*S+22,sign*13.5*S,.75);
 box(sign*13.5*S,.19,i*S,3.2,.38,72,grassmat);tree(sign*13.5*S,i*S-22,.75);tree(sign*13.5*S,i*S+22,.75);
}
batchRegion='global';
// Road paint and crossings are raised slightly to avoid depth flicker.
for(let i=-N;i<=N;i++){const a=i*S+S/2;box(a,.025,0,.15,.04,edge*2,markmat);box(a+.5,.025,0,.15,.04,edge*2,markmat);box(0,.03,a,edge*2,.04,.15,markmat);box(0,.03,a+.5,edge*2,.04,.15,markmat);for(let j=-N;j<=N;j++){const b=j*S;for(let k=-3;k<=3;k++){box(a+k*2.3,.04,b+44,1.15,.05,5,white);box(b+44,.04,a+k*2.3,5,.05,1.15,white)}for(let t=-1;t<=1;t+=2){box(a+t*6,.025,b, .16,.04,5,white);box(b,.025,a+t*6,5,.04,.16,white)}}}
// Waterfront follows the expanded northern land boundary.
const coastZ=-edge-47,railZ=-edge-91;
box(0,-.5,coastZ,edge*2,3,95,pavement);box(0,1,railZ,edge*2,1.6,1,concrete);for(let x=-edge+10;x<=edge-10;x+=14){box(x,2,railZ,.15,2,.15,darkmetal)}box(0,2.8,railZ,edge*2,.12,.12,darkmetal);
const water=new T.Mesh(new T.PlaneGeometry(12000,6000),new T.MeshStandardMaterial({color:'#5c8e9b',roughness:.32,metalness:.5}));water.rotation.x=-Math.PI/2;water.position.set(0,-2,railZ-3002);scene.add(water);
// Eastgrove is a continuous park in the new southeast neighborhood. Its raised
// landscaping covers internal road markings while perimeter roads remain open.
box(PARK.x,.38,PARK.z,PARK.width,.48,PARK.depth,pavement);
box(PARK.x,.65,PARK.z,PARK.width-8,.12,PARK.depth-8,grassmat);
box(PARK.x,.74,PARK.z,8,.10,PARK.depth-8,pavement);
box(PARK.x,.74,PARK.z,PARK.width-8,.10,8,pavement);
const pool=mat('#638e91',.24,.4);box(PARK.x,.85,PARK.z,27,.6,27,concrete);box(PARK.x,1.2,PARK.z,24,.12,24,pool);addGeometry(cylinder,white,PARK.x,2.3,PARK.z,2,3,2);addGeometry(cylinder,concrete,PARK.x,3.7,PARK.z,5,.5,5);
for(let x=-1;x<=1;x++)for(let z=-2;z<=2;z++){const bx=PARK.x+x*55+13,bz=PARK.z+z*55+14;box(bx,1.3,bz,4,.3,1.3,bark);box(bx,1.75,bz+.5,4,.7,.2,bark);box(bx-1.5,.9,bz,.2,.7,1,darkmetal);box(bx+1.5,.9,bz,.2,.7,1,darkmetal);}
const lampGlow=new T.MeshStandardMaterial({color:'#f8e8c2',emissive:'#ffe0a1',emissiveIntensity:.5});
for(let ix=-N;ix<=N;ix++)for(let iz=-N;iz<=N;iz++){if(isParkBlock(ix,iz))continue;const x=ix*S+42,z=iz*S+35;addGeometry(cylinder,darkmetal,x,4.2,z,.13,8.4,.13);box(x+1.2,8.35,z,2.6,.16,.25,darkmetal);box(x+2.3,8.2,z,1.3,.12,.7,lampGlow)}
// Full architectural geometry stays visible throughout the city.
const cityInk=new T.LineBasicMaterial({color:'#1c2948',transparent:true,opacity:.14});
for(const b of batches.values()){const m=b.m;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.computeBoundingSphere();b.geometry=g;const mesh=new T.Mesh(g,m);mesh.matrixAutoUpdate=false;mesh.castShadow=m!==roadmat&&m!==pavement&&m!==grassmat&&m!==markmat;mesh.receiveShadow=true;scene.add(mesh);if(b.region!=='global')renderDistricts.push({mesh,lod:b.region.endsWith(':buildings')?districtLods.get(b.region.split(':')[0]):null,center:g.boundingSphere.center.clone(),radius:g.boundingSphere.radius,shadow:mesh.castShadow});}for(const b of batches.values()){b.p=b.n=b.uv=null;}batches.clear();
const forest=createForest(scene,treeSpecs,mobile);
const boostEffect=createBoostEffect(scene),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;const flightCamera=createFlightCamera();let punches=null,heatVision=null,grabs=null,combat=null,multiplayer=null,lockOn=null,practiceDummy=null,heroClash=null;const defense=createDefense(),health=createHealth({onKO(){hero.impact({closing:25,impulse:new T.Vector3(4,2,3),point:player.clone().add(new T.Vector3(0,1.5,0)),normal:new T.Vector3(0,0,1)});}});let healthHUD=null;const carryDamage=createHealth();let carryHitId=0,lastCarry=null;let combatReaction=null,heroGrapple=null;let heldPose=null,heldAnchor=null,flightPunchCooldown=0;let boostEngaged=false,bank=0;
const airRecovery=createAirRecovery(),groundRecovery=createGroundRecovery();let groundRecoveryPose={phase:"none",progress:0,grounded:false};const hero=createHero(mat);const avatar=hero.root;scene.add(avatar);const defenseFX=createDefenseFX(scene,hero);
const jumpHold=new JumpHold(),weather=createWind();let levitating=false,hoverAfterHold=false,flightMode='normal';let groundPress=false,pendingJump=null,jumpCharge=0,flightRecovery=0,impactSkid=0,impactCarry=0;const impactNormal=new T.Vector3();
const player=new T.Vector3(0,.75,171),velocity=new T.Vector3();let yaw=0,movementYaw=0,wasMoving=false,lastLook=-Infinity,pitch=.16,viewYaw=0,viewPitch=.16,fly=false,grounded=true,vertical=0,lastJump=-1000,groundMode='walk',joyX=0,joyY=0;const keys=new Set();let lastTime=performance.now(),elapsed=0,quality=0;
function toggleFlight(){if(health.dead||groundRecovery.locked||defense.busy||combatReaction)return;pendingJump=null;hoverAfterHold=false;fly=!fly;if(fly){airRecovery.reset();groundRecovery.reset();groundRecoveryPose={phase:"none",progress:0,grounded:false};hero.resetCollision();velocity.y=vertical;flightRecovery=grounded?0:1.15;if(grounded)player.y+=.3;grounded=false}else{vertical=velocity.y;grounded=false;}$('jump').querySelector('span').textContent=fly?'FLY':'JUMP';$('mode').textContent=fly?'IN FLIGHT':'ON FOOT';updateSpeedControl()}
function jump(charge=0,heldSeconds=0){if(health.dead||groundRecovery.locked||defense.busy||combatReaction)return;const now=performance.now();if(charge===0&&(fly||!grounded||now-lastJump<330)){toggleFlight();lastJump=-1000}else{if(!fly&&grounded)pendingJump={remaining:Math.max(0,.13-heldSeconds),charge};lastJump=charge>0?-1000:now;}}
function beginJump(){if(health.dead||jumpHold.down||groundRecovery.locked||defense.busy||combatReaction)return;groundPress=!fly&&grounded;pendingJump=null;jumpHold.press(performance.now());}
function endJump(){if(!jumpHold.down)return;const now=performance.now(),held=(now-jumpHold.started)/1000,onGround=groundPress,tap=jumpHold.release(now);groundPress=false;if(onGround){if(grounded&&!fly)jump(held<.26?0:chargeAmount(held),held);}else if(tap)jump();levitating=false;}
function cancelJump(){jumpHold.cancel();groundPress=false;pendingJump=null;jumpCharge=0;levitating=false;}
function reset(){desktopSpeed.reset();health.reset();heatVision?.reset();airRecovery.reset();lockOn?.clear();practiceDummy?.reset();heroGrapple?.cancel();defense.reset();defenseFX.reset();combatReaction=null;combat?.reset();grabs?.reset();heatVision?.stop();punches?.reset();hero.resetCollision();groundRecovery.reset();groundRecoveryPose={phase:"none",progress:0,grounded:false};flightRecovery=impactSkid=impactCarry=0;cancelJump();levitating=hoverAfterHold=false;flightMode='normal';player.set(0,.75,171);velocity.set(0,0,0);yaw=0;movementYaw=0;wasMoving=false;lastLook=performance.now();pitch=.16;viewYaw=0;viewPitch=.16;vertical=0;setGroundMode('walk');fly=false;grounded=true;placeSpawn();}
function placeSpawn(){
 const scale=hero.character.height,width=hero.character.width/.74;
 collisionWorld.bodyRadius=.28*scale*width;
 hero.orientation.quaternion.identity();
 const offsets=collisionWorld.bodyOffsets(hero.orientation.quaternion,false,scale,width);
 // Intersections have clearance in every direction; test the entire body,
 // including extra space around the shoulders, before accepting a spawn.
 if(hero.character.id==='monolith'){
  const radius=collisionWorld.bodyRadius;
  let found=false;
  for(let ring=0;ring<=12&&!found;ring++)for(let ix=-ring;ix<=ring&&!found;ix++)for(let iz=-ring;iz<=ring&&!found;iz++){
   if(Math.max(Math.abs(ix),Math.abs(iz))!==ring)continue;
   const x=S/2+ix*S,z=S*1.5+iz*S;
   const candidate=new T.Vector3(x,groundHeight(x,z)+.02,z);
   collisionWorld.bodyRadius=radius*1.2;
   // Raising offsets by the clearance margin preserves ground contact.
   const padded=offsets.map(o=>o.clone().add(new T.Vector3(0,radius*.2,0)));
   if(!collisionWorld.bodyHit(candidate,padded)){player.copy(candidate);found=true;}
  }
  collisionWorld.bodyRadius=radius;
 }
 collisionWorld.recover(player,offsets);
 safePosition.copy(player);safeOrientation.copy(hero.orientation.quaternion);
 avatar.position.copy(player);updateSpeedControl();
}
$('reset-city').onclick=()=>multiplayer?multiplayer.resetCity():location.reload();
function setPaused(value){$('helpPanel').hidden=!value;document.body.classList.toggle('paused',value);$('help').setAttribute('aria-expanded',String(value));if(value){desktopLook?.release();clearInput();punches?.reset();$('pause-note').textContent=multiplayer?.connected?'Online match continues while this menu is open.':'Single-player paused.';}if(!value&&!document.body.classList.contains('in-menu'))desktopLook?.request();lastTime=performance.now();}
$('reset').onclick=()=>{reset();setPaused(false);};$('help').onclick=()=>setPaused($('helpPanel').hidden);$('closeHelp').onclick=$('resume-game').onclick=()=>setPaused(false);
for(const type of ['pointerdown','pointerup','pointermove','keydown','keyup'])$('helpPanel').addEventListener(type,e=>e.stopPropagation());
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!document.body.classList.contains('in-menu')){if(desktopLook?.locked)return;e.preventDefault();e.stopImmediatePropagation();setPaused($('helpPanel').hidden);}else if(!$('helpPanel').hidden&&!e.target.closest?.('#helpPanel,#multiplayer-panel')){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('keyup',e=>{if(!$('helpPanel').hidden&&!e.target.closest?.('#helpPanel,#multiplayer-panel'))e.stopImmediatePropagation();},true);
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();$('jump').setPointerCapture(e.pointerId);beginJump()});
$('jump').addEventListener('pointerup',e=>{e.preventDefault();endJump()});
for(const event of ['pointercancel','lostpointercapture'])$('jump').addEventListener(event,()=>{if(jumpHold.down)cancelJump()});
$('jump').onclick=e=>{if(e.detail===0)jump()};
function updateSpeedControl(){const button=$('fast');const airborne=airborneControl(grounded,fly);button.dataset.mode=airborne?flightMode:groundMode;button.removeAttribute('aria-pressed');button.textContent=airborne?flightMode.toUpperCase():groundLabel(groundMode);button.setAttribute('aria-label',airborne?flightMode+' flight; tap for '+nextFlightMode(flightMode)+' flight':groundLabel(groundMode)+'; tap for '+groundLabel(nextGroundMode(groundMode)));}
function setGroundMode(mode){groundMode=mode;updateSpeedControl();}
function syncDesktopSpeed(now=performance.now()){if(mobile)return;const nextFlight=desktopSpeed.mode(now),nextGround=desktopSpeed.fast(now)?'sprint':'walk';if(flightMode===nextFlight&&groundMode===nextGround)return;flightMode=nextFlight;groundMode=nextGround;updateSpeedControl();}
function cycleSpeed(){if(airborneControl(grounded,fly)){flightMode=nextFlightMode(flightMode);updateSpeedControl();}else setGroundMode(nextGroundMode(groundMode));}
$('fast').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();cycleSpeed()});
$('fast').onclick=e=>{if(e.detail===0)cycleSpeed()};
const joy=$('joystick'),stick=$('stick');let joyId=null;function joystick(e){const r=joy.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2),y=(e.clientY-r.top-r.height/2);const max=r.width*.34,d=Math.hypot(x,y);if(d>max){x*=max/d;y*=max/d}joyX=x/max;joyY=-y/max;stick.style.transform=`translate(${x*joy.offsetWidth/r.width}px,${y*joy.offsetHeight/r.height}px)`}joy.onpointerdown=e=>{e.preventDefault();joyId=e.pointerId;joy.setPointerCapture(joyId);joystick(e)};joy.onpointermove=e=>{if(e.pointerId===joyId)joystick(e)};joy.onpointerup=joy.onpointercancel=()=>{joyId=null;joyX=joyY=0;stick.style.transform=''};
let viewportInputScale=1,lookId=null,lx=0,ly=0;const canvas=$('world');
function aimLockPoint(){return grabs?.carrying||desktopLook?.freeLooking?null:lockOn.point();}
function turnCamera(dx,dy,scale=1){const turn=dx*.0075*scale;yaw-=turn;movementYaw-=turn;lastLook=performance.now();pitch=T.MathUtils.clamp(pitch+dy*.004*scale,-Math.PI/2,Math.PI/2);}
desktopLook=createDesktopLook({canvas,enabled:!mobile,isPlaying:()=>!document.body.classList.contains('in-menu')&&$('helpPanel').hidden,onMove:(dx,dy)=>turnCamera(dx,dy),onRelease:()=>setPaused(true),onError:message=>{setPaused(true);$('pause-note').textContent=message;}});
canvas.onpointerdown=e=>{if(!mobile){if(!document.body.classList.contains('in-menu')&&$('helpPanel').hidden)desktopLook.request();return;}if(lookId!==null)return;lookId=e.pointerId;lastLook=performance.now();lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(!mobile||e.pointerId!==lookId)return;turnCamera(e.clientX-lx,e.clientY-ly,viewportInputScale);lx=e.clientX;ly=e.clientY};
canvas.onpointerup=canvas.onpointercancel=e=>{if(e.pointerId===lookId){lookId=null;lastLook=performance.now();}};
if(!mobile){$('hint').textContent='WASD to move · Move trackpad to look · Esc to pause';const guide=document.createElement('div');guide.id='keyboard-guide';guide.textContent='WASD Move · J / K / L Punch · Hold trackpad click: Free look · SHIFT Hold: Fast / Tap: Cruise · ESC Pause';document.body.append(guide);
 const shortcuts={'lock-on':['TAB','Lock on'],'heat':['R','Hold for heat vision'],'grab':['E','Grab / throw'],'punch-quick':['J','Quick punch'],'punch-normal':['K','Normal punch'],'punch-serious':['L','Serious punch'],'block':['F','Hold to block'],'parry':['Q','Parry'],'jump':['SPACE','Jump / fly; hold to charge / rise']};
 for(const [id,[key,action]]of Object.entries(shortcuts)){const button=$(id),badge=document.createElement('kbd');badge.textContent=key;button.append(badge);button.setAttribute('aria-label',action+'. Keyboard '+key);button.title=action+' · '+key;}
 $('lock-on').querySelector('small').textContent='TOGGLE';$('grab').querySelector('small').textContent='GRAB / THROW';$('block').querySelector('small').textContent='HOLD';
}
addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Space'&&!e.repeat)beginJump();if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!e.repeat){e.preventDefault();if(mobile)cycleSpeed();else desktopSpeed.press(e.code,performance.now());}keys.add(e.code)});addEventListener('keyup',e=>{keys.delete(e.code);if(!mobile&&(e.code==='ShiftLeft'||e.code==='ShiftRight')){desktopSpeed.release(e.code,performance.now());syncDesktopSpeed();}if(e.code==='Space'){endJump();}});function clearInput(){desktopSpeed.cancel();syncDesktopSpeed();lockOn?.clear();heroGrapple?.cancel();defense.hold(false);defenseFX.reset();grabs?.reset();heatVision?.stop();cancelJump();wasMoving=false;lastLook=performance.now();keys.clear();joyX=joyY=0;lookId=null;stick.style.transform=''}addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();lastTime=performance.now()});
const adaptiveQuality=createAdaptiveQuality(graphics.maxRatio,graphics.minRatio,mobile?{}:{windowMs:1000,slowMs:21,drop:.15});
function qualitySet(q){quality=q;adaptiveQuality.reset();camera.far=6120;camera.updateProjectionMatrix();sky.scale.setScalar(camera.far*.95/6800);const labels=['Auto','High','Smooth'];$('quality').textContent='Quality: '+labels[q];renderer.setPixelRatio(q===2?Math.min(devicePixelRatio,1):q===1?Math.min(devicePixelRatio,2):graphics.maxRatio);renderer.shadowMap.enabled=q!==2;const shadowSize=q===1?2048:graphics.shadowSize;if(sunlight.shadow.mapSize.x!==shadowSize){sunlight.shadow.map?.dispose();sunlight.shadow.map=null;sunlight.shadow.mapSize.set(shadowSize,shadowSize);}renderer.shadowMap.needsUpdate=true;resizeViewport()}$('quality').onclick=()=>qualitySet((quality+1)%3);
let groundDamage=null;
function baseGroundHeight(x,z){const residential=residentialSurface(x,z);if(residential)return residential.height;if(Math.abs(x-PARK.x)<PARK.width/2&&Math.abs(z-PARK.z)<PARK.depth/2)return .80;if(z<-edge+.5)return 1;const dx=Math.abs(x-Math.round(x/S)*S),dz=Math.abs(z-Math.round(z/S)*S);return dx<=43&&dz<=43?.455:0;}
function groundHeight(x,z){return groundDamage?groundDamage.field.height(x,z):baseGroundHeight(x,z);}
// Terrain collision comes from the same height field used by the damaged mesh.
for(const s of colliders)if(!s.building&&s.y2<=1.25)s.disabled=true;
const collisionWorld=new CollisionWorld([...colliders,...forest.solids],groundHeight);
collisionWorld.setArenaBounds({minX:-edge+3,maxX:edge-3,minZ:-edge-80,maxZ:edge-3,minY:-64,maxY:900});
const destruction=createDestruction(scene,collisionWorld,{concrete,roofmat,mobile,camera,audio});
const cityLife=createCityLife(scene,mat,mobile,collisionWorld,{onProjectileContact({actor,person,velocity,start,end,attacker}){
 const delta=end.clone().sub(start),distance=delta.length();if(distance<.001||!combat)return null;
 const direction=delta.divideScalar(distance),target=combat.trace(start,direction,distance,person?.4:1.2,attacker);
 if(!target)return null;return {...combat.hit(target.id,{kind:'projectile',attacker,direction,velocity:velocity.clone(),redirect(){}}),defender:target.id};
},onThrowImpact({point,velocity,person,ground,explosion,solid}){
 const speed=velocity.length(),direction=velocity.clone().normalize();
 if(solid?.building&&speed>25)destruction.punch(solid.building,point,direction,person?'quick':'normal');
 if(ground&&speed>25)groundDamage?.punch(point,person?'quick':'normal');
 destruction.burst(point,velocity.clone().multiplyScalar(.2),explosion?28:12,explosion?5:2);
 if(explosion){destruction.plume(point,100,velocity);audio.punch('normal');}
}});setGroundMode('walk');
groundDamage=createGroundDamage(scene,baseGroundHeight,[roadmat,pavement,markmat,grassmat,white,concrete,curbmat],{mobile,emit:destruction.burst,affect:cityLife.shock});
combat=createCombat({onHeroImpact:(point,direction,kind,blocked)=>{defenseFX.impact(point,direction,kind,blocked);multiplayer?.impact(point,direction,kind,blocked);},onParry:(point,direction)=>{audio.parry();defenseFX.impact(point,direction,'quick',true);}});
combat.register({id:'player',type:'hero',health,active:()=>!health.dead,position:()=>player,height:()=>2.2*hero.character.height,radius:()=>.6*hero.character.height,defense,onHit(result){
 if(result.damageBlocked&&result.distance===0&&!result.velocity)return;
 if(airRecovery.active&&!grounded){airRecovery.start();combatReaction??={mode:'launch',blocked:false,age:0,duration:Infinity};}
 punches?.state.cancel();heatVision?.stop();grabs?.reset();cancelJump();
 if(result.distance>0||result.velocity){
  const slide=result.mode==='slide'&&grounded,launch=result.velocity||launchForRange(result.distance,result.direction,24);
  if(slide){const deceleration=18,slideVelocity=new T.Vector3(result.direction.x,0,result.direction.z).normalize().multiplyScalar(Math.sqrt(2*deceleration*result.distance)).add(result.momentum||new T.Vector3()).setY(0),speed=Math.min(MAX_LAUNCH_SPEED,slideVelocity.length()),dir=slideVelocity.normalize();combatReaction={mode:'slide',blocked:true,age:0,duration:speed/deceleration,speed,deceleration,dir};velocity.copy(dir).multiplyScalar(speed);vertical=0;}
  else{airRecovery.start();combatReaction={mode:'launch',blocked:result.blocking,age:0,duration:Math.max(.5,2*Math.max(0,launch.y)/24+.35)};velocity.copy(launch);vertical=launch.y;grounded=false;fly=false;}
  hero.resetCollision();groundRecovery.reset();groundRecoveryPose={phase:'none',progress:0,grounded:false};updateSpeedControl();
 }
}});
// Shared hit receiver is also the registration point for future opponents.
window.cityCombat=combat;

lockOn=createLockOn({combat,camera,player,button:$('lock-on'),dot:$('lock-dot'),reticle:()=>new T.Vector2(0,1-2*(heatVision?.reticleTop??36.5)/100),visible:p=>cameraFraction(player.clone().add(new T.Vector3(0,1.5,0)),p)>.98});
function toggleLock(){if(document.body.classList.contains('in-menu')||!$('helpPanel').hidden)return;lockOn.toggle();}
$('lock-on').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();toggleLock();});
addEventListener('keydown',e=>{if(e.code===actionKeys.lock){e.preventDefault();if(!e.repeat)toggleLock();}});
$('practice-reset').onclick=()=>{grabs.reset();lockOn.clear();const p=player.clone().add(new T.Vector3(-Math.sin(viewYaw)*10,0,-Math.cos(viewYaw)*10));practiceDummy?.reset(p);setPaused(false);};
grabs=createGrab(scene,{life:cityLife,hero,isFlying:()=>fly,aimAt:origin=>heatVision.aimAt(origin),combat,network:{acquireGrab:(id,mode)=>{if(id==='practice-dummy'){return practiceDummy?.acquire(mode);}return heroGrapple?.request(id,mode);},releaseGrab:(target,v)=>target.id==='practice-dummy'?practiceDummy?.release(v):heroGrapple?.release(target,v)}});
punches=createPunches(scene,{buildings,destruction,groundDamage,cityLife,groundHeight,camera,audio,hero,combat,getVelocity:()=>new T.Vector3(velocity.x,fly?velocity.y:vertical,velocity.z),onPunchThrown:()=>grabs.countPunch(),targetPoint:()=>aimLockPoint()});
const sonicWake=createSonicWake(scene,(point,radius,dir)=>{destruction.shockwave(point,radius);groundDamage.shockwave(point,radius);cityLife.shock(point,radius,18,dir.multiplyScalar(70));forest.damage(point,radius);});
heatVision=createHeatVision(scene,{camera,hero,destruction,cityLife,groundHeight,collisionWorld,combat,inCombat:()=>health.inCombat||[...combat.actors].some(([id,a])=>id!=='player'&&a.active?.()!==false&&a.position().distanceToSquared(player)<150*150),targetPoint:()=>aimLockPoint()});
const heatButton=$('heat');let heatPointer=null;
heatButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(health.dead||heatPointer!==null||grabs.active||defense.busy||combatReaction)return;heatPointer=e.pointerId;heatButton.setPointerCapture(e.pointerId);heatVision.held=true;heatButton.setAttribute('aria-pressed','true');});
function releaseHeat(e){if(e&&e.pointerId!==heatPointer)return;heatPointer=null;heatVision.stop();heatButton.setAttribute('aria-pressed','false');}
for(const event of ['pointerup','pointercancel','lostpointercapture'])heatButton.addEventListener(event,releaseHeat);
addEventListener('keydown',e=>{if(!health.dead&&e.code===actionKeys.heat&&!e.repeat&&!grabs.active&&!defense.busy&&!combatReaction){e.preventDefault();heatVision.held=true;}});addEventListener('keyup',e=>{if(e.code===actionKeys.heat)releaseHeat();});addEventListener('blur',()=>releaseHeat());document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseHeat();});$('help').addEventListener('click',()=>releaseHeat());
function punchPress(kind){if(health.dead||groundRecovery.locked||grabs.active||defense.busy||combatReaction)return;const dir=new T.Vector3(-Math.sin(viewYaw)*Math.cos(viewPitch),-Math.sin(viewPitch),-Math.cos(viewYaw)*Math.cos(viewPitch));punches.state.press(kind,dir);}
for(const kind of Object.keys(PUNCHES))$('punch-'+kind).addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();punchPress(kind);});
addEventListener('keydown',e=>{const kind=(mobile?{Digit1:'quick',Digit2:'normal',Digit3:'serious'}:{KeyJ:'quick',KeyK:'normal',KeyL:'serious'})[e.code];if(kind&&!e.repeat){e.preventDefault();punchPress(kind);}});
function floorAt(x,z,y){return collisionWorld.floorAt(x,z,y,true)}
function cameraFraction(start,end){return collisionWorld.cameraFraction(start,end)}
const safePosition=player.clone(),safeOrientation=hero.orientation.quaternion.clone();
function grabPress(){if(health.dead||defense.busy||combatReaction||groundRecovery.locked||document.body.classList.contains('in-menu')||!$('helpPanel').hidden)return;releaseHeat();if(grabs.press())punches.reset();}
$('grab').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();grabPress();});
addEventListener('keydown',e=>{if(e.code===actionKeys.grab&&!e.repeat){e.preventDefault();grabPress();}});
function defenseAllowed(){return !health.dead&&!document.body.classList.contains('in-menu')&&$('helpPanel').hidden&&!groundRecovery.locked&&!combatReaction;}
function cancelForDefense(){punches.state.cancel();releaseHeat();grabs.reset();cancelJump();}
let blockPointer=null;
function blockRelease(){blockPointer=null;defense.hold(false);$('block').setAttribute('aria-pressed','false');}
$('block').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(!defenseAllowed()||defense.locked)return;blockPointer=e.pointerId;$('block').setPointerCapture(e.pointerId);cancelForDefense();defense.hold(true);$('block').setAttribute('aria-pressed','true');});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('block').addEventListener(event,e=>{if(e.pointerId===blockPointer)blockRelease();});
function parryPress(){if(!defenseAllowed()||!defense.parry())return;cancelForDefense();audio.parry();}
$('parry').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();parryPress();});
addEventListener('keydown',e=>{if(e.repeat)return;if(e.code==='KeyQ'){e.preventDefault();parryPress();}if(e.code==='KeyF'&&defenseAllowed()&&!defense.locked){e.preventDefault();cancelForDefense();defense.hold(true);}});
addEventListener('keyup',e=>{if(e.code==='KeyF')blockRelease();});addEventListener('blur',blockRelease);document.addEventListener('visibilitychange',()=>{if(document.hidden)blockRelease();});$('help').addEventListener('click',blockRelease);
const target=new T.Vector3(),desired=new T.Vector3(),previousCameraRotation=new T.Quaternion();camera.position.set(0,6,183);let shadowTick=0;const stats={buildingCount:count,houseCount,urbanBuildingCount:count-houseCount,cityWidthMeters:edge*2,landAreaSquareMeters:(edge*2)**2};window.cityState=()=>({...stats,health:health.value,multiplayer:multiplayer?.stats,heroClash:heroClash?.stats,opponent:practiceDummy?.state,damageStage:hero.damageStage,tacklePunches:grabs?.tacklePunches,audio:audio.stats,defense:{phase:defense.phase,cooldown:defense.cooldown,blocking:defense.blocking,stun:defense.stun,reaction:combatReaction?.mode||null,...defenseFX.stats},renderDistance:camera.far,...cityLife.stats,punches:{...punches.stats,active:punches.state.current?.kind||null},heatVision:{...heatVision.stats,active:heatVision.active},destruction:destruction.stats,groundDamage:groundDamage.stats,groundMode,groundSpeed:GROUND_SPEEDS[groundMode],sprinting:grounded&&groundMode==='sprint',bodyResponse:hero.collisionFeedback,recoveryPhase:groundRecoveryPose.phase,airRecovery:{active:airRecovery.active,ready:airRecovery.ready,remaining:airRecovery.remaining},position:player.toArray(),flying:fly,flightMode,flightSpeed:FLIGHT_SPEEDS[flightMode],levitating,wind:weather.value.toArray(),tallestBuilding,highWindAltitude:tallestBuilding+20,pixelRatio:renderer.getPixelRatio(),renderCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'return_to_downtown',description:'Return the player to the downtown starting point.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('No arguments expected');reset();return {position:player.toArray(),flying:fly}}})).catch(()=>{})}catch{}}
const frameProfile=createFrameProfiler();
for(const [object,methods,label] of [[destruction,['update','hit','heat','punch','punchFalling','prepareNearby'],'destruction'],[cityLife,['update','shock'],'crowds'],[sonicWake,['update'],'wake'],[groundDamage,['update','punch'],'terrain'],[hero,['update'],'hero'],[heatVision,['update'],'heat'],[punches,['update'],'punches'],[renderer,['render'],'render'],[forest,['update'],'trees'],[collisionWorld,['moveAxis','recover','cameraFraction'],'collision']])frameProfile.wrap(object,methods,label);
window.performanceReport=()=>({...frameProfile.snapshot(),game:window.cityState()});
$('performance-report').onclick=()=>{const report=window.performanceReport(),round=n=>n.toFixed(2);$('performance-output').textContent='Average FPS: '+round(1000/Math.max(.001,report.frame.averageMs))+'\nRecent frame times: average '+round(report.frame.averageMs)+' ms; 95th percentile '+round(report.frame.p95Ms)+' ms; worst '+round(report.frame.maxMs)+' ms\n'+Object.entries(report.sections).sort((a,b)=>b[1].maxMs-a[1].maxMs).map(([name,s])=>name+': avg '+round(s.averageMs)+' / worst '+round(s.maxMs)+' ms').join('\n')+'\nDestruction: collider work '+round(report.game.destruction.colliderPeakMs||0)+' ms peak; mesh rebuild '+round(report.game.destruction.rebuildPeakMs||0)+' ms; nearby section hitboxes '+(report.game.destruction.heroColliders||0)+'\nRoad tiles pending: '+(report.game.groundDamage.pendingTiles||0)+'; resolution scale: '+report.game.pixelRatio+'; draw calls: '+report.game.renderCalls+'; triangles: '+report.game.triangles+'\nCPU measurements; sections overlap. GPU time is not measured.';$('performance-output').hidden=false;};
$('loading').style.display='none';setTimeout(()=>$('hint').style.opacity='0',14000);
let spawnedCharacter=null;
const mainMenu=createMainMenu({hero,onOpen(){desktopLook?.release();audio.stopMusic();clearInput();punches.reset();setPaused(false);},onPlay(){if(multiplayer&&!multiplayer.ready)return false;if(spawnedCharacter!==hero.character.id){reset();spawnedCharacter=hero.character.id;}audio.startMusic();clearInput();desktopLook?.request();lastTime=performance.now();}});
heroClash=createHeroClash(scene,{destruction,groundDamage,cityLife,forest,combat,audio,camera,localId:()=>multiplayer?.id||'player',emit:e=>multiplayer.emit('clash',e)});
heroGrapple=createHeroGrapple({send:e=>multiplayer?.emit('grab',e),peer:id=>multiplayer?.peer(id),
 canGrab:(p,mode)=>!health.dead&&!mainMenu.active&&!groundRecovery.locked&&(mode==='tackle'?!grounded&&p.flying&&p.fast&&p.velocity.length()>FLIGHT_SPEEDS.fast*.8&&p.position.distanceTo(player)<Math.min(24,6+p.velocity.length()*.12):p.position.distanceTo(player)<9),
 receiveGrab:(sender,p,mode)=>combat.hit('player',{kind:mode==='tackle'?'tackle':'grab',attacker:sender,direction:player.clone().sub(p.position).normalize()}),
 hold(p,mode,by){airRecovery.reset();heldPose={by,mode,direction:p.direction.toArray(),moving:p.flightCarry,age:p.grabAge};heldAnchor=p.anchor(mode);defense.stagger(.12);combatReaction={mode:'held',age:0,duration:.3};fly=false;grounded=false;velocity.set(0,0,0);vertical=0;player.copy(heldAnchor).add(new T.Vector3(0,-1.65*hero.character.height,0));player.y=Math.max(player.y,groundHeight(player.x,player.z));hero.resetCollision();groundRecovery.reset();groundRecoveryPose={phase:'none',progress:0,grounded:false};},
 release(v){airRecovery.reset();heldPose=null;heldAnchor=null;combatReaction=null;defense.reset();grounded=false;if(v&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=MAX_LAUNCH_SPEED)){combat.hit('player',{kind:'projectile',attacker:'grapple',direction:new T.Vector3().fromArray(v).normalize(),velocity:new T.Vector3().fromArray(v)});}else{velocity.set(0,0,0);vertical=0;}}});
multiplayer=createMultiplayer({onClash:(e,sender)=>heroClash.apply(e,sender),onGrab:(e,sender)=>heroGrapple.receive(e,sender),scene,mat,combat,buildings,destruction,groundDamage,groundHeight,camera,collisionWorld,onPause(){if(!mainMenu.active)setPaused(true);},getState(){const punch=punches.state.current;return {health:health.value,held:heldPose,grab:grabs.pose,p:player.toArray(),v:[velocity.x,fly?velocity.y:vertical,velocity.z],character:hero.character.id,active:!mainMenu.active,pose:{controlledFlight:fly&&!grounded&&!heldPose&&!health.dead&&!defense.busy&&!grabs.active&&!combatReaction&&!airRecovery.active&&!groundRecovery.locked,flying:fly,levitating:levitating||flightMode==='slow'&&fly,moving:velocity.length()>1,boost:fly?flightMode==='fast':groundMode==='sprint',grounded,yaw:viewYaw,pitch:viewPitch,bank,groundMode},defense:{phase:defense.phase,age:defense.age,blocking:defense.blocking||!!combatReaction?.blocked,stun:defense.stun},punch:punch?{kind:punch.kind,variant:punch.variant,age:punch.age,direction:punch.direction.toArray()}:null,heat:heatVision.active?heatVision.aim().toArray():null};}});
const menuButton=document.createElement('button');menuButton.textContent='Characters';menuButton.onclick=()=>mainMenu.open();document.querySelector('#pause-options').append(menuButton);
// Multiplayer sessions never construct or register a training actor.
if(!multiplayer.connected){
 practiceDummy=createPracticeDummy(scene,combat,groundHeight,{world:collisionWorld,material:mat,destruction,groundDamage,arena:{buildings,cityLife,audio},getOpponent:()=>({position:player,velocity:new T.Vector3(velocity.x,fly?velocity.y:vertical,velocity.z),flying:fly,height:hero.character.height,alive:!health.dead&&!mainMenu.active,attacking:!!punches.state.current||heatVision.active})});
 const fightButton=document.createElement('button');fightButton.id='combat-ai';fightButton.textContent='Combat: OFF';fightButton.setAttribute('aria-pressed','false');$('pause-options').append(fightButton);
 fightButton.onclick=()=>{const next=!practiceDummy.fighting;grabs.reset();lockOn.clear();practiceDummy.setCombat(next);const p=player.clone().add(new T.Vector3(-Math.sin(viewYaw)*18,0,-Math.cos(viewYaw)*18));practiceDummy.reset(p);health.reset();fightButton.textContent=next?'Combat: ON':'Combat: OFF';fightButton.setAttribute('aria-pressed',String(next));$('training-controls').querySelector('p').textContent=next?'Aggressive opponent · 1,000 health · Same damage and recovery rules.':'Same hero physics. No AI movement. Single-player only.';if(next)setPaused(false);};
 const select=$('dummy-character');for(const c of CHARACTERS){const option=document.createElement('option');option.value=c.id;option.textContent=c.name;select.append(option);}
 select.onchange=()=>{grabs.reset();practiceDummy.setCharacter(select.value);};
 for(const event of ['keydown','keyup'])$('training-controls').addEventListener(event,e=>e.stopPropagation());
}else{$('training-controls').hidden=true;}
const hud={grab:$('grab'),grabTitle:$('grab').querySelector('b'),grabCaption:$('grab').querySelector('small'),mode:$('mode'),jump:$('jump').querySelector('span'),altitude:$('altitude'),reticle:$('heat-reticle')};
const punchHud=Object.keys(PUNCHES).map(kind=>({kind,button:$('punch-'+kind),caption:$('punch-'+kind).querySelector('small')}));
function hudText(node,value){if(node.textContent!==value)node.textContent=value;}
let titanCrushClock=0;
function frame(now){requestAnimationFrame(frame);if(!mobile&&(quality===1||now-lastShadowUpdate>=1000/30)){renderer.shadowMap.needsUpdate=true;lastShadowUpdate=now;}const frameMs=now-lastTime;frameProfile.frame(frameMs);const dt=Math.min(frameMs/1000,.04);lastTime=now;if(!$('helpPanel').hidden&&!multiplayer.connected&&!mainMenu.active){cinematic.render(scene,camera,quality===1);return;}syncDesktopSpeed(now);multiplayer.update(dt,elapsed);heroGrapple.update();destruction.prepareNearby(dt,player,velocity,buildings);if(mainMenu.active){if(multiplayer.connected){destruction.update(dt,player);groundDamage.update(dt,player);}const enter=$('enter-city');enter.disabled=!multiplayer.ready;enter.firstChild.textContent=multiplayer.ready?'ENTER CITY ':'SYNCING CITY… ';multiplayer.flush();mainMenu.render(renderer,dt);return;}elapsed+=dt;carryDamage.update(dt);if(lastCarry!==grabs.confirmedTargetId){carryDamage.launch();lastCarry=grabs.confirmedTargetId;}if(health.update(dt))reset();if(health.dead){fly=false;grabs.reset();heroGrapple.cancel();heatVision.stop();punches.reset();cancelJump();}flightPunchCooldown=Math.max(0,flightPunchCooldown-dt);heroClash.update(dt);defense.update(dt);combat.update(dt);if(combatReaction){combatReaction.age+=dt;if((combatReaction.mode!=='launch'&&combatReaction.age>=combatReaction.duration)||(combatReaction.mode==='launch'&&combatReaction.age>.15&&grounded)){combatReaction=null;}}const ambientWind=weather.update(dt,elapsed,player.y,tallestBuilding);levitating=jumpHold.update(now)&&!groundPress;jumpCharge=groundPress&&jumpHold.down&&grounded?Math.max(.18,chargeAmount((now-jumpHold.started)/1000)):pendingJump?Math.max(.18,pendingJump.charge):0;if(levitating){if(!fly)toggleFlight();hoverAfterHold=true;lastJump=-1000;}groundDamage.update(dt,player);cityLife.update(dt,elapsed,player,new T.Vector3(velocity.x,fly?velocity.y:vertical,velocity.z));destruction.update(dt,player);
let mx=joyX+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),mz=joyY+(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),len=Math.hypot(mx,mz);if(health.dead||groundRecovery.active||defense.locked||combatReaction){mx=mz=len=0;}else if(defense.blocking){mx*=.35;mz*=.35;len*=.35;}if(len>1){mx/=len;mz/=len}if(!levitating&&len>.08)hoverAfterHold=false;const gentleHover=levitating||hoverAfterHold;const slowFlight=fly&&flightMode==='slow';const boost=(fly?flightMode==='fast':groundMode==='sprint')&&!gentleHover,speed=gentleHover?3:fly?FLIGHT_SPEEDS[flightMode]:hero.character.id==='monolith'?(groundMode==='sprint'?54:36):GROUND_SPEEDS[groundMode];// Keep held movement aimed in the same world direction while the camera catches up.
const hasMovement=len>.08;if(!hasMovement||!wasMoving)movementYaw=viewYaw;wasMoving=hasMovement;
const selectedPoint=lockOn.update(dt),lockedPoint=desktopLook.freeLooking?null:selectedPoint;const hitTracking=!!lockedPoint&&!grabs.carrying&&(!!combatReaction||airRecovery.active||groundRecovery.active||defense.stun>0);if(lockedPoint&&!grabs.carrying){const delta=lockedPoint.clone().sub(player).sub(new T.Vector3(0,1.65*hero.character.height,0));if(hitTracking){const angles=lockedHitAngles(delta,viewYaw,viewPitch,dt);yaw=angles.yaw;pitch=angles.pitch;}else{const angle=Math.atan2(-delta.x,-delta.z);yaw=viewYaw+Math.atan2(Math.sin(angle-viewYaw),Math.cos(angle-viewYaw));pitch=Math.atan2(-delta.y,Math.hypot(delta.x,delta.z));}movementYaw=yaw;}else if(!grabs.carrying)yaw=followYaw(yaw,velocity.x,velocity.z,dt,{manual:lookId!==null||!mobile,sinceLook:(now-lastLook)/1000,flying:fly});
const oldViewYaw=viewYaw;viewYaw=hitTracking?yaw:T.MathUtils.damp(viewYaw,yaw,14,dt);viewPitch=hitTracking?pitch:T.MathUtils.damp(viewPitch,pitch,14,dt);const aim=movementVector(mx,mz,movementYaw,viewPitch,fly&&!gentleHover,speed);if(gentleHover)aim.y=levitating?RISE_SPEED:0;
// Briefly let an impact separate the body from the wall before powered steering
// can push it back into the same surface.
if(fly&&impactCarry>.75){const into=aim.x*impactNormal.x+aim.y*impactNormal.y+aim.z*impactNormal.z;if(into<0){aim.x-=impactNormal.x*into;aim.y-=impactNormal.y*into;aim.z-=impactNormal.z*into;}}
const engaged=fly&&boost&&len>.08&&!defense.busy&&!combatReaction;if(engaged&&!boostEngaged&&boostEffect.age>.8){boostEffect.trigger(player,viewYaw,viewPitch);audio.boost();const center=player.clone().add(new T.Vector3(0,1.2,0));destruction.shockwave(center,20);groundDamage.shockwave(center,20);cityLife.shock(center,20,24,new T.Vector3(-Math.sin(viewYaw)*40,0,-Math.cos(viewYaw)*40));}boostEngaged=engaged;const impulse=boostEffect.update(dt);const normalResponse=gentleHover?7:responseRate(fly,len>.08,boost,boostEffect.age);const recoveryResponse=fly&&flightRecovery>0?recoveryRate(flightRecovery,normalResponse):normalResponse;const carryResponse=impactCarry>0?T.MathUtils.lerp(.3,recoveryResponse,(1-impactCarry/1.4)**2):recoveryResponse;const blend=1-Math.exp(-dt*(fly?carryResponse:normalResponse));impactCarry=Math.max(0,impactCarry-dt);flightRecovery=Math.max(0,flightRecovery-dt);impactSkid=Math.max(0,impactSkid-dt);bank=T.MathUtils.damp(bank,fly&&!reducedMotion?T.MathUtils.clamp(-(viewYaw-oldViewYaw)/Math.max(dt,.001)*.022,-.045,.045):0,6,dt);if(combatReaction){if(combatReaction.mode==='slide'){const v=Math.max(0,combatReaction.speed-combatReaction.deceleration*(combatReaction.age-dt*.5));velocity.copy(combatReaction.dir).multiplyScalar(v);}}else if(!fly&&(!grounded||impactSkid>0||groundRecovery.active)){const input=movementVector(mx,mz,movementYaw,0,false,1);coast(velocity,input.x,input.z,dt);if(grounded){const skidDrag=Math.exp(-.85*dt);velocity.x*=skidDrag;velocity.z*=skidDrag;}}else{velocity.x+=(aim.x-velocity.x)*blend;velocity.z+=(aim.z-velocity.z)*blend;}if(fly&&!combatReaction)velocity.y+=(aim.y-velocity.y)*blend;
// Crush the volume ahead before the body sweep reaches it; preserve arena walls.
const titanWalking=titanLocomotionSafe({character:hero.character,flying:fly,vertical,combat:!!combatReaction||airRecovery.active,dead:health.dead,held:heroGrapple.held});
titanCrushClock-=dt;
if(titanWalking&&len>.08&&titanCrushClock<=0){titanCrushClock=.25;const direction=new T.Vector3(velocity.x,0,velocity.z).normalize();
 for(const h of [6,22,40,56]){const point=player.clone().addScaledVector(direction,12);point.y+=h;const seen=new Set();
 for(const solid of collisionWorld.nearby(point.x,point.z,16,point.y,true)){const b=solid.building;if(!b||seen.has(b)||!collisionWorld.sphereSolid(point,18,solid))continue;seen.add(b);destruction.punch(b,point,direction,'serious',{origin:point.clone(),width:36,reach:72,spread:0,sphere:true});}}
}
// A slim capsule follows the flight pose; short sweeps stop fast dives tunnelling.
collisionWorld.ground=hero.character.id==='monolith'?groundDamage.titanField.height:groundHeight;
collisionWorld.bodyRadius=.28*hero.character.height*hero.character.width/.74;
let offsets=collisionWorld.bodyOffsets(hero.orientation.quaternion,fly||(!grounded&&!titanWalking),hero.character.height,hero.character.width/.74);
// Include the next frame's travel so no trunk or branch can stop the sweep.
if(titanWalking)forest.crushBody(player,offsets,collisionWorld.bodyRadius+Math.hypot(velocity.x,velocity.z)*dt+.1,collisionWorld);
function clearBodySpace(){
 const seen=new Set(),up=new T.Vector3(0,1,0);
 for(const o of offsets){const p=player.clone().add(o);for(const solid of collisionWorld.nearby(p.x,p.z,collisionWorld.bodyRadius,p.y,true)){
  const b=solid.building;if(!b||seen.has(b)||!collisionWorld.sphereSolid(p,collisionWorld.bodyRadius,solid))continue;seen.add(b);
  destruction.punch(b,player.clone().add(new T.Vector3(0,-.5,0)),up,'quick');
 }}return seen.size>0;
}
if(!heroGrapple.held&&collisionWorld.bodyHit(player,offsets)&&(fly||groundRecovery.active||combatReaction)){clearBodySpace();}
if(!heroGrapple.held&&!collisionWorld.recover(player,offsets)){player.copy(safePosition);hero.orientation.quaternion.copy(safeOrientation);offsets=collisionWorld.bodyOffsets(safeOrientation,fly||(!grounded&&!titanWalking),hero.character.height,hero.character.width/.74);collisionWorld.recover(player,offsets);}
const movementOrientation=hero.orientation.quaternion.clone();
if(pendingJump){pendingJump.remaining-=dt;if(!grounded||fly)pendingJump=null;else if(pendingJump.remaining<=0){groundDamage.jumpTakeoff(player,pendingJump.charge);vertical=jumpImpulse(pendingJump.charge);grounded=false;pendingJump=null;jumpCharge=0;}}
if(!fly)vertical-=24*dt;
const dy=fly?velocity.y:vertical;
let headOn=false;
if(fly&&!grounded&&!heldPose&&!health.dead&&!defense.busy&&!grabs.active&&!combatReaction&&!airRecovery.active&&!groundRecovery.locked){
 for(const [id]of combat.actors){if(id==='player'||!heroClash.available(id))continue;const npc=id==='practice-dummy'?practiceDummy:null,other=npc?{...npc.state,position:npc.root.position,velocity:new T.Vector3().fromArray(npc.state.velocity),height:npc.hero.character.height}:multiplayer.peer(id);const contact=headOnContact(player,velocity,other,dt,hero.character.height);if(!contact)continue;
  if(collisionWorld.cameraFraction(player.clone().add(new T.Vector3(0,1.2*hero.character.height,0)),contact)<.98)continue;
  headOn=heroClash.collide(id,contact,velocity,other.velocity);if(headOn)break;
 }
}
if(!headOn&&fly&&velocity.length()>12&&!defense.busy&&!grabs.active&&!combatReaction){const dir=velocity.clone().normalize(),origin=player.clone().add(new T.Vector3(0,1,0)),hit=combat.trace(origin,dir,velocity.length()*dt+1,.7,'player');
 if(hit){const airborne=hit.id==='practice-dummy'?practiceDummy?.airborne:multiplayer.peer(hit.id)?.airborne;
  if(boost&&len>.08&&velocity.length()>=FLIGHT_SPEEDS.fast*.8&&grabs.tacklePunches>0){if(flightPunchCooldown<=0){flightPunchCooldown=PUNCHES.normal.cooldown;combat.hit(hit.id,{id:'flight-normal-'+elapsed,kind:'normal',punch:true,attacker:'player',direction:dir,momentum:velocity.clone()});audio.punch('normal');}}
  else if(boost&&len>.08&&velocity.length()>=FLIGHT_SPEEDS.fast*.8&&airborne){if(grabs.startTackle(hit.id,velocity)){punches.reset();releaseHeat();}}
  else if(flightPunchCooldown<=0){flightPunchCooldown=.75;combat.hit(hit.id,{id:'flight-'+Math.floor(elapsed*5),kind:'flight',attacker:'player',direction:dir,velocity:velocity.clone(),redirect(direction){velocity.copy(direction).multiplyScalar(Math.max(30,velocity.length()));vertical=velocity.y;impactCarry=1.4;impactNormal.copy(direction);}});}
 }}
const steps=heroGrapple.held?0:Math.max(1,Math.ceil(Math.max(Math.abs(velocity.x),Math.abs(dy),Math.abs(velocity.z))*dt/.18));let supported=false;
function respondToContact(axis){
 if(airRecovery.ready&&!fly)combatReaction={mode:'launch',blocked:false,age:0,duration:Infinity};
 airRecovery.interrupt();
 const contact=collisionWorld.lastContact;

 // Walking mass is not a combat impact. This also covers brief unsupported
 // moments over craters, scenery, vehicles and the arena boundary.
 if(titanWalking&&contact){
  if(contact.solid?.building){const point=player.clone().add(contact.offset);destruction.punch(contact.solid.building,point,new T.Vector3(velocity.x,0,velocity.z).normalize(),'normal');}
  if(contact.normal.y>.55||axis==='y'&&vertical<0){supported=true;vertical=velocity.y=0;}
  else velocity[axis]=0;
  return;
 }
 if(!contact){if(axis==='y'){if(!fly&&vertical<0)supported=true;vertical=velocity.y=0;}else velocity[axis]=0;return;}
 // Gravity gives v²=2gh: sqrt(height scale) preserves proportional fall distance.
 const titanLandingScale=hero.character.id==='monolith'?Math.sqrt(hero.character.height):1;
 // Small terrain lips should slide against a giant, never initiate a ragdoll.
 if(titanLandingScale>1&&!fly&&!contact.solid&&Math.abs(vertical)<14*titanLandingScale){
  if(axis==='y'||contact.normal.y>.55){supported=true;vertical=velocity.y=0;}
  else velocity[axis]=0;
  return;
 }

 const closingSpeed=Math.max(0,-(velocity.x*contact.normal.x+(fly?velocity.y:vertical)*contact.normal.y+velocity.z*contact.normal.z));
 if(titanLandingScale>1&&!fly&&contact.normal.y>.55&&closingSpeed<14*titanLandingScale){
  supported=true;vertical=velocity.y=0;return;
 }
 velocity.y=fly?velocity.y:vertical;
 if(contact.solid?.kind!=='arena'){
  if(!fly&&!heroGrapple.held)health.damage(health.impact(contact,velocity));
  const victim=grabs.confirmedTargetId;
  if(victim){const amount=carryDamage.impact(contact,velocity,{held:true});if(amount)combat.hit(victim,{id:'carry-impact-'+elapsed+'-'+(++carryHitId),kind:'collision',attacker:'player',damage:amount});}
 }
 if(contact.normal.y>.5&&grabs.tackling)grabs.endTackle(true);
 if(contact.normal.y>.5&&!contact.solid){const point=player.clone().add(contact.offset).addScaledVector(contact.normal,-.28);groundDamage.contact(point,velocity,contact.normal);}
 if(combatReaction?.blocked){const inward=velocity.dot(contact.normal);if(inward<0)velocity.addScaledVector(contact.normal,-inward);if(contact.normal.y>.5){supported=true;vertical=velocity.y=0;}else if(!airRecovery.active){combatReaction=null;}return;}
 const broken=destruction.hit(contact,player,velocity,{powered:fly});
 if(broken){if(!fly){vertical=velocity.y;const bodyHit=resolveImpact(velocity.clone(),contact,hero.orientation.quaternion,{powered:false});if(bodyHit)hero.impact({...bodyHit,point:player.clone().add(contact.offset).addScaledVector(contact.normal,-.28)});}if(broken.pass)return;}
 const impact=resolveImpact(velocity,contact,hero.orientation.quaternion,{powered:fly});
 if(impact){
  groundRecovery.impact({flying:fly,normal:contact.normal,closing:impact.closing/titanLandingScale,speed:velocity.length()/titanLandingScale});
  if(!fly&&impact.closing>6){hero.impact({...impact,point:player.clone().add(contact.offset).addScaledVector(contact.normal,-.28)});if(!fly){impactCarry=1.4;impactNormal.copy(contact.normal);impactSkid=2.5;}}
  if(!fly&&contact.normal.y>.55&&impact.rebound<1.8){supported=true;velocity.y=0;}
 }
 if(!fly)vertical=velocity.y;
}
for(let i=0;i<steps;i++){
 for(const axis of ['x','z']){const before=player.clone();const hit=collisionWorld.moveAxis(player,axis,velocity[axis]*dt/steps,offsets);if(hit){let stepped=false;if(!fly&&grounded){const trial=before.clone();trial[axis]+=velocity[axis]*dt/steps;const sign=Math.sign(velocity[axis]);const support=floorAt(trial.x+(axis==='x'?sign*.28:0),trial.z+(axis==='z'?sign*.28:0),before.y+(hero.character.id==='monolith'?hero.character.height*.5:.50));if(support>before.y+.005&&support<=before.y+(hero.character.id==='monolith'?hero.character.height*.5:.50)){trial.y=support;if(!collisionWorld.bodyHit(trial,offsets)){player.copy(trial);stepped=true}}}if(!stepped)respondToContact(axis);}}
 const hitY=collisionWorld.moveAxis(player,'y',(fly?velocity.y:vertical)*dt/steps,offsets);if(hitY)respondToContact('y');
 collisionWorld.confine(player,velocity,collisionWorld.bodyRadius,offsets);
}
if(hero.character.id!=='monolith')groundDamage.slide(new T.Vector3(player.x,groundHeight(player.x,player.z),player.z),velocity,(supported||groundDamage.recentlyTouched)&&player.y<groundHeight(player.x,player.z)+2);
if(!fly&&!heroGrapple.held&&!supported&&restingOnSolid(collisionWorld,player,offsets,vertical)){supported=true;vertical=velocity.y=0;}
if(!fly)grounded=supported;
if(airRecovery.update(dt,{airborne:!grounded,held:heroGrapple.held})){
 if(combatReaction?.mode==='launch')combatReaction=null;
 defense.clearStun();groundRecovery.reset();groundRecoveryPose={phase:'none',progress:0,grounded:false};
}
groundRecoveryPose=groundRecovery.update(dt,{flying:fly,grounded,speed:Math.hypot(velocity.x,velocity.z),body:hero.collisionFeedback});
if(groundRecoveryPose.clearance){offsets=collisionWorld.bodyOffsets(new T.Quaternion(),false,hero.character.height,hero.character.width/.74);clearBodySpace();hero.resetCollision();collisionWorld.recover(player,offsets);}
if(groundRecovery.locked){velocity.x=velocity.z=0;pendingJump=null;cancelJump();}
updateSpeedControl();
heroGrapple.update();
sonicWake.update(dt,player,velocity,fly&&boost&&!defense.busy&&!combatReaction);forest.update(player,dt);
const steadyPoint=aimLockPoint(),steadyLock=!!steadyPoint&&(hitTracking||!!combatReaction||airRecovery.active||groundRecovery.active||defense.stun>0);previousCameraRotation.copy(camera.quaternion);
target.copy(player).add(new T.Vector3(0,1.65*hero.character.height,0));const landscape=camera.aspect>1.2;const distance=(landscape?(fly?7:5):(fly?8.5:5.8))*Math.max(1,hero.character.height)+(reducedMotion||steadyLock?0:impulse*1.1);desired.set(player.x+Math.sin(viewYaw)*Math.cos(viewPitch)*distance,target.y+Math.sin(viewPitch)*distance+(fly?0:1.4),player.z+Math.cos(viewYaw)*Math.cos(viewPitch)*distance);if(!steadyLock){desired.x+=Math.cos(viewYaw)*bank*5;desired.z-=Math.sin(viewYaw)*bank*5;}desired.lerpVectors(target,desired,cameraFraction(target,desired));desired.lerpVectors(target,desired,terrainCameraFraction(target,desired,groundHeight));camera.position.lerp(desired,fly||steadyLock?1:1-Math.exp(-dt*12));camera.position.lerpVectors(target,camera.position,terrainCameraFraction(target,camera.position,groundHeight));camera.up.set(-Math.sin(viewYaw)*Math.sin(viewPitch),Math.cos(viewPitch),-Math.cos(viewYaw)*Math.sin(viewPitch));if(fly)camera.quaternion.setFromEuler(new T.Euler(-viewPitch,viewYaw,0,'YXZ'));else camera.lookAt(target);const flightShake=flightCamera.update(dt,velocity.length(),fly,reducedMotion);if(!steadyLock){camera.rotateZ(bank+flightShake.z+(reducedMotion?0:Math.sin(elapsed*83)*impulse*.018));camera.rotateX(flightShake.x+(reducedMotion?0:Math.sin(elapsed*67)*impulse*.014));camera.rotateY(flightShake.y);if(!reducedMotion){camera.rotateX(Math.sin(elapsed*71)*(punches.shake+grabs.shake+heroClash.shake)*.025);camera.rotateZ(Math.sin(elapsed*53)*(punches.shake+grabs.shake+heroClash.shake)*.016);}}else steadyTargetCamera(camera,steadyPoint,previousCameraRotation,dt);camera.fov=T.MathUtils.lerp(camera.fov,(landscape?(fly&&boost?65:54):(fly&&boost?75:62))+(reducedMotion||steadyLock?0:impulse*7),dt*6);camera.updateProjectionMatrix();sky.position.copy(camera.position);
camera.updateMatrixWorld(true);
const grabPose=grabs.update(dt,player,heatVision.aim(),new T.Vector3(velocity.x,fly?velocity.y:vertical,velocity.z),len>.08);if(groundRecovery.locked)grabs.reset();hudText(hud.grabTitle,grabs.tackling?'TACKLE':grabs.phase==='hold'?'THROW':'GRAB');hudText(hud.grabCaption,grabs.tackling?'DRIVE · '+Math.max(0,2-(grabs.pose?.age||0)).toFixed(1)+'s':grabs.cooldown>0?grabs.cooldown.toFixed(1)+'s':grabs.phase==='hold'?'AIM · TAP':grabs.tacklePunches>0?'RAM: '+grabs.tacklePunches+' PUNCHES':(mobile?'TAP · G':'GRAB / THROW'));
const punchPose=punches.update(dt,player,aimLockPoint()?.sub(player).sub(new T.Vector3(0,1.45*hero.character.height,0)).normalize()||camera.getWorldDirection(new T.Vector3()));for(const entry of punchHud){const {kind,button,caption}=entry,cooldown=punches.state.cooldowns[kind],ready=Math.round((1-cooldown/PUNCHES[kind].cooldown)*100),disabled=String(!punches.state.canPress(kind));if(entry.ready!==ready){entry.ready=ready;button.style.setProperty('--ready',ready+'%');}hudText(caption,cooldown>.1?cooldown.toFixed(1)+'s':kind==='quick'?'INTERRUPT':kind==='normal'?'HEAVY HIT':'SHOCKWAVE');if(entry.disabled!==disabled){entry.disabled=disabled;button.setAttribute('aria-disabled',disabled);}}

heatVision.setForwardFlight(fly&&!gentleHover&&!slowFlight&&(len>.08||velocity.length()>8)&&velocity.length()>.15,dt);const reticleTop=heatVision.reticleTop.toFixed(3)+'%';if(hud.reticle.style.top!==reticleTop)hud.reticle.style.top=reticleTop;
avatar.position.copy(player);hero.update(dt,elapsed,{onTitanStep(point){groundDamage.titanStep(point);destruction.plume(point,45,new T.Vector3(0,6,0));audio.punch('normal');},health:health.value,held:heldPose,defense:{phase:defense.phase,age:defense.age,blocking:defense.blocking||!!combatReaction?.blocked,stun:defense.stun},grab:groundRecovery.locked?null:grabPose,heatAim:heatVision.active&&!groundRecovery.locked?heatVision.aim():null,punch:punchPose,flying:fly,levitating:gentleHover||slowFlight,jumpCharge,ambientWind,collisionWorld,groundRecovery:groundRecoveryPose,recovery:flightRecovery,groundMode,moving:fly?(len>.08||velocity.length()>8):len>.08,boost,bank,vx:velocity.x,vy:fly?velocity.y:vertical,vz:velocity.z,grounded,yaw:viewYaw,pitch:viewPitch,groundY:floorAt(player.x,player.z,player.y)});if(heldPose&&heldAnchor){hero.pinHeld(heldAnchor,heldPose.mode);player.copy(avatar.position);}grabs.attach();
collisionWorld.ground=groundHeight;
multiplayer.syncHolds(hero,grabs.confirmedTargetId,grabs.pose);
practiceDummy?.update(dt,hero.grappleAnchor(grabs.tackling?'tackle':'grab'),grabs.pose);
if(grabs.carrying){const victim=grabs.targetId==='practice-dummy'?practiceDummy?.root.position:multiplayer.peer(grabs.targetId)?.position;
 if(victim&&victim.y<=floorAt(victim.x,victim.z,victim.y+1)+.3){const amount=carryDamage.impact({normal:new T.Vector3(0,1,0)},velocity,{held:true});if(amount&&grabs.confirmedTargetId)combat.hit(grabs.confirmedTargetId,{id:'carry-ground-'+elapsed+'-'+(++carryHitId),kind:'collision',attacker:'player',damage:amount});if(grabs.tackling&&velocity.y<0)grabs.endTackle(true);}}
lockOn.draw();healthHUD??=createHealthHUD({combat,health,camera,lockOn});healthHUD.update(dt);heatVision.update(dt,!health.dead&&!groundRecovery.locked&&!grabs.active&&!defense.busy&&!combatReaction);hudText(heatButton.querySelector('small'),heatVision.stats.cooldown>0?heatVision.stats.cooldown.toFixed(1)+'s':(heatVision.stats.charge??3).toFixed(1)+'s · HOLD');defenseFX.update(dt,defense);hudText($('parry').querySelector('small'),defense.vulnerable?'OPEN':defense.cooldown>0?defense.cooldown.toFixed(1)+'s':(mobile?'TAP · Q':'COUNTER'));$('parry').setAttribute('aria-disabled',String(defense.cooldown>0||defense.locked));$('block').setAttribute('aria-pressed',String(defense.blocking));
// Resolve the newly animated pose with the same actor-specific terrain support.
collisionWorld.ground=hero.character.id==='monolith'?groundDamage.titanField.height:groundHeight;
collisionWorld.bodyRadius=.28*hero.character.height*hero.character.width/.74;
const posedOffsets=collisionWorld.bodyOffsets(hero.orientation.quaternion,fly||(!grounded&&!titanWalking),hero.character.height,hero.character.width/.74);
if(!heroGrapple.held&&!collisionWorld.recover(player,posedOffsets)){hero.orientation.quaternion.copy(movementOrientation);collisionWorld.recover(player,offsets);}
if(!fly)velocity.y=vertical;collisionWorld.confine(player,velocity,collisionWorld.bodyRadius,posedOffsets);if(!fly)vertical=velocity.y;
avatar.position.copy(player);
if(!collisionWorld.bodyHit(player,collisionWorld.bodyOffsets(hero.orientation.quaternion,fly||(!grounded&&!titanWalking),hero.character.height,hero.character.width/.74))){safePosition.copy(player);safeOrientation.copy(hero.orientation.quaternion);}

if((shadowTick++%12)===0){sunlight.position.copy(player).addScaledVector(sunDir,500);sunlight.target.position.copy(player);sunlight.target.updateMatrixWorld()}
collisionWorld.ground=groundHeight;
hudText(hud.mode,airRecovery.ready?'FLIGHT READY':airRecovery.active&&!grounded?'RECOVER IN '+airRecovery.remaining.toFixed(1)+'s':groundRecoveryPose.phase==='rising'?'GETTING UP':groundRecoveryPose.phase==='down'?'RECOVERING':levitating?'LEVITATING':fly?flightMode.toUpperCase()+' FLIGHT':'ON FOOT');hudText(hud.jump,airRecovery.ready?'RECOVER':jumpCharge>0?'CHARGE '+Math.round(jumpCharge*100)+'%':levitating?'RISE':fly?'FLY':'JUMP');
hudText(hud.altitude,Math.max(0,Math.floor(player.y))+' m');
for(const d of renderDistricts){const distance=player.distanceTo(d.center)-d.radius;d.mesh.visible=true;d.mesh.castShadow=d.shadow&&distance<240;}
multiplayer.flush();audio.update(dt,{position:player,yaw:viewYaw,speed:velocity.length(),flying:fly,fast:fly&&boost,grounded,vertical:fly?velocity.y:vertical,heat:heatVision.active&&!groundRecovery.locked,heatContact:!!heatVision.stats.contact,punch:punchPose});cinematic.render(scene,camera,quality===1);if(quality===0){const ratio=adaptiveQuality.update(frameMs);if(ratio!==null)renderer.setPixelRatio(ratio);}
}requestAnimationFrame(frame);
function resizeViewport(){
 const viewport=window.visualViewport;
 const {width,height,inverseScale}=gameViewport({width:viewport?.width||innerWidth,height:viewport?.height||innerHeight,scale:viewport?.scale||1,layoutWidth:innerWidth,screenWidth:screen.width,screenHeight:screen.height,coarse:matchMedia('(pointer:coarse)').matches});
 viewportInputScale=1/inverseScale;document.body.style.transformOrigin='0 0';document.body.style.transform=`scale(${inverseScale})`;
 document.body.style.width=width+'px';document.body.style.height=height+'px';
 document.body.style.left=(viewport?.offsetLeft||0)+'px';document.body.style.top=(viewport?.offsetTop||0)+'px';
 camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
}
let resizeFrame=0;function scheduleViewport(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resizeViewport);}
addEventListener('resize',scheduleViewport);window.visualViewport?.addEventListener('resize',scheduleViewport);window.visualViewport?.addEventListener('scroll',scheduleViewport);addEventListener('pageshow',scheduleViewport);
addEventListener('orientationchange',()=>{scheduleViewport();setTimeout(scheduleViewport,150);setTimeout(scheduleViewport,500);});
resizeViewport();
}
