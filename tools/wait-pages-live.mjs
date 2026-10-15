// Wait for the actual published application bytes, not just a successful Pages job.
import fs from 'node:fs';import {createHash} from 'node:crypto';
const base=process.env.ATLAS_URL||'https://xoqnapgf-dot.github.io/ynxz/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=['index.html','map.html','globe.html','js/map-view.js','css/map-view.css'];
const expected=Object.fromEntries(files.map(p=>[p,hash(fs.readFileSync(new URL('../'+p,import.meta.url)))]));
const deadline=Date.now()+600000;let results=[];
do{
 results=await Promise.all(files.map(async path=>{const url=new URL(path,base);url.searchParams.set('verify',process.env.GITHUB_SHA||'v21');try{const r=await fetch(url,{signal:AbortSignal.timeout(30000),cache:'no-store'});const actual=hash(Buffer.from(await r.arrayBuffer()));return {path,url:r.url,status:r.status,type:r.headers.get('content-type'),expected:expected[path],actual,match:r.ok&&actual===expected[path]};}catch(e){return {path,match:false,error:e.message};}}));
 if(results.every(r=>r.match)){const assets=[];for(const path of ['素材/地图/terrain.png','drafts/pierteia-globe/assets/land-mask.png','drafts/pierteia-globe/assets/surface.jpg','drafts/pierteia-globe/assets/atelier/academy-atelier.glb']){const r=await fetch(new URL(path,base),{signal:AbortSignal.timeout(120000)});const bytes=Buffer.from(await r.arrayBuffer()),expectedHash=hash(fs.readFileSync(new URL('../'+path,import.meta.url)));const entry={path,url:r.url,status:r.status,type:r.headers.get('content-type'),bytes:bytes.length,sha256:hash(bytes),expected:expectedHash};assets.push(entry);if(!r.ok||entry.sha256!==expectedHash||!r.url.startsWith(base))throw Error('Live binary resource mismatch: '+JSON.stringify(entry));}fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/pages-http-v21.json',JSON.stringify({base,checkedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,results,assets},null,2)+'\n');console.log('PASS live HTML/JS/CSS bytes match checkout');process.exit(0);}
 console.log('Waiting for published bytes:',results.filter(r=>!r.match));
 await new Promise(r=>setTimeout(r,10000));
}while(Date.now()<deadline);
fs.writeFileSync('docs/pages-http-v21.json',JSON.stringify({base,results,failed:true},null,2)+'\n');throw Error('Published application does not match this checkout after ten minutes');
