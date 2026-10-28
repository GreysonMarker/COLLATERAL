// Abbreviated reference beats: cheek down, brace, strained push, knee under,
// pause hunched over, then head and shoulders rise last.
export const GET_UP_SECONDS=2.8;
const frames=[
// t   height pitch roll chest head Larm Rarm Lelbow Relbow Lhip Rhip Lknee Rknee
[0,    .33,1.48,.16,.04,.12, .62,.46,-1.75,-1.45, -.10,-.18,.25,.40],
[.10,  .35,1.44,.12,.09,.23, .42,.25,-1.60,-1.20, -.15,-.25,.35,.55],
[.24,  .47,1.20,.04,.17,.30, .05,-.18,-1.05,-.85, -.45,-.55,.70,1.05],
[.32,  .44,1.25,.07,.23,.35, .15,-.08,-1.22,-.98, -.49,-.58,.80,1.12],
[.48,  .65,.85,-.05,.25,.34,-.35,-.40,-.65,-.55, -1.10,-.58,1.55,1.65],
[.62,  .84,.46,-.06,.30,.32,-.52,-.26,-.85,-.68, -.94,-.34,1.30,1.05],
[.74,  1.05,.19,-.04,.29,.29,-.32,-.10,-.95,-.54, -.40,-.14,.58,.37],
[.85,  1.15,.09,-.02,.22,.27,-.12,.03,-.65,-.35, -.15,-.07,.23,.13],
[1,    1.2,0,0,0,0,0,0,-.10,-.10,0,0,0,0]
];
const keys=['height','pitch','roll','chest','head','leftArm','rightArm','leftElbow','rightElbow','leftHip','rightHip','leftKnee','rightKnee'];
export function recoveryPose(progress){const t=Math.max(0,Math.min(1,progress));let i=0;while(i<frames.length-2&&t>frames[i+1][0])i++;const a=frames[i],b=frames[i+1],u=(t-a[0])/(b[0]-a[0]),s=u*u*(3-2*u);return Object.fromEntries(keys.map((key,j)=>[key,a[j+1]+(b[j+1]-a[j+1])*s]));}
