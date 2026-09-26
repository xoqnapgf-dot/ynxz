# -*- coding: utf-8 -*-
"""生成可直接上传到任意静态托管的离线版网站，并打成 zip。

- 3D 引擎（three.js 及用到的后期模块）、p5.js、p5.brush 全部下载到 vendor/
- 字体按全站实际用到的字裁剪成 woff2，放进 fonts/，不再依赖 Google Fonts
- zip 解压后根目录就是 index.html

用法：python3 tools/build_static.py 输出目录 [zip路径]
依赖：pip install fonttools brotli
"""
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THREE = "https://cdn.jsdelivr.net/npm/three@0.160.0"
LIBS = {
    "vendor/p5.min.js": "https://cdn.jsdelivr.net/npm/p5@2.2.3/lib/p5.min.js",
    "vendor/p5.brush.js": "https://cdn.jsdelivr.net/npm/p5.brush@2.2.3/dist/p5.brush.js",
}
THREE_ADDONS = [
    "postprocessing/EffectComposer.js", "postprocessing/RenderPass.js",
    "postprocessing/UnrealBloomPass.js", "postprocessing/OutputPass.js",
    "utils/BufferGeometryUtils.js",
]
FONTS = [
    # (家族名, 文件名, 来源, 字重范围)
    ("Zhi Mang Xing", "zhimangxing.woff2", "https://raw.githubusercontent.com/google/fonts/main/ofl/zhimangxing/ZhiMangXing-Regular.ttf", "400"),
    ("Noto Serif SC", "notoserifsc.woff2", "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf", "200 900"),
    ("Noto Sans SC", "notosanssc.woff2", "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf", "100 900"),
]
CACHE = Path("/tmp/wdgx-build-cache")


def fetch(url, dest):
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / re.sub(r"[^\w.-]", "_", url)
    if not cached.exists() or cached.stat().st_size == 0:
        subprocess.run(["curl", "-sSfL", "--retry", "4", "-o", str(cached), url], check=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(cached, dest)


def vendor_three(out):
    """下载 three.module.js 和所需模块，顺着相对 import 把依赖一起拉下来。"""
    fetch(f"{THREE}/build/three.module.js", out / "vendor/three/three.module.js")
    todo, seen = list(THREE_ADDONS), set()
    while todo:
        rel = todo.pop()
        if rel in seen:
            continue
        seen.add(rel)
        dest = out / "vendor/three/addons" / rel
        fetch(f"{THREE}/examples/jsm/{rel}", dest)
        for spec in re.findall(r"""from\s+['"](\.{1,2}/[^'"]+)['"]""", dest.read_text(encoding="utf-8")):
            todo.append(_norm(Path(rel).parent, spec))
    return len(seen)


def _norm(base, spec):
    parts = list(base.parts)
    for p in spec.split("/"):
        if p == "..":
            parts.pop()
        elif p != ".":
            parts.append(p)
    return "/".join(parts)


def used_chars(out):
    text = ""
    for f in [out / "index.html", *sorted((out / "assets").rglob("*.js")), *sorted((out / "assets").rglob("*.css"))]:
        text += f.read_text(encoding="utf-8")
    chars = {c for c in text if ord(c) > 0x7F}
    chars |= {chr(c) for c in range(0x20, 0x7F)}
    chars |= set("　，。、；：？！“”‘’（）《》【】「」…—·～")
    return "".join(sorted(chars))


def subset_fonts(out, chars):
    fdir = out / "fonts"
    fdir.mkdir(parents=True, exist_ok=True)
    (CACHE / "chars.txt").write_text(chars, encoding="utf-8")
    css = []
    for family, name, url, weight in FONTS:
        src = CACHE / (name + ".ttf")
        if not src.exists():
            subprocess.run(["curl", "-sSfL", "--retry", "4", "-o", str(src), url], check=True)
        subprocess.run([sys.executable, "-m", "fontTools.subset", str(src),
                        f"--text-file={CACHE / 'chars.txt'}", "--flavor=woff2",
                        "--layout-features=*", f"--output-file={fdir / name}"], check=True)
        css.append(f'@font-face {{ font-family: "{family}"; src: url("../../fonts/{name}") format("woff2"); '
                   f"font-weight: {weight}; font-style: normal; font-display: swap; }}")
    return "\n".join(css) + "\n"


def main(dist, zip_path=None):
    out = Path(dist)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    shutil.copy(ROOT / "index.html", out / "index.html")
    shutil.copytree(ROOT / "assets", out / "assets")
    (out / ".nojekyll").write_text("")

    for rel, url in LIBS.items():
        fetch(url, out / rel)
    n = vendor_three(out)

    # 改写引用
    html = (out / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'<link rel="preconnect" href="https://fonts[^"]+"[^>]*>\n?', "", html)
    html = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^"]+">\n?', "", html)
    html = html.replace(f"{THREE}/build/three.module.js", "./vendor/three/three.module.js")
    html = html.replace(f"{THREE}/examples/jsm/", "./vendor/three/addons/")
    (out / "index.html").write_text(html, encoding="utf-8")
    ink = out / "assets/js/ink.js"
    s = ink.read_text(encoding="utf-8")
    for rel, url in LIBS.items():
        s = s.replace(url, rel)
    ink.write_text(s, encoding="utf-8")

    chars = used_chars(out)
    face = subset_fonts(out, chars)
    css = out / "assets/css/site.css"
    css.write_text(face + css.read_text(encoding="utf-8"), encoding="utf-8")

    leftover = [str(p.relative_to(out)) for p in out.rglob("*.*") if p.suffix in (".html", ".js", ".css")
                and re.search(r"https://(cdn\.jsdelivr|fonts\.g)", p.read_text(encoding="utf-8")) and "vendor" not in p.parts]
    size = sum(p.stat().st_size for p in out.rglob("*") if p.is_file())
    print(f"three 模块 {n + 1} 个，字符 {len(chars)} 个，总大小 {size / 1024:.0f} KB")
    if leftover:
        print("仍有外部引用：", leftover)

    if zip_path:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for p in sorted(out.rglob("*")):
                if p.is_file():
                    zf.write(p, p.relative_to(out).as_posix())
        print(f"已打包 {zip_path}  {Path(zip_path).stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main(*sys.argv[1:])
