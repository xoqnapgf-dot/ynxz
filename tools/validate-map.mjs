// v23 静态校验：平面地图（atlas 代码渲染）+ 独立 3D 地球 + 每个地点一份 2.5D 沙盘配方。
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const ctx={};ctx.window=ctx;vm.runInNewContext(read('js/map-data.js')+'\n'+read('js/locations-data.js')+'\n'+read('js/atlas-data.js'),ctx);
const L=ctx.LOCATION_DATA,N=ctx.MAP_NATIONS,A=ctx.ATLAS_DATA;
// 地点志与地图标记
const official=N.filter(n=>Object.hasOwn(L,n.name));assert.equal(official.length,20,'20 mapped places');
for(const [k,v] of Object.entries(L)){if(v.parent)assert(Object.hasOwn(L,v.parent),k+' parent');}
for(const [a,n] of Object.entries(ctx.LOCATION_ALIAS||{}))assert(Object.hasOwn(L,n),'alias '+a);
// atlas 数据完整
assert.equal(A.W,3000);assert.equal(A.H,935);assert.equal(A.gw*A.step,3000);
for(const k of ['height','biome','state','temp'])assert.equal(Buffer.from(A[k],'base64').length,A.gw*A.gh,k);
assert(A.coast.length>10&&A.rivers.length>100&&A.borders.length>50&&A.islets.length>=20);
for(const n of N)if(n.id<900&&n.type!=='special'||n.name==='万知城')assert(A.regions[n.id],'region for '+n.name);
// 沙盘配方：每个地点恰好一份；国家 / 大地区为半开放，小地点为完整底座
const keys=(file,obj)=>[...read(file).matchAll(new RegExp(obj+"\\['([^']+)'\\]\\s*=\\s*\\{\\s*\\n?\\s*mode:\\s*'(open|closed)'",'g'))].map(m=>[m[1],m[2]]);
const open=keys('js/globe/diorama/places-open.js','COUNTRIES'),closed=keys('js/globe/diorama/places-closed.js','SITES');
assert(open.every(([,m])=>m==='open'),'places-open 只放半开放配方');assert(closed.every(([,m])=>m==='closed'),'places-closed 只放完整底座配方');
const names=[...open,...closed].map(([n])=>n);
assert.equal(new Set(names).size,names.length,'沙盘配方重名');
assert.deepEqual([...names].sort(),Object.keys(L).sort(),'每个地点志条目都要有沙盘配方');
// 页面入口
const html=read('map.html'),globe=read('globe.html');
for(const id of ['viewFlat','viewGlobe','mapStage','atlasCanvas','atlasCard','atlasSearch'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,'map '+id);
for(const id of ['globeStage','globeCanvas','atlasCard','acDio','dioHud','dioViews','dioVeil'])assert.equal((globe.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,'globe '+id);
assert(!/<img[^>]+素材\/地图/.test(html),'flat map must not load base images');assert(!html.includes('<iframe'),'no 3D iframe');
// 资源版本：同一文件在各页面的 ?v= 必须一致；3D 模块的相对导入统一版本，避免同一模块加载两份
const pages=fs.readdirSync(new URL('.',root)).filter(f=>f.endsWith('.html')),seen={};
for(const p of pages)for(const m of read(p).matchAll(/((?:js|css)\/[\w./-]+\.(?:js|css))\?v=(\d+)/g)){(seen[m[1]]??={})[m[2]]=(seen[m[1]][m[2]]||[]).concat(p);}
for(const [f,v] of Object.entries(seen))assert.equal(Object.keys(v).length,1,f+' 版本不一致 '+JSON.stringify(v));
const mods=['js/globe/app.js','js/globe/planet.js',...fs.readdirSync(new URL('js/globe/diorama/',root)).map(f=>'js/globe/diorama/'+f)],vers=new Set();
for(const f of mods)for(const m of read(f).matchAll(/(?:from |import\()'(\.[^']+)'/g)){const v=(m[1].match(/\?v=(\d+)$/)||[])[1];assert(v,f+' 相对导入缺少版本 '+m[1]);vers.add(v);}
assert.equal(vers.size,1,'3D 模块相对导入版本不统一 '+[...vers]);
for(const p of pages)assert(!/release=(1\d|2[0-2])\b/.test(read(p)),p+' 仍有旧 release 链接');
console.log(`PASS: v23 atlas, ${Object.keys(L).length} places (${official.length} mapped), ${open.length} open + ${closed.length} closed dioramas, ${pages.length} pages with consistent asset versions.`);
