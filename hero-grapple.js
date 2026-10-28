// Victim-authoritative grab handshake. Tokens prevent delayed releases grabbing a
// new target, and leases release either player if their connection disappears.
export function createHeroGrapple({send,peer,canGrab,receiveGrab,hold,release,now=()=>Date.now()}){
 let outgoing=null,incoming=null;
 function emit(target,action,token,extra={}){send({target,action,token,expires:now()+7000,...extra});}
 function cancel(){if(outgoing){emit(outgoing.id,'release',outgoing.token);outgoing=null;}if(incoming){emit(incoming.id,'cancel',incoming.token);incoming=null;release(null);}}
 return {
 request(id,mode='grab'){if(outgoing||incoming||!peer(id))return null;const target={kind:'hero',id,token:crypto.randomUUID(),actor:{},pending:true,mode};outgoing={...target,target,until:now()+3000};emit(id,'request',target.token,{mode});return target;},
 release(target,velocity){if(!outgoing||target.token!==outgoing.token)return;emit(target.id,'release',target.token,{velocity:velocity?.toArray()||null});outgoing=null;},
 receive(e,sender){if(!e||typeof e.token!=='string'||e.expires<now()||e.expires>now()+10000)return;
  if(e.action==='request'){
   const p=peer(sender);if(incoming||outgoing||!p||!canGrab(p,e.mode==='tackle'?'tackle':'grab'))return emit(sender,'reject',e.token);
   const result=receiveGrab(sender,p,e.mode);if(result?.damageBlocked||result?.parried)return emit(sender,'reject',e.token);
   incoming={id:sender,token:e.token,mode:e.mode==='tackle'?'tackle':'grab',until:now()+(e.mode==='tackle'?2300:6500)};emit(sender,'accept',e.token);
  }else if(e.action==='accept'&&outgoing?.id===sender&&outgoing.token===e.token){outgoing.target.pending=false;outgoing.until=now()+6000;}
  else if((e.action==='reject'||e.action==='cancel')&&outgoing?.id===sender&&outgoing.token===e.token){outgoing.target.actor.cut=true;outgoing=null;}
  else if(e.action==='release'&&incoming?.id===sender&&incoming.token===e.token){incoming=null;release(e.velocity);}
 },
 update(){if(outgoing&&(now()>outgoing.until||!peer(outgoing.id))){outgoing.target.actor.cut=true;emit(outgoing.id,'release',outgoing.token);outgoing=null;}
  if(incoming){const p=peer(incoming.id);if(now()>incoming.until||!p){emit(incoming.id,'cancel',incoming.token);incoming=null;release(null);}else hold(p,incoming.mode,incoming.id);}
 },cancel,get held(){return !!incoming;}
 };
}
