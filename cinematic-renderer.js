import * as T from './vendor/three.module.js';
// HDR scene plus quarter-resolution bloom: bright energy glows without washing out the city.
export function createCinematicRenderer(renderer,enabled){
 if(!enabled||!renderer.extensions.has('EXT_color_buffer_float'))return {render:(s,c)=>renderer.render(s,c),dispose(){}};
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true});target.samples=0;
 const a=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}),b=a.clone();
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1),quad=new T.Mesh(new T.PlaneGeometry(2,2));quad.frustumCulled=false;scene.add(quad);
 const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 function material(fragmentShader,uniforms){return new T.ShaderMaterial({vertexShader,fragmentShader,uniforms,depthTest:false,depthWrite:false});}
 const extract=material('varying vec2 vUv;uniform sampler2D source;void main(){vec3 c=texture2D(source,vUv).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(.85,1.8,l),1.);}',{source:{value:target.texture}});
 const blur=material('varying vec2 vUv;uniform sampler2D source;uniform vec2 stepUV;void main(){vec3 c=texture2D(source,vUv).rgb*.227027;c+=(texture2D(source,vUv+stepUV*1.384615).rgb+texture2D(source,vUv-stepUV*1.384615).rgb)*.316216;c+=(texture2D(source,vUv+stepUV*3.230769).rgb+texture2D(source,vUv-stepUV*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}',{source:{value:a.texture},stepUV:{value:new T.Vector2()}});
 const composite=material(`varying vec2 vUv;uniform sampler2D source;uniform sampler2D glow;
 void main(){vec3 c=texture2D(source,vUv).rgb+texture2D(glow,vUv).rgb*.24;float corner=dot(vUv-.5,vUv-.5);c*=1.-corner*.16;gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`,{source:{value:target.texture},glow:{value:a.texture}});
 const size=new T.Vector2();let w=0,h=0;
 function pass(mat,out){quad.material=mat;renderer.setRenderTarget(out);renderer.render(scene,camera);}
 return {render(s,c,active=true){if(!active){renderer.render(s,c);return;}renderer.getDrawingBufferSize(size);if(w!==size.x||h!==size.y){w=size.x;h=size.y;target.setSize(w,h);a.setSize(Math.max(1,Math.ceil(w/4)),Math.max(1,Math.ceil(h/4)));b.setSize(a.width,a.height);}const autoReset=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();try{renderer.setRenderTarget(target);renderer.render(s,c);pass(extract,a);blur.uniforms.source.value=a.texture;blur.uniforms.stepUV.value.set(1/a.width,0);pass(blur,b);blur.uniforms.source.value=b.texture;blur.uniforms.stepUV.value.set(0,1/b.height);pass(blur,a);pass(composite,null);}finally{renderer.setRenderTarget(null);renderer.info.autoReset=autoReset;}},dispose(){target.dispose();a.dispose();b.dispose();quad.geometry.dispose();extract.dispose();blur.dispose();composite.dispose();}};
}
