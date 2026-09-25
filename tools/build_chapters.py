# -*- coding: utf-8 -*-
"""把小说原文切成章节，做校勘替换，输出 assets/js/chapters.js。

用法：python3 tools/build_chapters.py 原文.txt
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 一、确认是错别字：直接改正（原文 → 改为）
TYPOS = [
    ("奇艺", "奇异"),
    ("凭空行成", "凭空形成"),
    ("行成一道", "形成一道"),
    ("无法变改", "无法改变"),
    ("轨迹变改", "轨迹改变"),
    ("大的收货", "大的收获"),
    ("及其遥远", "极其遥远"),
    ("即是拥有", "即使拥有"),
    ("即是将来", "即使将来"),
    ("霎那", "刹那"),
    ("萤绿光光辉", "萤绿光辉"),
    ("拉开于神秘人", "拉开与神秘人"),
    ("身旁点文星", "身旁的文星"),
    ("对方是什么要与自己交友", "对方为什么要与自己交友"),
    ("来了这这么长时间", "来了这么长时间"),
    ("最信任都系统", "最信任的系统"),
    ("张开都血盆大口", "张开的血盆大口"),
    ("那种层次都存在", "那种层次的存在"),
    ("没没想到", "没想到"),
    ("就就像", "就像"),
    ("见再也挑战者", "见再无挑战者"),
    ("刚才了纷乱", "刚才的纷乱"),
    ("再此上路", "再次上路"),
    ("抱拳做辑", "抱拳作揖"),
    ("按耐不住", "按捺不住"),
    ("乘火打劫", "趁火打劫"),
    ("各路静脉", "各路经脉"),
    ("修养完的他", "休养完的他"),
    ("他修养的这段时间", "他休养的这段时间"),
    ("一起物归原主", "一并物归原主"),
    ("要借乱逃脱，", "要借乱逃脱。"),
    ("全体目光向我看齐", "全体目光向我看齐！"),
]

# 二、同一事物的不同写法：统一
UNIFY = [
    ("司空柯", "司空珂"),
    ("《归尘剑法》", "《绝尘剑法》"),
    ("龙族锻体术", "龙族炼体术"),
    ("引气决", "引气诀"),
]

# 原文缺标题的章节
MISSING_TITLES = {2: "师父文鸿"}

CN_NUM = "零一二三四五六七八九十"


def cn_to_int(s):
    if s == "十":
        return 10
    if s.startswith("十"):
        return 10 + CN_NUM.index(s[1])
    if "十" in s:
        a, b = s.split("十")
        return CN_NUM.index(a) * 10 + (CN_NUM.index(b) if b else 0)
    return CN_NUM.index(s)


def main(src):
    text = Path(src).read_text(encoding="utf-8").replace("\r", "")
    for a, b in TYPOS + UNIFY:
        text = text.replace(a, b)

    head = re.compile(r"^第([一二三四五六七八九十]+)章[ 　]*(.*)$", re.M)
    marks = list(head.finditer(text))
    chapters = []
    for i, m in enumerate(marks):
        n = cn_to_int(m.group(1))
        title = m.group(2).strip() or MISSING_TITLES.get(n, "")
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        body = text[m.end():end]
        paras = [p.strip().strip("　").strip() for p in body.split("\n")]
        paras = [p for p in paras if p]
        chapters.append({"n": n, "title": title, "paras": paras})

    out = ROOT / "assets" / "js" / "chapters.js"
    payload = json.dumps(chapters, ensure_ascii=False, separators=(",", ":"))
    out.write_text("window.WDGX_CHAPTERS=" + payload + ";\n", encoding="utf-8")
    chars = sum(len(p) for c in chapters for p in c["paras"])
    print(f"{len(chapters)} 章，约 {chars} 字 → {out}")


if __name__ == "__main__":
    main(sys.argv[1])
