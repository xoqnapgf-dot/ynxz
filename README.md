# 万道归墟 · 设定站

《万道归墟》设定集网站：作品档案、星源天体系与系统法则、人物志、破妄镜系统图鉴、功法法宝、世界层界运镜、境界天梯量级圈、三维时间树（终焉纪）、势力星图、伏线弧图、境界攀升长卷与全书大纲，以及 three.js 实时渲染的开篇 PV。

纯静态网页，不需要编译，手机和电脑都能看。

## 改内容

全站文字都在 `assets/js/data.js`：书名、档案、体系、人物、系统、法宝、境界、势力、伏笔、大纲。用 `[[ ]]` 包起来的文字会显示成剧透遮罩。

## 文件

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构 |
| `assets/css/site.css` | 全部样式 |
| `assets/js/site.js` | 页面渲染、破妄镜、显现动画、下坠与归墟动画 |
| `assets/js/visuals.js` | 境界攀升长卷、伏线弧图、诸势星图、五境图、天罡阁剖面、法宝图标 |
| `assets/js/realms.js` | 境界天梯量级圈 |
| `assets/js/ink.js` | 首屏水墨（p5.js + p5.brush） |
| `assets/js/world.js` | 世界层界滚动运镜 |
| `assets/js/tree3d.js` | 终焉纪三维时间树（three.js + 泛光，滚动运镜） |
| `assets/js/pv3d.js` | 开篇 PV（three.js 九个分镜，WebAudio 合成音效） |
| `tools/build_artifact.py` | 打包成单文件 HTML |

## 发布

GitHub Pages 从 `main` 分支根目录发布，网址是 <https://xoqnapgf-dot.github.io/ynxz/>。代码合并进 `main` 后一两分钟自动更新。
