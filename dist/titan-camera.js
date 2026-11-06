import * as T from './vendor/three.module.js';
import {terrainCameraFraction} from './terrain-camera.js';
// Keep the shoulder out of the opponent's sightline without changing manual aim.
export function titanCameraFraming(height,combatBlend){const t=T.MathUtils.clamp(combatBlend,0,1);return {focusLift:.20*height*t,cameraLift:.45*height*t,shoulder:1.5*height*t,distanceScale:1-.10*t};}
// Occlusion changes boom length, never blocks the orbit or follows a collision path.
export function collideTitanCamera(anchor,wanted,previous,world,ground){
 const fraction=Math.min(world.cameraFraction(anchor,wanted,.55,true),terrainCameraFraction(anchor,wanted,ground,.55));
 return wanted.clone().lerpVectors(anchor,wanted,fraction);
}
export function createTitanCameraBoom(){let distance=null;return {
 update(anchor,wanted,dt,world,ground){const safe=collideTitanCamera(anchor,wanted,null,world,ground),allowed=anchor.distanceTo(safe);
  // Pop inward immediately; ease outward only. Use today's orbit direction so
  // yesterday's camera position can never pin the camera behind a wall.
  distance=distance===null||allowed<distance?allowed:T.MathUtils.damp(distance,allowed,6,dt);
  return safe.sub(anchor).setLength(distance).add(anchor);
 },reset(){distance=null;}
};}
