import * as T from './vendor/three.module.js';
export function selectLockTarget(actors,camera,reticle,origin,visible=()=>true){
 let best=null,score=Infinity;camera.updateMatrixWorld(true);
 for(const [id,a] of actors){if(id==='player'||a.active?.()===false)continue;const p=a.position().clone().add(new T.Vector3(0,(a.height?.()||2.2)*.6,0));if(p.clone().applyMatrix4(camera.matrixWorldInverse).z>=0)continue;const screen=p.clone().project(camera);if(Math.abs(screen.x)>1||Math.abs(screen.y)>1||!visible(p))continue;const value=((screen.x-reticle.x)*camera.aspect)**2+(screen.y-reticle.y)**2;if(value<score){score=value;best=id;}}
 return best;
}
export function createLockOn({combat,camera,player,button,dot,reticle,visible}){
 const distanceLabel=dot.querySelector?.('.lock-distance');
 let id=null;
 function clear(){id=null;dot.hidden=true;button.setAttribute('aria-pressed','false');button.querySelector('b').textContent='LOCK';}
 function point(){const a=combat.actors.get(id);return a&&a.active?.()!==false?a.position().clone().add(new T.Vector3(0,(a.height?.()||2.2)*.6,0)):null;}
 function toggle(){if(id){clear();return;}id=selectLockTarget(combat.actors,camera,reticle(),player,visible);button.setAttribute('aria-pressed',String(!!id));button.querySelector('b').textContent=id?'LOCKED':'NO TARGET';}
 function update(){const p=point();if(!p){clear();return null;}return p;}
 function draw(){const p=point();if(!p){dot.hidden=true;return;}const behind=p.clone().applyMatrix4(camera.matrixWorldInverse).z>=0;const s=p.project(camera);dot.hidden=behind||Math.abs(s.x)>1||Math.abs(s.y)>1;if(!dot.hidden){if(distanceLabel){const meters=Math.round(player.distanceTo(combat.actors.get(id).position())),label=meters+' m';if(distanceLabel.textContent!==label)distanceLabel.textContent=label;distanceLabel.style.transform=s.x>.8?'translateX(calc(-100% - 22px))':'';}dot.style.left=(s.x+1)*50+'%';dot.style.top=(1-s.y)*50+'%';}}
 return {toggle,clear,point,update,draw,get id(){return id;}};
}
