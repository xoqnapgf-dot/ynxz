# -*- coding: utf-8 -*-
"""把站点打包成一个单文件 HTML（样式、数据、脚本全部内联），用于发布成 claude.ai 在线页面。

用法：python3 tools/build_artifact.py 输出路径.html
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main(out):
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    head = html[html.index("<head>") + 6:html.index("</head>")]
    body = html[html.index("<body>") + 6:html.index("</body>")]

    title = re.search(r"<title>.*?</title>", head).group(0)
    fonts = "\n".join(re.findall(r'<link rel="(?:preconnect|stylesheet)" href="https://fonts[^"]+"[^>]*>', head))
    css = (ROOT / "assets/css/site.css").read_text(encoding="utf-8")

    importmap = re.search(r'<script type="importmap">.*?</script>', head).group(0)
    classic = [f.split("?")[0] for f in re.findall(r'<script src="(assets/js/[^"]+)"></script>', body)]
    modules = [f.split("?")[0] for f in re.findall(r'<script type="module" src="(assets/js/[^"]+)"></script>', body)]
    body = re.sub(r'<script( type="module")? src="assets/js/[^"]+"></script>\n?', "", body)
    read = lambda f: (ROOT / f).read_text(encoding="utf-8").replace("</script", "<\\/script")
    js = "\n".join(read(f) for f in classic)
    mods = "\n".join(f'<script type="module">\n{read(f)}\n</script>' for f in modules)

    page = f"{title}\n{fonts}\n{importmap}\n<style>\n{css}\n</style>\n{body.strip()}\n<script>\n{js}\n</script>\n{mods}\n"
    Path(out).write_text(page, encoding="utf-8")
    print(f"{out}  {len(page.encode('utf-8')) / 1024:.0f} KB")


if __name__ == "__main__":
    main(sys.argv[1])
