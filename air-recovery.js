export const AIR_RECOVERY_SECONDS=2;
// Only uninterrupted simulation time while airborne counts toward escape.
export function createAirRecovery(){
 let active=false,elapsed=0,interrupted=false;
 return {
  start(){active=true;elapsed=0;interrupted=false;},
  interrupt(){if(active){elapsed=0;interrupted=true;}},
  reset(){active=false;elapsed=0;interrupted=false;},
  update(dt,{airborne,held=false}){
   if(!active)return false;
   if(held||!airborne){this.reset();return false;}
   if(interrupted){interrupted=false;return false;}
   const wasReady=elapsed>=AIR_RECOVERY_SECONDS;
   elapsed=Math.min(AIR_RECOVERY_SECONDS,elapsed+dt);
   if(AIR_RECOVERY_SECONDS-elapsed<1e-9)elapsed=AIR_RECOVERY_SECONDS;
   return !wasReady&&elapsed>=AIR_RECOVERY_SECONDS;
  },
  get active(){return active;},get ready(){return active&&elapsed>=AIR_RECOVERY_SECONDS;},
  get remaining(){return active?Math.max(0,AIR_RECOVERY_SECONDS-elapsed):0;}
 };
}
