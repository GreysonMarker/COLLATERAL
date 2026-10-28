import * as T from './vendor/three.module.js';
export function createBoostEffect(scene){
 const rings=[];const geometry=new T.TorusGeometry(1,.05,6,64);
 for(let i=0;i<4;i++){const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color:i===0?'#ffffff':'#a5e7ff',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));mesh.visible=false;scene.add(mesh);rings.push(mesh)}
 let age=10;const normal=new T.Vector3(0,0,1),dir=new T.Vector3();
 function trigger(position,yaw,pitch){age=0;dir.set(-Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));for(const r of rings){r.position.copy(position).add(new T.Vector3(0,1.25,0)).addScaledVector(dir,-1);r.quaternion.setFromUnitVectors(normal,dir);r.visible=true}}
 function update(dt){age+=dt;for(let i=0;i<rings.length;i++){const t=(age-i*.065)/.85,r=rings[i];r.visible=t>=0&&t<1;if(r.visible){r.scale.setScalar(.75+30*Math.pow(t,.7));r.material.opacity=(1-t)**2*(i===0?1:.6)}}return Math.max(0,1-age/.55)}
 return {trigger,update,get age(){return age}};
}
export function responseRate(flying,hasInput,fast,burstAge){return !flying?12:!hasInput?(fast?3.8:5.5):fast&&burstAge<.3?12:6.5}
