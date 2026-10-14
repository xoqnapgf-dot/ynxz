import fs from 'node:fs';
const root=new URL('../',import.meta.url).pathname;
if(process.argv.length!==4)throw Error('Usage: node tools/downsample-study-hdr.mjs INPUT.hdr OUTPUT.hdr');
const T=await import(root+'vendor/three.module.js');
const text=fs.readFileSync(root+'vendor/addons/loaders/RGBELoader.js','utf8').replace("from 'three'",`from 'file://${root}vendor/three.module.js'`);
const {RGBELoader}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const path=process.argv[2];const data=fs.readFileSync(path),parsed=new RGBELoader().setDataType(T.FloatType).parse(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
const w=parsed.width/2,h=parsed.height/2,result=[Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`)];
for(let y=0;y<h;y++){
 const line=new Uint8Array(w*4);
 for(let x=0;x<w;x++){
  const color=[0,0,0];for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)for(let c=0;c<3;c++)color[c]+=parsed.data[((y*2+dy)*parsed.width+x*2+dx)*4+c]*.25;
  const max=Math.max(...color),exp=max>1e-32?Math.floor(Math.log2(max))+1:0,factor=max>1e-32?256/2**exp:0;
  for(let c=0;c<3;c++)line[c*w+x]=Math.min(255,Math.floor(color[c]*factor));line[3*w+x]=max>1e-32?exp+128:0;
 }
 result.push(Buffer.from([2,2,w>>8,w&255]));for(let c=0;c<4;c++)for(let x=0;x<w;x+=127){const n=Math.min(127,w-x);result.push(Buffer.from([n]),Buffer.from(line.slice(c*w+x,c*w+x+n)));}
}
fs.writeFileSync(process.argv[3],Buffer.concat(result));console.log(w,h,Buffer.concat(result).length);
