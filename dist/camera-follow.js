// Soft horizontal recentering. Manual look always wins; vertical aim is untouched.
export function followYaw(yaw,vx,vz,dt,{manual=false,sinceLook=10,flying=false}={}){
 if(manual||sinceLook<1.2||Math.hypot(vx,vz)<1)return yaw;
 const target=Math.atan2(-vx,-vz),difference=Math.atan2(Math.sin(target-yaw),Math.cos(target-yaw));
 const deadZone=.07;if(Math.abs(difference)<=deadZone)return yaw;
 const resume=Math.min(1,(sinceLook-1.2)/.8),angle=difference-Math.sign(difference)*deadZone;
 const step=angle*(1-Math.exp(-dt*(flying?.8:1.15)))*resume,limit=(flying?.48:.65)*dt*resume;
 return yaw+Math.max(-limit,Math.min(limit,step));
}
