import {PARRY_WINDOW,PARRY_RECOVERY} from './combat-rules.js';
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function defensePose(state){
 if(!state)return null;
 if(state.phase==='parry'){
  const t=state.age/PARRY_WINDOW,slap=smooth((t-.12)/.50);
  return {weight:1,right:[.42-.95*slap,.58+.16*Math.sin(t*Math.PI),.30+.40*Math.sin(t*Math.PI)],left:[-.30,.57,.35],twist:-.24+.5*slap,lean:.04,open:true};
 }
 if(state.phase==='vulnerable')return {weight:1-smooth((state.age-(PARRY_RECOVERY-.15))/.15),right:[.60,.24,.24],left:[-.52,.32,.25],twist:.18,lean:-.10,open:true};
 if(state.stun>0)return {weight:1,right:[.50,.22,.15],left:[-.48,.28,.20],twist:.05,lean:-.12,open:true};
 if(state.blocking)return {weight:1,right:[-.06,.70,.48],left:[.05,.57,.53],twist:-.12,lean:.10,open:false};
 return null;
}
