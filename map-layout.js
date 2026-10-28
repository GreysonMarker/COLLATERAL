export const BLOCK=112;
export const RADIUS=16;
export const EDGE=(RADIUS+.5)*BLOCK;
export const PARK={x:9.5*BLOCK,z:6*BLOCK,width:198,depth:310};
export function isParkBlock(ix,iz){return ix>=9&&ix<=10&&iz>=5&&iz<=7}
export function zoneAt(ix,iz){const r=Math.max(Math.abs(ix),Math.abs(iz));return r>13?'residential':r>10?'outer':Math.abs(ix)<=2&&Math.abs(iz)<=2?'core':'middle'}
export function districtAt(x,z){if(z<-EDGE+22)return 'WATERFRONT';if(Math.abs(x-PARK.x)<PARK.width/2+8&&Math.abs(z-PARK.z)<PARK.depth/2+8)return 'EASTGROVE PARK';if(Math.abs(x)<330&&Math.abs(z)<330)return 'DOWNTOWN';if(Math.max(Math.abs(x),Math.abs(z))>1512)return 'CEDAR NEIGHBORHOODS';if(Math.max(Math.abs(x),Math.abs(z))>1176)return 'GARDEN DISTRICT';return 'MIDTOWN'}
// A broad continuous height envelope joins the core to surrounding districts.
// Local variation breaks up rings, while avenue clusters extend the skyline.
export function transitionHeight(x,z){
 const ix=x/BLOCK,iz=z/BLOCK,r=Math.hypot(ix,iz);
 const variation=.82+.34*(Math.abs(Math.sin(ix*17.17+iz*31.71))*1000%1);
 const envelope=14+225*Math.exp(-Math.pow(r/7.1,1.6));
 const avenue=32*Math.exp(-iz*iz/3)*Math.exp(-Math.pow((Math.abs(ix)-5)/4,2));
 const cluster=28*Math.exp(-((ix+6)**2+(iz-3.5)**2)/7);
 return Math.round((envelope*variation+avenue+cluster)/4.2)*4.2;
}
// Shared surface samples keep residential ground collision and crater colors aligned.
export function residentialSurface(x,z){
 const ix=Math.round(x/BLOCK),iz=Math.round(z/BLOCK),dx=x-ix*BLOCK,dz=z-iz*BLOCK;
 if(zoneAt(ix,iz)!=='residential'||Math.abs(dx)>41.5||Math.abs(dz)>41.5)return null;
 const index=Math.abs(ix*17+iz*31),bend=(index%3-1)*6;
 const step=Math.min(7,Math.max(0,Math.floor((dx+43)/10.75))),a=-43+step*10.75,t=(dx-a)/10.75;
 const lane=bend*((1-t)*Math.sin((a+43)/86*Math.PI)+t*Math.sin((a+53.75)/86*Math.PI));
 if(Math.abs(dz-lane)<4)return {height:.595,color:'#3c4864'};
 if(Math.abs(dz-lane)<6.5)return {height:.57,color:'#b8b5a8'};
 const offsets=index%5===0?[-30,-18,-6,6,18,30]:[-26,0,26];
 if(Math.abs(dz)>=5&&Math.abs(dz)<=17&&offsets.some(v=>Math.abs(dx-v)<.8))return {height:.60,color:'#b8b5a8'};
 return {height:.515,color:'#468579'};
}
