import * as T from './vendor/three.module.js';
import {createHero} from './hero.js';
import {CHARACTERS} from './character-styles.js';
export function createMainMenu({hero,onOpen,onPlay}){
 const panel=document.createElement('section');panel.id='main-menu';panel.setAttribute('aria-label','Main menu and character selection');
 panel.innerHTML=`<div class="menu-heading"><span>COLLATERAL</span><h1>Choose your<br>hero.</h1><p>One city. Your impact.</p></div><div class="character-info"><span id="character-size"></span><h2 id="character-name"></h2><p>Shared powers · Shared moves</p></div><div class="menu-bottom"><div id="character-options" aria-label="Characters"></div><button id="enter-city">ENTER CITY <span>↗</span></button><p class="menu-note">Your character selection is saved automatically.</p></div>`;
 document.body.append(panel);document.body.classList.add('in-menu');
 const scene=new T.Scene();scene.background=new T.Color('#101b2e');scene.fog=new T.Fog('#101b2e',12,28);
 const camera=new T.PerspectiveCamera(36,1,.1,50);camera.position.set(5,3.2,10);camera.lookAt(0,1.9,0);
 scene.add(new T.HemisphereLight('#d0eaff','#293041',2.5));const key=new T.DirectionalLight('#fff1d2',3);key.position.set(4,8,6);scene.add(key);const rim=new T.DirectionalLight('#627dff',3);rim.position.set(-4,4,-4);scene.add(rim);
 const preview=createHero(c=>new T.MeshStandardMaterial({color:c,roughness:.72,metalness:.12,flatShading:true}));scene.add(preview.root);
 const platform=new T.Mesh(new T.CylinderGeometry(2.5,2.7,.18,64),new T.MeshStandardMaterial({color:'#26374e',roughness:.5,metalness:.45}));platform.position.y=-.16;scene.add(platform);
 const ring=new T.Mesh(new T.TorusGeometry(2.48,.015,6,64),new T.MeshBasicMaterial({color:'#e3bc69'}));ring.rotation.x=Math.PI/2;ring.position.y=-.06;scene.add(ring);
 let active=true,selected='original',time=0;const buttons=[];
 function choose(id){selected=id;hero.setAppearance(id);const style=preview.setAppearance(id);document.getElementById('character-size').textContent=style.size+' / '+(style.height===1?'Base height':Math.round(style.height*100)+'% height');document.getElementById('character-name').textContent=style.name;for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.id===id));try{localStorage.setItem('meridian-character',id)}catch{}}
 for(const c of CHARACTERS){const b=document.createElement('button');b.className='character-choice';b.dataset.id=c.id;b.innerHTML=`<i style="--suit:${c.colors[1]};--trim:${c.colors[4]}"></i><span>${c.name}<small>${c.size}</small></span>`;b.onclick=()=>choose(c.id);buttons.push(b);panel.querySelector('#character-options').append(b);}
 try{const saved=localStorage.getItem('meridian-character');if(CHARACTERS.some(c=>c.id===saved))selected=saved;}catch{}choose(selected);
 function open(){active=true;panel.hidden=false;document.body.classList.add('in-menu');onOpen();}
 function play(){if(onPlay()===false)return;active=false;panel.hidden=true;document.body.classList.remove('in-menu');}
 panel.querySelector('#enter-city').onclick=play;
 // Stop menu input before it reaches gameplay listeners, while retaining audio unlock.
 for(const type of ['pointerdown','pointerup','pointermove','keydown','keyup'])panel.addEventListener(type,e=>e.stopPropagation());
 const keyboardGuard=e=>{if(active&&!panel.contains(e.target)&&!e.target.closest?.('#multiplayer-panel')){e.stopImmediatePropagation();if(e.code==='Enter'){e.preventDefault();play();}}};window.addEventListener('keydown',keyboardGuard,true);window.addEventListener('keyup',e=>{if(active&&!e.target.closest?.('#multiplayer-panel'))e.stopImmediatePropagation();},true);
 return {open,get active(){return active;},render(renderer,dt){time+=dt;const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.position.set(w<h?3.8:5,3.1,w<h?13:10);camera.lookAt(0,1.9,0);camera.updateProjectionMatrix();preview.update(dt,time,{flying:false,moving:false,boost:false,vx:0,vy:0,vz:0,grounded:true,yaw:0,groundY:0});preview.orientation.rotation.y=.25+Math.sin(time*.25)*.16;renderer.render(scene,camera);}};
}
