/* 各地的纸：地点 → 纸的种类（样式在 css/papers.css 的 [data-paper]）。
   人物关系页的纸板和画廊地点志弹层共用；小地点沿 parent 找到所属国家 / 大地区，没列的用羊皮纸。 */
var PLACE_PAPER = {
  '科鲁鲁王国': 'vellum',       // 礼法古国：泛黄羊皮纸，红色双栏线
  '安那其学院': 'pulp',         // 岛上印刷所：再生粗纸，印刷栏线
  '伊鲁尼利亚共和国': 'chart',  // 两面临海的商贸共和国：海图纸
  '万知城': 'ledger',           // 书城：档案卡纸，横格与红边线
  '坎普共和国': 'kraft',        // 码头与矿区：牛皮纸
  '布图里亚': 'tide',           // 海峡王国：灰蓝布纹纸，浪纹水印
  '璇玑联邦': 'drafting',       // 研究院与精密工坊：制图纸
  '铁枢人民共和国': 'graph',    // 计划经济：方格表格纸
  '霁川公国': 'rice',           // 稻作水乡：长纤维白纸，淡墨晕
  '卡法里扬帝国': 'ash',        // 北方冻土与矿冶：冷灰厚纸，烟熏边
  '塞雷格帝国': 'decree',       // 自称古帝国继承者：诏书纸，双重框
  '帕尔哈南神权政治': 'scripture', // 抄经院：赭金经卷纸
  '裂缝彼端': 'rift',           // 彼方：暗紫异纸，一道裂光
  '翁吉亚共和国': 'ochre',      // 高地诸神：赭土纸，回纹边
  '契莱西亚保护国': 'bark',     // 山林雨林：树皮纸
  '奥嫩堡王国': 'charter',      // 封臣与城堡：特许状厚羊皮，蜡封
  '罗歇阿普公国': 'damp',       // 湿热海岸：受潮泛黄、霉斑
  '天神峰': 'snow',             // 雪峰：冷白纸，雪点
  '常灵群岛': 'mist',           // 雾岛：灰绿纸，雾带
  '卡斯奎尼亚王国': 'hemp',     // 草原与骑士：麻纸织纹
  '示安神权政治': 'washi'       // 社祠与潮汐：长纤维薄纸，朱印
  };
function placePaper(name) {
  var L = window.LOCATION_DATA || {}, A = window.LOCATION_ALIAS || {}, seen = {};
  name = L[name] ? name : (A[name] || name);
  while (name && !PLACE_PAPER[name] && L[name] && L[name].parent && !seen[name]) { seen[name] = 1; name = L[name].parent; }
  return PLACE_PAPER[name] || 'vellum';
}
