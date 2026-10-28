// Shared, grounded two-bone gait. +Z is forward. Feet flatten during stance.
export function gait(phase,amount=1,run=0,upper=.46,lower=.47,brisk=0){
 const cycle=((phase/(Math.PI*2))%1+1)%1,stance=.62-run*.15-brisk*.045;
 const reach=(.25+run*.18+brisk*.10)*amount;
 let z,lift,roll;
 if(cycle<stance){const t=cycle/stance;z=reach*(1-2*t);lift=0;roll=Math.max(0,(t-.8)/.2)*.13*amount;}
 else{const t=(cycle-stance)/(1-stance),s=t*t*(3-2*t);z=reach*(2*s-1);lift=Math.sin(Math.PI*t)*(.09+run*.14+brisk*.025)*amount;roll=-Math.sin(Math.PI*t)*.15;}
 // Keep a soft knee through support instead of locking it at each stride end.
 const supportFlex=cycle<stance?Math.sin(Math.PI*cycle/stance)*.012:0;
 const down=Math.sqrt(Math.max(.01,(upper+lower-.018-supportFlex)**2-z*z))-lift;
 const distance=Math.min(upper+lower-.001,Math.hypot(down,z));
 const clamp=n=>Math.max(-1,Math.min(1,n));
 const hip=Math.atan2(-z,down)-Math.acos(clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance)));
 const knee=Math.PI-Math.acos(clamp((upper*upper+lower*lower-distance*distance)/(2*upper*lower)));
 return {hip:hip*amount,knee:knee*amount,ankle:(-hip-knee+roll)*amount,arm:Math.cos(phase-.12)*(.29+run*.44+brisk*.19)*amount};
}
export const gaitRate=(speed,run=0)=>Math.PI*2*(.70+Math.min(speed,4)*.13+run*.24);
// Contact, compression, toe-off, heel recovery, knee drive, extension.
const sprintKeys=[
 [0,-.86,.22,.50],[.16,-.27,.43,-.16],[.38,.62,.12,-.70],
 [.54,.36,1.72,-1.02],[.72,-.91,1.68,-.66],[.90,-1.02,.48,.40],[1,-.86,.22,.50]
];
export function sprintGait(phase,amount=1){
 const t=((phase/(Math.PI*2))%1+1)%1;let i=0;while(sprintKeys[i+1][0]<t)i++;
 const a=sprintKeys[i],b=sprintKeys[i+1],u=(t-a[0])/(b[0]-a[0]),ease=u*u*(3-2*u);
 return {hip:(a[1]+(b[1]-a[1])*ease)*amount,knee:(a[2]+(b[2]-a[2])*ease)*amount,ankle:(a[3]+(b[3]-a[3])*ease)*amount,arm:Math.cos(phase)*1.04*amount};
}

// A purposeful heel-to-toe walk, retaining double support and relaxed knees.
export const walkingGait=(phase,amount=1,brisk=0)=>gait(phase,amount,0,.46,.47,brisk);
