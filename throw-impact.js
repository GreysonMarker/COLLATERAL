// Ground severity considers inward speed and whether the wheels face down.
export function explosiveLanding(velocity,pitch=0,roll=0){
 const down=Math.max(0,-velocity.y),speed=velocity.length(),upright=Math.cos(pitch)*Math.cos(roll);
 return down>24||(upright<.45&&down>9&&speed>30);
}
