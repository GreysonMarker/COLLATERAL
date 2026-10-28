// Retract toward the character when terrain blocks the camera boom.
export function terrainCameraFraction(start,end,height,clearance=.16){
 const steps=Math.max(1,Math.ceil(start.distanceTo(end)/.12));
 for(let i=1;i<=steps;i++){const t=i/steps,x=start.x+(end.x-start.x)*t,y=start.y+(end.y-start.y)*t,z=start.z+(end.z-start.z)*t;if(y<height(x,z)+clearance)return (i-1)/steps;}
 return 1;
}
