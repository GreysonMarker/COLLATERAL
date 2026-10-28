export const MAX_HEALTH=1000;
export const ATTACK_DAMAGE={quick:25,normal:50,serious:100,flight:75,tackle:75,clash:150,heat:2.5};
export function createHealth({onDamage=()=>{},onKO=()=>{}}={}){
 let value=MAX_HEALTH,respawn=0,clock=0,combatUntil=0,impactUntil=-1,slide=0,slideSpent=0,lastSlide=-1,impactGrace=0;const contacts=new Map();
 function damage(amount){if(value<=0||!Number.isFinite(amount)||amount<=0)return 0;const loss=Math.min(value,amount);value-=loss;combatUntil=clock+12;onDamage(loss,value);if(value<=0){respawn=3;onKO();}return loss;}
 return {damage,get value(){return value;},get dead(){return value<=0;},get respawn(){return respawn;},get inCombat(){return clock<combatUntil;},
 suppressImpacts(){impactGrace=clock+.7;},
 launch(){impactUntil=clock+12;slide=slideSpent=0;contacts.clear();},
 impact(contact,velocity,{held=false}={}){if(value<=0||clock<impactGrace||(!held&&clock>impactUntil)||contact?.solid?.kind==='arena')return 0;
 const closing=Math.max(0,-velocity.dot(contact.normal)),speed=velocity.length(),ground=contact.normal.y>.55,scale=held?1:.5;
 if(speed<10)return 0;const key=ground?'ground':contact.solid?.building||contact.solid||'wall';
 if(closing>=12){if((contacts.get(key)??-Infinity)>clock-.65)return 0;contacts.set(key,clock);return (ground?60:15)*scale;}
 // Each simulation frame contributes once even when movement has hundreds of substeps.
 if(lastSlide===clock||slideSpent>=30*scale)return 0;lastSlide=clock;slide+=Math.min(.05,this.dt||0)*10*scale*Math.min(1,speed/40);
 if(slide<1)return 0;const amount=Math.min(Math.floor(slide),30*scale-slideSpent);slide-=amount;slideSpent+=amount;return amount;
 },
 dt:0,update(dt){this.dt=dt;clock+=dt;if(value<=0){respawn=Math.max(0,respawn-dt);return respawn===0;}return false;},
 reset(){value=MAX_HEALTH;respawn=0;impactGrace=0;impactUntil=-1;slide=slideSpent=0;contacts.clear();}
 };
}
export function createHeatBudget(){let charge=3,cooldown=0;return {get charge(){return charge;},get cooldown(){return cooldown;},update(dt,firing){if(cooldown>0){cooldown=Math.max(0,cooldown-dt);if(cooldown===0)charge=3;return 0;}if(!firing)return 0;const used=Math.min(dt,charge);charge=Math.max(0,charge-used);if(charge<1e-8){charge=0;cooldown=10;}return used;},reset(){charge=3;cooldown=0;}};}
