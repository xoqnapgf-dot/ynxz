# 万道归墟 · 设定站

《万道归墟》设定集网站：作品档案、星源天体系与系统法则、人物志、破妄镜系统图鉴、功法法宝、世界层界缩放、境界天梯、三维时间树（终焉纪）、势力阵营、伏笔与回收、全书大纲、开篇 PV 和校勘记。

纯静态网页，不需要编译，手机和电脑都能看。

## 改内容

全站文字都在 `assets/js/data.js`：书名、档案、体系、人物、系统、法宝、境界、势力、伏笔、大纲、校勘记。条目里带 `bu: true` 的是网站补写的内容，用 `[[ ]]` 包起来的文字会显示成剧透遮罩。

## 文件

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构 |
| `assets/css/site.css` | 全部样式 |
| `assets/js/site.js` | 页面渲染、破妄镜、下坠与归墟动画 |
| `assets/js/ink.js` | 首屏水墨（p5.js + p5.brush） |
| `assets/js/world.js` | 世界层界缩放图 |
| `assets/js/tree3d.js` | 三维时间树（three.js） |
| `assets/js/pv.js` | 开篇 PV |
| `tools/build_artifact.py` | 打包成单文件 HTML |

## 发布

GitHub Pages 从 `main` 分支根目录发布，网址是 <https://xoqnapgf-dot.github.io/ynxz/>。代码合并进 `main` 后一两分钟自动更新。
