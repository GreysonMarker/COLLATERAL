import * as T from './vendor/three.module.js';
// The existing facade layout is retained so holes and rubble still match the building.
export function polishFacade(material,style){
 const n=512,c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d');g.drawImage(material.map.image,0,0,n,n);
 const glass=style==='glass',pad=glass?6:style==='brick'?90:64,y=glass?6:70,w=n-pad*2,h=n-y-68;
 g.save();g.beginPath();g.rect(pad,y,w,h);g.clip();
 // Faint floor shadows and blinds sit behind the reflected skyline.
 for(let i=0;i<8;i++){g.fillStyle=i%3===0?'#101c3426':'#dbe4e90d';g.fillRect(pad,y+i*h/8,w,3);}
 const reflection=g.createLinearGradient(pad,y,pad+w,y+h);reflection.addColorStop(0,'#c1e3f930');reflection.addColorStop(.4,'#b2cee009');reflection.addColorStop(.53,'#172b4225');reflection.addColorStop(1,'#f4d7b312');g.fillStyle=reflection;g.fillRect(pad,y,w,h);
 for(let i=0;i<14;i++){const xx=pad+i*w/14,hh=h*(.12+(Math.sin(i*8.23)*.5+.5)*.36);g.fillStyle='#10243813';g.fillRect(xx,y+h-hh,w/20,hh);}
 g.restore();g.strokeStyle='#0c17245c';g.lineWidth=4;g.strokeRect(pad,y,w,h);g.strokeStyle='#e8edf55c';g.lineWidth=1;g.strokeRect(pad+2,y+2,w-4,h-4);
 material.map.image=c;material.map.needsUpdate=true;
 function map(draw){const c=document.createElement('canvas');c.width=c.height=n;const q=c.getContext('2d');draw(q);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=material.map.anisotropy;return t;}
 material.roughness=1;material.roughnessMap=map(q=>{q.fillStyle=glass?'#8b8b8b':'#e4e4e4';q.fillRect(0,0,n,n);q.fillStyle=glass?'#303030':'#555555';q.fillRect(pad,y,w,h);q.fillStyle='#a0a0a0';q.fillRect(n/2-4,y,8,h);q.fillRect(pad,n/2,w,6);});
 material.bumpMap=map(q=>{q.fillStyle='#aaaaaa';q.fillRect(0,0,n,n);q.fillStyle='#606060';q.fillRect(pad,y,w,h);q.fillStyle='#bcbcbc';q.fillRect(n/2-4,y,8,h);q.fillRect(pad,n/2,w,6);});material.bumpScale=glass?.035:.075;
 material.envMapIntensity=glass?1.1:.35;material.needsUpdate=true;
}
