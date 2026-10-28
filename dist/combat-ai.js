// Deliberately delayed perception. Decisions use the previous observation, not
// this frame's input; attacks commit to that aim and can miss a moving hero.
export function createCombatAI(random=Math.random){
 let timer=.3,seen=null,guard=0,attackWait=.7,strafe=1,strategy=0;
 return {reset(){timer=.3;seen=null;guard=0;attackWait=.7;strategy=0;},update(dt,observation,{busy=false,canAttack=()=>true}={}){
  timer-=dt;guard=Math.max(0,guard-dt);attackWait=Math.max(0,attackWait-dt);let attack=null,parry=false;
  if(timer<=0){timer=.24+random()*.20;const previous=seen;seen={...observation,position:observation.position.clone(),velocity:observation.velocity.clone()};
   if(previous){strategy++;if(strategy%4===0)strafe=random()<.5?-1:1;
    if(!busy&&previous.attacking&&previous.distance<14&&random()<.48){guard=.32+random()*.45;parry=random()<.12;}
    else if(!busy&&attackWait<=0&&guard<=0&&previous.alive){
     const roll=random();let kind=previous.distance<6.5?(roll<.23?'quick':roll<.84?'normal':'serious'):previous.distance<140&&roll<.52?'serious':null;
     if(kind&&canAttack(kind)){attack=kind;attackWait=kind==='quick'?.70+random()*.40:kind==='normal'?.65+random()*.35:1.3;}
    }
   }
  }
  return {seen,attack,parry,blocking:guard>0&&!busy,strafe,laser:seen?.alive&&seen.distance>18&&seen.distance<100&&strategy%7===0&&!busy&&guard<=0};
 }};
}
