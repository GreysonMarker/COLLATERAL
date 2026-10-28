import * as T from './vendor/three.module.js';
export function createWind(){
 const value=new T.Vector3(),base=new T.Vector3(),target=new T.Vector3();let remaining=0,seed=6941,multiplier=1.3;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 return {value,update(dt,time,altitude=0,tallestBuilding=Infinity){remaining-=dt;if(remaining<=0){remaining=6+random()*9;const angle=random()*Math.PI*2,strength=1.5+random()*7;target.set(Math.cos(angle)*strength,.1+random()*.6,Math.sin(angle)*strength);}
 const gust=.85+.22*Math.sin(time*1.7)+.14*Math.sin(time*.61+2);
 base.x=T.MathUtils.damp(base.x,target.x*gust,.65,dt);base.z=T.MathUtils.damp(base.z,target.z*gust,.65,dt);base.y=T.MathUtils.damp(base.y,target.y+Math.sin(time*1.2)*.2,.8,dt);multiplier=T.MathUtils.damp(multiplier,altitude>=tallestBuilding+20?3:1.3,1.5,dt);value.copy(base).multiplyScalar(multiplier);return value;}};
}
