// Bounded, local-only measurements. Percentiles are computed only on request.
export function createFrameProfiler(clock=()=>performance.now()){
 const size=240,frames=new Float64Array(size),sections=new Map();let index=0,count=0;
 function frame(ms){index=(index+1)%size;frames[index]=ms;count=Math.min(size,count+1);for(const s of sections.values())s[index]=0;}
 function wrap(object,methods,label){for(const name of methods){const original=object[name];if(typeof original!=='function')continue;const key=label+'.'+name,values=new Float64Array(size);sections.set(key,values);object[name]=function(...args){const start=clock();try{return original.apply(this,args);}finally{values[index]+=clock()-start;}};}}
 function summary(values){const a=Array.from(values).filter((_,i)=>count===size||i>0&&i<=count).sort((a,b)=>a-b);if(!a.length)return {averageMs:0,p95Ms:0,maxMs:0};return {averageMs:a.reduce((x,y)=>x+y,0)/a.length,p95Ms:a[Math.ceil(a.length*.95)-1],maxMs:a.at(-1)};}
 function snapshot(){return {frames:count,frame:summary(frames),sections:Object.fromEntries([...sections].map(([key,value])=>[key,summary(value)])),note:'CPU timings; nested sections overlap. Rendering measures submission, not GPU completion.'};}
 return {frame,wrap,snapshot};
}
