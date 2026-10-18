#!/usr/bin/env python3
"""地点场景图：按 prompts.json 调图片生成接口，压成网页用的 WebP 放进 素材/地点/。

  IMG_API_KEY=...  python3 tools/place-images/generate.py 汐见町 万知城   # 指定地点
  IMG_API_KEY=...  python3 tools/place-images/generate.py --all          # 全部（已存在的跳过）
  python3 tools/place-images/generate.py --dry-run --all                 # 只打印要发的请求

密钥只从环境变量读，不要写进任何文件。可选环境变量：
  IMG_API_BASE  默认 https://api.openai.com/v1（第三方中转填它的 /v1 地址）
  IMG_MODEL     默认 gpt-image-2.5-sunburst
已经生成过的地点默认跳过，避免重复扣费；要重画加 --force。原图另存在 --raw 目录（默认不进仓库）。
"""
import argparse, base64, io, json, os, ssl, sys, time, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '素材' / '地点'
CFG = json.loads((Path(__file__).with_name('prompts.json')).read_text('utf-8'))


def post(url, body, key):
    req = urllib.request.Request(url, json.dumps(body).encode(), {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key})
    ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or None)
    with urllib.request.urlopen(req, timeout=600, context=ctx) as r:
        return json.loads(r.read())


def fetch(url):
    ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or None)
    with urllib.request.urlopen(url, timeout=300, context=ctx) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('names', nargs='*')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--raw', default=os.environ.get('IMG_RAW_DIR', '/tmp/place-images-raw'))
    ap.add_argument('--width', type=int, default=1280)
    a = ap.parse_args()
    names = list(CFG['places']) if a.all else a.names
    bad = [n for n in names if n not in CFG['places']]
    if bad or not names:
        sys.exit('未知地点或未指定：' + ' '.join(bad))
    key = os.environ.get('IMG_API_KEY', '')
    if not key and not a.dry_run:
        sys.exit('缺少环境变量 IMG_API_KEY')
    base = os.environ.get('IMG_API_BASE', 'https://api.openai.com/v1').rstrip('/')
    model = os.environ.get('IMG_MODEL', 'gpt-image-2.5-sunburst')
    OUT.mkdir(parents=True, exist_ok=True); Path(a.raw).mkdir(parents=True, exist_ok=True)
    for n in names:
        dst = OUT / (n + '.webp')
        if dst.exists() and not a.force:
            print('跳过（已存在）', n); continue
        body = {'model': model, 'prompt': CFG['style'] + '\n\nScene: ' + CFG['places'][n], 'size': CFG['size'], 'quality': CFG['quality'], 'n': 1}
        if a.dry_run:
            print(json.dumps(body, ensure_ascii=False)[:300], '…'); continue
        t0 = time.time()
        try:
            res = post(base + '/images/generations', body, key)
        except urllib.error.HTTPError as e:
            print('失败', n, e.code, e.read()[:500].decode('utf-8', 'replace')); continue
        d = (res.get('data') or [{}])[0]
        raw = base64.b64decode(d['b64_json']) if d.get('b64_json') else fetch(d['url']) if d.get('url') else None
        if not raw:
            print('返回里没有图片', n, json.dumps(res)[:400]); continue
        (Path(a.raw) / (n + '.png')).write_bytes(raw)
        im = Image.open(io.BytesIO(raw)).convert('RGB')
        if im.width > a.width:
            im = im.resize((a.width, round(im.height * a.width / im.width)), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=80, method=6)
        print('完成', n, f'{time.time() - t0:.0f}s', im.size, f'{dst.stat().st_size // 1024}KB', 'usage', json.dumps(res.get('usage', {}))[:200])


if __name__ == '__main__':
    main()
