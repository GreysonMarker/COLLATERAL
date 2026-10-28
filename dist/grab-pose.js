export const THROW_RELEASE=1.05,THROW_DURATION=1.65;
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
export function throwPose(age){
 const load=ease(age/.78),drive=ease((age-.78)/.27),fade=1-ease((age-1.25)/.40);
 return {load,drive,weight:fade,twist:(-.95*load+1.55*drive)*fade,
  handX:.35+.26*load-.36*drive,handY:.75+.25*load-.18*drive,
  handZ:.63-1.35*load+1.65*drive,sink:.15*load*(1-drive),lean:-.16*load+.42*drive,gust:drive*36*fade};
}
