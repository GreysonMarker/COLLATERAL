import {varyPunchPose} from './punch-variants.js';
// Two-second silhouette-led pose: anticipation, coil, hip drive, impact, hold, recovery.
// Times align the fully extended fist with the Serious damage release at 1.1 seconds.
const keys=[
 // t, sink, hipYaw, waistYaw, chestYaw, lean, side, handX, handY, handZ, guardZ, gust
 [0,    0,    0,    0,    0,   0,    0, .38,.20,.05,.26,  0],
 [.28, .12, .20, .24, .12, .08,-.05, .52,.46,-.20,.40, 12],
 [.78, .24, .40, .36, .25,-.10,-.13, .54,.65,-.43,.48, 24],
 [.96, .26, .43, .40, .27,-.13,-.15, .54,.67,-.46,.49, 30],
 [1.04,.19,-.18, .04, .08, .15,-.06, .47,.57, .27,.31, 90],
 [1.10,.22,-.35,-.28,-.18, .32, .08, .30,.50, .88,.15,145],
 [1.22,.25,-.43,-.32,-.21, .38, .11, .28,.47, .89,.08,110],
 [1.48,.22,-.35,-.24,-.16, .29, .07, .31,.50, .82,.16, 65],
 [1.72,.08,-.18,-.13,-.07, .12, .03, .40,.45, .48,.28, 22],
 [2,    0,    0,    0,    0,   0,    0, .38,.20,.05,.26,  0]
];
const names=['sink','hipYaw','waistYaw','chestYaw','lean','side','handX','handY','handZ','guardZ','gust'];
export function seriousPunchPose(age,variant=null){
 const t=Math.max(0,Math.min(2,age));let index=0;while(index<keys.length-2&&t>keys[index+1][0])index++;
 const a=keys[index],b=keys[index+1],u=(t-a[0])/(b[0]-a[0]),s=u*u*(3-2*u),pose={};
 for(let j=0;j<names.length;j++)pose[names[j]]=a[j+1]+(b[j+1]-a[j+1])*s;
 const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 pose.weight=ease(t/.16)*(1-ease((t-1.65)/.35));
 pose.drive=ease((t-.96)/.14);pose.strikeSide=1;return varyPunchPose(pose,'serious',age,variant);
}

// Normal is a right cross; Quick is a short left jab. Both reach impact at the gameplay release time.
const normalKeys=[
 [0,0,0,0,0,0,0,.38,.20,.10,.30,0],
 [.12,.07,.18,.18,.10,-.04,-.04,.51,.40,-.25,.46,8],
 [.22,.11,.24,.23,.14,-.07,-.07,.56,.42,-.40,.49,12],
 [.30,.09,-.27,-.25,-.16,.23,.055,.28,.51,.90,.25,48],
 [.39,.10,-.34,-.28,-.16,.27,.07,.21,.48,.86,.20,36],
 [.53,.06,-.19,-.14,-.07,.13,.03,.32,.44,.55,.35,16],
 [.78,0,0,0,0,0,0,.38,.20,.10,.30,0]
];
const quickKeys=[
 [0,0,0,0,0,0,0,-.38,.28,.18,.36,0],
 [.025,.025,-.075,-.07,-.04,-.02,.025,-.43,.43,.14,.45,3],
 [.065,.035,.16,.17,.09,.13,-.045,-.27,.50,.85,.43,18],
 [.095,.035,.18,.19,.10,.15,-.05,-.25,.50,.84,.42,14],
 [.15,.018,.08,.08,.035,.055,-.02,-.36,.43,.42,.41,6],
 [.23,0,0,0,0,0,0,-.38,.28,.18,.36,0]
];
export function regularPunchPose(kind,age,variant=null){
 const quick=kind==='quick',table=quick?quickKeys:normalKeys,duration=quick?.23:.78,t=Math.max(0,Math.min(duration,age));
 let i=0;while(i<table.length-2&&t>table[i+1][0])i++;
 const a=table[i],b=table[i+1],u=(t-a[0])/(b[0]-a[0]),s=u*u*(3-2*u),pose={};
 for(let j=0;j<names.length;j++)pose[names[j]]=a[j+1]+(b[j+1]-a[j+1])*s;
 const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 pose.weight=ease(t/(quick?.018:.065))*(1-ease((t-(quick?.145:.53))/(quick?.085:.25)));
 pose.strikeSide=quick?-1:1;return varyPunchPose(pose,kind,age,variant);
}
