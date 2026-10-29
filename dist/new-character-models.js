import * as T from './vendor/three.module.js';
// Concept models: merged by animation joint and material, with no new powers.
export function buildNewCharacter({style,rig,head,arms,legs,all,toon}){
 const pale=style.id==='pale-king',stone=style.id==='monolith',bins=new Map();
 const mat=c=>{const m=toon(c);m.flatShading=true;m.roughness=.85;return m;};
 const dark=mat('#20242b'),shell=mat(pale?'#ded0ac':stone?'#c3a779':'#eeeae2'),accent=mat(pale?'#6d2035':stone?'#343b3d':'#182532');
 const glow=new T.MeshBasicMaterial({color:stone?'#38d8cc':'#36d8ff',toneMapped:false});
 const box=new T.BoxGeometry(1,1,1),gem=new T.IcosahedronGeometry(1,1),ball=new T.SphereGeometry(1,8,6);
 function add(p,m,g,x,y,z,w,h,d,rz=0){const a=g.index?g.toNonIndexed():g.clone();a.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),rz),new T.Vector3(w,h,d)));if(!bins.has(p))bins.set(p,new Map());const b=bins.get(p);if(!b.has(m))b.set(m,[]);b.get(m).push(a);}
 const b=(p,m,x,y,z,w,h,d,r=0)=>add(p,m,box,x,y,z,w,h,d,r);
 const lump=(p,m,x,y,z,w,h,d)=>add(p,m,gem,x,y,z,w,h,d);
 function plate(p,m,pts,z,depth=.06){const s=new T.Shape();pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false});g.translate(0,0,z-depth/2);add(p,m,g,0,0,0,1,1,1);g.dispose();}
 function spike(p,m,a,c,r){const av=new T.Vector3(...a),cv=new T.Vector3(...c),g=new T.ConeGeometry(r,av.distanceTo(cv),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),cv.clone().sub(av).normalize()));g.translate(...av.add(cv).multiplyScalar(.5).toArray());add(p,m,g,0,0,0,1,1,1);g.dispose();}
 const thick=pale?.25:stone?.175:.16;
 lump(rig,dark,0,1.49,0,.35,.48,.24);lump(rig,dark,0,1.06,0,.30,.19,.24);
 for(const s of [-1,1]){lump(rig,shell,s*.18,1.72,.11,thick,.23,.21);for(let i=0;i<3;i++)lump(rig,stone?shell:dark,s*.095,1.46-i*.115,.18,.12,.075,.09);}
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
 for(const [p,ms]of bins)for(const [m,gs]of ms){const g=new T.BufferGeometry();for(const key of ['position','normal','uv']){const size=key==='uv'?2:3;const out=new Float32Array(gs.reduce((n,x)=>n+x.attributes[key].array.length,0));let at=0;for(const x of gs){out.set(x.attributes[key].array,at);at+=x.attributes[key].array.length;}g.setAttribute(key,new T.BufferAttribute(out,size));}g.computeBoundingSphere();const mesh=new T.Mesh(g,m);mesh.name=style.id+'-concept';mesh.castShadow=mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;p.add(mesh);all.push(mesh);gs.forEach(x=>x.dispose());}
 box.dispose();gem.dispose();ball.dispose();
}
