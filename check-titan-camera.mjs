import assert from 'node:assert/strict';
import * as T from './dist/vendor/three.module.js';
import {CollisionWorld} from './dist/collision.js';
import {titanCameraFraming,collideTitanCamera,createTitanCameraBoom} from './dist/titan-camera.js';
const v=(x,y,z)=>new T.Vector3(x,y,z),ground=()=>0;
const f=titanCameraFraming(28,1);assert.equal(f.distanceScale,.9);assert(f.focusLift>0&&f.cameraLift>0&&f.shoulder>10);assert.equal(titanCameraFraming(28,0).distanceScale,1);
const wall={x1:-40,x2:40,y1:0,y2:130,z1:30,z2:40},world=new CollisionWorld([wall],ground);
const p=collideTitanCamera(v(0,60,0),v(0,80,100),v(0,70,20),world,ground);assert(p.z<29.5);assert.equal(world.cameraFraction(p,p,.55),1);
const corner=collideTitanCamera(v(60,60,0),v(60,60,60),v(0,60,20),world,ground);assert(corner.equals(v(60,60,60)),'old camera path must not block a clear new orbit');
const embedded=collideTitanCamera(v(0,60,35),v(0,70,35),v(0,60,35),world,ground);assert(embedded.equals(v(0,70,35)),'containing structure must not trap or teleport giant camera to its roof');
const open=new CollisionWorld([],ground),wanted=v(20,80,100);assert(collideTitanCamera(v(0,60,0),wanted,v(0,70,80),open,ground).equals(wanted));
console.log('PASS: higher/closer shoulder framing, wall retraction, free orbit, embedded-anchor escape and unobstructed boom.');
// Check the actual Monolith mesh, not just a bounding-box guess: opponents at
// medium range must be both on-screen and unobscured by his own shoulders.
const {createHero}=await import('./dist/hero.js');const hero=createHero(c=>new T.MeshBasicMaterial({color:c}));hero.setAppearance('monolith');hero.update(0,0,{grounded:true,flying:false,moving:false,vx:0,vy:0,vz:0,groundY:0});hero.root.updateMatrixWorld(true);const meshes=[];hero.root.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
for(const aspect of [1.6,.65]){const framing=titanCameraFraming(28,1),camera=new T.PerspectiveCamera(aspect>1.2?54:62,aspect,.1,2000),anchor=v(0,1.65*28+framing.focusLift,0),distance=(aspect>1.2?5:5.8)*28*framing.distanceScale;camera.position.set(framing.shoulder,anchor.y+Math.sin(.16)*distance+1.4+framing.cameraLift,Math.cos(.16)*distance);camera.lookAt(anchor);camera.updateMatrixWorld();for(const z of [-100,-200,-400]){const opponent=v(0,1.3,z),ray=new T.Raycaster(camera.position,opponent.clone().sub(camera.position).normalize(),0,camera.position.distanceTo(opponent));assert.equal(ray.intersectObjects(meshes,false).length,0);const screen=opponent.project(camera);assert(Math.abs(screen.x)<1&&Math.abs(screen.y)<1);}}
console.log('PASS: actual Monolith mesh leaves opponents visible at 100/200/400m in portrait and landscape.');

for(const fps of [30,60,144]){const boom=createTitanCameraBoom(),anchor=v(0,60,0);let cam=boom.update(anchor,v(0,60,100),1/fps,world,ground);assert(cam.z<29.5);cam=boom.update(anchor,v(100,60,0),1/fps,world,ground);assert(cam.x>0&&Math.abs(cam.z)<1e-8,'orbit continues while retracted');for(let i=0;i<fps;i++)cam=boom.update(anchor,v(100,60,0),1/fps,world,ground);assert(cam.x>99,'distance restores after obstruction clears');cam=boom.update(anchor,v(0,60,100),1/fps,world,ground);assert(cam.z<29.5,'immediate inward response');boom.reset();assert(boom.update(anchor,v(100,60,0),1/fps,world,ground).equals(v(100,60,0)));}
console.log('PASS: immediate retraction, unrestricted orbit and smooth outward restoration at 30/60/144 FPS.');
