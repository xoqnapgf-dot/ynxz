# -*- coding: utf-8 -*-
"""给 index.html 里引用的样式和脚本加上版本号，发布新版时强制浏览器重新下载。

用法：python3 tools/stamp.py
"""
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
p = ROOT / "index.html"
v = time.strftime("%Y%m%d%H%M")
s = re.sub(r'(assets/(?:css|js)/[\w.-]+\.(?:css|js))(\?v=\w+)?', r'\1?v=' + v, p.read_text(encoding="utf-8"))
p.write_text(s, encoding="utf-8")
print("版本号", v)
