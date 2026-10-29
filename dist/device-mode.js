// Choose before allocating world effects: device mode controls both input and budgets.
export function graphicsProfile(mobile,dpr=1){
 return {maxRatio:Math.min(dpr,mobile?1.2:1.5),minRatio:Math.min(dpr,mobile?.85:1),shadowSize:mobile?1024:2048};
}
export function chooseDevice(){
 return new Promise(resolve=>{
  const panel=document.createElement('section');panel.id='device-choice';panel.setAttribute('aria-label','Choose your device');
  panel.innerHTML=`<div><span class="device-eyebrow">COLLATERAL</span><h1>How are you playing?</h1><p>Choose your controls and graphics profile.</p><div class="device-options"><button data-device="mobile"><b>Mobile</b><span>Touch controls<br>Lighter graphics & effects</span></button><button data-device="computer"><b>Computer</b><span>Keyboard + mouse or trackpad<br>Free camera · richer effects</span></button></div><p class="device-footnote">You can choose again when you reload the game.</p></div>`;
  document.body.append(panel);document.body.classList.add('choosing-device');
  for(const button of panel.querySelectorAll('button'))button.onclick=()=>{
   const mobile=button.dataset.device==='mobile';document.body.dataset.device=mobile?'mobile':'computer';document.body.classList.remove('choosing-device');panel.remove();resolve(mobile);
  };
 });
}
