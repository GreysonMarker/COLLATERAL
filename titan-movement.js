// Titan translation never consults scenery colliders. Damage is a separate pass.
export function moveTitan(position,velocity,vertical,dt,{grounded,ground,confine}){
 position.x+=velocity.x*dt;position.z+=velocity.z*dt;
 position.y+=vertical*dt;
 const floor=ground(position.x,position.z);
 const supported=vertical<=0&&(grounded||position.y<=floor);
 if(supported){position.y=floor;vertical=0;}
 velocity.y=vertical;
 confine?.(position,velocity);
 return {grounded:supported,vertical:velocity.y};
}
