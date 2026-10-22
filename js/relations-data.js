/* 人物关系
   只收人设正文里写明或直接可读出的关系；a / b 为角色 id。
   sure:true  实线：正文写明
   sure:false 虚线：正文能看出交集，但算不算「关系」、怎么称呼，待站主确认
   src 记出处，方便核对；不要为了连线好看而补关系（同国、同姓、同职业都不算） */
var RELATION_DATA = [
  /* 科鲁鲁王国 */
  { a: 'corporatism-margaret', b: 'corporatism-sofia', label: '同道 · 路数不同', sure: true,
    src: '玛格丽特·勃兰特：「玛格丽特和索菲亚信的是同一套法团秩序，路数却不一样。索菲亚劝人坐下来谈，她更习惯先在国家这台大机器里替每一种力量找好位置。」' },
  { a: 'authoritarianism-yekaterina', b: 'enlightened-absolutism-sophie', label: '前摄政 · 在位女王', sure: true,
    src: '叶卡捷琳娜：「科鲁鲁先王的遗孀，曾在王位交接期间摄政。新历536年索菲登基后，正式的统治权已交给在位女王」（两人不设母女关系）' },
  { a: 'corporatism-margaret', b: 'enlightened-absolutism-sophie', label: '法团院章程 · 驳回异议', sure: false,
    src: '玛格丽特·勃兰特替法团院拟章程；索菲：「法团院真递回了对法典第三条的异议……她重新签了一遍」。两人是否直接打过交道，正文未写。' },
  { a: 'utilitarianism-felicity', b: 'enlightened-absolutism-sophie', label: '法典编修 · 重编法典', sure: false,
    src: '费利西蒂是法典编修人，主张推倒重写；索菲的敕令之一是「编一部通行的法典」。是否为女王做事，正文未写。' },
  { a: 'three-principles-dongfangyue', b: 'enlightened-absolutism-sophie', label: '要共和 · 不满足于敕令改革', sure: false,
    src: '东方悦：「眼前的科鲁鲁却仍由女王发敕令……有人拿女王已经在改革来劝她满足，她仍要问，下一位统治者能不能把这些收回去。」属于政见上的对立，不是私人往来。' },

  /* 安那其学院 */
  { a: 'egoism-evita', b: 'anarchism-annaqi', label: '分工搭档', sure: true,
    src: '艾薇塔：「她和安娜琪分工：安娜琪替课程和自治会社牵线，她管账目、船期和对外往来。」' },
  { a: 'anarcho-capitalism-anzi', b: 'anarcho-communism-ankang', label: '同年 · 最在意 / 常争论', sure: true,
    src: '安资：「安资和安康同年生，比她小两个月，处处却像个姐姐……偏偏最在意那个什么都想分给别人的安康」；「安康更愿意把工坊共有，两人为此没少争」（不是双胞胎）' }
];
