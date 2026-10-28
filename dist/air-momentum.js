// Preserve launch/flight velocity; airborne steering adds acceleration rather than
// replacing momentum with walking speed. Gravity is integrated separately.
export function coast(velocity,inputX,inputZ,dt){
 const drag=Math.exp(-.22*dt);velocity.x=velocity.x*drag+inputX*7*dt;velocity.z=velocity.z*drag+inputZ*7*dt;
}
