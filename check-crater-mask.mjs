import assert from 'node:assert/strict';
import {createCraterMask} from './dist/crater-mask.js';
const mask=createCraterMask(),depth=new Float32Array(289);depth[8*17+8]=1;mask.update(0,0,depth);
function sample(a,b,x,z){const map=mask.uniforms.craterMap.value.image.data,i=((b+256)*512+a+256)*4,slot=map[i]+256*map[i+1]-1;if(slot<0)return 0;const n=mask.uniforms.craterColumns.value,w=mask.uniforms.craterAtlasSize.value;return mask.uniforms.craterDepth.value.image.data[(Math.floor(slot/n)*17+z)*w+(slot%n)*17+x];}
assert.equal(sample(0,0,8,8),255);assert.equal(sample(0,0,0,0),0);assert.equal(sample(0,0,16,16),0);assert.equal(sample(1,0,0,0),0);
for(let i=1;i<1030;i++)mask.update(i%40,Math.floor(i/40),depth);
assert.equal(mask.uniforms.craterColumns.value,64);assert.equal(sample(0,0,8,8),255);assert.equal(sample(29,25,8,8),255);assert.equal(sample(29,25,0,0),0);
console.log('Crater mask preserves untouched tile areas, separates neighboring tiles and retains data when growing.');
