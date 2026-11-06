import * as T from './vendor/three.module.js';
// RGBA8, two bounded targets; no bloom, float buffers or scene-wide mask traversal.
export function createImpactRenderer(renderer,{mobile=false,reducedMotion=false}={}){
 const source=new T.WebGLRenderTarget(1,1),mask=new T.WebGLRenderTarget(1,1);
 const post=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const uniforms={source:{value:source.texture},mask:{value:mask.texture},center:{value:new T.Vector2(.5,.5)},axis:{value:new T.Vector2(1,0)},aspect:{value:1},age:{value:0},hold:{value:.35},variant:{value:0},laser:{value:0},strength:{value:1},paper:{value:new T.Color()},ink:{value:new T.Color()}};
 const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
 varying vec2 vUv;uniform sampler2D source,mask;uniform vec2 center,axis;uniform float aspect,age,hold,variant,laser,strength;uniform vec3 paper,ink;
 float hash(float n){return fract(sin(n*127.1)*43758.5453);}
 float zig(float x){return abs(fract(x)-.5)*4.-1.;}
 float line(float x,float width){return 1.-smoothstep(width,width+.008,abs(x));}
 void main(){vec2 p=(vUv-center)*vec2(aspect,1.);float r=length(p),a=atan(p.y,p.x),x=dot(p,axis),y=dot(p,vec2(-axis.y,axis.x));
 float grain=fract(sin(dot(floor(vUv*vec2(1100.,700.)),vec2(12.9898,78.233)))*43758.5453);
 float sector=floor((a+3.14159)*36.);float rays=step(.94-hash(sector+variant)*.15,sin(a*(23.+variant*3.)+sin(a*7.)*3.))*smoothstep(.08+hash(sector)*.18,.65,r);
 float marks=0.;
 if(variant<.5)marks=line(zig(a*1.8+r*2.5)*r,.017)+rays;
 else if(variant<1.5)marks=step(.17,r)*step(r,.24)+rays;
 else if(variant<2.5)marks=line(x,.025)+line(y,.012)+rays*.5;
 else if(variant<3.5)marks=line(sin(r*45.-age*3.)*.07,.009)*smoothstep(.1,.5,r);
 else if(variant<4.5)marks=line(x-y*.6-zig(y*7.)*.055,.014)+rays;
 else if(variant<5.5)marks=line(sin(r*65.)*.09,.012)*step(.08,r);
 else if(variant<6.5)marks=line(y+x*.5,.025)+line(y+x*.5-.14,.008)+rays;
 else if(variant<7.5)marks=step(.60,sin(a*19.+zig(r*3.)*.8))*smoothstep(.05+hash(sector)*.16,.42,r);
 else if(variant<8.5)marks=line(y*(1.+abs(x)*12.),.025)+line(r-.18,.014)+rays;
 else if(variant<9.5)marks=line(r-.22-zig(a*1.43)*.035,.014)*step(-.4,sin(a*3.))+rays;
 else if(variant<10.5)marks=line(x+zig(y*5.)*.065,.022)+line(x+zig(y*5.3)*.065-.14,.008);
 else marks=step(.55,sin(a*8.))*step(r,.28)+line(r-.34,.008)+rays;
 vec3 live=texture2D(source,vUv).rgb;float silhouette=texture2D(mask,vUv).r;
 float luma=dot(live,vec3(.2126,.7152,.0722));float inked=step(.45,luma)*.12;
 vec3 graphic=mix(paper,ink,clamp(marks+inked,0.,1.));graphic=mix(graphic,ink,silhouette);
 graphic*=.96+grain*.04;
 float release=smoothstep(hold,hold+.12,age);float contact=1.-smoothstep(.018,.065,age);
 // One contact exposure, then a stable held composition: no alternating inversion.
 graphic=mix(graphic,mix(paper,ink,.08),contact*.22);
 float weight=(1.-release)*.9+release*.22;
 if(laser>.5){float stream=line(y+zig(x*3.-age*.35)*.012,.025)+line(y-.12+zig(x*5.-age*.5)*.015,.007)+line(y+.12+zig(x*4.-age*.5)*.015,.007);
 graphic=mix(vec3(.012,.045,.12),vec3(.18,.75,1.),clamp(stream+rays*.25,0.,1.));
 graphic=mix(graphic,vec3(.78,.97,1.),silhouette);weight=.65;
 }else{graphic=mix(graphic,mix(live,ink,rays*.65),release);}
 float focus=1.-smoothstep(.35,1.1,r);gl_FragColor=vec4(mix(live,graphic,weight*strength*focus),1.);
 #include <colorspace_fragment>
 }`});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),material);post.add(quad);
 const white=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});const size=new T.Vector2(),point=new T.Vector3(),tip=new T.Vector3(),clear=new T.Color();
 return {render(scene,view,effect,fallback){if(!effect){fallback();return;}point.copy(effect.point).project(view);if(point.z>1||point.z< -1||Math.abs(point.x)>1.4||Math.abs(point.y)>1.4){fallback();return;}
 renderer.getDrawingBufferSize(size);const factor=Math.min(1,(mobile?900:1440)/Math.max(size.x,size.y));const w=Math.max(1,Math.round(size.x*factor)),h=Math.max(1,Math.round(size.y*factor));if(source.width!==w||source.height!==h){source.setSize(w,h);mask.setSize(w,h);}
 uniforms.center.value.set(point.x*.5+.5,point.y*.5+.5);tip.copy(effect.point).add(effect.direction).project(view);uniforms.axis.value.set((tip.x-point.x)*view.aspect,tip.y-point.y);if(uniforms.axis.value.lengthSq()<.00001)uniforms.axis.value.set(1,0);else uniforms.axis.value.normalize();
 uniforms.aspect.value=view.aspect;uniforms.age.value=effect.age;uniforms.hold.value=effect.profile.hold;uniforms.variant.value=effect.profile.index;uniforms.laser.value=+effect.laser;uniforms.strength.value=effect.fade*(reducedMotion?.28:1);uniforms.paper.value.setHex(effect.profile.background);uniforms.ink.value.setHex(effect.profile.ink);
 const previous=renderer.getRenderTarget(),override=scene.overrideMaterial,background=scene.background,layers=view.layers.mask,alpha=renderer.getClearAlpha(),auto=renderer.autoClear,shadow=renderer.shadowMap.autoUpdate,needs=renderer.shadowMap.needsUpdate;renderer.getClearColor(clear);const changed=[];
 try{renderer.autoClear=true;renderer.setRenderTarget(source);renderer.render(scene,view);
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;view.layers.set(30);effect.visual?.traverse(o=>{if(o.isMesh){changed.push([o,o.layers.mask]);o.layers.enable(30);}});scene.overrideMaterial=white;scene.background=null;renderer.setClearColor(0,1);renderer.setRenderTarget(mask);renderer.render(scene,view);
 view.layers.mask=layers;scene.overrideMaterial=override;scene.background=background;renderer.setRenderTarget(previous);renderer.render(post,camera);
 }finally{for(const [o,m]of changed)o.layers.mask=m;view.layers.mask=layers;scene.overrideMaterial=override;scene.background=background;renderer.setClearColor(clear,alpha);renderer.autoClear=auto;renderer.shadowMap.autoUpdate=shadow;renderer.shadowMap.needsUpdate=needs;renderer.setRenderTarget(previous);}},
 dispose(){source.dispose();mask.dispose();material.dispose();white.dispose();quad.geometry.dispose();}};
}
