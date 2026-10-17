import * as T from 'three';
import { finishAtelier } from './academy-study.js?v=11';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
let source,loadJob;
export function loadAtelier(progress=()=>{}){
 if(source)return Promise.resolve();if(loadJob)return loadJob;
 const loader=new GLTFLoader();
 loadJob=loader.loadAsync(new URL('./assets/atelier/academy-atelier.glb',import.meta.url).href,e=>progress(e.total?Math.round(e.loaded/e.total*100):null)).then(gltf=>{
  source=gltf.scene;

 }).catch(e=>{loadJob=null;throw e;});return loadJob;
}
export function attachAtelier(parent){
 if(!source)throw Error('Blender atelier asset has not loaded');
 const g=source.clone(true);g.name='Blender academy reading room';g.userData.noBake=true;
 g.position.set(-.119,.056,.163);g.rotation.y=.52;g.scale.setScalar(.01);
 g.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.transmission;o.receiveShadow=true;}});finishAtelier(g);
 parent.add(g);return g;
}
export function createDaylight(renderer){
 // Original HDR lighting field, not a photographic/scanned HDRI.
 const w=1024,h=512,data=new Float32Array(w*h*4),sun=new T.Vector3(-2.2,3.3,4.5).normalize();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const t=y/h*Math.PI,p=x/w*Math.PI*2,dx=-Math.cos(p)*Math.sin(t),dy=Math.cos(t),dz=Math.sin(p)*Math.sin(t);
  const haze=Math.exp(-Math.max(0,dy)*5),cloud=Math.pow(Math.max(0,Math.sin(p*7+t*5)*Math.sin(p*3-t*11)),3)*.23*Math.max(0,dy);
  const s=Math.pow(Math.max(0,dx*sun.x+dy*sun.y+dz*sun.z),650)*16,k=(y*w+x)*4;
  data[k]=(dy<0?.20:.47+.22*haze+cloud)+s;data[k+1]=(dy<0?.23:.53+.20*haze+cloud)+s*.87;data[k+2]=(dy<0?.15:.62+.14*haze+cloud)+s*.68;data[k+3]=1;
 }
 const texture=new T.DataTexture(data,w,h,T.RGBAFormat,T.FloatType);texture.mapping=T.EquirectangularReflectionMapping;texture.needsUpdate=true;
 const pmrem=new T.PMREMGenerator(renderer),target=pmrem.fromEquirectangular(texture);texture.dispose();pmrem.dispose();return target;
}
