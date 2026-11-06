// Authored contact compositions. Timing is shared by physics, animation and rendering.
export const IMPACT_PROFILES=Object.freeze([
 ['Whiteout fracture',.32,0xf3f7ef,0x101523],['Black sun',.38,0x111321,0xe4faff],
 ['Crimson cross',.34,0x381321,0xffede0],['Cyan pressure',.36,0x13394b,0xcaffff],
 ['Split lightning',.31,0xf4eedc,0x1a1728],['Concentric crush',.40,0x171b26,0xe0f7ff],
 ['Diagonal shear',.33,0xe8eee4,0x142831],['Ink eruption',.37,0x0c1320,0xf1f5dd],
 ['Gold compression',.42,0x382819,0xffe1a0],['Broken halo',.35,0xe1f5ff,0x131b34],
 ['Scarlet fault',.39,0x22121a,0xff6c69],['Terminal star',.44,0xf5f5e8,0x0b2333]
].map(([name,hold,background,ink],index)=>Object.freeze({name,hold,background,ink,index})));
export function impactProfile(index=0){return IMPACT_PROFILES[((Math.trunc(Number(index)||0)%12)+12)%12];}
export function createImpactTimeline({onRelease=()=>{}}={}){let strike=null,beam=null,clock=0;
 return {strike(point,direction,index,visual){strike={point:point.clone(),direction:direction.clone(),profile:impactProfile(index),visual,age:0};},
 beam(point,direction,visual){if(!beam||beam.visual!==visual||clock-beam.last>.18)beam={age:0};Object.assign(beam,{point:point.clone(),direction:direction.clone(),visual,last:clock});},
 update(dt){clock+=dt;if(strike){const before=strike.age;strike.age+=dt;if(before<strike.profile.hold&&strike.age>=strike.profile.hold)onRelease(strike.point);if(strike.age>strike.profile.hold+.32)strike=null;}if(beam){beam.age+=dt;if(clock-beam.last>.24)beam=null;}},
 get current(){return strike?{...strike,laser:false,fade:Math.min(1,Math.max(0,1-(strike.age-strike.profile.hold)/.32))}:beam?{...beam,laser:true,profile:impactProfile(3),fade:Math.min(1,beam.age/.1)*Math.min(1,(.24-(clock-beam.last))/.12)}:null;},reset(){strike=beam=null;}};
}
