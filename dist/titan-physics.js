// v² = 2gh: scale speed thresholds by sqrt(height) for proportional falls.
export function titanLocomotionSafe({character,flying,vertical,combat=false,dead=false,held=false}){
 return character.id==='monolith'&&!flying&&!combat&&!dead&&!held&&Math.abs(vertical)<14*Math.sqrt(character.height);
}
