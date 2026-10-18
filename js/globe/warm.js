// 着色器预热：首帧前用 compileAsync 让驱动在后台把程序编好。
// 不预热时，第一次 render 会在主线程上同步等每个着色器编译完（Windows 上尤其慢），整页像卡死一样。
// three 按参数缓存程序，所以这里用「同参数」的材质编一遍，真实渲染时直接复用。
import * as T from 'three';

const SHADOW_SIDE = { [T.FrontSide]: T.BackSide, [T.BackSide]: T.FrontSide, [T.DoubleSide]: T.DoubleSide };
const TONE = { [T.LinearToneMapping]: 'LINEAR', [T.ReinhardToneMapping]: 'REINHARD', [T.CineonToneMapping]: 'CINEON', [T.ACESFilmicToneMapping]: 'ACES_FILMIC', [T.AgXToneMapping]: 'AGX', [T.NeutralToneMapping]: 'NEUTRAL' };
const first = m => (Array.isArray(m) ? m[0] : m);

// OutputPass 在第一次 render 时才按渲染器设置写 defines；先替它写好，免得预热的程序作废
function primeOutput(renderer, p) {
  if (p._outputColorSpace === renderer.outputColorSpace && p._toneMapping === renderer.toneMapping) return;
  p._outputColorSpace = renderer.outputColorSpace; p._toneMapping = renderer.toneMapping;
  p.material.defines = {};
  if (T.ColorManagement.getTransfer(p._outputColorSpace) === T.SRGBTransfer) p.material.defines.SRGB_TRANSFER = '';
  if (TONE[p._toneMapping]) p.material.defines[TONE[p._toneMapping] + '_TONE_MAPPING'] = '';
  p.material.needsUpdate = true;
}

// 返回一个 dispose：临时深度材质要留到真实阴影渲染接手程序之后再释放
export async function warmUp(renderer, scene, camera, composer, { budget = 20000 } = {}) {
  const prevRT = renderer.getRenderTarget(), jobs = [], temps = [];
  const compile = (s, c) => jobs.push(renderer.compileAsync(s, c));
  renderer.setRenderTarget(composer.readBuffer);
  try {
    compile(scene, camera);
    // 阴影深度与 GTAO 法线：把网格临时换成对应材质编一遍
    const meshes = [];
    scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    const swap = (list, pick) => {
      if (!list.length) return;
      const keep = list.map(o => o.material);
      list.forEach(o => { o.material = pick(o); });
      compile(scene, camera);
      list.forEach((o, i) => { o.material = keep[i]; });
    };
    if (renderer.shadowMap.enabled && renderer.shadowMap.type !== T.VSMShadowMap) {
      const depth = new Map();
      swap(meshes.filter(o => o.castShadow), o => {
        if (o.customDepthMaterial) return o.customDepthMaterial;
        const m = first(o.material), side = m.shadowSide ?? SHADOW_SIDE[m.side];
        const alpha = m.alphaTest > 0 && (m.map || m.alphaMap);
        const key = side + (alpha ? ':' + m.uuid : '');
        if (!depth.has(key)) {
          const d = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, side });
          if (alpha) Object.assign(d, { map: m.map, alphaMap: m.alphaMap, alphaTest: m.alphaTest });
          depth.set(key, d); temps.push(d);
        }
        return depth.get(key);
      });
    }
    const pm = new Set();
    for (const p of composer.passes) {
      if (!p.enabled) continue;
      if ('_toneMapping' in p && p.material) primeOutput(renderer, p);
      for (const k in p) {
        if (k === 'depthRenderMaterial' || (k === 'basic' && !p.renderToScreen)) continue;   // 只在调试或直出屏幕时才用
        const v = p[k];
        for (const m of Array.isArray(v) ? v : [v]) if (m && m.isMaterial) pm.add(m);
      }
    }
    for (const m of pm) if (m.isMeshNormalMaterial) { swap(meshes.filter(o => o.visible), () => m); pm.delete(m); }
    // 后期各通道的全屏材质
    const fs = new T.Scene(), geo = new T.PlaneGeometry(2, 2);
    for (const m of pm) { const q = new T.Mesh(geo, m); q.frustumCulled = false; fs.add(q); }
    compile(fs, new T.OrthographicCamera(-1, 1, 1, -1, 0, 1));
    geo.dispose();
  } finally {
    renderer.setRenderTarget(prevRT);
  }
  await Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, budget))]);
  return { dispose: () => temps.forEach(m => m.dispose()) };
}

// 离屏渲染（如 PMREM 烘环境图）前先把场景在后台编好；目标设成离屏，参数才和真正烘焙时一致
export async function warmOffscreen(renderer, scene, camera = new T.PerspectiveCamera()) {
  const prev = renderer.getRenderTarget(), tmp = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  let job;
  renderer.setRenderTarget(tmp);
  try { job = renderer.compileAsync(scene, camera); } finally { renderer.setRenderTarget(prev); }
  await job;
  tmp.dispose();
}
