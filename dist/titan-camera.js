import * as T from './vendor/three.module.js';
import {terrainCameraFraction} from './terrain-camera.js';
// Keep the shoulder out of the opponent's sightline without changing manual aim.
export function titanCameraFraming(height,combatBlend){const t=T.MathUtils.clamp(combatBlend,0,1);return {focusLift:.20*height*t,cameraLift:.45*height*t,shoulder:1.5*height*t,distanceScale:1-.10*t};}
export function collideTitanCamera(anchor,wanted,previous,world,ground){
 const radius=.55,free=p=>p.y>=ground(p.x,p.z)+radius&&world.cameraFraction(p,p,radius)===1;
 const clip=(from,to)=>to.lerpVectors(from,to,Math.min(world.cameraFraction(from,to,radius),terrainCameraFraction(from,to,ground,radius)));
 const result=wanted.clone();
 if(free(anchor))clip(anchor,result);
 else if(!free(result)){
  // A giant may occupy a building while crushing it. Never retract into that
  // embedded anchor; recover above the roof, then approach the desired camera.
  const above=result.clone();let found=false;for(let i=0;i<256;i++){above.y+=2;if(free(above)){found=true;break;}}
  if(found)clip(above,result);else return previous.clone();
 }
 // Sweep the smoothed position too: an orbit can otherwise cut through corners.
 if(free(previous))clip(previous,result);
 return result;
}
