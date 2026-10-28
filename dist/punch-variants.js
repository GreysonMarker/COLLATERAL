// Six authored trajectories, mirrored for twelve choices per attack class.
const styles=[
 {name:'straight',wind:[.48,.45,-.30],hit:[.28,.50,.90],follow:[.24,.48,.87],twist:1,sink:0,pole:.22,pull:1},
 {name:'cross',wind:[.61,.48,-.40],hit:[.10,.54,.87],follow:[-.02,.51,.78],twist:1.25,sink:.015,pole:.26,pull:.85},
 {name:'hook',wind:[.83,.46,-.08],hit:[.12,.52,.59],follow:[-.28,.49,.48],twist:1.4,sink:.02,pole:.52,pull:0},
 {name:'body-shot',wind:[.62,.10,-.24],hit:[.18,.08,.76],follow:[-.02,.12,.65],twist:1.15,sink:.11,pole:-.02,pull:.2},
 {name:'uppercut',wind:[.42,-.04,-.18],hit:[.22,.72,.58],follow:[.16,.87,.48],twist:.85,sink:.08,pole:.02,pull:0},
 {name:'overhand',wind:[.62,.88,-.26],hit:[.15,.46,.80],follow:[-.04,.22,.69],twist:1.12,sink:.04,pole:.60,pull:.6}
];
export const PUNCH_VARIANTS=Object.freeze(styles.flatMap((style,index)=>[-1,1].map(side=>Object.freeze({id:index*2+(side===1?1:0),side,style:style.name}))));
export function createPunchVariationPicker(random=Math.random){
 const bags=new Map();let last=-1;
 return kind=>{let bag=bags.get(kind);if(!bag?.length){bag=[...PUNCH_VARIANTS];for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}bags.set(kind,bag);}
  if(bag.length>1&&bag.at(-1).id===last)[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];
  const choice=bag.pop();last=choice.id;return choice;
 };
}
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function varyPunchPose(p,kind,age,variant){
 if(!variant)return p;
 const definition=styles.find(s=>s.name===variant.style)||styles[0],side=variant.side===-1?-1:1,baseSide=kind==='quick'?-1:1,mirror=side/baseSide;
 for(const key of ['hipYaw','waistYaw','chestYaw','side'])p[key]*=mirror;
 p.strikeSide=side;p.longPull=definition.pull;p.poleY=definition.pole;
 const [impact,duration]=kind==='quick'?[.065,.23]:kind==='normal'?[.30,.78]:[1.1,2];
 const load=impact*(kind==='serious'?.86:.72),follow=impact+(duration-impact)*.20;
 const rest=[.38,.28,.18],wind=definition.wind.map((v,i)=>i===2&&kind==='serious'?v-.12:v);
 const points=[rest,wind,definition.hit,definition.follow,rest],times=[0,load,impact,follow,duration];
 const t=Math.max(0,Math.min(duration,age));let index=0;while(index<3&&t>times[index+1])index++;
 const blend=ease((t-times[index])/(times[index+1]-times[index])),a=points[index],b=points[index+1];
 p.handX=side*(a[0]+(b[0]-a[0])*blend);p.handY=a[1]+(b[1]-a[1])*blend;p.handZ=a[2]+(b[2]-a[2])*blend;
 const strength=kind==='quick'?.6:kind==='serious'?1.2:1,envelope=Math.sin(Math.PI*t/duration);
 p.hipYaw*=definition.twist;p.waistYaw*=definition.twist;p.chestYaw*=definition.twist;
 p.sink+=definition.sink*envelope*strength;
 if(definition.name==='body-shot')p.lean+=.10*envelope*strength;
 if(definition.name==='uppercut')p.lean-=.10*ease((t-load)/(impact-load))*envelope*strength;
 p.guardZ+=.04*envelope;p.gust*=1+(definition.twist-1)*.3;
 return p;
}
