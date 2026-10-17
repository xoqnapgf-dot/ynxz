// Rendering catalog only. It does not add or change official map coordinates.
// Secondary locations resolve their anchor through the existing parent chain.
export const SCENES = [
  {key:900,name:'安那其学院',en:'ANARCHIST ACADEMY',icon:'⌂',label:'环形山麓学园 · 圈 A 门徽',color:'#d8c087',scope:'landmark'},
  {key:901,name:'常灵群岛',en:'CHANGLING ISLES',icon:'✧',label:'群岛 · 横空世界裂隙',color:'#a4d7dd',scope:'landmark'},
  {key:902,name:'天神峰',en:'TIANSHEN PEAK',icon:'△',label:'高原孤峰 · 通天之柱',color:'#b8cfe2',scope:'landmark'},
  {key:9,name:'万知城',en:'WANZHI CITY',icon:'⊙',label:'中立城邦 · 万知之城',color:'#c7ba92',scope:'landmark'},
  {key:12,name:'铁枢人民共和国',en:'TIESHU / RAIL & STEEL',icon:'⌗',label:'铁路与重工业 · 局部场景',color:'#caac85',scope:'country'},
  {key:11,name:'璇玑联邦',en:'XUANJI / LAKE DISTRICT',icon:'◇',label:'内陆湖港与研究院 · 局部场景',color:'#b3d4d3',scope:'country'},
  {key:'falota',name:'法洛塔',en:'FALOTA / WORKING HARBOUR',icon:'⌂',label:'货栈、渔市与码头 · 坐标未定',color:'#d1b790',scope:'secondary'},
  {key:'shiomi',name:'汐见町',en:'SHIOMI / TIDAL TOWN',icon:'⌂',label:'商店街、渡口与小神社 · 坐标未定',color:'#c2d0ac',scope:'secondary'}
];
export const SCENE_BY_NAME = Object.fromEntries(SCENES.map(s=>[s.name,s]));
