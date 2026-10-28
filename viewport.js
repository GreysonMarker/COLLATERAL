// Keep game-space CSS pixels stable when Safari's visual viewport is zoomed.
export function gameViewport({width,height,scale=1,layoutWidth,screenWidth=0,screenHeight=0,coarse=false}){
 const pinch=Math.max(.1,scale||1),short=Math.min(screenWidth,screenHeight),long=Math.max(screenWidth,screenHeight);
 const phone=coarse&&short>0&&short<=500,landscape=width>height;
 const physicalWidth=landscape?long:short;
 const page=phone&&layoutWidth>0&&layoutWidth<physicalWidth*.94?physicalWidth/layoutWidth:1;
 const zoom=pinch*page;
 return {width:Math.max(1,width*zoom),height:Math.max(1,height*zoom),inverseScale:1/zoom};
}
