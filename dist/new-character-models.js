import * as T from './vendor/three.module.js';
// Concept models: merged by animation joint and material, with no new powers.
export function buildNewCharacter({style,rig,head,arms,legs,all,toon}){
 const pale=style.id==='pale-king',stone=style.id==='monolith',bins=new Map(),anchors=new Map();
 const mat=c=>{const m=toon(c);m.flatShading=true;m.roughness=.85;return m;};
 const dark=mat('#20242b'),shell=mat(pale?'#ded0ac':stone?'#c3a779':'#eeeae2'),accent=mat(pale?'#6d2035':stone?'#343b3d':'#182532');
 const glow=new T.MeshBasicMaterial({color:stone?'#38d8cc':'#36d8ff',toneMapped:false});
 const box=new T.BoxGeometry(1,1,1),gem=new T.IcosahedronGeometry(1,2),ball=new T.SphereGeometry(1,8,6);
 function add(p,m,g,x,y,z,w,h,d,rz=0){if(p===rig&&y>1.15){const ay=y>1.55?1.7:1.3;if(!anchors.has(ay)){const anchor=new T.Group();anchor.position.y=ay;rig.add(anchor);anchors.set(ay,anchor);}p=anchors.get(ay);y-=ay;}const a=g.index?g.toNonIndexed():g.clone();a.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),rz),new T.Vector3(w,h,d)));if(!bins.has(p))bins.set(p,new Map());const b=bins.get(p);if(!b.has(m))b.set(m,[]);b.get(m).push(a);}
 const b=(p,m,x,y,z,w,h,d,r=0)=>add(p,m,box,x,y,z,w,h,d,r);
 const lump=(p,m,x,y,z,w,h,d)=>add(p,m,gem,x,y,z,w,h,d);
 function plate(p,m,pts,z,depth=.06){const s=new T.Shape();pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.008,bevelThickness:.006,bevelSegments:2});g.translate(0,0,z-depth/2);add(p,m,g,0,0,0,1,1,1);g.dispose();}
 function spike(p,m,a,c,r){const av=new T.Vector3(...a),cv=new T.Vector3(...c),g=new T.ConeGeometry(r,av.distanceTo(cv),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),cv.clone().sub(av).normalize()));g.translate(...av.add(cv).multiplyScalar(.5).toArray());add(p,m,g,0,0,0,1,1,1);g.dispose();}
 const thick=pale?.25:stone?.175:.16;
 lump(rig,dark,0,1.49,0,.35,.48,.24);lump(rig,dark,0,1.06,0,.30,.19,.24);
 for(const s of [-1,1]){lump(rig,shell,s*.18,1.72,.11,thick,.23,.21);for(let i=0;i<3;i++)lump(rig,pale||stone?shell:dark,s*.095,1.46-i*.115,.18,.12,.075,.09);}
 b(rig,accent,0,1.12,0,.64,.12,.49);
 for(const a of arms){const p=a.shoulder,e=a.elbow,s=a.side;
 lump(p,pale||stone?shell:dark,0,-.06,0,thick,.20,.20);lump(p,pale||stone?shell:dark,0,-.25,0,thick*.7,.21,.14);
 lump(e,dark,0,0,0,.12,.10,.12);lump(e,shell,0,-.17,0,thick*.9,.21,.17);lump(e,dark,0,-.37,.025,pale?.17:.11,.13,.12);
 for(let i=0;i<4;i++)b(e,pale?shell:dark,-.085+i*.055,-.36,.14,.045,.075,.05);
 if(pale){spike(p,shell,[s*.10,.04,0],[s*.34,.30,0],.11);spike(e,shell,[s*.10,-.12,0],[s*.25,.06,0],.08);}else if(!stone){b(e,glow,0,-.17,.18,.055,.18,.015);for(let i=0;i<4;i++)b(e,glow,-.075+i*.05,-.35,.172,.025,.025,.012);}
 }
 for(const l of legs){lump(l.hip,stone?shell:dark,0,-.22,0,stone?.13:.17,.27,.15);lump(l.knee,shell,0,-.025,.08,.14,.13,.13);lump(l.knee,stone?shell:dark,0,-.25,0,.13,.23,.13);b(l.ankle,dark,0,-.025,.07,.29,.19,.40);lump(l.ankle,shell,0,.015,.16,.17,.12,.23);if(!pale)b(l.knee,stone?accent:shell,0,-.25,.12,.20,.29,.08);if(!pale&&!stone)b(l.knee,glow,0,-.23,.169,.035,.13,.012);}
 if(pale){
 lump(head,shell,0,.035,0,.23,.27,.20);
 plate(head,shell,[[-.17,.13],[.17,.13],[.12,-.14],[0,-.23],[-.12,-.14]],.20,.10);
 for(const s of [-1,1]){b(head,dark,s*.09,.065,.254,.115,.045,.022,s*-.25);spike(head,shell,[s*.15,.19,0],[s*.29,.38,-.03],.09);spike(head,shell,[s*.27,.34,-.03],[s*.36,.40,-.06],.045);}
 b(head,dark,0,-.12,.258,.025,.12,.012);
 b(rig,accent,.25,1.65,.31,.15,.60,.06,-.25);
 plate(rig,accent,[[-.25,1.15],[.05,1.10],[.10,.51],[-.05,.60],[-.13,.48]],.28);
 plate(rig,accent,[[.06,1.13],[.28,1.12],[.38,.62],[.24,.66],[.21,.52]],.25);
 b(rig,accent,0,1.12,.28,.64,.13,.08);lump(rig,shell,0,1.12,.34,.11,.09,.05);
 }else if(stone){
 b(head,shell,0,.025,.015,.36,.49,.30);b(head,accent,0,.025,-.15,.30,.40,.08);
 for(const s of [-1,1]){b(head,glow,s*.095,.08,.171,.10,.035,.02);b(head,accent,s*.13,-.07,.174,.025,.13,.012);b(rig,accent,s*.28,1.89,.02,.38,.15,.53,s*-.22);}
 b(head,glow,0,.02,.172,.018,.44,.015);b(rig,glow,0,1.52,.327,.035,.48,.018);
 plate(rig,accent,[[-.18,1.12],[.18,1.12],[.20,.52],[0,.35],[-.20,.52]],.27);
 b(rig,glow,0,.80,.31,.025,.52,.015);
 for(const a of arms)b(a.elbow,accent,0,-.25,0,.32,.09,.35);
 }else{
 // White hood enclosing a separate faceless mask, open jacket and split tails.
 lump(head,dark,0,.025,0,.22,.26,.20);
 plate(head,shell,[[-.26,-.17],[-.26,.19],[0,.37],[.26,.19],[.26,-.17],[.17,-.10],[.17,.16],[0,.25],[-.17,.16],[-.17,-.10]],.08,.25);
 plate(head,shell,[[-.155,.17],[.155,.17],[.13,-.12],[0,-.22],[-.13,-.12]],.23,.055);
 for(const s of [-1,1]){b(head,glow,s*.075,.055,.265,.085,.023,.012,s*.18);plate(rig,shell,[[s*.09,1.91],[s*.37,1.84],[s*.32,1.17],[s*.12,1.12],[s*.17,1.55]],.29,.07);b(rig,dark,s*.105,1.63,.34,.025,.48,.025,s*-.14);b(rig,shell,s*.29,1.55,-.20,.13,.63,.10);b(rig,dark,s*.28,1.03,.07,.14,.20,.25);}
 b(rig,shell,0,1.60,-.25,.58,.62,.06);
 plate(rig,shell,[[-.30,1.20],[-.04,1.20],[-.06,.84],[-.33,.95]],-.25);
 plate(rig,shell,[[.04,1.20],[.30,1.20],[.33,.95],[.06,.84]],-.25);
 }
 // Sculpted wraparound details. Every surface is real geometry, including backs.
 const edge=mat(pale?'#b6a789':stone?'#797164':'#b8c3cc'),recess=mat('#111820');
 function tube(p,m,points,r=.01){const curve=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v)));const g=new T.TubeGeometry(curve,Math.max(8,points.length*4),r,6,false);add(p,m,g,0,0,0,1,1,1);g.dispose();}
 function band(p,m,y,rx,rz,width){const g=new T.CylinderGeometry(1,1,width,16,1,true);add(p,m,g,0,y,0,rx,1,rz);g.dispose();}
 function cloth(p,m,rows,width){const pos=[],uv=[],index=[];const n=12;for(let j=0;j<rows.length;j++){const [cx,y,z,w=width]=rows[j];for(let i=0;i<=n;i++){const t=i/n;pos.push(cx+(t-.5)*w,y,z+Math.sin(t*Math.PI*6+j*.32)*.012);uv.push(t,j/(rows.length-1));}}for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i;index.push(a,a+1,a+n+1,a+1,a+n+2,a+n+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();const cm=m.clone();cm.side=T.DoubleSide;add(p,cm,g,0,0,0,1,1,1);g.dispose();}
 function diamond(p,m,x,y,z,w,h){plate(p,m,[[x,y+h],[x+w,y],[x,y-h],[x-w,y]],z,.03);}
 // Separate sculpted back muscles, spine protection, and side obliques.
 for(const sign of [-1,1]){
 lump(rig,pale||stone?shell:dark,sign*.18,1.73,-.15,.22,.23,.15);
 lump(rig,pale||stone?shell:dark,sign*.22,1.47,-.08,.13,.23,.17);
 for(let j=0;j<3;j++)lump(rig,pale||stone?shell:dark,sign*(.25-j*.025),1.52-j*.11,.06,.09,.085,.17);
 }
 for(let j=0;j<6;j++)lump(rig,pale?shell:stone?accent:dark,0,1.83-j*.11,-.28,.065,.072,.045);
 // Hands: separate thumb and three curled phalanges per finger, knuckle caps.
 for(const a of arms){const e=a.elbow,sign=a.side;
 for(let k=0;k<4;k++){const x=-.087+k*.058;for(let j=0;j<3;j++)lump(e,pale||stone?shell:dark,x,-.34-j*.036,.105+Math.sin(j*.9)*.035,.032,.034,.035);lump(e,pale||stone?shell:edge,x,-.323,.13,.034,.028,.025);if(!pale&&!stone)b(e,glow,x,-.35,.166,.028,.027,.008);}
 tube(e,pale||stone?shell:dark,[[sign*.11,-.30,.04],[sign*.15,-.34,.09],[sign*.11,-.39,.12]],.043);
 lump(a.shoulder,pale||stone?shell:dark,0,-.24,-.10,.115,.18,.10);
 band(e,dark,-.29,pale?.17:.13,.15,.045);
 }
 for(const l of legs){
 lump(l.hip,stone?shell:dark,0,-.21,-.10,.14,.23,.10);lump(l.knee,stone?shell:dark,0,-.22,-.08,.13,.18,.11);
 b(l.ankle,recess,0,-.105,.07,.31,.055,.42);
 for(let i=0;i<5;i++)b(l.ankle,edge,0,-.13,-.08+i*.078,.29,.013,.022);
 if(pale){band(l.knee,accent,-.36,.145,.15,.09);band(l.ankle,accent,.06,.145,.16,.07);for(let i=0;i<3;i++)tube(l.ankle,accent,[[-.14,.015+i*.03,.08],[0,.035+i*.03,.20],[.14,.015+i*.03,.08]],.018);}
 }
 if(pale){
 // Layered bone cuirass, serrated shoulder shells and swept curved horns.
 for(const sign of [-1,1]){
 for(let j=0;j<3;j++)plate(rig,shell,[[sign*.015,1.59-j*.11],[sign*.19,1.61-j*.11],[sign*.24,1.53-j*.11],[sign*.12,1.48-j*.11],[sign*.02,1.50-j*.11]],.285-j*.012,.06);
 tube(head,shell,[[sign*.14,.20,-.02],[sign*.22,.28,-.05],[sign*.33,.30,-.11],[sign*.39,.36,-.13]],.055);
 plate(head,edge,[[sign*.03,.10],[sign*.16,.13],[sign*.19,.02],[sign*.12,-.13],[sign*.055,-.07]],.255,.015);
 plate(head,shell,[[0,.20],[sign*.08,.10],[sign*.045,-.17],[0,-.23]],.28,.025);
 for(const a of arms.filter(a=>a.side===sign)){for(let j=0;j<3;j++){lump(a.shoulder,shell,sign*(.03+j*.035),.045-j*.065,-.025,.255,.12,.25);spike(a.shoulder,shell,[sign*.12,.10-j*.065,-.14],[sign*(.25+j*.035),.24-j*.07,-.20],.07);}plate(a.elbow,shell,[[-.14,-.03],[.03,.015],[.17,-.12],[.12,-.31],[0,-.36],[-.12,-.27]],.17,.08);tube(a.elbow,edge,[[0,-.02,.22],[.04,-.16,.25],[0,-.31,.22]],.012);}
 }
 // Sash follows shoulder over the back, layered waist wraps and long torn tails.
 cloth(rig,accent,[[.25,1.97,-.05,.14],[.27,1.85,-.31,.15],[.18,1.57,-.34,.16],[.04,1.25,-.28,.18]],.15);
 for(let j=0;j<3;j++)band(rig,accent,1.10+j*.04,.33,.28,.065);
 cloth(rig,accent,[[.15,1.10,.31,.28],[.22,.91,.34,.27],[.30,.67,.34,.25],[.34,.40,.30,.22],[.40,.23,.28,.12]],.28);
 cloth(rig,accent,[[-.08,1.12,-.29,.43],[-.13,.86,-.33,.40],[-.12,.59,-.34,.35],[-.17,.38,-.30,.18]],.4);
 for(const sign of [-1,1]){diamond(rig,shell,sign*.23,1.12,.32,.075,.11);plate(rig,shell,[[sign*.28,1.08],[sign*.37,.93],[sign*.30,.77],[sign*.20,.89]],.23,.06);}
 }else if(stone){
 // Full mantle collar: curved front/back wraps, sculpted trapezius stones.
 for(let i=0;i<3;i++){const y=1.91+i*.045;tube(rig,accent,[[-.39,y,.04],[-.28,y-.07,.26],[0,y-.09,.30],[.28,y-.07,.26],[.39,y,.04],[.25,y+.01,-.28],[0,y+.025,-.32],[-.25,y+.01,-.28],[-.39,y,.04]],.04);}
 for(const sign of [-1,1]){
 // Shoulder relief blocks, rear carved bands, cheek relief and head ribs.
 for(const z of [-.29,.29]){b(rig,edge,sign*.29,1.89,z,.30,.035,.025,sign*-.20);for(let j=0;j<4;j++)b(rig,edge,sign*(.17+j*.065),1.84,z,.025,.07,.025);}
 for(let j=0;j<3;j++)b(head,edge,sign*(.08+j*.045),.03,.178,.018,.40-j*.035,.018);
 tube(head,accent,[[sign*.18,.17,-.12],[sign*.23,.09,-.10],[sign*.23,-.03,-.10],[sign*.18,-.08,-.12]],.03);
 diamond(rig,accent,0,1.52,.35,.095,.105);diamond(rig,glow,0,1.52,.371,.054,.065);diamond(rig,shell,0,1.52,.39,.027,.036);
 plate(rig,accent,[[sign*.15,1.10],[sign*.35,1.09],[sign*.42,.79],[sign*.24,.71]],.10,.09);
 for(const a of arms.filter(a=>a.side===sign)){plate(a.elbow,shell,[[sign*-.12,-.28],[sign*.17,-.25],[sign*.25,-.02],[sign*.10,.06]],.14,.09);band(a.elbow,edge,-.27,.18,.19,.035);for(let j=0;j<4;j++)b(a.elbow,edge,-.12+j*.08,-.23,.19,.04,.025,.02);}
 }
 plate(rig,edge,[[-.19,1.10],[.19,1.10],[.19,.52],[0,.37],[-.19,.52]],.315,.025);
 plate(rig,accent,[[-.15,1.08],[.15,1.08],[.15,.54],[0,.43],[-.15,.54]],.335,.025);
 for(const sign of [-1,1])b(rig,glow,sign*.075,.79,.355,.018,.48,.015);
 diamond(rig,edge,0,1.10,.36,.14,.14);diamond(rig,glow,0,1.10,.38,.07,.08);diamond(rig,accent,0,1.10,.40,.04,.05);diamond(rig,edge,0,.53,.365,.07,.08);
 plate(rig,accent,[[-.27,1.12],[.27,1.12],[.26,.55],[0,.44],[-.26,.55]],-.29,.08);
 for(const sign of [-1,1])tube(rig,edge,[[sign*.23,1.06,-.34],[sign*.21,.62,-.34],[0,.49,-.34]],.016);
 // Stone fractures are shallow dark inlays, stable geometry rather than a noise shader.
 for(const a of arms)for(let j=0;j<3;j++)tube(a.shoulder,edge,[[-.08,-.08-j*.09,.14],[.015,-.12-j*.09,.16],[.045,-.17-j*.09,.145]],.0035);
 for(const sign of [-1,1])for(let j=0;j<3;j++)tube(rig,edge,[[sign*.06,1.82-j*.15,.30],[sign*.13,1.79-j*.15,.30],[sign*.16,1.73-j*.15,.28]],.0035);
 }else{
 // Curved hood crown and closed back, dark inner lining and stitched white rim.
 const hood=new T.SphereGeometry(1,20,14,0,Math.PI*2,0,Math.PI*.62);add(head,shell,hood,0,.11,-.075,.285,.30,.245);hood.dispose();
 tube(head,edge,[[-.25,-.13,.15],[-.26,.15,.19],[0,.365,.09],[.26,.15,.19],[.25,-.13,.15]],.012);
 for(const sign of [-1,1]){
 cloth(rig,shell,[[sign*.27,1.88,.25,.20],[sign*.27,1.65,.31,.19],[sign*.25,1.42,.30,.20],[sign*.24,1.19,.29,.24]],.20);
 tube(rig,edge,[[sign*.34,1.85,.29],[sign*.31,1.60,.34],[sign*.33,1.22,.32]],.009);
 tube(rig,edge,[[sign*.30,1.86,-.24],[sign*.27,1.62,-.30],[sign*.29,1.22,-.30]],.008);
 b(rig,edge,sign*.15,1.80,.34,.045,.09,.025,sign*.15);
 for(const a of arms.filter(a=>a.side===sign)){lump(a.shoulder,shell,0,-.035,-.02,.21,.21,.21);band(a.shoulder,edge,-.17,.15,.16,.03);b(a.shoulder,dark,sign*.15,-.03,.10,.05,.16,.10);plate(a.elbow,shell,[[-.13,-.03],[.10,.01],[.16,-.20],[.08,-.29],[-.13,-.25]],.16,.065);band(a.elbow,recess,-.29,.15,.16,.065);}
 for(const l of legs.filter(l=>l.side===sign)){band(l.hip,dark,-.30,.17,.16,.055);b(l.hip,recess,sign*.14,-.21,.02,.10,.25,.22);b(l.hip,edge,sign*.195,-.14,.02,.018,.04,.14);tube(l.hip,glow,[[sign*.11,-.02,.16],[sign*.10,-.15,.18]],.012);plate(l.knee,shell,[[-.12,-.08],[.12,-.08],[.15,-.21],[.08,-.44],[-.07,-.44],[-.13,-.25]],.16,.065);tube(l.knee,edge,[[0,-.13,.21],[.03,-.27,.23],[0,-.41,.21]],.008);b(l.ankle,shell,0,.04,-.11,.26,.13,.12);}
 }
 // Back jacket yoke, shoulder piping, waist seams and center zip.
 cloth(rig,shell,[ [0,1.91,-.24,.55],[0,1.72,-.32,.62],[0,1.48,-.31,.54],[0,1.20,-.29,.57]],.6);
 tube(rig,edge,[[-.28,1.72,-.34],[0,1.67,-.35],[.28,1.72,-.34]],.01);
 tube(rig,edge,[[0,1.89,-.28],[0,1.60,-.34],[0,1.22,-.31]],.007);
 for(let j=0;j<5;j++)b(rig,edge,-.22+j*.11,1.12,.30,.045,.12,.03);
 b(rig,edge,0,1.12,.33,.12,.13,.035);b(rig,dark,0,1.12,.355,.075,.08,.015);
 }

 for(const [p,ms]of bins)for(const [m,gs]of ms){const g=new T.BufferGeometry();for(const key of ['position','normal','uv']){const size=key==='uv'?2:3;const out=new Float32Array(gs.reduce((n,x)=>n+x.attributes[key].array.length,0));let at=0;for(const x of gs){out.set(x.attributes[key].array,at);at+=x.attributes[key].array.length;}g.setAttribute(key,new T.BufferAttribute(out,size));}g.computeBoundingSphere();const mesh=new T.Mesh(g,m);mesh.name=style.id+'-concept';mesh.castShadow=mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;p.add(mesh);all.push(mesh);gs.forEach(x=>x.dispose());}
 box.dispose();gem.dispose();ball.dispose();
}
