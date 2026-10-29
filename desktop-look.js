// Relative mouse movement keeps turning beyond screen edges. Never fake this by
// just hiding an ordinary cursor: that would retain the edge limit.
export function createDesktopLook({canvas,doc=document,enabled,isPlaying,onMove,onRelease,onError}){
 let wasLocked=false,pending=false,freeLooking=false;
 function failed(){pending=false;onError('Mouse capture was blocked. Click RESUME GAME to retry. If needed, open the game in its own browser tab.');}
 function request(){
  if(!enabled||doc.pointerLockElement===canvas||pending)return;
  if(!canvas.requestPointerLock){onError('This browser does not support free camera capture. Open the game in desktop Safari or Chrome.');return;}
  pending=true;
  try{const result=canvas.requestPointerLock();result?.catch(failed);}catch{failed();}
 }
 function release(){freeLooking=false;if(doc.pointerLockElement===canvas)doc.exitPointerLock();}
 doc.addEventListener('pointerlockchange',()=>{
  const locked=doc.pointerLockElement===canvas;pending=false;if(!locked)freeLooking=false;
  doc.body.classList.toggle('mouse-captured',locked);
  if(wasLocked&&!locked&&isPlaying())onRelease();wasLocked=locked;
 });
 doc.addEventListener('pointerlockerror',()=>{if(pending)failed();});
 doc.addEventListener('mousedown',e=>{if(e.button===0&&enabled&&doc.pointerLockElement===canvas&&isPlaying())freeLooking=true;});
 doc.addEventListener('mouseup',e=>{if(e.button===0)freeLooking=false;});
 doc.defaultView?.addEventListener('blur',()=>{freeLooking=false;});
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden)freeLooking=false;});
 doc.addEventListener('mousemove',e=>{if(e.buttons!==undefined&&!(e.buttons&1))freeLooking=false;if(enabled&&doc.pointerLockElement===canvas&&isPlaying())onMove(e.movementX,e.movementY);});
 return {request,release,get freeLooking(){return enabled&&freeLooking&&doc.pointerLockElement===canvas;},get locked(){return doc.pointerLockElement===canvas;}};
}
