# 万道归墟 · 设定站

《万道归墟》的设定与剧情展示网站：首屏水墨、人物志、破妄镜系统图鉴、功法法宝、世界层界缩放、境界天梯、三维时间树（终焉纪）、全书大纲、开篇 PV，以及第一卷二十七章在线阅读和校勘记。

纯静态网页，不需要编译，手机和电脑都能看。

## 改内容

- 全站文字：`assets/js/data.js`（书名、人物、系统、法宝、境界、大纲、校勘记都在这里）
- 正文：`assets/js/chapters.js`，由原稿生成：

  ```
  python3 tools/build_chapters.py 原稿.txt
  ```

  错别字和统一写法的替换表在 `tools/build_chapters.py` 顶部。

## 文件

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构 |
| `assets/css/site.css` | 全部样式 |
| `assets/js/site.js` | 页面渲染、阅读器、破妄镜、下坠与归墟动画 |
| `assets/js/ink.js` | 首屏水墨（p5.js + p5.brush） |
| `assets/js/world.js` | 世界层界缩放图 |
| `assets/js/tree3d.js` | 三维时间树（three.js） |
| `assets/js/pv.js` | 开篇 PV |
| `tools/build_artifact.py` | 打包成单文件 HTML |

## 发布

GitHub Pages 从 `main` 分支根目录发布，网址是 <https://xoqnapgf-dot.github.io/ynxz/>。代码合并进 `main` 后一两分钟自动更新。
