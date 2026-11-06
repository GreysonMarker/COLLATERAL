import {isTitan} from './titan-powers.js';
// v² = 2gh: scale speed thresholds by sqrt(height) for proportional falls.
export function titanLocomotionSafe({character,flying,vertical,combat=false,dead=false,held=false}){
 return isTitan(character)&&!flying&&!combat&&!dead&&!held&&Math.abs(vertical)<14*Math.sqrt(character.height);
}
