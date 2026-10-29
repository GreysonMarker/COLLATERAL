// Brief taps select a cruising speed; holds temporarily boost without changing it.
export function createDesktopSpeed(holdMs=180){
 let selected='normal',started=null;const heldKeys=new Set();
 function press(code,now){if(heldKeys.has(code))return;heldKeys.add(code);if(started===null)started=now;}
 function release(code,now){if(!heldKeys.delete(code)||heldKeys.size)return;if(now-started<holdMs)selected=selected==='normal'?'slow':'normal';started=null;}
 function fast(now){return started!==null&&now-started>=holdMs;}
 function cancel(){heldKeys.clear();started=null;}
 return {press,release,cancel,fast,mode:now=>fast(now)?'fast':selected,reset(){cancel();selected='normal';},get selected(){return selected;}};
}
