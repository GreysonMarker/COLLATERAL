// Original AAC packets copied from the supplied video: no synthesis, filters,
// time stretching, crossfades or gameplay-driven scheduling.
export function createBackgroundMusic({storage,mediaFactory=()=>new Audio(new URL('./meridian-original-soundtrack.m4a',import.meta.url).href)}={}){
 let media,source,gain,context,volume=.4,muted=false,hidden=false,active=false;
 try{const saved=storage?.getItem('meridian-music');if(saved!==null&&saved!==undefined&&Number.isFinite(Number(saved)))volume=Math.max(0,Math.min(1,Number(saved)));}catch{}
 try{media=mediaFactory();media.loop=true;media.preload='auto';media.playbackRate=1;media.defaultPlaybackRate=1;media.setAttribute('playsinline','');media.load?.();}catch{}
 function level(){if(gain)gain.gain.value=muted?0:volume;else if(media)media.muted=muted;}
 function play(){if(!media||!active||hidden||!media.paused)return;try{const result=media.play();result?.catch(()=>{});}catch{}}
 function start(ctx){
  if(active)return;
  active=true;
  try{
   if(!source&&ctx&&media){context=ctx;gain=context.createGain();source=context.createMediaElementSource(media);source.connect(gain);gain.connect(context.destination);}
   if(media)media.currentTime=0;
   level();play(); // Called synchronously by ENTER CITY, within its user gesture.
  }catch{level();play();}
 }
 function stop(){active=false;media?.pause();if(media)media.currentTime=0;}
 return {start,stop,setHidden(value){hidden=!!value;if(hidden)media?.pause();else play();},setMuted(value){muted=!!value;level();},setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));try{storage?.setItem('meridian-music',String(volume));}catch{}level();},get volume(){return volume;}};
}
