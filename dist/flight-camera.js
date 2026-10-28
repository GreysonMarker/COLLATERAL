// Render-only wind buffeting: never feeds back into steering or camera follow.
export function createFlightCamera(){
  let strength=0,time=0;
  const rotation={x:0,y:0,z:0};
  return {update(dt,speed,flying,reducedMotion=false){
    time+=dt;
    const airspeed=Math.min(1,Math.max(0,speed)/142.5);
    const target=flying&&!reducedMotion?.006*Math.pow(airspeed,1.15):0;
    strength+=(target-strength)*(1-Math.exp(-dt*5));
    if(reducedMotion)strength=0;
    // Mixed frequencies keep the motion continuous without a regular bobbing loop.
    rotation.x=strength*(.56*Math.sin(time*24.7)+.28*Math.sin(time*39.1+1.7)+.16*Math.sin(time*9.3));
    rotation.y=strength*.75*(.6*Math.sin(time*21.3+.8)+.25*Math.sin(time*34.9)+.15*Math.sin(time*7.7+2.1));
    rotation.z=strength*.65*(.65*Math.sin(time*12.1+2.4)+.35*Math.sin(time*19.7));
    return rotation;
  }};
}
