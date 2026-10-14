"""Deterministic cartographic surface synthesis. Python + NumPy/Pillow/SciPy.
The original polygon coastline, lakes and mountain distribution remain authoritative.
Sub-cell ridges, erosion-like channels, weather and material grain are visual detail,
not newly asserted geography. No real-Earth satellite imagery is used.
"""
from pathlib import Path
import json, math, gc
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, distance_transform_edt, zoom, map_coordinates
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parents[1]/'assets'
source=ROOT/'素材/地图/Pierteia Full 2026-09-19-01-11.json'
p=json.loads(source.read_text()); W,H=6144,3072
cells=p['pack']['cells']; verts={v['i']:v['p'] for v in p['pack']['vertices']}; byid={c['i']:c for c in cells}
sw,sh=p['info']['width'],p['info']['height']
rasters=[Image.new('L',(W,H),0) for _ in range(4)]; draws=[ImageDraw.Draw(i) for i in rasters]
for c in cells:
 poly=[(verts[v][0]/sw*W,verts[v][1]/sh*H) for v in c['v']]
 f=p['pack']['features'][c['f']]
 for d,value in zip(draws,[c['h'],c['biome'],255 if c['h']>=20 else 0,255 if c['h']<20 and isinstance(f,dict) and f['type']=='lake' else 0]): d.polygon(poly,fill=int(value))
raw,biome,mask,lake=[np.asarray(i).copy() for i in rasters]; land=mask>127; lake=lake>127
rng=np.random.default_rng(59812824)
def noise(sx,sy):
 a=rng.random((sy+1,sx+1),dtype=np.float32); a[:,-1]=a[:,0]
 return zoom(a,(H/(sy+1),W/(sx+1)),order=1,grid_mode=False)[:H,:W].astype('float32')
print('rasterized original geography',flush=True)
n0=noise(36,18);n1=noise(130,65);n2=noise(420,210);n3=noise(1100,550);n4=noise(2400,1200)
fine=n2*.48+n3*.32+n4*.20
height=gaussian_filter(raw.astype('float32'),10)
mount=np.clip((height-34)/43,0,1)
# Warped multi-scale ridges: the source height controls their location and strength.
ridges=(1-np.abs(n2*2-1))*.50+(1-np.abs(n3*2-1))*.30+(1-np.abs(n4*2-1))*.20
relief=np.clip((height-19)/81,0,1)**1.35
relief+=(ridges-.60)*.25*mount+(fine-.5)*.012
relief=np.where(land,np.maximum(relief,.003),0).astype('float32')
# Natural muted biomes; political state IDs never color the surface.
colors=np.array([[12,35,62],[165,141,103],[125,127,104],[108,116,75],[84,104, 60],[48,79,49],[41,70,46],[58,84,59],[51,76,63],[83,94,73],[136,143,129],[221,228,222],[55,90,66]],dtype='float32')
albedo=colors[np.minimum(biome,12)]
albedo=gaussian_filter(albedo,sigma=(18,18,0))
rock=np.empty_like(albedo);rock[:,:,0]=126+fine*24;rock[:,:,1]=122+fine*21;rock[:,:,2]=109+fine*23
rockmix=np.clip((height-42)/34,0,.86)
albedo*=1-rockmix[...,None];albedo+=rock*rockmix[...,None];del rock
snow=np.clip((height+(ridges-.6)*14-71)/12,0,1)*land
albedo=albedo*(1-snow[...,None])+np.array([225,231,225],dtype='float32')*snow[...,None]
# Relief shading is fine and restrained, with an independent normal map for lighting.
dy,dx=np.gradient(gaussian_filter(relief,.7));shade=np.clip(1+(-dx*.65-dy*.8)*34,.64,1.23)
albedo*=shade[...,None];albedo+=(fine-.5)[...,None]*24+(n4-.5)[...,None]*7
coast=distance_transform_edt(~land).astype('float32');shore=distance_transform_edt(land).astype('float32')
beach=np.exp(-shore/2.4)*land*(height<30)
albedo=albedo*(1-beach[...,None]*.55)+np.array([174,163,127],dtype='float32')*beach[...,None]*.55
sea=np.empty_like(albedo);shelf=np.exp(-coast/15)
for k,(base,shallows) in enumerate([(11,16),(36,45),(61,38)]):sea[:,:,k]=base+shelf*shallows+(n0-.5)*3
sea[lake]=np.array([25,65,72],dtype='float32')+(fine[lake]-.5)[:,None]*4
albedo=np.where(land[...,None],albedo,sea)
image=Image.fromarray(np.clip(albedo,0,255).astype('uint8'),'RGB');del albedo,sea;gc.collect()
rd=ImageDraw.Draw(image);riverpaths=[]
for r in p['pack']['rivers']:
 points=[byid[i]['p'] for i in r['cells'] if i in byid]
 if len(points)<3:continue
 coords=[(round(px/sw*W),round(py/sh*H)) for px,py in points]
 rd.line(coords,fill=(35, 70,80),width=2 if r['discharge']>700 else 1)
 if r['discharge']>150:riverpaths.append([[round(px/sw,6),round(py/sh,6)] for px,py in points])
image.save(OUT/'surface.jpg',quality=96,subsampling=0)
image.resize((1200,600)).save(OUT/'atlas-preview.jpg',quality=94)
Image.fromarray((np.clip(relief,0,1)*255).astype('uint8')).save(OUT/'elevation.png')
normal=np.stack([-dx*65,dy*65,np.ones_like(dx)],-1);normal/=np.linalg.norm(normal,axis=-1)[...,None]
Image.fromarray(np.clip((normal*.5+.5)*255,0,255).astype('uint8')).save(OUT/'surface-normal.jpg',quality=96,subsampling=0);del normal,dx,dy
Image.fromarray(np.where(land,219+n4*22,139+n4*10).astype('uint8')).save(OUT/'roughness.jpg',quality=94)
Image.fromarray(mask).save(OUT/'land-mask.png')
print('6K surface / relief / normals saved',flush=True)
# Narrow weather fronts and broken high cloud, never an opaque white blanket.
y,x=np.mgrid[:H,:W].astype('float32'); yy=y+(n1-.5)*240;xx=(x+(n0-.5)*380)%W
weather=map_coordinates(n1,[np.clip(yy,0,H-1),xx],order=1,mode='wrap')
body=weather*.62+n2*.24+n3*.10+n4*.04
alpha=np.clip((body-.63)*3.8,0,.66)
wisps=np.clip(1-np.abs(body-.595)*85,0,1)*.08
alpha=(alpha+wisps)*np.clip(np.cos((y/H-.5)*math.pi),.18,1)
rgba=np.full((H,W,4),247,dtype='uint8');rgba[:,:,3]=(alpha*235).astype('uint8')
Image.fromarray(rgba,'RGBA').resize((4096,2048),Image.Resampling.LANCZOS).save(OUT/'clouds.png')
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
meta={'source':str(source.relative_to(ROOT)),'sourceSize':[sw,sh],'textureSize':[W,H],'cells':len(cells),'projection':'lon=360*x-180; lat=90-180*y','coordinates':p['mapCoordinates'],'relief':'source-constrained procedural sub-cell ridges; no absolute height conversion or measured erosion','seed':59812824,'borders':len(borders),'rivers':len(riverpaths),'revision':2}
(OUT/'provenance.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2));print('textures complete',flush=True)
