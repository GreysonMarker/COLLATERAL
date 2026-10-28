import * as T from './vendor/three.module.js';
// Decorative pieces are baked by joint and material, never given physics bodies.
export function addCharacterDetail({style,rig,head,arms,legs,all,toon}){
 const bins=new Map(),dark=toon(style.colors[0]),suit=toon(style.colors[1]),trim=toon(style.colors[4]),white=toon(style.colors[2]),skin=toon(style.colors[6]),hair=toon(style.colors[7]);
 const metal=style.id==='obsidian'||style.id==='violet';trim.roughness=metal?.38:.65;trim.metalness=metal?.45:.08;
 const edge=toon(new T.Color(style.colors[1]).multiplyScalar(1.28)),seam=toon('#0c1320'),red=toon('#c7203c'),glow=new T.MeshBasicMaterial({color:style.id==='violet'?'#e535ff':'#91f8ff',toneMapped:false});
 const block=new T.BoxGeometry(1,1,1),muscle=new T.SphereGeometry(1,8,5),knuckle=new T.IcosahedronGeometry(1,0);
 const torsoAnchors=new Map();
 function add(parent,mat,geo,x,y,z,sx,sy,sz,rz=0){if(parent===rig&&y>1.15){const anchorY=y>1.55?1.7:1.3;let anchor=torsoAnchors.get(anchorY);if(!anchor){anchor=new T.Group();anchor.position.y=anchorY;anchor.name='detail-spine-anchor';rig.add(anchor);torsoAnchors.set(anchorY,anchor);}parent=anchor;y-=anchorY;}const m=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),rz),new T.Vector3(sx,sy,sz));let byMat=bins.get(parent);if(!byMat){byMat=new Map();bins.set(parent,byMat);}if(!byMat.has(mat))byMat.set(mat,[]);const g=(geo.index?geo.toNonIndexed():geo.clone()).applyMatrix4(m);byMat.get(mat).push(g);}
 const box=(p,m,x,y,z,w,h,d,angle=0)=>add(p,m,block,x,y,z,w,h,d,angle);
 function shield(points){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.07,bevelThickness:.08});g.translate(0,0,-.5);return g;}
 const plate=shield([[-.5,.45],[.32,.5],[.5,.25],[.40,-.35],[0,-.52],[-.45,-.3]]),diamond=shield([[0,.5],[.5,0],[0,-.5],[-.5,0]]),wing=shield([[-.5,.4],[.56,.60],[.4,-.35],[-.28,-.5]]);
 const panel=(p,m,x,y,z,w,h,d,angle=0)=>add(p,m,plate,x,y,z,w,h,d,angle);
 const badge=(p,m,x,y,z,w,h,d)=>add(p,m,diamond,x,y,z,w,h,d);
 const stripe=(p,m,a,b,width,depth=.025)=>{const dx=b[0]-a[0],dy=b[1]-a[1];box(p,m,(a[0]+b[0])/2,(a[1]+b[1])/2,a[2],width,Math.hypot(dx,dy),depth,-Math.atan2(dx,dy));};
 // Sculpted fists with separate knuckle ridges, thumb and folded-finger seams.
 for(const a of arms){for(let i=0;i<4;i++){add(a.elbow,dark,knuckle,-.085+i*.056,-.365,.105,.034,.042,.036);box(a.elbow,seam,-.085+i*.056,-.402,.09,.008,.045,.04);}add(a.elbow,dark,knuckle,a.side*.105,-.34,.045,.048,.077,.07);panel(a.elbow,suit,0,-.335,-.08,.19,.12,.065);}
 for(const l of legs){box(l.ankle,seam,0,-.095,.075,.27,.04,.40);box(l.ankle,edge,0,-.066,.255,.24,.035,.025);for(const z of [-.07,.035,.14])box(l.ankle,dark,0,-.12,z,.24,.02,.018);panel(l.hip,suit,0,-.24,-.09,.22,.34,.10);}
 if(style.id!=='violet'){
  // Faceted cheek planes, chin, ears and individually shaped hair locks.
  for(const side of [-1,1]){panel(head,skin,side*.12,-.08,.16,.12,.14,.055,side*.18);box(head,toon(new T.Color(style.colors[6]).multiplyScalar(.7)),side*.212,.015,.025,.018,.065,.026);box(head,seam,side*.087,.112,.232,.105,.025,.018,side*.16);}
  panel(head,skin,0,-.16,.105,.19,.075,.065);box(head,seam,0,-.098,.204,.068,.009,.008);
  for(let i=0;i<11;i++){const x=-.17+i*.034;add(head,hair,knuckle,x,.25+Math.sin(i*2.3)*.025,-.015,.046,.075,.10,(i%3-1)*.22);}
  for(const side of [-1,1])for(let i=0;i<3;i++)panel(head,hair,side*.19,.10+i*.045,-.09,.065,.08,.12,side*.2);
 }
 if(style.id==='obsidian'){
  for(const side of [-1,1]){panel(rig,suit,side*.21,1.71,.25,.43,.32,.19,side*-.10);stripe(rig,trim,[side*.06,1.82,.36],[side*.34,1.91,.36],.065);stripe(rig,trim,[side*.15,1.31,.28],[side*.21,1.49,.28],.045);panel(rig,suit,side*.29,1.03,.13,.22,.32,.18,side*.30);box(rig,trim,side*.26,1.14,.22,.06,.13,.10);}
  badge(rig,trim,0,1.68,.43,.27,.43,.055);badge(rig,dark,0,1.68,.47,.15,.29,.045);badge(rig,trim,0,1.145,.30,.24,.22,.06);badge(rig,dark,0,1.145,.34,.13,.12,.035);
  for(const a of arms){for(let j=0;j<3;j++)panel(a.shoulder,j===1?edge:suit,a.side*(.045+j*.025),.07-j*.075,-.025,.36-j*.025,.15,.31,a.side*-.22);stripe(a.shoulder,trim,[-.16,-.02,.22],[.16,-.12,.22],.065);for(const y of [-.07,-.26])box(a.elbow,trim,0,y,.19,.28,.05,.045);panel(a.elbow,edge,0,-.17,.19,.21,.22,.07);}
  for(const l of legs){panel(l.knee,trim,0,.015,.18,.24,.20,.10);panel(l.knee,dark,0,-.24,.18,.23,.32,.10);stripe(l.knee,trim,[-.09,-.09,.25],[-.035,-.39,.25],.045);stripe(l.knee,trim,[.09,-.09,.25],[.035,-.39,.25],.045);}
  for(const side of [-1,1])box(rig,trim,side*.12,1.98,.10,.06,.14,.08);
 }
 if(style.id==='gold'){
  // Thin two-color suit: detail comes from muscle volume and seams, not armor.
  for(const side of [-1,1]){add(rig,suit,muscle,side*.21,1.72,.17,.24,.19,.17);for(let j=0;j<3;j++)add(rig,j%2?suit:dark,muscle,side*.095,1.49-j*.105,.18,.105,.075,.08);stripe(rig,trim,[side*.32,1.88,.28],[side*.31,1.61,.32],.085,.035);add(rig,dark,muscle,side*.25,1.43,.015,.11,.20,.13);}
  box(rig,trim,0,1.145,.20,.59,.12,.12);box(rig,trim,0,1.145,.28,.18,.15,.055);
  for(const a of arms){add(a.shoulder,suit,muscle,a.side*.025,-.015,0,.205,.205,.19);add(a.shoulder,suit,muscle,0,-.25,.045,.145,.17,.14);add(a.shoulder,dark,muscle,0,-.25,-.07,.14,.17,.12);add(a.elbow,suit,muscle,0,-.13,.035,.155,.17,.14);}
  for(const l of legs){add(l.hip,suit,muscle,0,-.20,.07,.155,.25,.15);add(l.knee,suit,muscle,0,-.18,-.035,.13,.19,.12);}
  stripe(head,toon('#833d42'),[.065,.20,.224],[.13,-.07,.224],.012,.006);
 }
 if(style.id==='violet'){
  for(const a of arms){add(a.shoulder,suit,wing,a.side*.09,.06,.015,.49,.35,.36,-a.side*.18);stripe(a.shoulder,trim,[-a.side*.12,.20,.23],[-a.side*.03,-.02,.23],.055,.045);stripe(a.shoulder,glow,[-.13,-.06,.25],[.15,.005,.25],.035);panel(a.elbow,trim,0,-.15,.195,.27,.33,.04);panel(a.elbow,suit,0,-.15,.225,.19,.24,.04);box(a.elbow,glow,0,-.15,.25,.043,.20,.018);}
  badge(rig,trim,0,1.70,.39,.35,.40,.08);badge(rig,suit,0,1.70,.45,.25,.29,.065);badge(rig,glow,0,1.70,.50,.14,.19,.04);
  for(const side of [-1,1]){stripe(rig,glow,[side*.34,1.61,.275],[side*.18,1.46,.275],.025);stripe(rig,glow,[side*.18,1.46,.275],[side*.13,1.26,.275],.025);panel(head,trim,side*.16,-.05,.245,.10,.27,.04,side*.12);panel(head,dark,side*.075,-.07,.28,.12,.22,.055,side*-.12);panel(head,edge,side*.18,.31,.01,.09,.38,.13,side*-.08);}
  stripe(head,trim,[-.22,.13,.25],[0,.08,.25],.045);stripe(head,trim,[0,.08,.25],[.22,.13,.25],.045);
  badge(rig,trim,0,1.14,.27,.25,.19,.06);badge(rig,trim,0,.91,.25,.26,.40,.05);badge(rig,suit,0,.93,.29,.18,.30,.04);
  for(const l of legs){panel(l.knee,trim,0,0,.18,.21,.22,.09);panel(l.knee,suit,0,-.24,.18,.27,.34,.10);box(l.knee,glow,0,-.25,.24,.045,.25,.02);panel(l.ankle,suit,0,.02,.15,.25,.15,.20);}
 }
 if(style.id==='lanky'){
  badge(rig,white,0,1.72,.35,.39,.39,.045);badge(rig,red,0,1.72,.395,.13,.23,.04);
  for(const side of [-1,1]){stripe(rig,white,[0,1.76,.31],[side*.39,1.80,.31],.08);stripe(rig,white,[side*.20,1.22,.25],[side*.23,1.52,.25],.035);stripe(rig,red,[side*.26,1.22,.24],[side*.29,1.51,.24],.05);box(rig,red,side*.23,1.145,.22,.10,.13,.07);add(rig,trim,knuckle,side*.33,1.88,.18,.08,.08,.04);}
  box(rig,trim,0,1.145,.26,.22,.12,.06);
  for(const a of arms){panel(a.elbow,white,0,-.16,.18,.26,.30,.07);box(a.elbow,red,0,-.16,.23,.06,.24,.018);box(a.elbow,suit,0,-.30,.13,.26,.05,.10);}
  for(const l of legs){panel(l.knee,white,0,-.02,.18,.21,.19,.07);box(l.knee,red,0,-.25,.205,.065,.28,.03);box(l.ankle,red,0,-.07,.12,.25,.04,.30);}
 }
 if(style.id==='teal'){
  badge(rig,white,0,1.72,.36,.34,.36,.05);badge(rig,trim,0,1.72,.41,.18,.23,.045);
  for(const side of [-1,1]){stripe(rig,white,[side*.28,1.56,.29],[0,1.36,.29],.10,.045);stripe(rig,suit,[side*.29,1.04,.20],[side*.19,.88,.20],.05);panel(head,dark,side*.088,.066,.221,.20,.12,.035,side*.14);panel(head,glow,side*.088,.066,.246,.10,.045,.012,side*.14);box(rig,trim,side*.26,1.145,.20,.11,.15,.12);}
  for(let i=0;i<2;i++)box(rig,suit,0,1.22+i*.09,.24,.23,.035,.03);box(rig,glow,0,1.145,.28,.18,.095,.035);
  for(const a of arms){panel(a.shoulder,white,a.side*.03,.015,.10,.32,.30,.19,a.side*-.12);panel(a.shoulder,suit,a.side*.04,.035,.21,.23,.22,.07,a.side*-.12);box(a.shoulder,trim,a.side*.17,.005,.15,.055,.12,.10);panel(a.elbow,suit,0,-.16,.24,.16,.24,.04);box(a.elbow,glow,0,-.16,.27,.045,.18,.02);box(a.elbow,trim,a.side*.13,-.08,.15,.05,.12,.08);}
  for(const l of legs){panel(l.knee,white,0,0,.19,.24,.20,.07);panel(l.knee,trim,0,0,.24,.16,.13,.03);box(l.knee,suit,0,-.25,.21,.13,.26,.04);box(l.ankle,trim,0,.065,.21,.09,.13,.035);box(l.ankle,white,0,-.02,.25,.24,.07,.04);}
 }

 // Rear plates use the same joint/material batches as the front.
 // Negative Z is the back; trim sits beyond the plate surface, not buried in it.
 for(const side of [-1,1]){
  if(style.id==='gold'){
   add(rig,suit,muscle,side*.19,1.72,-.15,.22,.20,.14);
   add(rig,dark,muscle,side*.23,1.47,-.10,.14,.23,.12);
   stripe(rig,trim,[side*.31,1.91,-.19],[side*.29,1.60,-.29],.08,.04);
   stripe(rig,seam,[side*.06,1.64,-.265],[side*.09,1.30,-.265],.013,.009);
  }else{
   panel(rig,dark,side*.20,1.70,-.20,.40,.37,.14,side*.10);
   panel(rig,suit,side*.21,1.74,-.285,.32,.25,.075,side*.16);
   panel(rig,edge,side*.22,1.58,-.25,.27,.12,.065,side*-.13);
   for(let i=0;i<3;i++)panel(rig,suit,side*.19,1.45-i*.09,-.19,.25-i*.025,.105,.09,side*.18);
   const edging=style.id==='lanky'||style.id==='teal'?white:trim;
   stripe(rig,edging,[side*.34,1.85,-.34],[side*.10,1.64,-.34],.045,.028);
   // Side ribs bridge the front and back plates.
   for(let i=0;i<3;i++)box(rig,dark,side*(.30-i*.012),1.48-i*.075,0,.055,.04,.39);
  }
  box(rig,trim,side*.21,1.145,-.205,.18,.095,.055);
 }
 if(metal){
  // Articulated central back armor with a recessed channel and small fasteners.
  box(rig,dark,0,1.69,-.285,.095,.43,.065);
  for(let i=0;i<4;i++)panel(rig,style.id==='violet'?suit:edge,0,1.85-i*.085,-.325,.105,.075,.045);
  for(const side of [-1,1])for(const y of [1.82,1.66])add(rig,trim,knuckle,side*.29,y,-.34,.018,.018,.012);
  panel(rig,suit,0,1.30,-.23,.22,.18,.07);
  badge(rig,trim,0,1.145,-.25,.15,.12,.035);
  for(const a of arms){
   for(let i=0;i<2;i++)panel(a.shoulder,suit,a.side*.06,.04-i*.11,-.18,.31,.16,.11,-a.side*.18);
   stripe(a.shoulder,trim,[-.13,-.05,-.25],[.13,-.05,-.25],.035);
   panel(a.elbow,suit,0,-.14,-.145,.24,.27,.085);
   box(a.elbow,trim,0,-.27,-.195,.22,.045,.035);
  }
  for(const l of legs){
   panel(l.hip,suit,0,-.23,-.13,.25,.30,.10);
   panel(l.knee,suit,0,-.25,-.14,.23,.29,.09);
   box(l.knee,trim,0,-.34,-.195,.20,.04,.03);
   panel(l.ankle,edge,0,.015,-.135,.23,.14,.075);
  }
 }
 if(style.id==='violet'){
  badge(rig,trim,0,1.77,-.36,.19,.23,.04);
  badge(rig,glow,0,1.77,-.39,.10,.14,.025);
  for(const side of [-1,1]){
   stripe(rig,glow,[side*.28,1.69,-.34],[side*.12,1.57,-.34],.021,.018);
   stripe(rig,glow,[side*.12,1.48,-.25],[side*.09,1.28,-.25],.020,.018);
   panel(head,suit,side*.12,.04,-.19,.19,.32,.09,side*.12);
   stripe(head,trim,[side*.17,.17,-.25],[side*.10,-.12,-.25],.025,.02);
  }
  for(const a of arms)box(a.elbow,glow,0,-.15,-.20,.035,.16,.012);
  for(const l of legs)box(l.knee,glow,0,-.24,-.195,.028,.18,.012);
 }
 if(style.id==='teal'){
  for(const side of [-1,1]){
   stripe(rig,white,[side*.29,1.66,-.34],[0,1.47,-.34],.065,.03);
   panel(rig,trim,side*.28,1.80,-.34,.075,.08,.025);
  }
  badge(rig,suit,0,1.75,-.35,.22,.23,.04);
  badge(rig,glow,0,1.75,-.38,.10,.12,.02);
  for(let i=0;i<3;i++)box(rig,suit,0,1.38-i*.07,-.24,.17,.028,.025);
  for(const a of arms){panel(a.shoulder,white,a.side*.02,.01,-.17,.27,.24,.08);panel(a.shoulder,suit,a.side*.025,.02,-.22,.18,.16,.035);panel(a.elbow,white,0,-.16,-.14,.23,.28,.065);box(a.elbow,suit,0,-.16,-.185,.12,.20,.025);}
  for(const l of legs){panel(l.knee,white,0,-.25,-.13,.20,.29,.06);box(l.knee,suit,0,-.25,-.17,.085,.23,.025);panel(l.ankle,trim,0,.02,-.14,.13,.10,.03);}
 }
 if(style.id==='lanky'){
  // Back crest and seam lines remain visible whenever the cape lifts in flight.
  badge(rig,white,0,1.72,-.335,.28,.31,.035);
  badge(rig,red,0,1.72,-.36,.12,.18,.02);
  for(const side of [-1,1]){stripe(rig,red,[side*.24,1.47,-.255],[side*.19,1.22,-.255],.05);stripe(rig,white,[side*.18,1.47,-.265],[side*.14,1.22,-.265],.025);}
  for(const a of arms){panel(a.elbow,white,0,-.16,-.14,.22,.29,.065);box(a.elbow,red,0,-.16,-.185,.05,.22,.02);}
  for(const l of legs){panel(l.knee,white,0,-.25,-.13,.19,.29,.06);box(l.knee,red,0,-.25,-.17,.05,.23,.02);}
 }
 for(const [parent,byMat] of bins)for(const [mat,geometries] of byMat){const g=new T.BufferGeometry();for(const name of ['position','normal','uv']){const size=name==='uv'?2:3,total=geometries.reduce((n,v)=>n+v.attributes[name].array.length,0),data=new Float32Array(total);let at=0;for(const geo of geometries){data.set(geo.attributes[name].array,at);at+=geo.attributes[name].array.length;}g.setAttribute(name,new T.BufferAttribute(data,size));}g.computeBoundingSphere();const mesh=new T.Mesh(g,mat);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);all.push(mesh);for(const geo of geometries)geo.dispose();}
 for(const geo of [block,muscle,knuckle,plate,diamond,wing])geo.dispose();
}
