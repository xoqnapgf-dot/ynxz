import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAARenderPass } from 'three/addons/postprocessing/SSAARenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createPlanetMaterials } from './planet-materials.js?v=9';
import { WorldGTAOPass } from './world-occlusion.js?v=11';
import { loadAtelier, createDaylight } from './academy-asset.js?v=11';
import { loadStudyAssets, studyEnvironment } from './academy-study.js?v=11';
import { loadWorldSurfaces } from './world-finish.js?v=9';
import { updateEcology } from './ecology.js?v=9';
let createLandmark,inspectionRequest=0,pendingScene=null,lastSceneError=null;
const $=s=>document.querySelector(s),R=3.2,Y=new T.Vector3(0,1,0),GLOBE_UP=new T.Vector3(-.22,.974,.045).normalize();
import { SCENES, SCENE_BY_NAME } from './scene-catalog.js?v=5';
const special=Object.fromEntries(SCENES.filter(s=>typeof s.key==='number').map(s=>[s.key,s]));
let ao,daylight,ambient,renderer,scene,camera,controls,composer,clouds,earth,grid,borders,sun,atmosphere,stars,hemisphere,activeModel,planetMaterials;
let data,lines,heights,markers=[],models=[],selected=null,filter='special',inspection=false,night=false,flight=null,ready=false;
let isClean=false,rotation=false,toastTimer,lastFrame=0,exporting=false,paused=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const point=(u,v,r=R)=>{const lon=(u-.5)*Math.PI*2,lat=(.5-v)*Math.PI;return new T.Vector3(Math.sin(lon)*Math.cos(lat)*r,Math.sin(lat)*r,Math.cos(lon)*Math.cos(lat)*r)};
function elevation(u,v){if(!heights)return 0;const x=Math.max(0,Math.min(heights.w-1,Math.round(u*(heights.w-1)))),y=Math.max(0,Math.min(heights.h-1,Math.round(v*(heights.h-1))));return heights.a[(y*heights.w+x)*4]/255*.020;}
const surface=(u,v,extra=0)=>point(u,v,R+elevation(u,v)+extra);
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500)}
function fail(err){console.error(err);$('#loading').innerHTML='<div class="fatal"><h2>三维场景暂时无法启动</h2><p>请用支持 WebGL 2 的浏览器，并通过本地 HTTP 服务打开。<br>如显卡受限，可以先查看草稿文件夹中的截图。</p><a href="screenshots/">打开截图文件夹 ↗</a><small id="error-message"></small></div>';$('#error-message').textContent=err.message||String(err)}
async function init(){
 const [d,l]=await Promise.all([fetch('./assets/places.json').then(r=>{if(!r.ok)throw Error('地点数据载入失败');return r.json()}),fetch('./assets/lines.json').then(r=>r.json())]);data=d;lines=l;
 renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor('#060c15');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;$('#viewport').appendChild(renderer.domElement);
 scene=new T.Scene();scene.background=new T.Color('#050a10');camera=new T.PerspectiveCamera(39,innerWidth/innerHeight,.005,150);camera.up.copy(GLOBE_UP);camera.position.copy(point(.37,.37,innerWidth<700?18:12.9));
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.06;controls.enablePan=false;controls.rotateSpeed=.45;controls.minDistance=R+1;controls.maxDistance=20;controls.autoRotateSpeed=.22;
 controls.addEventListener('start',()=>{flight=null});ambient=new T.AmbientLight('#adc3d0',.45);scene.add(ambient);hemisphere=new T.HemisphereLight('#cfdee1','#48504b',.75);scene.add(hemisphere);
 sun=new T.DirectionalLight('#fff1dc',2.9);sun.position.set(-5,6,10);sun.castShadow=true;sun.shadow.mapSize.set(Math.min(4096,renderer.capabilities.maxTextureSize),Math.min(4096,renderer.capabilities.maxTextureSize));sun.shadow.camera.near=.01;sun.shadow.camera.far=30;sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.bias=-.0001;sun.shadow.normalBias=.00006;sun.shadow.radius=2.5;scene.add(sun);scene.add(sun.target);
 const loader=new T.TextureLoader();$('#loading-text').textContent='正在合拢海岸，塑造山脉';
 const [color,displace,rough,cloud,normal,land,cirrus]=await Promise.all(['surface.jpg','elevation.png','roughness.jpg','clouds.png','surface-normal.jpg','land-mask.png','cirrus.png'].map(x=>loader.loadAsync('./assets/'+x+'?v=3')));
 color.colorSpace=T.SRGBColorSpace;color.anisotropy=renderer.capabilities.getMaxAnisotropy();for(const x of [color,displace,rough,cloud,normal,land,cirrus]){x.wrapS=T.RepeatWrapping;x.wrapT=T.ClampToEdgeWrapping;}
 const hc=document.createElement('canvas');hc.width=displace.image.width;hc.height=displace.image.height;const hx=hc.getContext('2d',{willReadFrequently:true});hx.drawImage(displace.image,0,0);heights={w:hc.width,h:hc.height,a:hx.getImageData(0,0,hc.width,hc.height).data};
 const geo=new T.SphereGeometry(R,1024,512);geo.rotateY(-Math.PI/2);const pos=geo.attributes.position,uv=geo.attributes.uv,p=new T.Vector3();for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).normalize().multiplyScalar(R+elevation(uv.getX(i),1-uv.getY(i)));pos.setXYZ(i,p.x,p.y,p.z)}geo.computeVertexNormals();
 planetMaterials=createPlanetMaterials({color,normal,rough,land,cloud,cirrus});
 earth=new T.Mesh(geo,planetMaterials.ground);scene.add(earth);
 clouds=new T.Group();
 for(const [radius,material] of [[R+.028,planetMaterials.lowCloud],[R+.038,planetMaterials.highCloud]]){const cg=new T.SphereGeometry(radius,320,160);cg.rotateY(-Math.PI/2);const layer=new T.Mesh(cg,material);layer.renderOrder=2;clouds.add(layer);}scene.add(clouds);
 atmosphere=new T.Mesh(new T.SphereGeometry(R*1.012,128,80),planetMaterials.air);atmosphere.renderOrder=3;scene.add(atmosphere);
 // The planet opens without downloading the 14 MB optional academy asset.

 makeStars();makeLines();makeMarkers();renderList();bind();
 const sceneTarget=new T.WebGLRenderTarget(innerWidth,innerHeight,{type:T.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});composer=new EffectComposer(renderer,sceneTarget);composer.addPass(new RenderPass(scene,camera));ao=new WorldGTAOPass(scene,camera,innerWidth,innerHeight);ao.updateGtaoMaterial({radius:.008,thickness:.006,distanceExponent:1,distanceFallOff:1,scale:1,samples:16});ao.blendIntensity=.48;ao.enabled=false;composer.addPass(ao);composer.addPass(new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.14,.4,1.3));composer.addPass(new OutputPass());composer.addPass(new SMAAPass(innerWidth,innerHeight));
 resize();ready=true;$('#status').textContent='地理档案已就绪';$('#loading').classList.add('gone');setTimeout(()=>$('#loading').hidden=true,850);animate(0);
 const query=new URLSearchParams(location.search),site=query.get('site');
 if(site){const entry=SCENES.find(s=>String(s.key)===site||s.name===site),m=data.markers.find(m=>String(m.id)===site||m.name===site);const name=entry?.name||m?.name;if(name){selectPlace(name);if(query.has('inspect')&&entry)inspect(entry).then(ok=>{if(ok&&activeModel?.key===entry.key&&query.has('frame'))frameLandmark(query.get('frame'));});}}
 if(query.has('clean'))toggleClean(true);
 window.__globe={ready:true,select:selectPlace,inspect:id=>{const entry=SCENES.find(s=>String(s.key)===String(id)||s.name===id);if(entry){selectPlace(entry.name,false);return inspect(entry);}},view:setView,setClean:toggleClean,captureHQ,frame:frameLandmark,pause:on=>paused=on,comparison:()=>{exitInspection();flight=null;retargetControls(Y);camera.position.copy(point(.43,.35,12.9));controls.target.set(0,0,0);controls.update();},stats:()=>({markers:markers.length,models:SCENES.length,loadedModels:models.length,activeScene:activeModel?.key??null,quality:'Desktop HQ',revision:11,antialiasSamples:composer.renderTarget1.samples,edgeAntialias:'SMAA',pendingScene,lastSceneError,assetLighting:!!scene.environment,contactOcclusion:!!ao?.enabled,shadowSize:sun.shadow.mapSize.x,surfaceSize:[heights.w,heights.h],locations:Object.keys(data.locations).length,renderer:renderer.info.render,inspection,geometry:models.map(m=>({id:m.key,anchorId:m.marker.id,...m.geometry}))}),settle:()=>{if(flight){camera.position.copy(flight.to);controls.target.copy(flight.target);flight=null;controls.update();}},renderer};

}
function makeStars(){let seed=7982;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};const p=[],colors=[];for(let i=0;i<2400;i++){const v=point(rand(),Math.acos(2*rand()-1)/Math.PI,50+rand()*30);p.push(...v.toArray());const c=new T.Color().setHSL(.55+rand()*.13,.2,.35+rand()*.5);colors.push(...c.toArray())}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));stars=new T.Points(g,new T.PointsMaterial({size:.035,vertexColors:true,transparent:true,opacity:.4,depthWrite:false}));scene.add(stars);}
function makeLines(){const b=[];for(const edge of lines.borders)for(const [u,v]of edge)b.push(...surface(u,v,.004).toArray());const bg=new T.BufferGeometry();bg.setAttribute('position',new T.Float32BufferAttribute(b,3));borders=new T.LineSegments(bg,new T.LineBasicMaterial({color:'#ccb98d',transparent:true,opacity:.55}));borders.visible=false;scene.add(borders);
 const a=[];for(let lat=-75;lat<=75;lat+=15)for(let lon=0;lon<360;lon+=2){a.push(...surface(lon/360,(90-lat)/180,.003).toArray(),...surface((lon+2)/360,(90-lat)/180,.003).toArray())}for(let lon=0;lon<360;lon+=30)for(let lat=-89;lat<89;lat+=2){a.push(...surface(lon/360,(90-lat)/180,.003).toArray(),...surface(lon/360,(88-lat)/180,.003).toArray())}const gg=new T.BufferGeometry();gg.setAttribute('position',new T.Float32BufferAttribute(a,3));grid=new T.LineSegments(gg,new T.LineBasicMaterial({color:'#819dad',transparent:true,opacity:.13}));grid.visible=false;scene.add(grid);}
function makeMarkers(){for(const m of data.markers){const el=document.createElement('button');el.className='marker '+(special[m.id]?'special':'minor');el.innerHTML='<span class="pin"></span><span class="text"></span>';el.querySelector('.text').textContent=m.name;el.setAttribute('aria-label','查看'+m.name);el.title=m.name;el.addEventListener('click',()=>selectPlace(m.name));$('#labels').appendChild(el);markers.push({...m,el,position:surface(m.x,m.y,special[m.id]?.02:.008)});}}
function ensureModel(entry){
 let model=models.find(m=>m.key===entry.key);if(model)return model;
 const m=findMarker(entry.name);if(!m)throw Error('Missing parent anchor: '+entry.name);
 model=createLandmark(entry.key);model.key=entry.key;model.name=entry.name;model.marker=m;model.scope=entry.scope;
 model.group.position.copy(surface(m.x,m.y,.003));model.group.quaternion.setFromUnitVectors(Y,point(m.x,m.y,1));model.group.userData.place=entry.name;model.group.visible=false;
 model.group.traverse(o=>{for(const mat of [o.material].flat().filter(Boolean))for(const key of ['map','normalMap'])if(mat[key])mat[key].anisotropy=renderer.capabilities.getMaxAnisotropy();});
 scene.add(model.group);models.push(model);return model;
}
function renderList(){const query=$('#search').value.trim().toLowerCase();const names=Object.keys(data.locations).filter(name=>{const m=data.markers.find(x=>x.name===name);return (!query&&filter==='special'?SCENE_BY_NAME[name]:true)&&(!query||name.toLowerCase().includes(query)||data.locations[name].kind.includes(query))});const list=$('#place-list');list.innerHTML='';for(const name of names){const m=data.markers.find(x=>x.name===name),s=SCENE_BY_NAME[name],d=data.locations[name];const el=document.createElement('button');el.className='place'+(selected===name?' selected':'');el.style.setProperty('--site-color',s?.color||'#b7b5a3');el.innerHTML='<span class="place-icon"></span><span class="place-text"><strong></strong><small></small></span><span>↗</span>';el.querySelector('.place-icon').textContent=s?.icon||(d.parent?'·':'◈');el.querySelector('strong').textContent=name;el.querySelector('small').textContent=s?.label||(m?d.kind:d.kind+' · 坐标未定');el.onclick=()=>selectPlace(name);list.appendChild(el)}if(!names.length){list.innerHTML='<p class="empty-list">没有找到这个地点，试试简称以外的地名。</p>'}}
function findMarker(name){let n=name;const seen=new Set();while(n&&!seen.has(n)){seen.add(n);const m=data.markers.find(m=>m.name===n);if(m)return m;n=data.locations[n]?.parent}return null}
function coords(m){const lon=m.x*360-180,lat=90-m.y*180;return `${Math.abs(lat).toFixed(2)}° ${lat>=0?'N':'S'}　/　${Math.abs(lon).toFixed(2)}° ${lon>=0?'E':'W'}`}
function selectPlace(name,move=true){cancelInspection();const d=data.locations[name];if(!d)return;selected=name;const m=findMarker(name),exact=m?.name===name,s=SCENE_BY_NAME[name];$('#detail').hidden=false;$('#explorer-content').parentElement.style.visibility='hidden';$('#detail-title').textContent=name;$('#detail-tag').textContent=d.kind;$('#detail-number').textContent=s?'SCENE / '+String(SCENES.indexOf(s)+1).padStart(2,'0'):'GEOGRAPHIC RECORD';$('#detail-coordinates').textContent=exact?coords(m):'坐标未定 · 沿所属地区定位';$('#detail-description').textContent=d.desc;$('#inspect').hidden=!s;$('#inspect').onclick=()=>inspect(s);$('#detail-note').textContent=s?(s.scope==='secondary'?'二级地点的局部场景；没有独立坐标，仅沿所属地区定位。':'局部建筑与环境演绎，不代表全国缩微模型，也非正式建筑设定。'):exact?'标记沿用现有正式坐标；国界线仅为原始底图参考。':'没有为此地点编造精确坐标。球体显示其已定位的上级地区。';const child=$('#children');child.innerHTML='';const related=d.parent?[d.parent]:Object.keys(data.locations).filter(n=>data.locations[n].parent===name);for(const n of related){const b=document.createElement('button');b.textContent=(d.parent?'↑ ':'↳ ')+n;b.onclick=()=>selectPlace(n);child.appendChild(b)}for(const mark of markers)mark.el.classList.toggle('active',mark.name===m?.name);renderList();if(move&&m){exitInspection();fly(point(m.x,m.y,8.6),new T.Vector3(),1400);setRotation(false)}$('#status').textContent=name;}
function cancelInspection(){inspectionRequest++;pendingScene=null;$('#scene-loading').hidden=true;$('#inspect').disabled=false;}
function showSceneLoad(text,fraction=0){$('#scene-loading').hidden=false;$('#scene-loading-text').textContent=text;$('#scene-progress').value=fraction;}
async function inspect(entry){
 if(!entry)return;const request=++inspectionRequest;pendingScene=entry.key;lastSceneError=null;
 const current=()=>request===inspectionRequest&&pendingScene===entry.key;
 $('#scene-retry').hidden=true;$('#scene-cancel').textContent='取消进入';$('#inspect').disabled=true;
 try{
  showSceneLoad(entry.name+' · 正在准备材质');
  const module=await import('./landmarks.js?v=11');createLandmark=module.createLandmark;
  if(!current())return false;
  await loadWorldSurfaces(p=>{if(current())showSceneLoad(entry.name+' · PBR 材质 '+Math.round(p*100)+'%',p*.6);});
  if(!current())return false;
  if(entry.key===900){
   await loadStudyAssets(renderer,p=>{if(current())showSceneLoad('学院 · 参考材质与摄影环境 '+Math.round(p*100)+'%',.6+p*.1);});
   if(!current())return false;
   showSceneLoad('安那其学院 · 正在载入 Blender 建筑',.6);
   await loadAtelier(p=>{if(current())showSceneLoad('安那其学院 · Blender 建筑'+(p===null?'':' '+p+'%'),.6+(p||0)*.003);});
  }
  if(!current())return false;
  showSceneLoad(entry.name+' · 正在组装场景',.95);
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  if(!current())return false;
  if(!daylight)daylight=createDaylight(renderer);
  activateScene(entry);pendingScene=null;$('#scene-loading').hidden=true;$('#inspect').disabled=false;return true;
 }catch(error){
  if(!current())return false;
  pendingScene=null;lastSceneError=error.message||'场景资源载入失败';$('#inspect').disabled=false;
  showSceneLoad(entry.name+' · 资源载入失败，可重试或返回星球');$('#scene-retry').hidden=false;
  $('#scene-retry').onclick=()=>inspect(entry);$('#scene-cancel').textContent='关闭';return false;
 }
}
function activateScene(entry){const model=ensureModel(entry),m=model.marker;inspection=true;renderer.toneMappingExposure=entry.key===900?1.0:1.08;sun.intensity=entry.key===900?2.1:2.9;activeModel=model;for(const x of models){x.group.visible=x===model;x.group.scale.setScalar(x===model?1:.1);x.detail.visible=x===model;}earth.visible=clouds.visible=atmosphere.visible=stars.visible=grid.visible=borders.visible=false;scene.fog=new T.Fog(new T.Color().setRGB(.47,.48,.45),1.1,entry.scope==='landmark'?4.2:3.8);hemisphere.position.copy(point(m.x,m.y,1));retargetControls(point(m.x,m.y,1));document.body.classList.add('inspection');setRotation(false);controls.minDistance=.04;ao.enabled=true;scene.environment=entry.key===900?studyEnvironment().texture:daylight.texture;scene.environmentRotation.setFromQuaternion(model.group.quaternion);ambient.intensity=entry.key===900?0:.15;hemisphere.intensity=entry.key===900?.12:.55;controls.maxDistance=1.8;controls.rotateSpeed=.36;applyInspectionOffset();const focus=model.group.localToWorld(new T.Vector3(0,model.focus,0));const eye=model.group.localToWorld(new T.Vector3(...model.eye));camera.position.copy(eye);controls.target.copy(focus);flight=null;controls.update();$('#detail-views').hidden=entry.key!==901&&!model.views;for(const button of document.querySelectorAll('[data-detail-view]')){button.hidden=['street','materials','library','teaching','workshop','courtyard','joinery'].includes(button.dataset.detailView)?!model.views?.[button.dataset.detailView]:button.dataset.detailView!=='wide'&&entry.key!==901;}$('#status').textContent=entry.name+' · 场景特写';$('#detail-note').textContent=(entry.scope==='secondary'?'坐标未定，仅沿上级地区定位。':'')+'可环绕、缩放查看建筑与街区；局部场景为视觉演绎，不表示测绘比例。';}
function applyInspectionOffset(){if(!inspection){camera.clearViewOffset();return}if(innerWidth<700)camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.14,innerWidth,innerHeight);else camera.setViewOffset(innerWidth,innerHeight,innerWidth*.095,0,innerWidth,innerHeight);}
function exitInspection(){cancelInspection();if(ao)ao.enabled=false;scene.environment=null;sun.intensity=2.9;renderer.toneMappingExposure=1.22;ambient.intensity=.45;hemisphere.intensity=.75;$('#detail-views').hidden=true;inspection=false;activeModel=null;camera.clearViewOffset();for(const x of models){x.group.scale.setScalar(.1);x.group.visible=false;x.detail.visible=false;}earth.visible=atmosphere.visible=stars.visible=true;grid.visible=$('#grid').checked;borders.visible=$('#borders').checked;scene.fog=null;hemisphere.position.set(0,1,0);retargetControls(GLOBE_UP);document.body.classList.remove('inspection');controls.minDistance=R+1;controls.maxDistance=20;controls.rotateSpeed=.45;clouds.visible=$('#clouds').checked;}
function retargetControls(up){const target=controls.target.clone();controls.dispose();camera.up.copy(up);controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(target);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.06;controls.minPolarAngle=.12;controls.maxPolarAngle=inspection?2.05:Math.PI-.12;controls.autoRotateSpeed=.22;controls.autoRotate=rotation&&!inspection;controls.addEventListener('start',()=>flight=null)}
function fly(to,target,duration=1400){flight={from:camera.position.clone(),fromTarget:controls.target.clone(),to:to.clone(),target:target.clone(),start:performance.now(),duration:reduced?1:duration};}
function setView(name){exitInspection();$('#detail').hidden=true;$('.explorer').style.visibility='';selected=null;for(const m of markers)m.el.classList.remove('active');renderList();const presets={overview:[.37,.37,innerWidth<700?18:12.9],west:[.26,.39,9.1],east:[.755,.46,9.4],strait:[.49,.49,8.7]};const a=presets[name]||presets.overview;fly(point(...a),new T.Vector3(),1600);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$('#status').textContent=({overview:'星球全景',west:'西大陆',east:'东大陆',strait:'两陆海峡'})[name]||'星球全景';}
function setRotation(on){rotation=on;controls.autoRotate=on&&!inspection;$('#rotate').setAttribute('aria-pressed',String(on));}
function toggleClean(on=!isClean){isClean=on;document.body.classList.toggle('clean',on);$('#restore-ui').hidden=!on;}
function bind(){$('#scene-cancel').onclick=cancelInspection;for(const [id,obj]of [['clouds',clouds],['borders',borders],['grid',grid]])$('#'+id).onchange=e=>{obj.visible=e.target.checked;if(id==='borders'&&e.target.checked)toast('国界沿用旧底图；未设定地区不新增地名或主权。')};$('#markers').onchange=e=>$('#labels').style.display=e.target.checked?'':'none';$('#rotate').onclick=()=>setRotation(!rotation);$('#lighting').onclick=()=>{night=!night;$('#lighting').setAttribute('aria-pressed',String(night));toast(night?'已固定太阳方向，可旋转观察昼夜分界':'已恢复面向观察方向的展示光照')};$('#search').oninput=renderList;for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderList()};for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);$('#reset').onclick=()=>setView('overview');$('#close-detail').onclick=()=>{cancelInspection();$('#detail').hidden=true;$('.explorer').style.visibility='';if(inspection)setView('overview')};$('#zoom-in').onclick=()=>zoom(.82);$('#zoom-out').onclick=()=>zoom(1.2);$('#clean').onclick=()=>toggleClean();$('#restore-ui').onclick=()=>toggleClean(false);$('#fold').onclick=()=>{const c=$('#explorer-content');c.hidden=!c.hidden;$('#fold').textContent=c.hidden?'+':'−'};$('#capture').onclick=()=>captureHQ({download:true}).catch(e=>toast('4K PNG: '+e.message));for(const button of document.querySelectorAll('[data-detail-view]'))button.onclick=()=>frameLandmark(button.dataset.detailView);

 addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement){if(e.key==='Escape')e.target.blur();return}if(e.key.toLowerCase()==='h')toggleClean();if(e.key==='/'){cancelInspection();e.preventDefault();$('#explorer-content').hidden=false;$('#detail').hidden=true;$('.explorer').style.visibility='';$('#search').focus()}if(e.key==='Escape'){if(isClean)toggleClean(false);else setView('overview')}});addEventListener('resize',resize);renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;cancelInspection();if(window.__globe)window.__globe.ready=false;showSceneLoad('图形上下文已中断，请刷新页面恢复。');$('#scene-retry').hidden=false;$('#scene-retry').textContent='刷新页面';$('#scene-retry').onclick=()=>location.reload()});
 let down=null;renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1),camera);const hit=ray.intersectObjects(inspection?[activeModel.group]:[earth],true)[0];if(hit){let o=hit.object;while(o&&!o.userData.place)o=o.parent;if(o)selectPlace(o.userData.place,!inspection)}});
}
function zoom(f){flight=null;const delta=camera.position.clone().sub(controls.target);delta.setLength(T.MathUtils.clamp(delta.length()*f,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(delta);controls.update()}
function frameLandmark(preset='wide') {
 if(!activeModel)return;
 const poses={wide:{eye:activeModel.eye,target:[0,activeModel.focus,0]},...(activeModel.key===901?{harbor:{eye:[-.41,.22,.41],target:[-.21,.045,.045]},rift:{eye:[.68,.37,.92],target:[0,.27,0]}}:{}),...activeModel.views};
 const p=poses[preset]||poses.wide;flight=null;
 camera.position.copy(activeModel.group.localToWorld(new T.Vector3(...p.eye)));
 controls.target.copy(activeModel.group.localToWorld(new T.Vector3(...p.target)));controls.update();
}
async function captureHQ({width=3840,height=2160,samples=4,download=false}={}) {
 if(exporting)throw Error('An export is already running');
 if(!ready)throw Error('Scene is not ready');
 if(width>renderer.capabilities.maxTextureSize||height>renderer.capabilities.maxTextureSize)throw Error('Resolution exceeds this GPU limit');
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<64||height<64||![1,2,4,8,16].includes(samples))throw Error('Invalid export settings');
 const button=$('#capture'),size=renderer.getSize(new T.Vector2()),ratio=renderer.getPixelRatio(),oldAspect=camera.aspect,oldView=camera.view?{...camera.view}:null,oldRotation=controls.autoRotate;
 const previousPass=composer.passes[0],oldShadowAuto=renderer.shadowMap.autoUpdate;
 const aa=new SSAARenderPass(scene,camera);aa.sampleLevel=Math.log2(samples);
 exporting=true;button.disabled=true;button.textContent='4K…';toast('4K PNG · Rendering…');
 try {
  await new Promise(resolve=>setTimeout(resolve,60));
  controls.autoRotate=false;flight=null;renderFrame(lastFrame||performance.now(),false);
  camera.clearViewOffset();camera.aspect=width/height;camera.updateProjectionMatrix();
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);composer.setPixelRatio(1);composer.setSize(width,height);
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  composer.passes[0]=aa;composer.render();
  const url=renderer.domElement.toDataURL('image/png');
  if(download){const a=document.createElement('a');a.download='Pierteia-'+(selected||'planet')+'-HQ-4K.png';a.href=url;a.click();toast('4K PNG ✓');}
  return url;
 } finally {
  composer.passes[0]=previousPass;aa.dispose();
  renderer.shadowMap.autoUpdate=oldShadowAuto;controls.autoRotate=oldRotation;
  renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);composer.setPixelRatio(ratio);composer.setSize(size.x,size.y);
  camera.aspect=oldAspect;camera.clearViewOffset();if(oldView?.enabled)camera.setViewOffset(oldView.fullWidth,oldView.fullHeight,oldView.offsetX,oldView.offsetY,oldView.width,oldView.height);camera.updateProjectionMatrix();
  exporting=false;button.disabled=false;button.innerHTML='4K PNG <span>↗</span>';
 }
}
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<700?51:39;applyInspectionOffset();camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer?.setSize(innerWidth,innerHeight);}
const project=new T.Vector3(),delta=new T.Vector3();
function updateMarkers(){const occupied=[];for(const m of [...markers].sort((a,b)=>(!!special[b.id])-(!!special[a.id]))){project.copy(m.position).project(camera);delta.copy(camera.position).sub(m.position);let show=delta.dot(m.position.clone().normalize())>.02&&project.z<1&&project.x>-1&&project.x<1&&project.y>-1&&project.y<1&&!inspection;const x=(project.x+1)/2*innerWidth,y=(-project.y+1)/2*innerHeight,w=m.name.length*(special[m.id]?11:10)+20;if(show){if(occupied.some(a=>x<a.x+a.w&&x+w>a.x&&Math.abs(y-a.y)<22))show=false;else occupied.push({x,y,w})}m.el.dataset.hidden=String(!show);if(show){m.el.style.left=x+'px';m.el.style.top=y+'px'}}}
function animate(now){requestAnimationFrame(animate);if(!ready||document.hidden||exporting||paused)return;if(now-lastFrame<31)return;lastFrame=now;renderFrame(now);}
function renderFrame(now,draw=true){const t=now/1000;if(flight){let k=Math.min(1,(performance.now()-flight.start)/flight.duration);k=k*k*(3-2*k);camera.position.lerpVectors(flight.from,flight.to,k);controls.target.lerpVectors(flight.fromTarget,flight.target,k);if(k>=1)flight=null}controls.update();if(inspection&&activeModel){sun.position.copy(activeModel.group.localToWorld(new T.Vector3(...(activeModel.light||[-2.2,3.3,4.5]))));}else if(!night){sun.position.copy(camera.position).normalize().applyAxisAngle(Y,-.72).multiplyScalar(12);sun.position.y+=4;}else{sun.position.set(-5,6,10);}sun.target.position.copy(controls.target);const shadowSpan=inspection?(activeModel.key===900&&camera.position.distanceTo(controls.target)<.35?.18:.65):4;sun.shadow.camera.left=-shadowSpan;sun.shadow.camera.right=shadowSpan;sun.shadow.camera.top=shadowSpan;sun.shadow.camera.bottom=-shadowSpan;sun.shadow.camera.updateProjectionMatrix();planetMaterials.update(sun.position,clouds.rotation.y,clouds.visible);if(!reduced){updateEcology(t);clouds.rotation.y=t*.00004;if(activeModel)activeModel.update(t)}const norm=camera.position.clone().normalize(),lon=Math.atan2(norm.x,norm.z)*180/Math.PI,lat=Math.asin(norm.y)*180/Math.PI;$('#view-coordinates').textContent=`${Math.abs(lon).toFixed(1)}°${lon>=0?'E':'W'} · ${Math.abs(lat).toFixed(1)}°${lat>=0?'N':'S'}`;updateMarkers();if(draw)composer.render();}
init().catch(fail);
