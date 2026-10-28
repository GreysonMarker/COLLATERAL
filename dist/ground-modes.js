export const GROUND_SPEEDS=Object.freeze({slow:3.2,walk:12*.55,sprint:12});
export const groundLabel=mode=>mode==='slow'?'SLOW WALK':mode.toUpperCase();
export const nextGroundMode=mode=>mode==='walk'?'sprint':mode==='sprint'?'slow':'walk';
