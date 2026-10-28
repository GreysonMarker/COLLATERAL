// Recovery advances with balance and available support, not a playback clock.
export function createGroundRecovery(){
 let phase='none',balance=0,progress=0,stalled=0;
 return {impact({flying,normal,closing,speed}){if(!flying&&normal.y>.55&&(closing>14||speed>25)){phase='sliding';balance=0;progress=Math.max(0,progress-.35);}},reset(){phase='none';balance=progress=stalled=0;},update(dt,{flying,grounded,speed,body={}}){
 if(!flying&&phase==='none'&&grounded&&speed<2.2&&body.active){phase='down';balance=progress=stalled=0;}
 if(flying){phase='none';balance=progress=stalled=0;}
 else if(phase!=='none'){
  stalled=grounded&&speed<2.2?stalled+dt:0;
  const forced=stalled>2;
  const stable=grounded&&speed<2.2&&(forced||(body.energy??0)<2.2);
  const support=grounded?Math.min(1,.35+(body.supports||0)*.22):0;
  balance=Math.max(0,Math.min(1,balance+dt*(stable?support*1.7:-2.5)));
  if(!grounded||speed>2.2){phase='sliding';progress=Math.max(0,progress-dt*.6);}
  else if(balance<.5&&progress<.05)phase='down';
  else{phase='rising';const obstruction=!forced&&(body.error>.48||body.energy>4);progress=Math.max(0,Math.min(1,progress+dt*(obstruction?-.16:.6*balance*(.6+support*.4))));if(progress>=1&&stable){phase='none';balance=progress=stalled=0;}}
 }
 return {phase,progress,grounded,balance,clearance:stalled>2};
 },get active(){return phase!=='none';},get locked(){return phase==='down'||phase==='rising';}};
}

// Probe the actual body footprint, including exposed floors inside damaged towers.
export function restingOnSolid(world,position,offsets,verticalSpeed){
 if(Math.abs(verticalSpeed)>1.8)return false;
 const radius=world.bodyRadius??.28;
 return offsets.some(o=>{const x=position.x+o.x,z=position.z+o.z,bottom=position.y+o.y-radius,floor=world.floorAt(x,z,bottom+.08,true),gap=bottom-floor;return gap>=-.08&&gap<=.12;});
}
