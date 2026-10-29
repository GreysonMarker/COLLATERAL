import * as T from './vendor/three.module.js';
export function createForest(scene, specs, mobile=false) {
  let seed=92341;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
  // Leaf-shaped alpha cutouts leave real gaps through each layered crown.
  for(let i=0;i<290;i++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*105,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r*.85;ctx.save();ctx.translate(x,y);ctx.rotate(rnd()*Math.PI);const l=8+rnd()*15;ctx.beginPath();ctx.moveTo(-l,0);ctx.quadraticCurveTo(0,-l*.62,l,0);ctx.quadraticCurveTo(0,l*.62,-l,0);const shade=145+Math.floor(rnd()*100);ctx.fillStyle=`rgb(${shade},${shade},${shade})`;ctx.fill();ctx.strokeStyle='#ffffff30';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-l,0);ctx.lineTo(l,0);ctx.stroke();ctx.restore()}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  const palette=['#70a447','#39825a','#daa443','#bc6859'];
  const canopyMat=new T.MeshStandardMaterial({map:tex,alphaTest:.38,side:T.DoubleSide,roughness:.95,metalness:0});
  // Each tree gets seven overlapping, differently oriented crowns.
  const cards=new T.InstancedMesh(new T.PlaneGeometry(1,1),canopyMat,specs.length*21);
  const trunkMat=new T.MeshStandardMaterial({color:'#72604e',roughness:1});
  const trunks=new T.InstancedMesh(new T.CylinderGeometry(.55,1,1,7),trunkMat,specs.length*13);
  const solids=[];
  const obj=new T.Object3D(),dir=new T.Vector3(),up=new T.Vector3(0,1,0),color=new T.Color();let ti=0,ci=0;
  function branch(a,b,r){if(r>=.10)solids.push({kind:'branch',a:a.clone(),b:b.clone(),r});dir.subVectors(b,a);obj.position.copy(a).add(b).multiplyScalar(.5);obj.quaternion.setFromUnitVectors(up,dir.clone().normalize());obj.scale.set(r,dir.length(),r);obj.updateMatrix();trunks.setMatrixAt(ti++,obj.matrix)}
  for(const tree of specs){tree.solidStart=solids.length;tree.bindings=[];tree.trunkStart=ti;tree.cardStart=ci;const {x,z,h}=tree;tree.crowns=[];const kind=Math.floor(rnd()*4);tree.color=palette[kind];const sway=rnd()*.6-.3;
    branch(new T.Vector3(x,.45,z),new T.Vector3(x+sway,h*.83,z),h*.039);
    for(let j=0;j<6;j++){const angle=j*2.399+rnd()*.5;const length=h*(kind===1?.20:.28);const bx=x+Math.cos(angle)*length,bz=z+Math.sin(angle)*length,by=h*(.52+j*.055);const start=new T.Vector3(x+sway*.5,h*(.36+j*.06),z),fork=new T.Vector3(bx,by,bz);branch(start,fork,h*.017);branch(fork,new T.Vector3(bx+Math.cos(angle+.5)*h*.10,by+h*.19,bz+Math.sin(angle+.5)*h*.10),h*.008);tree.crowns.push({x:bx,y:by+h*.12,z:bz,r:h*(kind===1?.19:.235)})}
    tree.crowns.push({x:x+sway,y:h*.89,z,r:h*.24});
    for(const crown of tree.crowns)for(let k=0;k<3;k++){obj.position.set(crown.x,crown.y,crown.z);obj.rotation.set(k===2?Math.PI/2:rnd()*.35,k*Math.PI/3+rnd()*.5,rnd()*.4-.2);obj.scale.set(crown.r*2.5,crown.r*2.2,1);obj.updateMatrix();cards.setMatrixAt(ci,obj.matrix);color.set(tree.color).multiplyScalar(.72+(.25*crown.y/h)+rnd()*.20);cards.setColorAt(ci++,color)}
  }
  for(let i=0;i<specs.length;i++){const tree=specs[i];tree.solidEnd=i+1<specs.length?specs[i+1].solidStart:solids.length;for(let j=tree.solidStart;j<tree.solidEnd;j++)solids[j].tree=tree;}
  cards.count=ci;trunks.count=ti;cards.castShadow=cards.receiveShadow=trunks.castShadow=trunks.receiveShadow=true;// Split by region: a city-wide instance batch otherwise submits every tree
  // even when the camera's far plane hides most of the city.
  const regions=new Map();for(const tree of specs){const key=Math.floor(tree.x/448)+','+Math.floor(tree.z/448);if(!regions.has(key))regions.set(key,[]);regions.get(key).push(tree);}
  const matrix=new T.Matrix4(),tint=new T.Color();
  for(const trees of regions.values())for(const [source,startKey,perTree] of [[cards,'cardStart',21],[trunks,'trunkStart',13]]){
    const batch=new T.InstancedMesh(source.geometry,source.material,trees.length*perTree);let index=0;
    for(const tree of trees){tree.bindings.push({batch,start:index,count:perTree});for(let i=0;i<perTree;i++){source.getMatrixAt(tree[startKey]+i,matrix);batch.setMatrixAt(index,matrix);if(source.instanceColor){source.getColorAt(tree[startKey]+i,tint);batch.setColorAt(index,tint);}index++;}}
    batch.matrixAutoUpdate=false;batch.castShadow=batch.receiveShadow=true;batch.computeBoundingSphere();scene.add(batch);
  }
  cards.dispose();trunks.dispose();
  // Tree detail is unchanged inside the camera range.
  // Folded individual leaves only near the player; fixed capacity keeps cost predictable.
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,-1,-.42,0,0,0,.15,0, 0,0,-1,0,.15,0,.42,0,0, -.42,0,0,0,0,1,0,.15,0, 0,.15,0,0,0,1,.42,0,0],3));g.computeVertexNormals();
  const leafMat=new T.MeshStandardMaterial({color:'#fff',side:T.DoubleSide,roughness:.88});
  const leaves=new T.InstancedMesh(g,leafMat,60*168);leaves.count=0;leaves.receiveShadow=true;leaves.castShadow=false;leaves.frustumCulled=false;scene.add(leaves);
  let lastX=Infinity,lastY=Infinity,lastZ=Infinity,lastSelection=[];const leafCache=new Map();
  const falling=[],turn=new T.Matrix4(),transform=new T.Matrix4(),pivot=new T.Matrix4(),zero=new T.Matrix4().makeScale(0,0,0);
  function hide(tree){for(const b of tree.bindings){for(let i=0;i<b.count;i++)b.batch.setMatrixAt(b.start+i,zero);b.batch.instanceMatrix.needsUpdate=true;}}
  function damage(point,radius){for(let rx=Math.floor((point.x-radius)/448);rx<=Math.floor((point.x+radius)/448);rx++)for(let rz=Math.floor((point.z-radius)/448);rz<=Math.floor((point.z+radius)/448);rz++)for(const tree of regions.get(rx+','+rz)||[]){if(tree.broken)continue;const dy=point.y-Math.max(.5,Math.min(tree.h,point.y));if((point.x-tree.x)**2+(point.z-tree.z)**2+dy*dy>radius*radius)continue;tree.broken=true;lastX=Infinity;for(let i=tree.solidStart;i<tree.solidEnd;i++)solids[i].disabled=true;
   if(falling.length>=16)hide(falling.shift().tree);
   const parts=[];for(const b of tree.bindings)for(let i=0;i<b.count;i++){const original=new T.Matrix4();b.batch.getMatrixAt(b.start+i,original);parts.push({batch:b.batch,index:b.start+i,original});}
   const axis=new T.Vector3(tree.z-point.z,0,point.x-tree.x);if(axis.lengthSq()<.01)axis.set(1,0,0);falling.push({tree,parts,age:0,axis:axis.normalize()});
  }}
  function update(position,dt=.016){
   for(let i=falling.length-1;i>=0;i--){const f=falling[i];f.age+=dt;if(f.age>3){hide(f.tree);falling.splice(i,1);continue;}turn.makeRotationAxis(f.axis,Math.min(1.5,f.age*f.age*.9));transform.makeTranslation(f.tree.x,-(Math.max(0,f.age-1.6)**2)*f.tree.h,f.tree.z).multiply(turn).multiply(pivot.makeTranslation(-f.tree.x,0,-f.tree.z));for(const part of f.parts){matrix.multiplyMatrices(transform,part.original);part.batch.setMatrixAt(part.index,matrix);part.batch.instanceMatrix.needsUpdate=true;}}
   if((position.x-lastX)**2+(position.z-lastZ)**2<28**2&&Math.abs(position.y-lastY)<28)return;
   lastX=position.x;lastY=position.y;lastZ=position.z;
   const near=[];
   for(let rx=Math.floor((position.x-170)/448);rx<=Math.floor((position.x+170)/448);rx++)for(let rz=Math.floor((position.z-170)/448);rz<=Math.floor((position.z+170)/448);rz++)for(const tree of regions.get(rx+','+rz)||[]){
    const d=(tree.x-position.x)**2+(tree.z-position.z)**2;if(!tree.broken&&d<170**2&&Math.abs(tree.h-position.y)<90)near.push({tree,d});
   }
   near.sort((a,b)=>a.d-b.d);const selected=near.slice(0,60).map(n=>n.tree);
   // Order is immaterial to these opaque leaves. Keep existing slots when the
   // same trees are still nearby instead of uploading identical foliage again.
   if(selected.length===lastSelection.length&&selected.every(t=>lastSelection.includes(t)))return;
   let index=0;
   for(const tree of selected){let cache=leafCache.get(tree);
    if(!cache){cache={matrices:new Float32Array(168*16),colors:new Float32Array(168*3)};
     seed=(Math.abs(Math.floor(tree.x*137+tree.z*317))+8123)>>>0;let n=0;
     for(const crown of tree.crowns)for(let j=0;j<24;j++){const a=rnd()*Math.PI*2,v=rnd()*2-1,r=crown.r*(.65+rnd()*.38),horizontal=Math.sqrt(1-v*v);obj.position.set(crown.x+Math.cos(a)*r*horizontal,crown.y+v*r*.7,crown.z+Math.sin(a)*r*horizontal);obj.rotation.set(rnd()*Math.PI,rnd()*Math.PI*2,rnd()*Math.PI);obj.scale.setScalar(.19+rnd()*.16);obj.updateMatrix();obj.matrix.toArray(cache.matrices,n*16);color.set(tree.color).multiplyScalar(.7+rnd()*.55);color.toArray(cache.colors,n*3);n++;}
    }
    leafCache.delete(tree);leafCache.set(tree,cache);
    if(!leaves.instanceColor)leaves.setColorAt(0,color.set('#ffffff'));
    leaves.instanceMatrix.array.set(cache.matrices,index*16);leaves.instanceColor.array.set(cache.colors,index*3);index+=168;
   }
   while(leafCache.size>128)leafCache.delete(leafCache.keys().next().value);
   lastSelection=selected;leaves.count=index;
   for(const [attribute,stride] of [[leaves.instanceMatrix,16],[leaves.instanceColor,3]])if(attribute){attribute.clearUpdateRanges();if(index){attribute.addUpdateRange(0,index*stride);attribute.needsUpdate=true;}}
  }

  // Resolve whole trees from branch contacts before the actor movement sweep.
  // damage() disables every branch immediately and reuses bounded falling visuals.
  const crushPoint=new T.Vector3(),treePoint=new T.Vector3();
  function crushBody(position,offsets,radius,world){
   let crushed=0;
   for(const offset of offsets){crushPoint.addVectors(position,offset);
    for(const solid of world.nearby(crushPoint.x,crushPoint.z,radius,crushPoint.y,true)){
     const tree=solid.tree;if(!tree||tree.broken||!world.sphereSolid(crushPoint,radius,solid))continue;
     treePoint.set(tree.x,.5,tree.z);damage(treePoint,.1);crushed++;
    }
   }
   return crushed;
  }
  return {update,damage,crushBody,solids};
}
