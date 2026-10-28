// Resolution adapts only after sustained load. A single punch or tab resume must
// not permanently remove shadows, and recovered headroom restores sharpness.
export function createAdaptiveQuality(maxRatio,minRatio=Math.min(1,maxRatio)){
 let ratio=maxRatio,elapsed=0,samples=0,slow=0,steady=0;
 function reset(){ratio=maxRatio;elapsed=samples=slow=steady=0;return ratio;}
 function update(ms){
  if(!Number.isFinite(ms)||ms<=0||ms>250){elapsed=samples=slow=steady=0;return null;}
  elapsed+=ms;samples++;if(ms>24)slow++;
  if(elapsed<2000)return null;
  const mean=elapsed/samples,old=ratio;
  if(mean>23&&slow/samples>.3){ratio=Math.max(minRatio,Math.round((ratio-.1)*100)/100);steady=0;}
  else if(mean<18){steady+=elapsed;if(steady>=8000){ratio=Math.min(maxRatio,Math.round((ratio+.05)*100)/100);steady=0;}}
  else steady=0;
  elapsed=samples=slow=0;return ratio!==old?ratio:null;
 }
 return {update,reset,get ratio(){return ratio;}};
}
