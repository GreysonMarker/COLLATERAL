import * as T from './vendor/three.module.js';
// Fixed-step Verlet cloth with pinned shoulders, stretch/shear/bend constraints,
// inertial lag, aerodynamic loading, and torso/ground collision.
export function createCape(root,rig,material){
 const cols=10,rows=16,n=(cols+1)*(rows+1),points=[],previous=[],rest=[],links=[];
 const geo=new T.PlaneGeometry(1,1,cols,rows),positions=geo.attributes.position;
 const colors=[];
 for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const t=y/rows,u=x/cols;const p=new T.Vector3((u-.5)*(.78+t*.50),1.88-t*1.32,-.31-.09*Math.sin(t*Math.PI));rest.push(p);points.push(p.clone());previous.push(p.clone());const edge=x===0||x===cols||y===rows;const c=new T.Color(edge?'#f6c666':(x<2||x>8)?'#961f57':'#d43157');c.multiplyScalar(.86+.14*Math.cos(u*Math.PI*6));colors.push(c.r,c.g,c.b);}
 geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 function connect(a,b,stiff=1){links.push([a,b,rest[a].distanceTo(rest[b]),stiff])}
 for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const i=y*(cols+1)+x;if(x<cols)connect(i,i+1);if(y<rows)connect(i,i+cols+1);if(x<cols&&y<rows){connect(i,i+cols+2,.75);connect(i+1,i+cols+1,.75)}if(x<cols-1)connect(i,i+2,.35);if(y<rows-1)connect(i,i+2*(cols+1),.35)}
 const clothMaterial=material.clone();clothMaterial.color.set('#ffffff');clothMaterial.vertexColors=true;clothMaterial.side=T.DoubleSide;
 const mesh=new T.Mesh(geo,clothMaterial);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 const anchor=new T.Vector3(),delta=new T.Vector3(),oldOrigin=new T.Vector3(),origin=new T.Vector3(),local=new T.Vector3(),inverse=new T.Matrix4(),rootInverse=new T.Matrix4();let initialized=false,accumulator=0,shoulderFrame=null;
 function reset(){rig.updateWorldMatrix(true,false);for(let i=0;i<n;i++){points[i].copy(rest[i]).applyMatrix4(rig.matrixWorld);previous[i].copy(points[i])}rig.getWorldPosition(oldOrigin);initialized=true;accumulator=0;}
 function pin(){for(let i=0;i<=cols;i++){points[i].copy(rest[i]);if(shoulderFrame){points[i].y-=1.55;points[i].applyMatrix4(shoulderFrame.matrixWorld);}else points[i].applyMatrix4(rig.matrixWorld);previous[i].copy(points[i])}}
 function update(dt,time,velocity,groundY,ambientWind=null,spine=null,punchForce=null){shoulderFrame=spine;shoulderFrame?.updateWorldMatrix(true,false);rig.updateWorldMatrix(true,false);rig.getWorldPosition(origin);if(!initialized||origin.distanceTo(oldOrigin)>10)reset();delta.subVectors(origin,oldOrigin);oldOrigin.copy(origin);
  // Partial advection prevents boost speeds overstretching the mesh while retaining inertia.
  for(let i=cols+1;i<n;i++){points[i].addScaledVector(delta,.8);previous[i].addScaledVector(delta,.8)}
  inverse.copy(rig.matrixWorld).invert();root.updateWorldMatrix(true,false);rootInverse.copy(root.matrixWorld).invert();accumulator=Math.min(accumulator+dt,.05);const h=1/120;
  while(accumulator>=h){accumulator-=h;pin();for(let i=cols+1;i<n;i++){const p=points[i],q=previous[i],px=p.x,py=p.y,pz=p.z,t=Math.floor(i/(cols+1))/rows;const damp=.955;
    const gust=Math.sin(time*4.1+i*.21)*t;
    p.x+=(p.x-q.x)*damp+T.MathUtils.clamp(-velocity.x*.5+(ambientWind?.x||0)*2+gust*1.8,-45,45)*h*h+(punchForce?.x||0)*t*h*h;
    p.y+=(p.y-q.y)*damp+(-12+T.MathUtils.clamp(-velocity.y*.45+(ambientWind?.y||0)*2,-30,30)+gust+(punchForce?.y||0)*t)*h*h;
    p.z+=(p.z-q.z)*damp+T.MathUtils.clamp(-velocity.z*.5+(ambientWind?.z||0)*2+Math.cos(time*3.7+i*.15)*t*1.3,-45,45)*h*h+(punchForce?.z||0)*t*h*h;q.set(px,py,pz);
  }
  for(let pass=0;pass<8;pass++){pin();for(const [a,b,length,stiff]of links){const p=points[a],q=points[b];delta.subVectors(q,p);const d=delta.length();if(d<1e-8)continue;const w1=a>cols?1:0,w2=b>cols?1:0,w=w1+w2;if(!w)continue;delta.multiplyScalar((d-length)/d*stiff/w);if(w1)p.add(delta);if(w2)q.sub(delta)}
    for(let i=cols+1;i<n;i++){local.copy(points[i]).applyMatrix4(inverse);if(local.y>.78&&local.y<1.96&&Math.abs(local.x)<.49&&local.z>-.34&&local.z<.3){local.z=-.34;points[i].copy(local).applyMatrix4(rig.matrixWorld)}if(points[i].y<groundY+.06)points[i].y=groundY+.06;}
  }pin();}
  for(let i=0;i<n;i++){local.copy(points[i]).applyMatrix4(rootInverse);positions.setXYZ(i,local.x,local.y,local.z)}positions.needsUpdate=true;geo.computeVertexNormals();
 }
 return {update,reset,mesh,points,links,rest};
}
