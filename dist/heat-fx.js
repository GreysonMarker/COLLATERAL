import * as T from './vendor/three.module.js';
// Bounded visual pool, independent of cutting geometry and destruction strength.
export function createHeatFX(scene,camera){
 const root=new T.Group();root.visible=false;scene.add(root);const pixels=new Uint8Array(64*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){const r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5),i=(y*64+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(Math.max(0,1-r)**2*255);}
 const map=new T.DataTexture(pixels,64,64);map.needsUpdate=true;
 const sprite=(color)=>{const m=new T.Sprite(new T.SpriteMaterial({map,color,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,fog:false}));m.renderOrder=5;root.add(m);return m;};
 const eyes=[sprite('#ff3810'),sprite('#ff3810')],streaks=[sprite('#ff9b38'),sprite('#ff9b38')],impact=sprite('#ff6b15'),impactCore=sprite('#fff6c8');
 const faceLight=new T.PointLight('#ff5427',0,7,2),hitLight=new T.PointLight('#ff8e3c',0,13,2);root.add(faceLight,hitLight);
 const ribbons=[];
 for(let i=0;i<2;i++){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(12),3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));g.setIndex([0,1,2,2,1,3]);
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,uniforms:{time:{value:0},strength:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;void main(){float x=abs(vUv.x-.5)*2.;float jitter=.055*sin(vUv.y*155.-time*44.)+.035*sin(vUv.y*310.+time*27.);float glow=exp(-x*x*5.5);float hot=exp(-pow(abs(vUv.x-.5+jitter)*2.,2.)*180.);float pulse=.85+.15*sin(time*33.+vUv.y*100.);vec3 color=vec3(1.,.065,.006)*glow*.65+vec3(1.,.38,.065)*hot*1.6;gl_FragColor=vec4(color,glow*pulse*strength);}`});const mesh=new T.Mesh(g,material);mesh.frustumCulled=false;mesh.renderOrder=4;root.add(mesh);ribbons.push(mesh);}
 const capacity=256,geo=new T.PlaneGeometry(1,1),alpha=new T.InstancedBufferAttribute(new Float32Array(capacity),1);geo.setAttribute('sparkAlpha',alpha);
 const mat=new T.MeshBasicMaterial({map,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,fog:false});mat.onBeforeCompile=shader=>{shader.vertexShader='attribute float sparkAlpha;varying float vSparkAlpha;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSparkAlpha=sparkAlpha;');shader.fragmentShader='varying float vSparkAlpha;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vSparkAlpha;');};mat.customProgramCacheKey=()=> 'heat-sparks-v1';
 const sparks=new T.InstancedMesh(geo,mat,capacity);sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);sparks.frustumCulled=false;sparks.count=0;sparks.renderOrder=6;root.add(sparks);
 const pool=[],dummy=new T.Object3D(),up=new T.Vector3(0,1,0),warm=new T.Color('#ff611d'),hot=new T.Color('#fff1b9');let time=0,power=0,lastImpact=null,impactAge=10,emit=0;
 function spawn(p,v,size,life,ember=true){if(pool.length>=capacity)pool.shift();pool.push({p:p.clone(),v,age:0,life,size,ember});}
 // Entry/exit glints are independent of the main wall-contact flare. Civilians
 // never shorten the beam or move its terminal impact back onto their body.
 function pierce(passes,direction){
  const side=new T.Vector3().crossVectors(direction,new T.Vector3(0,1,0));if(side.lengthSq()<.001)side.set(1,0,0);side.normalize();const vertical=new T.Vector3().crossVectors(direction,side).normalize();
  for(const pass of passes.slice(0,16))for(const [at,sign] of [[pass.entry,-1],[pass.exit,1]]){
   const point=at.clone().addScaledVector(direction,sign*.10);
   for(let i=0;i<4;i++){const angle=i*Math.PI*.5;const velocity=direction.clone().multiplyScalar(sign*3).addScaledVector(side,Math.cos(angle)*1.4).addScaledVector(vertical,Math.sin(angle)*1.4);spawn(point,velocity,.10,.16,false);}
  }
 }
 const inverseCamera=new T.Quaternion(),localVelocity=new T.Vector3(),sparkColor=new T.Color();
 function update(dt,active,origins=null,end=null,contact=null){
  // Once the release fade finishes, idle heat vision needs no GPU uploads or particle work.
  if(!active&&!root.visible)return;
  time+=dt;power=T.MathUtils.damp(power,active?1:0,active?25:18,dt);if(contact){lastImpact=contact.clone();impactAge=0;}else impactAge+=dt;
  const contactPower=active&&lastImpact?Math.max(0,1-impactAge/.22):0;
  for(let i=0;i<2;i++){eyes[i].visible=streaks[i].visible=ribbons[i].visible=active;if(!active)continue;const start=origins[i],dir=end.clone().sub(start).normalize(),toward=camera.position.clone().sub(start),side=new T.Vector3().crossVectors(dir,toward).normalize();if(side.lengthSq()<.01)side.set(1,0,0);
   // Broad screen-facing glow surrounds a narrow physical beam.
   const width=.36+.045*Math.sin(time*39+i),p=ribbons[i].geometry.attributes.position;for(let j=0;j<4;j++){const point=(j<2?start:end).clone().addScaledVector(side,(j%2?1:-1)*width);p.setXYZ(j,point.x,point.y,point.z);}p.needsUpdate=true;ribbons[i].material.uniforms.time.value=time;ribbons[i].material.uniforms.strength.value=power;
   eyes[i].position.copy(start);eyes[i].scale.setScalar(.8*(.9+.1*Math.sin(time*41)));streaks[i].position.copy(start);streaks[i].scale.set(1.8,.16,1);eyes[i].material.opacity=power;streaks[i].material.opacity=power*.8;
  }
  if(active){faceLight.position.copy(origins[0]).lerp(origins[1],.5).add(new T.Vector3(0,.1,.15));}faceLight.intensity=power*12;
  impact.visible=impactCore.visible=contactPower>0;if(contactPower>0){impact.position.copy(lastImpact);impactCore.position.copy(lastImpact);impact.scale.setScalar(2.3+.35*Math.sin(time*47));impactCore.scale.setScalar(.7);impact.material.opacity=contactPower;impactCore.material.opacity=contactPower;hitLight.position.copy(lastImpact).lerp(camera.position,.008);}hitLight.intensity=contactPower*35;
  emit+=dt;if(active&&emit>=.025){emit=0;const dir=end.clone().sub(origins[0]).normalize();for(let i=0;i<3;i++){const p=origins[i%2].clone().addScaledVector(dir,.2+Math.random()*5);spawn(p,dir.clone().multiplyScalar(8+Math.random()*12).add(new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5)),.1+Math.random()*.12,.12+Math.random()*.2,false);}
   if(contactPower>0)for(let i=0;i<9;i++){const v=new T.Vector3(Math.random()-.5,Math.random()-.25,Math.random()-.5).normalize().multiplyScalar(3+Math.random()*13).addScaledVector(dir,-2);spawn(lastImpact,v,.12+Math.random()*.2,.22+Math.random()*.65);}}
  // Compact before writing instances so expired particles cannot leave stale slots.
  let live=0;for(const p of pool){p.age+=dt;if(p.age<p.life)pool[live++]=p;}pool.length=live;
  inverseCamera.copy(camera.quaternion).invert();
  for(let i=0;i<pool.length;i++){const p=pool[i];if(p.ember)p.v.y-=12*dt;p.p.addScaledVector(p.v,dt);dummy.position.copy(p.p);dummy.quaternion.copy(camera.quaternion);localVelocity.copy(p.v).applyQuaternion(inverseCamera);dummy.rotateZ(Math.atan2(-localVelocity.x,localVelocity.y));dummy.scale.set(p.size,p.size*(p.ember?2.5:1.5),1);dummy.updateMatrix();sparks.setMatrixAt(i,dummy.matrix);sparks.setColorAt(i,p.ember?sparkColor.copy(warm).lerp(hot,Math.max(0,1-p.age/p.life)*.8):hot);alpha.setX(i,Math.min(1,(1-p.age/p.life)*3));}
  sparks.count=pool.length;sparks.instanceMatrix.needsUpdate=true;if(sparks.instanceColor)sparks.instanceColor.needsUpdate=true;alpha.needsUpdate=true;
  root.visible=active||power>.005||pool.length>0;
  if(!root.visible){power=0;faceLight.intensity=hitLight.intensity=0;}
 }
 return {update,pierce,get particles(){return pool.length;},get active(){return root.visible;}};
}
// Ray/convex clipping respects previously carved holes, rather than sparking on empty AABBs.
export function heatContact(world,origin,direction,reach){if(!world)return null;let closest=reach+.001,point=null;const seen=new Set(),ray=new T.Ray(origin,direction);
 for(let d=0;d<=reach+8;d+=8){const p=origin.clone().addScaledVector(direction,Math.min(d,reach));if(d>closest+8)break;for(const s of world.nearby(p.x,p.z,5,p.y,true)){if(seen.has(s)||s.disabled)continue;seen.add(s);let distance;
  if(s.kind==='convex'){let lo=0,hi=reach,valid=true;for(const plane of s.planes){const a=plane.distanceToPoint(origin),b=plane.normal.dot(direction);if(Math.abs(b)<1e-8){if(a>0){valid=false;break;}continue;}const t=-a/b;if(b<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi){valid=false;break;}}if(!valid)continue;distance=lo;}
  else{const at=ray.intersectBox(new T.Box3(new T.Vector3(s.x1,s.y1,s.z1),new T.Vector3(s.x2,s.y2,s.z2)),new T.Vector3());if(!at)continue;distance=at.distanceTo(origin);}
  if(distance>=0&&distance<closest){closest=distance;point=origin.clone().addScaledVector(direction,distance-.03);}
 }}return point;}
