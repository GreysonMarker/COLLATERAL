import * as T from './vendor/three.module.js';
import {createBlastRubble} from './blast-rubble.js';
import {BLOCK,PARK,residentialSurface} from './map-layout.js';
const TILE=16,MASK_SIZE=512,clamp=T.MathUtils.clamp;
export function groundImpactProfile(velocity,normal){
 const speed=velocity.length(),closing=Math.max(0,-velocity.dot(normal)),direct=closing/Math.max(speed,1);
 if(speed<32||closing<8)return null;
 const force=clamp((closing-8)/130,0,1),fast=clamp((speed-72)/70,0,1);
 return {speed,closing,direct,radius:3+force*10,depth:.65+force*5.5,power:8+force*30+fast*8,shockRadius:7+force*20};
}
export function createGroundField(baseHeight,minCraterRadius=0){
 const scars=[],grid=new Map(),tiles=new Set(),nodes=new Map();
 const tileKey=(x,z)=>Math.floor(x/TILE)+','+Math.floor(z/TILE);
 function add(x,z,radius,depth,guard=null){if(radius<=minCraterRadius)return [];let scar=(grid.get(Math.floor(x/32)+','+Math.floor(z/32))||[]).find(s=>Math.hypot(s.x-x,s.z-z)<Math.min(radius,s.radius)*.3&&JSON.stringify(s.guard||null)===JSON.stringify(guard));if(scar){scar.radius=Math.max(scar.radius,radius);scar.depth=Math.max(scar.depth,depth);x=scar.x;z=scar.z;radius=scar.radius;}else{scar={x,z,radius,depth,guard};scars.push(scar);}for(let a=Math.floor((x-radius)/32);a<=Math.floor((x+radius)/32);a++)for(let b=Math.floor((z-radius)/32);b<=Math.floor((z+radius)/32);b++){const k=a+','+b;if(!grid.has(k))grid.set(k,[]);if(!grid.get(k).includes(scar))grid.get(k).push(scar);}const touched=[];for(let a=Math.floor((x-radius)/TILE);a<=Math.floor((x+radius)/TILE);a++)for(let b=Math.floor((z-radius)/TILE);b<=Math.floor((z+radius)/TILE);b++){const k=a+','+b;tiles.add(k);touched.push(k);nodes.delete(k);}return touched;}
 function raw(x,z){const tile=tileKey(x,z);let cache=nodes.get(tile);if(!cache){cache=new Map();nodes.set(tile,cache);}const key=x+','+z;if(cache.has(key))return cache.get(key);let depth=0;for(const s of grid.get(Math.floor(x/32)+','+Math.floor(z/32))||[]){const angle=Math.atan2(z-s.z,x-s.x),edge=.94+.04*Math.sin(angle*7)+.02*Math.cos(angle*11),r=Math.hypot(x-s.x,z-s.z)/(s.radius*edge);if(r>=1)continue;const bowl=(1-r*r)**2;const front=s.guard?clamp(((x-s.guard.x)*s.guard.dx+(z-s.guard.z)*s.guard.dz-2)/3,0,1):1;depth=Math.max(depth,s.depth*bowl*front*front);}const value=baseHeight(x,z)-depth;cache.set(key,value);return value;}
 function height(x,z){if(!tiles.has(tileKey(x,z)))return baseHeight(x,z);const ix=Math.floor(x),iz=Math.floor(z),a=x-ix,b=z-iz;if(a+b<=1)return raw(ix,iz)+(raw(ix+1,iz)-raw(ix,iz))*a+(raw(ix,iz+1)-raw(ix,iz))*b;return raw(ix+1,iz+1)+(raw(ix,iz+1)-raw(ix+1,iz+1))*(1-a)+(raw(ix+1,iz)-raw(ix+1,iz+1))*(1-b);}
 return {add,raw,height,scars,tiles};
}
export function createGroundDamage(scene,baseHeight,materials,{emit=()=>{},affect=()=>{},mobile=false}={}){
 const maskData=new Uint8Array(MASK_SIZE*MASK_SIZE),mask=new T.DataTexture(maskData,MASK_SIZE,MASK_SIZE,T.RedFormat);mask.magFilter=mask.minFilter=T.NearestFilter;mask.generateMipmaps=false;mask.needsUpdate=true;
 // Titan support ignores foot-sized excavation; visible terrain keeps every scar.
 const titanField=createGroundField(baseHeight,10);
 const field=createGroundField(baseHeight),meshes=new Map(),dirty=new Set(),uniforms={groundTileCount:{value:0},groundMask:{value:mask}};
 const aftermath=createBlastRubble(scene,(x,z)=>field.height(x,z),{mobile});
 let decorationsDirty=false;let clock=0,lastHit=-10,lastTouch=-10,lastTrail=null,lastRefresh=-10;
 const stats={craters:0,slideScars:0,visibleTiles:0,persistentTiles:0};
 for(const material of new Set(materials)){
  const prior=material.onBeforeCompile.bind(material),cache=material.customProgramCacheKey.bind(material);
  const cacheKey=cache();material.onBeforeCompile=shader=>{prior(shader);Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec3 groundWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngroundWorld=(modelMatrix*vec4(position,1.0)).xyz;');shader.fragmentShader='varying vec3 groundWorld;uniform sampler2D groundMask;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 if(groundWorld.y<1.25){vec2 cell=floor(groundWorld.xz/${TILE}.0)+vec2(${MASK_SIZE/2}.0);if(all(greaterThanEqual(cell,vec2(0.0)))&&all(lessThan(cell,vec2(${MASK_SIZE}.0)))&&texture2D(groundMask,(cell+.5)/${MASK_SIZE}.0).r>.5)discard;}`);};material.customProgramCacheKey=()=>cacheKey+'-ground-excavation-mask-v2';material.needsUpdate=true;
 }
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0});
 let debris=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({color:'#70727a',roughness:1}),mobile?320:480);debris.count=0;debris.frustumCulled=false;scene.add(debris);const rubble=[];const fractures=[];const crackMesh=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#181d27'}));crackMesh.frustumCulled=false;scene.add(crackMesh);
 function groundColor(x,z,y){const original=baseHeight(x,z),depth=original-y;
  if(depth>.12){const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};const coarse=hash(Math.floor(x/7),Math.floor(z/7)),grain=hash(x,z),noise=coarse*.09+grain*.06;return new T.Color().setRGB(.19+noise,.175+noise,.15+noise);}
  const residential=residentialSurface(x,z);if(residential)return new T.Color(residential.color);
  const dx=x-Math.round(x/BLOCK)*BLOCK,dz=z-Math.round(z/BLOCK)*BLOCK;
  if(Math.abs(x-PARK.x)<PARK.width/2&&Math.abs(z-PARK.z)<PARK.depth/2)return new T.Color('#468579');
  if(Math.abs(dx)<=43&&Math.abs(dz)<=43)return new T.Color('#b8b5a8');
  const ax=Math.abs(Math.abs(dx)-BLOCK/2),az=Math.abs(Math.abs(dz)-BLOCK/2);
  const crossing=(Math.abs(dz-44)<2.5&&Math.abs(dx)>47&&Math.abs(dx)<65&&Math.abs((dx+BLOCK/2)/2.3-Math.round((dx+BLOCK/2)/2.3))<.25)||(Math.abs(dx-44)<2.5&&Math.abs(dz)>47&&Math.abs(dz)<65&&Math.abs((dz+BLOCK/2)/2.3-Math.round((dz+BLOCK/2)/2.3))<.25);
  if(ax<.15||az<.15||Math.abs(ax-.5)<.15||Math.abs(az-.5)<.15||crossing)return new T.Color('#c5c4ad');return new T.Color('#3c4864');
 }
 function build(key){const [a,b]=key.split(',').map(Number),positions=[],colors=[],uv=[],indices=[];
  for(let z=0;z<=TILE;z++)for(let x=0;x<=TILE;x++){const wx=a*TILE+x,wz=b*TILE+z,y=field.raw(wx,wz);positions.push(wx,y,wz);const color=groundColor(wx,wz,y);colors.push(color.r,color.g,color.b);uv.push(wx,wz);}
  for(let z=0;z<TILE;z++)for(let x=0;x<TILE;x++){const p=z*(TILE+1)+x;indices.push(p,p+TILE+1,p+1,p+1,p+TILE+1,p+TILE+2);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  let mesh=meshes.get(key);if(mesh){mesh.geometry.dispose();mesh.geometry=geometry;}else{mesh=new T.Mesh(geometry,material);mesh.matrixAutoUpdate=false;mesh.receiveShadow=true;mesh.visible=true;scene.add(mesh);meshes.set(key,mesh);}const mx=a+MASK_SIZE/2,mz=b+MASK_SIZE/2;if(mx>=0&&mx<MASK_SIZE&&mz>=0&&mz<MASK_SIZE){maskData[mz*MASK_SIZE+mx]=255;mask.needsUpdate=true;}dirty.delete(key);
 }
 let networkStamp=null;
 function stamp(x,z,radius,depth,guard=null){networkStamp?.(x,z,radius,depth,guard);titanField.add(x,z,radius,depth,guard);for(const key of field.add(x,z,radius,depth,guard))dirty.add(key);stats.persistentTiles=field.tiles.size;decorationsDirty=true;}
 function scatter(point,radius,count,large=false,guard=null){for(let i=0;i<count;i++){const angle=i/count*Math.PI*2+.2*Math.random(),r=radius*(.68+Math.random()*.35);const x=point.x+Math.cos(angle)*r,z=point.z+Math.sin(angle)*r;if(guard&&(x-guard.x)*guard.dx+(z-guard.z)*guard.dz<2)continue;rubble.push({x,z,size:large?1.2+Math.random()*2.4:.2+Math.random()*.8,angle});}}
 function contact(point,velocity,normal){if(normal.y<.5)return;lastTouch=clock;const profile=groundImpactProfile(velocity,normal);if(!profile||clock-lastHit<.45)return;lastHit=clock;stamp(point.x,point.z,profile.radius,profile.depth);stats.craters++;for(let i=0;i<12;i++){const angle=i/12*Math.PI*2;fractures.push({x:point.x,z:point.z,angle,radius:profile.radius});}scatter(point,profile.radius,12+Math.floor(profile.power*.4));const eject=velocity.clone();eject.y=Math.abs(velocity.y)*.45+profile.power*.8;emit(point,eject,Math.min(32,12+Math.floor(profile.power/2)),profile.radius*.6);affect(point,profile.shockRadius,profile.power,velocity);}
 function slide(point,velocity,touching){const speed=Math.hypot(velocity.x,velocity.z);if(!touching||speed<30){lastTrail=null;return;}const spacing=2.2;if(lastTrail&&point.distanceTo(lastTrail)<spacing)return;const amount=clamp((speed-30)/110,0,1),radius=1.3+amount*1.6;stamp(point.x,point.z,radius,.2+amount*.9);stats.slideScars++;lastTrail=point.clone();if(stats.slideScars%3===0){scatter(point,radius,4);emit(point,velocity,7,1.4);affect(point,3+amount*5,5+amount*10,velocity);}}
 function titanStep(point){const p=point.clone();p.y=field.height(p.x,p.z);stamp(p.x,p.z,9.6,.9);scatter(p,11,14,true);emit(p,new T.Vector3(0,20,0),22,4.8);affect(p,24,18,new T.Vector3(0,8,0));stats.titanSteps=(stats.titanSteps||0)+1;}
 function jumpTakeoff(point,charge){if(charge<.25||Math.abs(point.y-field.height(point.x,point.z))>1)return false;const c=clamp(charge,0,1);stamp(point.x,point.z,.65+c*.3,.06+c*.08);emit(point,new T.Vector3(0,4,0),5,.5);stats.jumpScuffs=(stats.jumpScuffs||0)+1;return true;}
 function shockwave(point,radius=20){const height=Math.max(0,point.y-field.height(point.x,point.z));if(height>radius*.65)return;const strength=1-height/(radius*.65);stamp(point.x,point.z,2.5+strength*3,.12+strength*.32);scatter(point,2.5+strength*3,6);stats.shockScuffs=(stats.shockScuffs||0)+1;}
 function radialBlast(point,radius,buildings=[]){
  const height=Math.max(0,point.y-baseHeight(point.x,point.z));if(height>=radius){aftermath.blast(point,radius,buildings);Object.assign(stats,aftermath.stats);return;}
  const footprint=Math.sqrt(radius*radius-height*height),previous=networkStamp;networkStamp=null;
  try{stamp(point.x,point.z,footprint,12*(1-height/radius)+2);scatter(new T.Vector3(point.x,baseHeight(point.x,point.z),point.z),footprint,36,true);stats.craters++;aftermath.blast(point,radius,buildings);Object.assign(stats,aftermath.stats);}finally{networkStamp=previous;}
 }
 function update(dt,player){clock+=dt;if(!field.tiles.size)return;
  // Physics changes immediately; publish road meshes in small slices instead of
  // blocking the release frame on an entire several-hundred-meter trench.
  const started=performance.now();let built=0;
  for(const key of dirty){build(key);built++;if(built>=6||performance.now()-started>2)break;}
  stats.pendingTiles=dirty.size;stats.builtThisFrame=built;stats.buildMs=performance.now()-started;
  stats.visibleTiles=meshes.size;uniforms.groundTileCount.value=meshes.size;
  // Rubble and cracks are static. Camera movement must not recreate their buffers.
  if(decorationsDirty&&(!dirty.size||clock-lastRefresh>.25)){lastRefresh=clock;decorationsDirty=false;
   if(rubble.length>debris.instanceMatrix.count){const old=debris;debris=new T.InstancedMesh(old.geometry,old.material,Math.max(rubble.length,old.instanceMatrix.count*2));debris.frustumCulled=false;scene.remove(old);old.dispose();scene.add(debris);}const dummy=new T.Object3D();let n=0;for(let i=rubble.length-1;i>=0&&n<debris.instanceMatrix.count;i--){const r=rubble[i];dummy.position.set(r.x,field.height(r.x,r.z)+r.size*.18,r.z);dummy.rotation.set(.3,r.angle,.2);dummy.scale.set(r.size,r.size*.3,r.size*.65);dummy.updateMatrix();debris.setMatrixAt(n++,dummy.matrix);}debris.count=n;debris.instanceMatrix.needsUpdate=true;
   const lines=[];for(let i=fractures.length-1;i>=0;i--){const f=fractures[i];for(let j=0;j<3;j++){const a=f.angle+Math.sin(i*2+j)*.06,b=f.angle+Math.sin(i*2+j+1)*.06,r0=f.radius*(.78+j*.2),r1=f.radius*(.98+j*.2),x0=f.x+Math.cos(a)*r0,z0=f.z+Math.sin(a)*r0,x1=f.x+Math.cos(b)*r1,z1=f.z+Math.sin(b)*r1;lines.push(x0,field.height(x0,z0)+.035,z0,x1,field.height(x1,z1)+.035,z1);}}crackMesh.geometry.dispose();crackMesh.geometry=new T.BufferGeometry();crackMesh.geometry.setAttribute('position',new T.Float32BufferAttribute(lines,3));

  }
 }
 function punch(point,kind,guard=null,waveRadius=22.5){const floor=field.height(point.x,point.z);if(point.y-floor>8||point.y-floor< -10)return;if(kind==='quick'){jumpTakeoff(new T.Vector3(point.x,floor,point.z),1);return;}const radius=kind==='serious'?waveRadius:9,depth=kind==='serious'?5:4;stamp(point.x,point.z,radius,depth,guard);stats.craters++;scatter(new T.Vector3(point.x,floor,point.z),radius,10,kind==='serious',guard);}
 return {set onNetworkStamp(fn){networkStamp=fn;},applyNetworkStamp(x,z,radius,depth,guard){const previous=networkStamp;networkStamp=null;try{stamp(x,z,radius,depth,guard);scatter(new T.Vector3(x,baseHeight(x,z),z),radius,6);}finally{networkStamp=previous;}},titanStep,punch,radialBlast,field,titanField,stats,contact,slide,update,jumpTakeoff,shockwave,get recentlyTouched(){return clock-lastTouch<.16;}};
}
