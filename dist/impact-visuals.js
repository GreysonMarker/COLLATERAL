import * as T from './vendor/three.module.js';
const LIMIT=24;
// Cut the standing facade on the impact frame. Fracture geometry fills in the
// exposed interior later; collision and this mask use the same cell-sized cut.
export function createImpactVisuals(scene){
 const states=new Map();
 function state(b){let s=states.get(b);if(s)return s;s={cuts:[],materials:new Map(),count:{value:0},a:{value:Array.from({length:LIMIT},()=>new T.Vector4())},d:{value:Array.from({length:LIMIT},()=>new T.Vector4())},shape:{value:Array.from({length:LIMIT},()=>new T.Vector2())},preview:null,interior:null,collapse:{value:new T.Vector3(1e9,0,0)},attached:new WeakSet()};states.set(b,s);return s;}
 function material(s,base){if(s.materials.has(base))return s.materials.get(base);const m=base.clone(),prior=base.onBeforeCompile;
 m.onBeforeCompile=shader=>{prior.call(base,shader);Object.assign(shader.uniforms,{impactCount:s.count,impactA:s.a,impactD:s.d,impactShape:s.shape,impactCollapse:s.collapse});shader.vertexShader='varying vec3 impactWorld;varying vec3 impactNormal;uniform vec3 impactCollapse;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nif(position.y>=impactCollapse.x)transformed.y+=impactCollapse.y;');shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nimpactWorld=(modelMatrix*vec4(position,1.0)).xyz;impactNormal=normalize(mat3(modelMatrix)*normal);');shader.fragmentShader=`varying vec3 impactWorld;varying vec3 impactNormal;uniform vec3 impactCollapse;uniform int impactCount;uniform vec4 impactA[24];uniform vec4 impactD[24];uniform vec2 impactShape[24];\n`+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 if(impactCollapse.z>0.5&&impactWorld.y>=impactCollapse.x)discard;
 vec3 impactCell=floor((impactWorld-impactNormal*0.001)/4.2)*4.2+vec3(2.1);
 for(int i=0;i<24;i++){if(i>=impactCount)break;vec3 delta=impactCell-impactA[i].xyz;if(impactShape[i].x<0.0){if(dot(delta,delta)<=impactA[i].w*impactA[i].w)discard;continue;}float along=dot(delta,impactD[i].xyz);float radius=impactA[i].w+impactShape[i].x*max(0.0,along);if(along>=impactShape[i].y&&along<=impactD[i].w&&dot(delta,delta)-along*along<=radius*radius)discard;}`);};
 m.customProgramCacheKey=()=>base.customProgramCacheKey()+'-impact-mask-v2';s.materials.set(base,m);return m;
 }
 function attach(b,root){const s=states.get(b);if(!s||s.attached.has(root))return;s.attached.add(root);root.traverse(o=>{if(o.isMesh){const base=o.userData.impactBase??o.material;o.userData.impactBase=base;o.material=material(s,base);}});}
 function cut(b,p,d,radius,depth,spread=0,back=-4.2){const s=state(b);let c=s.cuts.find(c=>c.p.distanceToSquared(p)<1&&c.d.dot(d)>.995&&c.spread===spread);if(c){c.radius=Math.max(c.radius,radius);c.depth=Math.max(c.depth,depth);}else{c={p:p.clone(),d:d.clone().normalize(),radius,depth,spread,back};if(s.cuts.length===LIMIT)s.cuts.shift();s.cuts.push(c);}s.count.value=s.cuts.length;for(let i=0;i<s.cuts.length;i++){const c=s.cuts[i];s.a.value[i].set(c.p.x,c.p.y,c.p.z,c.radius);s.d.value[i].set(c.d.x,c.d.y,c.d.z,c.depth);s.shape.value[i].set(c.spread,c.back);}
 interior(b,s);if(b.active){attach(b,b.mesh);return;}
 if(!s.preview){s.preview=new T.Group();for(const r of b.ranges){const source=r.b.geometry,g=new T.BufferGeometry();r.originalPositions??=source.attributes.position.array.slice(r.start*3,r.end*3);g.setAttribute('position',new T.BufferAttribute(r.originalPositions.slice(),3));for(const name of ['normal','uv']){const a=source.attributes[name];g.setAttribute(name,new T.BufferAttribute(a.array.slice(r.start*a.itemSize,r.end*a.itemSize),a.itemSize));}const mesh=new T.Mesh(g,material(s,r.m));mesh.castShadow=false;mesh.receiveShadow=true;s.preview.add(mesh);const a=source.attributes.position;for(let i=r.start;i<r.end;i++)a.setXYZ(i,0,-10000,0);a.addUpdateRange(r.start*3,(r.end-r.start)*3);a.needsUpdate=true;}scene.add(s.preview);}
 }
 // A bounded local shell closes the cut on the hit frame, independently of
 // the full facade rebuild. Only surviving cells bordering a cut are emitted.
 function interior(b,s){
  if(s.interior){s.interior.geometry.dispose();s.interior.removeFromParent();}
  const size=4.2,seen=new Set(),boxes=[],v=new T.Vector3();
  const cut=(x,y,z)=>s.cuts.some(c=>{v.set((x+.5)*size,(y+.5)*size,(z+.5)*size).sub(c.p);if(c.spread<0)return v.lengthSq()<=c.radius*c.radius;const a=v.dot(c.d),r=c.radius+c.spread*Math.max(0,a);return a>=c.back&&a<=c.depth&&v.lengthSq()-a*a<=r*r;});
  for(const c of s.cuts){const end=c.p.clone().addScaledVector(c.d,c.depth),r=c.radius+(c.spread<0?0:c.spread*c.depth)+size;
   for(const solid of b.solids){if(c.spread<0&&['x','y','z'].reduce((n,a)=>n+Math.max(Math.abs(solid[a+'1']-c.p[a]),Math.abs(solid[a+'2']-c.p[a]))**2,0)<(c.radius-size)**2)continue;const lo=['x','y','z'].map(a=>Math.floor(Math.max(solid[a+'1'],Math.min(c.p[a],end[a])-r)/size)),hi=['x','y','z'].map(a=>Math.floor((Math.min(solid[a+'2'],Math.max(c.p[a],end[a])+r)-.001)/size));
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){
     const k=x+','+y+','+z;if(seen.has(k)||cut(x,y,z))continue;
     if(![[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].some(([a,b,c])=>cut(x+a,y+b,z+c)))continue;
     const min=new T.Vector3(Math.max(x*size,solid.x1),Math.max(y*size,solid.y1),Math.max(z*size,solid.z1)),max=new T.Vector3(Math.min((x+1)*size,solid.x2),Math.min((y+1)*size,solid.y2),Math.min((z+1)*size,solid.z2));
     if(solid.planes?.some(p=>p.distanceToPoint(min.clone().add(max).multiplyScalar(.5))>0))continue;
     seen.add(k);boxes.push({min,max});
    }
   }
  }
  const g=new T.BoxGeometry(1,1,1);
  s.interiorMaterial??=new T.MeshStandardMaterial({color:0x777a7b,roughness:1});
  // World-space geometry lets the same cut and collapse shader serve both paths.
  const positions=[],normals=[],uvs=[];
  const raw=g.toNonIndexed();for(const box of boxes){const scale=box.max.clone().sub(box.min),center=box.max.clone().add(box.min).multiplyScalar(.5);for(let i=0;i<raw.attributes.position.count;i++){v.fromBufferAttribute(raw.attributes.position,i).multiply(scale).add(center);positions.push(v.x,v.y,v.z);normals.push(raw.attributes.normal.getX(i),raw.attributes.normal.getY(i),raw.attributes.normal.getZ(i));uvs.push(raw.attributes.uv.getX(i),raw.attributes.uv.getY(i));}}
  g.dispose();raw.dispose();const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  s.interior=new T.Mesh(geo,material(s,s.interiorMaterial));s.interior.userData.immediateInterior=true;s.interior.frustumCulled=false;scene.add(s.interior);
 }
 function collapse(b,level,offset,hidden=false){const s=state(b);s.collapse.value.set(level,offset,hidden?1:0);if(b.mesh)attach(b,b.mesh);}
 function activate(b){const s=states.get(b);if(!s)return;if(s.preview){s.preview.traverse(o=>o.geometry?.dispose());s.preview.removeFromParent();s.preview=null;}attach(b,b.mesh);}
 function dispose(b){const s=states.get(b);if(!s)return;if(s.preview){s.preview.traverse(o=>o.geometry?.dispose());s.preview.removeFromParent();}if(s.interior){s.interior.geometry.dispose();s.interior.removeFromParent();}s.interiorMaterial?.dispose();for(const m of s.materials.values())m.dispose();states.delete(b);}
 function retire(b){if(b.mesh)b.mesh.traverse(o=>{if(o.userData.impactBase){o.material=o.userData.impactBase;delete o.userData.impactBase;}});dispose(b);}
 return {cut,collapse,attach,activate,dispose,retire,has:b=>states.has(b),count:b=>states.get(b)?.count.value||0};
}
