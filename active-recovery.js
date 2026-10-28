// Balance-controller intent. These are joint goals, not a timed animation:
// the articulated solver can yield, stall or be knocked away from every goal.
export function activeRecoveryPose(progress,body={}){
 const p=Math.max(0,Math.min(1,progress)),remaining=1-p,kneeling=Math.sin(Math.PI*p),support=Math.min(1,(body.supports||0)/2),strain=Math.min(1,(body.energy||0)/5);
 return {height:.34+.86*p,pitch:1.44*remaining**1.5,roll:(body.bracing===1?.07:0)*remaining,chest:.20*kneeling,head:.18*remaining+.13*strain,
 leftArm:.45*remaining-.65*kneeling,rightArm:.3*remaining-.45*kneeling,
 leftElbow:-.1-1.45*remaining*(.6+.4*support),rightElbow:-.1-1.25*remaining,
 leftHip:-.15*remaining-.9*kneeling,rightHip:-.15*remaining-.40*kneeling,
 leftKnee:.25*remaining+1.1*kneeling,rightKnee:.35*remaining+1.4*kneeling};
}
