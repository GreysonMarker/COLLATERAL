export const FLIGHT_SPEEDS=Object.freeze({slow:26.775,normal:63.75,fast:142.5});
export const RISE_SPEED=8.4;
export function nextFlightMode(mode){return {slow:'normal',normal:'fast',fast:'slow'}[mode]||'normal';}
