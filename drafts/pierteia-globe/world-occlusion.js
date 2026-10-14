import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
// The stock normal override ignores sprite/foliage alpha. Such billboards must
// not become opaque rectangles in the AO depth buffer. Keep them in beauty and
// shadow passes; only exclude them during the normal/depth prepass.
export class WorldGTAOPass extends GTAOPass {
 overrideVisibility(){
  super.overrideVisibility();
  this.scene.traverse(object=>{
   if(object.isSprite||[object.material].flat().some(m=>m&&(m.transparent||m.alphaTest>0||m.depthWrite===false)))object.visible=false;
  });
 }
}
