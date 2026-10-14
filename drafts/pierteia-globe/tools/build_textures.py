"""Derive draft globe textures from the repository's existing Azgaar polygons.
Offline build only: pip install pillow numpy scipy. No external geography used.
Run from this file's directory or repository root. Seeded noise is surface detail,
not new coastlines, tectonic plates, settlements or political boundaries.
"""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter, distance_transform_edt, zoom

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parents[1]/'assets'
source=ROOT/'素材/地图/Pierteia Full 2026-09-19-01-11.json'
p=json.loads(source.read_text()); W,H=4096,2048
cells=p['pack']['cells']; verts={v['i']:v['p'] for v in p['pack']['vertices']}; byid={c['i']:c for c in cells}
sw,sh=p['info']['width'],p['info']['height']
rasters=[Image.new('L',(W,H),v) for v in [0,0,0,0]]
draws=[ImageDraw.Draw(i) for i in rasters]
for c in cells:
 poly=[(verts[v][0]/sw*W,verts[v][1]/sh*H) for v in c['v']]
 land=c['h']>=20
 for d,value in zip(draws,[c['h'],c['biome'],c['state'],255 if land else 0]):d.polygon(poly,fill=int(value))
raw,biome,state,mask=[np.asarray(i).copy() for i in rasters];land=mask>127
rng=np.random.default_rng(59812824)
def noise(sx,sy):
 a=rng.random((sy,sx)).astype('float32');a=np.pad(a,((1,1),(1,1)),mode='wrap')
 return zoom(a,(H/(sy+2),W/(sx+2)),order=1)[:H,:W].astype('float32')
fine=noise(1200,600);medium=noise(250,125);broad=noise(60,30)
fbm=.45*medium+.25*broad+.30*fine
height=gaussian_filter(raw.astype('float32'),5)
# Color palettes use the actual biome mask. Regional blends follow the location gazetteer.
colors=np.array([[10,36,55],[180,157,107],[139,142,117],[126,143,85],[94,128,79],[54,105,64],[38,93,62],[53,105,71],[46,87,72],[68,97,78],[132,143,130],[212,221,219],[49,97,75]],dtype='float32')
albedo=colors[np.minimum(biome,len(colors)-1)]
regional={4:(96,110,88),5:(98,137,88),11:(88,120,91),12:(101,136,92),13:(141,140,96),14:(141,153,100),20:(91,129,75),21:(108,141,91),24:(95,123,89),29:(40,95,64),30:(123,138,88),31:(56,108,80),32:(118,143,94),35:(83,127,73),38:(44,97,67),3:(66,121,79)}
for sid,color in regional.items():
 sel=(state==sid)&land;albedo[sel]=albedo[sel]*.35+np.array(color)*.65
# Lithology and ridges are visual high-frequency detail constrained by existing height.
ridge=np.abs(medium-.5)*2
mount=np.clip((height-40)/38,0,1)
rock=np.stack([147+fine*25,143+fine*23,130+fine*23],-1)
albedo=albedo*(1-mount[...,None]*.78)+rock*mount[...,None]*.78
snow=np.clip((height-70)/17,0,1)*land
albedo=albedo*(1-snow[...,None])+np.array([225,233,229])*snow[...,None]
albedo=gaussian_filter(albedo,sigma=(7,7,0))
detail=(fbm-.5)*32+(ridge-.5)*mount*25
albedo+=detail[...,None]
# Small farm/forest texture, only on lowland. It does not denote cadastral boundaries.
y,x=np.mgrid[:H,:W]
fields=(np.sin(x*.65+np.sin(y*.19))*np.sin(y*.47))*(state==35)*(height<46)*2.5
albedo+=fields[...,None]
coastdist=distance_transform_edt(~land).astype('float32');shelf=np.exp(-coastdist/10)
sea=np.zeros((H,W,3),dtype='float32')+np.array([9,31,48]);sea+=shelf[...,None]*np.array([13,37,35]);sea+=(broad-.5)[...,None]*np.array([2,5,6])
# Lakes remain water, with shallower blue-green coloring.
lakemask=Image.new('L',(W,H),0);ld=ImageDraw.Draw(lakemask)
for c in cells:
 f=p['pack']['features'][c['f']]
 if c['h']<20 and isinstance(f,dict) and f['type']=='lake':ld.polygon([(verts[v][0]/sw*W,verts[v][1]/sh*H) for v in c['v']],fill=255)
lake=np.asarray(lakemask)>0;sea[lake]=np.array([30,78,81])+(fine[lake]-.5)[:,None]*8
albedo=np.where(land[...,None],albedo,sea)
image=Image.fromarray(np.clip(albedo,0,255).astype('uint8'),'RGB');rd=ImageDraw.Draw(image)
riverpaths=[]
for r in p['pack']['rivers']:
 points=[byid[i]['p'] for i in r['cells'] if i in byid]
 if len(points)<3:continue
 coords=[(round(px/sw*W),round(py/sh*H)) for px,py in points]
 rd.line(coords,fill=(48,99,103),width=2 if r['discharge']>500 else 1)
 if r['discharge']>150:riverpaths.append([[round(px/sw,6),round(py/sh,6)] for px,py in points])
image.save(OUT/'surface.jpg',quality=94,subsampling=0)
# Height is relative visual relief, NOT an assertion of physical meter elevations.
elev=np.clip((height-19)/81,0,1)**1.45
elev+=((ridge-.35)*.065*mount+(fine-.5)*.013)*land
elev=np.where(land,np.maximum(elev,.006),0)
# Gazetteer: an isolated snowy peak at the formal Tian Shen marker.
u,v=.608,.423;peak=np.exp(-(((x/W-u)/.0042)**2+((y/H-v)/.0068)**2))
elev=np.clip(elev+peak*.5,0,1)
Image.fromarray((elev*255).astype('uint8')).save(OUT/'elevation.png')
rough=np.where(land,220+fine*22,83+fine*9).astype('uint8');Image.fromarray(rough).save(OUT/'roughness.jpg',quality=91)
Image.fromarray(mask).save(OUT/'land-mask.png')
# Country borders are shared polygon edges, not biome borders or subdivisions.
borders=[]
for c in cells:
 if c['h']<20:continue
 cv=set(c['v'])
 for n in c['c']:
  q=byid.get(n)
  if not q or n<=c['i'] or q['h']<20 or c['state']==q['state']:continue
  shared=list(cv.intersection(q['v']))
  if len(shared)==2:borders.append([[round(verts[v][0]/sw,6),round(verts[v][1]/sh,6)] for v in shared])
(OUT/'lines.json').write_text(json.dumps({'borders':borders,'rivers':riverpaths},separators=(',',':')))
# Seam-continuous weather texture, only decorative; not a climate simulation.
a=noise(42,21);b=noise(130,65);cloud=gaussian_filter(a*.65+b*.25+fine*.10,2)
alpha=np.clip((cloud-.54)*4.2,0,.52)
alpha*=np.clip(np.cos((y/H-.5)*math.pi)*1.1,.18,1)
rgba=np.zeros((H,W,4),dtype='uint8');rgba[:,:,:3]=244;rgba[:,:,3]=(alpha*210).astype('uint8')
Image.fromarray(rgba,'RGBA').save(OUT/'clouds.png')
image.resize((900,450)).save(OUT/'atlas-preview.jpg',quality=90)
meta={'source':str(source.relative_to(ROOT)),'sourceSize':[sw,sh],'textureSize':[W,H],'cells':len(cells),'projection':'lon=360*x-180; lat=90-180*y','coordinates':p['mapCoordinates'],'relief':'visual exaggeration; no absolute height conversion','seed':59812824,'borders':len(borders),'rivers':len(riverpaths)}
(OUT/'provenance.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
print(json.dumps(meta,ensure_ascii=False));print('textures complete')
