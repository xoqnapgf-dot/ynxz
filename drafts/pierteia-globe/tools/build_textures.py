"""Draft 03: source-constrained terrain, not a new world map.
Run with Python + Pillow, NumPy, SciPy. Builds 6K surface maps; weather has its
own spherical builder. Original polygon land/lake masks and formal coordinates
are unchanged. Fine ridges/shading are artistic detail, not surveyed erosion.
"""
from pathlib import Path
import json, gc, hashlib
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, distance_transform_edt, zoom, map_coordinates
from scipy.interpolate import CloughTocher2DInterpolator

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parents[1]/'assets'
source=ROOT/'素材/地图/Pierteia Full 2026-09-19-01-11.json'
p=json.loads(source.read_text());W,H=6144,3072
cells=p['pack']['cells'];verts={v['i']:v['p'] for v in p['pack']['vertices']};byid={c['i']:c for c in cells}
sw,sh=p['info']['width'],p['info']['height']
rasters=[Image.new('L',(W,H),0) for _ in range(4)];draws=[ImageDraw.Draw(i) for i in rasters]
for c in cells:
 poly=[(verts[v][0]/sw*W,verts[v][1]/sh*H) for v in c['v']]
 f=p['pack']['features'][c['f']]
 for d,value in zip(draws,[c['h'],c['biome'],255 if c['h']>=20 else 0,255 if c['h']<20 and isinstance(f,dict) and f['type']=='lake' else 0]):d.polygon(poly,fill=int(value))
raw,biome,mask,lake=[np.asarray(i).copy() for i in rasters];land=mask>127;lake=lake>127
rng=np.random.default_rng(59812824)
def noise(sx,sy):
 a=rng.random((sy+1,sx+1),dtype=np.float32);a[:,-1]=a[:,0]
 return zoom(a,(H/(sy+1),W/(sx+1)),order=3,grid_mode=False)[:H,:W].astype('float32')
print('original coastline rasterized',flush=True)
# C1 interpolation connects the original highland cells rather than shading
# disconnected flat Voronoi plates. Clamp interpolation overshoot to source range.
y,x=np.mgrid[:1024,:2048].astype('float32')
interp=CloughTocher2DInterpolator(np.array([c['p'] for c in cells]),np.array([c['h'] for c in cells]),fill_value=19)
small=interp(x/2047*sw,y/1023*sh).astype('float32')
height=np.clip(zoom(small,3,order=1),0,100);del interp,small,x,y
n0=noise(28,14);n1=noise(95,48);n2=noise(280,140);n3=noise(720,360);n4=noise(1900,950)
mount=np.clip((height-33)/43,0,1)
# Correlated octaves make branching ridge/valley detail within the original ranges.
y,x=np.mgrid[:H,:W].astype('float32')
warp_x=(x+(n1-.5)*58)%W;warp_y=np.clip(y+(n0-.5)*55,0,H-1)
warped=map_coordinates(n2,[warp_y,warp_x],order=1,mode='wrap')
r0=1-np.abs(warped*2-1);r1=1-np.abs(n3*2-1);r2=1-np.abs(n4*2-1)
ridge=r0*.58+r1*r0*.29+r2*r1*.13
relief=np.clip((height-19)/81,0,1)**1.3
relief+=(ridge-.62)*.12*mount+(n4-.5)*.003*land
relief=np.where(land,np.maximum(relief,.002),0).astype('float32')
# Keep the pole displacement single-valued. The color/land mask is not changed.
pole=np.sin(np.pi*y/H)**.45
relief*=pole
# Less saturated materials, not painted political colors. Source biome IDs are
# Azgaar's existing biome classes; these colors do not rewrite the gazetteer.
colors=np.array([[10,31,62],[188,158,111],[152,141,116],[150,139,94],[137,132,94],[76,94,64],[84,98, 70],[44,73,55],[62,85, 71],[88,101,83],[136,140,122],[220,227,225],[76,97,77]],dtype='float32')
albedo=gaussian_filter(colors[np.minimum(biome,12)],sigma=(12,12,0))
# Broad variations are quiet, subordinate to biome and elevation.
albedo+=(n0-.5)[...,None]*np.array([15,12,8],dtype='float32')
rockmix=np.clip((height-39)/43,0,.88)
rock=np.stack([147+n2*15,139+n2*12,121+n2*13],-1)
albedo=albedo*(1-rockmix[...,None])+rock*rockmix[...,None];del rock
snow=np.clip((height+(ridge-.6)*9- 75)/15,0,1)*land
albedo=albedo*(1-snow[...,None])+np.array([224,231,228],dtype='float32')*snow[...,None]
# Subdued relief shading helps source ranges read from orbit without making
# all plains look like coarse crumpled noise. Independent normal map lights it.
dy,dx=np.gradient(gaussian_filter(relief,.9))
shade=np.clip(1+(-dx*.8-dy*.6)*65*(.18+mount*.82),.65,1.18)
albedo*=shade[...,None];albedo+=(n4-.5)[...,None]*5
coast=distance_transform_edt(~land).astype('float32');shore=distance_transform_edt(land).astype('float32')
beach=np.exp(-shore/1.8)*land*(height<29)
albedo=albedo*(1-beach[...,None]*.38)+np.array([169,157,126],dtype='float32')*beach[...,None]*.38
sea=np.empty_like(albedo)
# The depth signal comes from original water-cell height, with an artistic,
# variable shelf falloff. It is not newly measured bathymetry.
shelf=np.exp(-coast/(6+n0*9));depth=np.clip((19-gaussian_filter(np.where(land,19,raw).astype('float32'),45))/19,0,1)
for k,(base,shallow) in enumerate([(12,14),(38,40),( 74,27)]):sea[:,:,k]=base+shelf*shallow+(1-depth)*([1,4,7][k])
sea[lake]=np.array([32,66, 77],dtype='float32')
albedo=np.where(land[...,None],albedo,sea)
image=Image.fromarray(np.clip(albedo,0,255).astype('uint8'),'RGB');del albedo,sea;gc.collect()
rd=ImageDraw.Draw(image);riverpaths=[]
for r in p['pack']['rivers']:
 points=[byid[i]['p'] for i in r['cells'] if i in byid]
 if len(points)<3:continue
 coords=[(round(px/sw*W),round(py/sh*H)) for px,py in points]
 rd.line(coords,fill=(43, 67, 75),width=2 if r['discharge']>700 else 1)
 if r['discharge']>150:riverpaths.append([[round(px/sw,6),round(py/sh,6)] for px,py in points])
image.save(OUT/'surface.jpg',quality=96,subsampling=0)
image.resize((1200,600)).save(OUT/'atlas-preview.jpg',quality=94)
Image.fromarray((np.clip(relief,0,1)*255).astype('uint8')).save(OUT/'elevation.png')
normal=np.stack([-dx*85*(.20+mount*.80),dy*85*(.20+mount*.80),np.ones_like(dx)],-1);normal/=np.linalg.norm(normal,axis=-1)[...,None]
Image.fromarray(np.clip((normal*.5+.5)*255,0,255).astype('uint8')).save(OUT/'surface-normal.jpg',quality=96,subsampling=0)
Image.fromarray(np.where(land,225+n4*20,165+n4*5).astype('uint8')).save(OUT/'roughness.jpg',quality=94)
Image.fromarray(mask).save(OUT/'land-mask.png')
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
meta={'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceSize':[sw,sh],'textureSize':[W,H],'cells':len(cells),'projection':'lon=360*x-180; lat=90-180*y','coordinates':p['mapCoordinates'],'relief':'C1 interpolation of source elevation; constrained artistic ridge detail, not measured erosion','landMaskSha256':hashlib.sha256((OUT/'land-mask.png').read_bytes()).hexdigest(),'seed':59812824,'borders':len(borders),'rivers':len(riverpaths),'revision':3}
(OUT/'provenance.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
print('source-aligned surface, continuous highlands and normals complete',flush=True)
