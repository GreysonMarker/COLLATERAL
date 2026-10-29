import {desktopVisuals,finishCharacterMaterial} from './visual-polish.js';
import * as T from './vendor/three.module.js';
import {createCharacterFace} from './character-face.js';
// Complete replacement silhouettes, not accessories layered over Meridian's suit.
// Local +Z faces forward. Every solid is baked into its existing animation joint.
export function buildReferenceCharacter({style,rig,head,arms,legs,all,toon}){
 const detailed=desktopVisuals();
 const id=style.id,heavy=['obsidian','gold','violet'].includes(id),armored=id==='obsidian'||id==='violet',bins=new Map(),anchors=new Map();
 const material=c=>{const m=toon(c);m.flatShading=!detailed;m.roughness=.78;if(detailed)finishCharacterMaterial(m);return m;};
 const dark=material(style.colors[0]),suit=material(style.colors[1]),trim=material(style.colors[4]),white=material(style.colors[2]),skin=material(style.colors[6]),hair=material(style.colors[7]),red=material('#c92343'),ink=material('#10131d'),eyeWhite=material('#fff9ef');
 if(detailed){finishCharacterMaterial(skin,'skin');finishCharacterMaterial(hair,'hair');finishCharacterMaterial(trim,'metal');if(armored){finishCharacterMaterial(suit,'metal');finishCharacterMaterial(dark,'metal');}}else if(armored){trim.metalness=.25;trim.roughness=.52;}
 const glow=new T.MeshBasicMaterial({color:id==='violet'?'#de21f2':'#9cf5ff',toneMapped:false});
 const cube=new T.BoxGeometry(1,1,1),round=new T.SphereGeometry(1,detailed?24:8,detailed?16:5);
 function add(parent,mat,geo,x,y,z,sx=1,sy=1,sz=1,rz=0){
  if(parent===rig&&y>1.15){const ay=y>1.55?1.7:1.3;if(!anchors.has(ay)){const a=new T.Group();a.position.y=ay;rig.add(a);anchors.set(ay,a);}parent=anchors.get(ay);y-=ay;}
  const matrix=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),rz),new T.Vector3(sx,sy,sz));
  const g=(geo.index?geo.toNonIndexed():geo.clone()).applyMatrix4(matrix);let mats=bins.get(parent);if(!mats){mats=new Map();bins.set(parent,mats);}if(!mats.has(mat))mats.set(mat,[]);mats.get(mat).push(g);
 }
 const box=(p,m,x,y,z,w,h,d,a=0)=>add(p,m,cube,x,y,z,w,h,d,a);
 const muscle=(p,m,x,y,z,w,h,d,a=0)=>add(p,m,round,x,y,z,w,h,d,a);
 function shape(points,depth=.06,bevel=.015){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:detailed?3:1,steps:1});g.translate(0,0,-depth/2);return g;}
 function plate(p,m,points,x,y,z,depth=.06,bevel=.015){const g=shape(points,depth,bevel);add(p,m,g,x,y,z);g.dispose();}
 const diamond=(p,m,x,y,z,w,h,d=.04)=>plate(p,m,[[0,h/2],[w/2,0],[0,-h/2],[-w/2,0]],x,y,z,d,.008);
 const chamfer=[[-.38,.5],[.38,.5],[.5,.32],[.5,-.32],[.32,-.5],[-.32,-.5],[-.5,-.32],[-.5,.32]];
 function panel(p,m,x,y,z,w,h,d=.05){plate(p,m,chamfer.map(([a,b])=>[a*w,b*h]),x,y,z,d,.008);}
 function stripe(p,m,a,b,w,d=.025){box(p,m,(a[0]+b[0])/2,(a[1]+b[1])/2,a[2],w,Math.hypot(a[0]-b[0],a[1]-b[1]),d,-Math.atan2(b[0]-a[0],b[1]-a[1]));}
 function cylinder(p,m,x,y,z,top,bottom,h,depth=1){const g=new T.CylinderGeometry(top,bottom,h,detailed?24:8);add(p,m,g,x,y,z,1,1,depth);g.dispose();}
 // Full torso, pelvis and neck. The large variants have broad chest and narrow waist.
 cylinder(rig,dark,0,1.46,0,heavy?.43:.36,.26,.69,.77);
 cylinder(rig,dark,0,1.07,0,.27,.30,.21,.85);
 cylinder(rig,id==='gold'?skin:dark,0,1.98,0,.12,.14,.18,1);
 const pecW=heavy?.245:.205;
 for(const s of [-1,1]){
  muscle(rig,id==='gold'?suit:id==='violet'?dark:suit,s*(heavy?.225:.19),1.72,.105,pecW,.205,.19);
  muscle(rig,dark,s*.22,1.46,-.015,.135,.24,.17);
  muscle(rig,dark,s*.19,1.73,-.12,.225,.20,.14);
  for(let j=0;j<3;j++)panel(rig,id==='gold'?suit:dark,s*.095,1.49-j*.105,.22,.17,.087,.07);
 }
 // Match the reference gloves, articulated elbows, thighs and substantial boots.
 for(const a of arms){const p=a.shoulder,e=a.elbow,s=a.side,w=heavy?.18:.125;
  muscle(p,suit,s*.015,-.03,0,heavy?.215:.165,.20,.18);
  muscle(p,id==='lanky'?suit:dark,0,-.25,0,w,.19,w*.92);
  muscle(e,dark,0,0,0,w*.78,.105,w*.8);
  cylinder(e,id==='lanky'?suit:dark,0,-.17,0,w*.92,w*1.04,.29,.96);
  panel(e,dark,0,-.37,.015,heavy?.28:.215,.24,.21);
  for(let k=0;k<4;k++)box(e,dark,-.08+k*.053,-.345,.132,.045,.07,.035);
  muscle(e,dark,-s*(heavy?.13:.10),-.34,.055,.048,.078,.065);
 }
 for(const l of legs){const w=heavy?.163:.125;
  muscle(l.hip,id==='lanky'?suit:dark,0,-.22,0,w,.265,w*.95);
  muscle(l.knee,dark,0,0,0,w*.88,.11,w*.9);
  cylinder(l.knee,id==='lanky'?suit:dark,0,-.235,0,w*.83,w*.80,.40,.98);
  panel(l.ankle,dark,0,-.012,.08,heavy?.30:.255,.18,.36);
  box(l.ankle,dark,0,-.115,.09,heavy?.32:.27,.055,.40);
 }
 if(id!=='violet'){
  const face=createCharacterFace(style,toon);
  add(head,face.material,face.geometry,0,0,0);face.geometry.dispose();
  panel(head,hair,0,.205,-.025,.39,.18,.31);
  for(let i=0;i<9;i++){const x=-.17+i*.043;panel(head,hair,x,.27+Math.sin(i*2.8)*.027,-.025,.065,.115,.24);}
  for(const s of [-1,1])panel(head,hair,s*.175,.12,-.085,.065,.20,.18);
  if(id!=='teal')plate(head,hair,[[-.06,.07],[.04,.08],[.065,.02],[.02,-.065],[-.035,-.025]],-.035,.20,.165,.065,.005);
 }
 if(id==='obsidian'){
  // Black/silver harness, ring clasps and open collar from the reference.
  for(const s of [-1,1]){
   stripe(rig,trim,[s*.05,1.74,.32],[s*.34,1.86,.32],.07,.045);
   stripe(rig,trim,[s*.20,1.15,.255],[s*.22,1.40,.255],.045,.035);
   stripe(rig,trim,[s*.22,1.40,.255],[s*.32,1.51,.255],.045,.035);
   box(rig,trim,s*.12,1.98,.14,.055,.145,.065);
   panel(rig,suit,s*.32,.99,.03,.23,.30,.25);
   for(const z of [-.28]){stripe(rig,trim,[s*.31,1.90,z],[s*.15,1.60,z],.065,.04);}
  }
  diamond(rig,trim,0,1.68,.355,.30,.43);diamond(rig,dark,0,1.68,.382,.16,.28);
  cylinder(rig,dark,0,1.94,0,.21,.21,.15,.95);
  for(const s of [-1,1]){const ring=new T.RingGeometry(.05,.085,8);add(rig,trim,ring,s*.34,1.87,.375);ring.dispose();}
  box(rig,dark,0,1.145,0,.62,.115,.48);for(const s of [-1,1])for(let j=0;j<2;j++)box(rig,trim,s*(.16+j*.1),1.145,.255,.075,.115,.075);
  diamond(rig,trim,0,1.145,.30,.24,.22);diamond(rig,dark,0,1.145,.328,.13,.12);
  plate(rig,suit,[[-.13,.15],[.13,.15],[.12,-.18],[0,-.25],[-.12,-.18]],0,.94,.22,.06);
  for(const s of [-1,1])box(rig,trim,s*.145,.94,.24,.035,.35,.035);
  for(const a of arms){const s=a.side;
   for(let j=0;j<3;j++)panel(a.shoulder,suit,s*(.025+j*.035),.08-j*.07,0,.38,.19,.34);
   stripe(a.shoulder,trim,[-s*.16,.13,.22],[s*.24,-.055,.22],.085,.06);
   for(const y of [-.12,-.31])cylinder(a.shoulder,trim,0,y,0,.18,.18,.055,.98);
   panel(a.elbow,suit,0,-.16,.05,.32,.32,.30);
   for(const y of [-.035,-.285])panel(a.elbow,trim,0,y,.20,.32,.055,.055);
   for(const s of [-1,1])box(a.elbow,trim,s*.12,-.16,.205,.045,.25,.055);
  }
  for(const l of legs){panel(l.knee,trim,0,0,.17,.24,.20,.10);panel(l.knee,suit,0,-.25,.10,.29,.36,.24);for(const s of [-1,1])stripe(l.knee,trim,[s*.11,-.08,.25],[s*.04,-.43,.25],.045,.035);cylinder(l.ankle,trim,0,.06,0,.17,.17,.07,1.15);panel(l.ankle,trim,0,-.015,.285,.29,.065,.035);}
 }
 if(id==='gold'){
  for(const s of [-1,1])for(const z of [.30,-.25])stripe(rig,trim,[s*.31,1.91,z],[s*.30,1.61,z],.075,.03);
  box(rig,trim,0,1.145,0,.60,.105,.49);box(rig,trim,0,1.145,.27,.20,.14,.055);
  for(const a of arms)cylinder(a.elbow,trim,0,-.245,0,.19,.19,.12,.98);
  for(const l of legs)cylinder(l.knee,trim,0,-.26,0,.15,.15,.095,1);

 }
 if(id==='violet'){
  // Tall swept helmet blades, black faceplate, gold brow and cheek frame.
  panel(head,suit,0,.06,0,.43,.45,.36);panel(head,dark,0,-.055,.225,.25,.23,.075);
  for(const s of [-1,1]){
   plate(head,suit,[[s*.13,.18],[s*.15,.53],[s*.205,.57],[s*.205,.18]],0,0,-.01,.12,.003);
   stripe(head,trim,[0,.11,.265],[s*.22,.19,.265],.04,.035);
   stripe(head,trim,[s*.15,.13,.268],[s*.15,-.17,.268],.035,.03);
   panel(head,glow,s*.085,.066,.275,.095,.029,.012);
  }
  box(head,trim,0,.27,.21,.04,.27,.035);
  diamond(rig,trim,0,1.71,.36,.35,.38,.07);diamond(rig,suit,0,1.71,.405,.24,.28);diamond(rig,glow,0,1.71,.44,.15,.19);
  for(const s of [-1,1])for(const z of [.27,-.245]){stripe(rig,glow,[s*.33,1.60,z],[s*.16,1.45,z],.026);stripe(rig,glow,[s*.16,1.45,z],[s*.12,1.24,z],.026);}
  box(rig,suit,0,1.145,0,.60,.10,.48);panel(rig,trim,0,1.145,.27,.22,.18,.055);
  plate(rig,trim,[[-.135,.16],[.135,.16],[.12,-.22],[0,-.29],[-.12,-.22]],0,.92,.22,.05);
  plate(rig,suit,[[-.10,.14],[.10,.14],[.085,-.19],[0,-.24],[-.085,-.19]],0,.92,.26,.03);
  for(const a of arms){const s=a.side;
   plate(a.shoulder,suit,[[-s*.17,.17],[s*.34,.21],[s*.25,-.09],[-s*.12,-.17]],0,.04,0,.33,.01);
   stripe(a.shoulder,trim,[-s*.12,.22,.20],[-s*.04,-.03,.20],.06,.045);
   stripe(a.shoulder,glow,[-s*.08,-.075,.20],[s*.21,.025,.20],.032,.02);
   panel(a.elbow,suit,0,-.15,.04,.33,.33,.30);
   for(const y of [-.02,-.29])panel(a.elbow,trim,0,y,.205,.33,.06,.05);
   panel(a.elbow,dark,0,-.16,.217,.17,.23,.025);box(a.elbow,glow,0,-.16,.238,.042,.20,.02);
  }
  for(const l of legs){panel(l.knee,trim,0,.01,.17,.20,.20,.075);panel(l.knee,suit,0,-.25,.10,.30,.35,.23);box(l.knee,glow,0,-.27,.24,.047,.25,.02);panel(l.ankle,suit,0,.01,.16,.28,.17,.22);box(l.ankle,trim,0,.075,.18,.29,.055,.20);}
 }
 if(id==='lanky'||id==='teal'){
  const blue=id==='lanky';
  for(const s of [-1,1]){
   if(blue){for(const z of [.225,-.22]){stripe(rig,red,[s*.25,1.18,z],[s*.29,1.51,z],.09,.035);stripe(rig,white,[s*.18,1.20,z],[s*.21,1.48,z],.027,.04);}muscle(rig,trim,s*.32,1.88,.20,.066,.066,.035);}
   else {stripe(rig,white,[s*.29,1.58,.275],[0,1.36,.275],.09,.04);stripe(rig,white,[s*.28,1.78,-.26],[0,1.49,-.26],.07,.035);}
  }
  diamond(rig,white,0,1.73,.32,blue?.36:.33,.35,.04);diamond(rig,blue?red:trim,0,1.73,.35,blue?.13:.18,.22,.035);
  if(blue)for(const s of [-1,1])stripe(rig,white,[s*.08,1.77,.325],[s*.35,1.81,.325],.065);
  box(rig,blue?red:dark,0,1.145,0,.57,.095,.46);box(rig,blue?trim:glow,0,1.145,.26,.20,.10,.04);
  for(const s of [-1,1])box(rig,trim,s*.245,1.145,.22,.085,.13,.08);
  if(!blue){for(let i=0;i<2;i++)box(rig,suit,0,1.25+i*.09,.25,.23,.035,.03);

  }
  for(const a of arms){const s=a.side;
   if(blue)panel(a.shoulder,red,0,.085,-.03,.28,.065,.27);
   else {panel(a.shoulder,white,s*.02,.005,.045,.30,.31,.26);panel(a.shoulder,suit,s*.025,.025,.20,.22,.25,.08);box(a.shoulder,trim,s*.15,.02,.19,.055,.12,.07);}
   panel(a.elbow,white,0,-.16,.04,.26,.32,.25);
   panel(a.elbow,blue?red:suit,0,-.16,.184,blue?.06:.15,.25,.035);
   if(!blue){box(a.elbow,glow,0,-.18,.21,.043,.18,.018);box(a.elbow,trim,s*.14,-.07,.12,.045,.12,.08);}
  }
  for(const l of legs){
   panel(l.knee,white,0,-.015,.14,.23,.19,.08);if(!blue)panel(l.knee,trim,0,-.015,.19,.155,.14,.03);
   panel(l.knee,white,0,-.26,.045,.235,.29,.21);box(l.knee,blue?red:suit,0,-.26,.17,blue?.065:.13,.27,.03);
   panel(l.ankle,blue?suit:white,0,.005,.16,.25,.15,.22);box(l.ankle,blue?trim:trim,0,.07,.23,blue?.22:.085,.06,.035);if(blue)box(l.ankle,red,0,-.12,.08,.27,.04,.40);
   if(!blue)for(const s of [-1,1])stripe(l.hip,suit,[s*.09,-.08,.115],[s*.07,-.37,.115],.045,.025);
  }
 }
 // Bake per-joint/material geometry, including the rear and side thickness.
 for(const [parent,mats]of bins)for(const [mat,geometries]of mats){const g=new T.BufferGeometry();for(const name of ['position','normal','uv']){const n=name==='uv'?2:3,total=geometries.reduce((s,g)=>s+g.attributes[name].array.length,0),data=new Float32Array(total);let at=0;for(const geo of geometries){data.set(geo.attributes[name].array,at);at+=geo.attributes[name].array.length;}g.setAttribute(name,new T.BufferAttribute(data,n));}g.computeBoundingSphere();const mesh=new T.Mesh(g,mat);mesh.name=style.id+'-reference-mesh';mesh.castShadow=mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;parent.add(mesh);all.push(mesh);for(const g of geometries)g.dispose();}
 cube.dispose();round.dispose();
}
