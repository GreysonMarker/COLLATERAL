// Camera pitch is positive when looking down; joystick forward follows the view.
export function movementVector(x, forward, yaw, pitch, flying, speed) {
  const length=Math.hypot(x,forward);if(length>1){x/=length;forward/=length;}
  const cp=flying?Math.cos(pitch):1;
  return {x:(x*Math.cos(yaw)-forward*Math.sin(yaw)*cp)*speed,
    y:flying?-forward*Math.sin(pitch)*speed:0,
    z:(-x*Math.sin(yaw)-forward*Math.cos(yaw)*cp)*speed};
}
