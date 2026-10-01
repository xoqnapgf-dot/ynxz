/* ============================================================
   画廊 · 意识形态 ⇄ 角色
   - 分类「意识形态」：首字母索引陈列意识形态，点进去 → 内部角色页
   - 分类「角色」：陈列全部角色，点进去 → 角色相册
   - 面包屑：意识形态页可返回画廊，角色页可返回所属意识形态
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var state = { cat: 'ideology' };

  var DATA = (typeof GALLERY_DATA !== 'undefined') ? GALLERY_DATA : [];

  /* 角色扁平列表（附所属意识形态引用） */
  function allCharacters() {
    var out = [];
    DATA.forEach(function (ideo) {
      (ideo.characters || []).forEach(function (c) {
        out.push({ ch: c, ideo: ideo });
      });
    });
    return out;
  }

  function findIdeology(id) {
    for (var i = 0; i < DATA.length; i++) if (DATA[i].id === id) return DATA[i];
    return null;
  }
  function findCharacter(id) {
    var list = allCharacters();
    for (var i = 0; i < list.length; i++) if (list[i].ch.id === id) return list[i];
    return null;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 图片字段兼容两种写法：'路径' 或 {thumb, full}
     - 索引卡缩略图 → thumb（省流量）
     - 详情页大图 → full（原图，长按保存/新窗口拿到的就是它）
     - 只写一个路径时浏览和详情都用它 */
  function imgThumb(im) { return typeof im === 'string' ? im : (im ? im.thumb : ''); }
  function imgFull(im)  { return typeof im === 'string' ? im : (im ? (im.full || im.thumb) : ''); }
  function hasFull(im)  { return typeof im !== 'string' && im && im.full && im.full !== im.thumb; }

  function ideoCover(ideo, withName) {
    if (ideo.cover) return ideo.cover;
    return designIdeologyCover(ideo, withName);   /* 意识形态专属：按主题自动设计封面 */
  }
  function chCover(pair) { return pair.ch.images && pair.ch.images.length ? imgThumb(pair.ch.images[0]) : ''; }

  /* ============================================================
     角色配色适配：让边框 / 辉光 / 铭牌跟着角色自己的色调走
     ------------------------------------------------------------
     配色唯一来源 = 数据里手写的 theme.accent / accent2（以立绘为准，
     看图定色：主色看画面面积占比，别把点缀当主色）。
     历史上曾有「运行时像素取色兜底」(extractTheme)，因采样过粗、
     分不清主色/点缀、取色死板而于 v65 移除；缺色时补数据，不补算法。
     ============================================================ */


  /* 页面用主色：数据里的主色按立绘手调，偏暗的（深红/深蓝/深紫）直接当文字会看不清，
     这里只向白色提亮到对比度 ≥ 4.5，色相不变；封面与数据本身不受影响 */
  function relLum(hex) {
    var c = hexRgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function readableAccent(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return hex;
    var bg = relLum('#0a0a0e');
    for (var t = 0; t <= 0.6; t += 0.04) {
      var c = t ? mixHex(hex, '#ffffff', t) : hex;
      if ((relLum(c) + 0.05) / (bg + 0.05) >= 4.5) return c;
    }
    return mixHex(hex, '#ffffff', 0.6);
  }
  /* 日间模式：向深褐提暗到对比度 ≥ 4.5（底 #f5f0e6），色相不变 */
  function readableOnLight(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return hex;
    var bg = relLum('#f5f0e6');
    for (var t = 0; t <= 0.78; t += 0.04) {
      var c = t ? mixHex(hex, '#1a1408', t) : hex;
      if ((bg + 0.05) / (relLum(c) + 0.05) >= 4.5) return c;
    }
    return mixHex(hex, '#1a1408', 0.78);
  }
  /* 主色同时写入夜间/日间两份，由 CSS（style.css 的 --ca 规则）按当前模式选用 */
  function setAcc(el, a1) {
    if (a1) { el.style.setProperty('--ca-d', readableAccent(a1)); el.style.setProperty('--ca-l', readableOnLight(a1)); }
    else { el.style.removeProperty('--ca-d'); el.style.removeProperty('--ca-l'); }
  }
  function themeColors(entry) {
    var th = (entry && entry.theme) || {};
    return {
      a1: th.accent || entry.accent || '',
      a2: th.accent2 || entry.accent2 || '',
      hi: th.hi || entry.hi || '',          /* 高光色：名字渐变亮部、装饰亮点 */
      frame: th.frame || entry.frame || '', /* 画框样式：gilt/iron/ink/glass/regal/organic */
      dust: th.dust || entry.dust || '',    /* 氛围粒子：gold/ember/snow/petal/leaf */
      motif: th.motif || entry.motif || ''
    };
  }

  /* 角色主题纹样（装饰层，纯 CSS/SVG，零依赖零请求） */
  var MOTIFS = {
    /* 麦穗：农业主义 */
    wheat: '<svg viewBox="0 0 120 260" xmlns="http://www.w3.org/2000/svg">' +
      '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
      '<path d="M60 250 C 58 190 62 130 60 60" />' +
      (function () {
        var s = '';
        for (var y = 60; y <= 210; y += 18) {
          s += '<path d="M60 ' + y + ' C 48 ' + (y - 4) + ' 42 ' + (y - 14) + ' 44 ' + (y - 26) + '"/>';
          s += '<path d="M60 ' + y + ' C 72 ' + (y - 4) + ' 78 ' + (y - 14) + ' 76 ' + (y - 26) + '"/>';
        }
        return s;
      })() +
      '<path d="M60 60 C 56 44 56 32 60 20 C 64 32 64 44 60 60 Z" fill="currentColor" stroke="none"/>' +
      '</g></svg>',
    gear: '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
      '<g fill="none" stroke="currentColor" stroke-width="5">' +
      '<circle cx="100" cy="100" r="58"/><circle cx="100" cy="100" r="22"/>' +
      (function () {
        var s = '';
        for (var i = 0; i < 10; i++) {
          var a = i * 36 * Math.PI / 180;
          s += '<line x1="' + (100 + Math.cos(a) * 58).toFixed(1) + '" y1="' + (100 + Math.sin(a) * 58).toFixed(1) +
               '" x2="' + (100 + Math.cos(a) * 82).toFixed(1) + '" y2="' + (100 + Math.sin(a) * 82).toFixed(1) + '"/>';
        }
        return s;
      })() +
      '</g></svg>',
    star: '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M100 12 L118 78 L188 78 L131 119 L152 188 L100 146 L48 188 L69 119 L12 78 L82 78 Z" fill="currentColor"/></svg>',
    scales: '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
      '<g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">' +
      '<line x1="100" y1="24" x2="100" y2="176"/><line x1="34" y1="52" x2="166" y2="52"/>' +
      '<path d="M34 52 L14 108 A 26 26 0 0 0 54 108 Z"/><path d="M166 52 L146 108 A 26 26 0 0 0 186 108 Z"/>' +
      '<circle cx="100" cy="24" r="8"/></g></svg>',
    /* 八向罗盘玫瑰：冒险主义 */
    compass: '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
      '<g fill="none" stroke="currentColor" stroke-width="4">' +
      '<circle cx="100" cy="100" r="88"/><circle cx="100" cy="100" r="72"/>' +
      (function () {
        var s = '';
        for (var i = 0; i < 8; i++) {
          var a = i * 45 * Math.PI / 180;
          var r1 = i % 2 === 0 ? 0 : 30;
          s += '<line x1="' + (100 + Math.cos(a) * r1).toFixed(1) + '" y1="' + (100 + Math.sin(a) * r1).toFixed(1) +
               '" x2="' + (100 + Math.cos(a) * 78).toFixed(1) + '" y2="' + (100 + Math.sin(a) * 78).toFixed(1) + '"/>';
        }
        return s;
      })() +
      '</g>' +
      '<path d="M100 30 L112 88 L100 78 L88 88 Z" fill="currentColor"/>' +
      '<path d="M100 170 L112 112 L100 122 L88 112 Z" fill="currentColor" opacity="0.55"/>' +
      '<circle cx="100" cy="100" r="7" fill="currentColor"/></svg>'
  };

  /* 给详情整页铺主题：变量 + 背景氛围 + 纹样 */
  function paintStage(entry, cover) {
    var pg = $('#galDetailPage');
    var t = themeColors(entry, cover);
    setAcc(pg, t.a1);
    if (t.a2) pg.style.setProperty('--ca2', t.a2); else pg.style.removeProperty('--ca2');
    if (t.hi) pg.style.setProperty('--ch', t.hi); else pg.style.removeProperty('--ch');
    pg.className = pg.className.replace(/\b(fr|dust)-\w+/g, '').replace(/\s+/g, ' ').trim();
    if (t.frame) pg.classList.add('fr-' + t.frame);
    if (t.dust) pg.classList.add('dust-' + t.dust);
    /* 返回键浮在详情页外，主题色单独同步 */
    var back = $('#detailBack');
    if (back) {
      setAcc(back, t.a1);
      if (t.a2) back.style.setProperty('--ca2', t.a2); else back.style.removeProperty('--ca2');
    }
    var bg = $('.stage-tint', pg);
    if (!bg) {
      bg = document.createElement('div');
      bg.className = 'stage-tint';
      bg.setAttribute('aria-hidden', 'true');
      pg.insertBefore(bg, pg.firstChild);
    }
    bg.style.backgroundImage = cover ? 'url("' + cover + '")' : 'none';
    /* 纹样层 */
    var mf = $('.stage-motif', pg);
    if (!mf) {
      mf = document.createElement('div');
      mf.className = 'stage-motif';
      mf.setAttribute('aria-hidden', 'true');
      pg.insertBefore(mf, pg.firstChild);
    }
    if (t.motif) {
      /* 水印直接复用海报纹样 motifDeco（带 viewBox 保证比例），与封面图标完全一致 */
      var mInner = motifDeco(t.motif, 'currentColor');
      mf.innerHTML = '<svg class="motif-svg" viewBox="0 0 400 512">' + mInner + '</svg>' +
                     '<svg class="motif-svg flip" viewBox="0 0 400 512">' + mInner + '</svg>';
      mf.style.display = '';
    } else { mf.innerHTML = ''; mf.style.display = 'none'; }
    /* 光尘粒子 */
    if (!$('.stage-dust', pg)) {
      var dust = document.createElement('div');
      dust.className = 'stage-dust';
      dust.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 14; i++) {
        var p = document.createElement('i');
        p.style.setProperty('--dx', (Math.random() * 2 - 1).toFixed(2));
        p.style.setProperty('--drift', (14 + Math.random() * 22).toFixed(0) + 's');
        p.style.setProperty('--delay', (-Math.random() * 30).toFixed(1) + 's');
        p.style.setProperty('--size', (2 + Math.random() * 3.5).toFixed(1) + 'px');
        p.style.left = (4 + Math.random() * 92).toFixed(1) + '%';
        dust.appendChild(p);
      }
      pg.insertBefore(dust, pg.firstChild);
    }
  }

  /* 卡片主题合并：角色没写就继承所属意识形态的 */
  function mergedTheme(ch, ideo) {
    var a = (ch && ch.theme) || {}, b = (ideo && ideo.theme) || {};
    return {
      theme: {
        accent: a.accent || b.accent || '',
        accent2: a.accent2 || b.accent2 || '',
        hi: a.hi || b.hi || '',
        frame: a.frame || b.frame || '',
        dust: a.dust || b.dust || '',
        motif: a.motif || b.motif || ''
      },
      accent: a.accent || b.accent || '',
      accent2: a.accent2 || b.accent2 || '',
      motif: a.motif || b.motif || ''
    };
  }
  /* ============ 意识形态封面：按主题自动设计（2:3 海报） ============ */
  function hexRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return [216, 178, 90];
    var v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function mixHex(c1, c2, t) {
    var a = hexRgb(c1), b = hexRgb(c2);
    function p(i) { var n = Math.round(a[i] + (b[i] - a[i]) * t).toString(16); return n.length < 2 ? '0' + n : n; }
    return '#' + p(0) + p(1) + p(2);
  }

  /* 纹样徽标：每个 motif 一套构图 */
  function motifDeco(motif, col) {
    var g = '', i, a, r1, r2;
    var C = 200, CY = 256;
    if (motif === 'compass') {
      for (i = 0; i < 72; i++) {
        a = i * 5 * Math.PI / 180;
        r1 = 72; r2 = (i % 6 === 0) ? 58 : 66;
        g += '<line x1="' + (Math.cos(a) * r1).toFixed(1) + '" y1="' + (Math.sin(a) * r1).toFixed(1) +
             '" x2="' + (Math.cos(a) * r2).toFixed(1) + '" y2="' + (Math.sin(a) * r2).toFixed(1) +
             '" stroke-width="' + (i % 6 === 0 ? 2 : 1) + '" opacity="' + (i % 6 === 0 ? 0.75 : 0.35) + '"/>';
      }
      g += '<circle r="84" stroke-width="2" opacity="0.6"/>' +
           '<circle r="97" stroke-width="1" opacity="0.22"/>' +
           '<path d="M0,-72 L13,-8 L0,8 L-13,-8 Z" fill="' + col + '" stroke="none"/>' +
           '<path d="M0,72 L13,8 L0,-8 L-13,8 Z" fill="' + col + '" stroke="none" opacity="0.32"/>' +
           '<path d="M-60,0 L-8,-11 L8,0 L-8,11 Z" fill="' + col + '" stroke="none" opacity="0.2"/>' +
           '<path d="M60,0 L8,-11 L-8,0 L8,11 Z" fill="' + col + '" stroke="none" opacity="0.2"/>' +
           '<circle r="5" fill="' + col + '" stroke="none"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'wheat') {
      g += '<path d="M' + C + ' 342 C ' + (C - 5) + ' 302 ' + (C + 6) + ' 248 ' + C + ' ' + (CY - 66) + '" stroke-width="3" opacity="0.85"/>';
      for (i = 0; i < 8; i++) {
        var y = CY - 48 + i * 17;
        var w = 26 - i * 1.4;
        g += '<path d="M' + C + ' ' + (y + 16) + ' C ' + (C - w) + ' ' + (y + 8) + ' ' + (C - w - 2) + ' ' + (y - 6) + ' ' + C + ' ' + (y - 14) + ' Z" opacity="0.8"/>' +
             '<path d="M' + C + ' ' + (y + 16) + ' C ' + (C + w) + ' ' + (y + 8) + ' ' + (C + w + 2) + ' ' + (y - 6) + ' ' + C + ' ' + (y - 14) + ' Z" opacity="0.8"/>';
      }
      for (i = 0; i < 5; i++) {
        var ax = C - 26 + i * 13, ay = CY - 74 + Math.abs(i - 2) * 4;
        g += '<line x1="' + C + '" y1="' + (CY - 66) + '" x2="' + ax + '" y2="' + (ay - 40) + '" stroke-width="1.6" opacity="0.5"/>';
      }
      return '<g stroke="' + col + '" fill="' + col + '" fill-opacity="0.16" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'gear') {
      for (i = 0; i < 10; i++) {
        a = i * 36 * Math.PI / 180;
        var da = 9 * Math.PI / 180;
        g += '<path d="M' + (Math.cos(a - da) * 80).toFixed(1) + ' ' + (Math.sin(a - da) * 80).toFixed(1) +
             ' L' + (Math.cos(a - da * 0.55) * 100).toFixed(1) + ' ' + (Math.sin(a - da * 0.55) * 100).toFixed(1) +
             ' L' + (Math.cos(a + da * 0.55) * 100).toFixed(1) + ' ' + (Math.sin(a + da * 0.55) * 100).toFixed(1) +
             ' L' + (Math.cos(a + da) * 80).toFixed(1) + ' ' + (Math.sin(a + da) * 80).toFixed(1) + ' Z" fill="' + col + '" stroke="none" opacity="0.7"/>';
      }
      g += '<circle r="78" stroke-width="3" opacity="0.8"/><circle r="30" stroke-width="3" opacity="0.8"/>';
      for (i = 0; i < 6; i++) {
        a = i * 60 * Math.PI / 180;
        g += '<line x1="' + (Math.cos(a) * 34).toFixed(1) + '" y1="' + (Math.sin(a) * 34).toFixed(1) +
             '" x2="' + (Math.cos(a) * 74).toFixed(1) + '" y2="' + (Math.sin(a) * 74).toFixed(1) + '" stroke-width="6" opacity="0.55"/>';
      }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'scales') {   /* 天平：平等 */
      g += '<line x1="0" y1="-88" x2="0" y2="52" stroke-width="2.5" opacity="0.85"/>' +
           '<line x1="-74" y1="-62" x2="74" y2="-62" stroke-width="2.5" opacity="0.85"/>' +
           '<circle cy="-88" r="6" fill="' + col + '" stroke="none"/>' +
           '<line x1="-96" y1="30" x2="96" y2="30" stroke-width="2" opacity="0.4"/>';
      for (i = -1; i <= 1; i += 2) {
        var px = i * 74;
        g += '<line x1="' + px + '" y1="-62" x2="' + (px - i * 34) + '" y2="6" stroke-width="1.6" opacity="0.7"/>' +
             '<line x1="' + px + '" y1="-62" x2="' + (px + i * 34) + '" y2="6" stroke-width="1.6" opacity="0.7"/>' +
             '<path d="M' + (px - i * 34) + ' 6 A 34 34 0 0 ' + (i > 0 ? 0 : 1) + ' ' + (px + i * 34) + ' 6" stroke-width="2" opacity="0.75"/>' +
             '<path d="M' + px + ' 52 l -12 14 h 24 Z" fill="' + col + '" stroke="none" opacity="0.8"/>';
      }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'star') {     /* 星芒：例外/卓越 */
      var spikes = 8;
      for (i = 0; i < spikes * 2; i++) {
        var long_ = i % 2 === 0;
        a = i * Math.PI / spikes - Math.PI / 2;
        var rr = long_ ? 92 : 40;
        g += '<line x1="0" y1="0" x2="' + (Math.cos(a) * rr).toFixed(1) + '" y2="' + (Math.sin(a) * rr).toFixed(1) +
             '" stroke-width="' + (long_ ? 2.2 : 1) + '" opacity="' + (long_ ? 0.8 : 0.35) + '"/>';
      }
      g += '<circle r="24" stroke-width="2" opacity="0.9" fill="' + col + '" fill-opacity="0.25"/>' +
           '<circle r="104" stroke-width="1" opacity="0.2"/>' +
           '<circle r="117" stroke-width="0.6" opacity="0.28" stroke-dasharray="2 9"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'leaf') {     /* 叶：环保/生长 */
      g += '<path d="M0 96 C -66 44 -58 -52 0 -96 C 58 -52 66 44 0 96 Z" stroke-width="2.4" opacity="0.85"/>' +
           '<line x1="0" y1="82" x2="0" y2="-84" stroke-width="1.6" opacity="0.7"/>';
      for (i = -3; i <= 3; i++) {
        if (!i) continue;
        var ly = i * 24;
        var lw = 52 - Math.abs(i) * 11;
        g += '<path d="M0 ' + ly + ' Q ' + lw + ' ' + (ly - 10) + ' ' + lw + ' ' + (ly - 26) + '" stroke-width="1.4" opacity="0.55"/>' +
             '<path d="M0 ' + ly + ' Q ' + -lw + ' ' + (ly - 10) + ' ' + -lw + ' ' + (ly - 26) + '" stroke-width="1.4" opacity="0.55"/>';
      }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'laurel') {   /* 桂冠：荣誉/精英 */
      for (i = -1; i <= 1; i += 2) {
        for (var k = 0; k < 9; k++) {
          a = (-72 + k * 17) * Math.PI / 180;
          var br = 86 - k * 2;
          var bx = Math.cos(a) * br * i, by = Math.sin(a) * br;
          var ta = a + i * 0.9;
          g += '<path d="M' + bx.toFixed(1) + ' ' + by.toFixed(1) +
               ' q ' + (Math.cos(ta) * 17 * -i).toFixed(1) + ' ' + (Math.sin(ta) * 17).toFixed(1) + ' ' +
               (Math.cos(a + i * 0.42) * 21 - bx).toFixed(1) + ' ' + (Math.sin(a + i * 0.42) * 21 - by).toFixed(1) +
               '" stroke-width="2" opacity="0.75"/>';
        }
      }
      g += '<circle r="34" stroke-width="1.4" opacity="0.5"/>' +
           '<path d="M0,-16 L10,6 L-10,6 Z" fill="' + col + '" stroke="none" opacity="0.6"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'coin') {     /* 铜钱（外圆内方）：资本 */
      g += '<circle r="90" stroke-width="2.4" opacity="0.85"/>' +
           '<circle r="66" stroke-width="1.3" opacity="0.45"/>' +
           '<circle r="34" stroke-width="1.6" opacity="0.6"/>';
      for (i = 0; i < 48; i++) {          /* 币缘齿纹 */
        a = i * Math.PI / 24;
        g += '<line x1="' + (Math.cos(a) * 90).toFixed(1) + '" y1="' + (Math.sin(a) * 90).toFixed(1) +
             '" x2="' + (Math.cos(a) * 80).toFixed(1) + '" y2="' + (Math.sin(a) * 80).toFixed(1) +
             '" stroke-width="1.3" opacity="0.5"/>';
      }
      g += '<rect x="-15" y="-15" width="30" height="30" fill="' + col + '" fill-opacity="0.18" stroke-width="1.8"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'expand') {   /* 扩张：中心向四方辐射的箭头 */
      for (i = 0; i < 4; i++) {
        a = i * Math.PI / 2;
        var ex = Math.cos(a), ey = Math.sin(a);
        g += '<line x1="' + (ex*26).toFixed(1) + '" y1="' + (ey*26).toFixed(1) + '" x2="' + (ex*84).toFixed(1) + '" y2="' + (ey*84).toFixed(1) + '" stroke-width="2.4" opacity="0.85"/>';
        var hx = ex*84, hy = ey*84;
        g += '<path d="M' + hx.toFixed(1) + ' ' + hy.toFixed(1) + ' L' + (hx - Math.cos(a-0.5)*18).toFixed(1) + ' ' + (hy - Math.sin(a-0.5)*18).toFixed(1) + ' M' + hx.toFixed(1) + ' ' + hy.toFixed(1) + ' L' + (hx - Math.cos(a+0.5)*18).toFixed(1) + ' ' + (hy - Math.sin(a+0.5)*18).toFixed(1) + '" stroke-width="2.4" opacity="0.85"/>';
      }
      g += '<circle r="18" stroke-width="1.6" opacity="0.6"/><circle r="4" fill="' + col + '" stroke="none"/>' +
           '<circle r="58" stroke-width="1" opacity="0.3" stroke-dasharray="3 7"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'peak') {     /* 例外：卓然独立的峰与旗 */
      g += '<path d="M-84 62 L-24 -22 L6 14 L40 -46 L88 62 Z" stroke-width="2.2" opacity="0.85" fill="' + col + '" fill-opacity="0.12"/>' +
           '<line x1="40" y1="-46" x2="40" y2="-88" stroke-width="2" opacity="0.85"/>' +
           '<path d="M40 -88 L72 -78 L40 -68 Z" fill="' + col + '" stroke="none" opacity="0.85"/>' +
           '<line x1="-88" y1="62" x2="88" y2="62" stroke-width="1.2" opacity="0.4"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'converge') { /* 民主集中：众声归一 */
      for (i = 0; i < 8; i++) {
        a = i * Math.PI / 4;
        var cvx = Math.cos(a)*82, cvy = Math.sin(a)*82;
        g += '<line x1="0" y1="0" x2="' + cvx.toFixed(1) + '" y2="' + cvy.toFixed(1) + '" stroke-width="1.4" opacity="0.5"/>' +
             '<circle cx="' + cvx.toFixed(1) + '" cy="' + cvy.toFixed(1) + '" r="9" stroke-width="1.8" opacity="0.8"/>';
      }
      g += '<circle r="17" fill="' + col + '" fill-opacity="0.9" stroke="none"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'web') {      /* 裙带：关系网 */
      var wpts = [[-66,-34],[-8,-74],[62,-24],[70,46],[2,72],[-62,40]];
      var wegs = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[1,4],[0,4],[2,5]];
      for (i = 0; i < wegs.length; i++) {
        var q1 = wpts[wegs[i][0]], q2 = wpts[wegs[i][1]];
        g += '<line x1="' + q1[0] + '" y1="' + q1[1] + '" x2="' + q2[0] + '" y2="' + q2[1] + '" stroke-width="1.3" opacity="0.5"/>';
      }
      for (i = 0; i < wpts.length; i++) {
        g += '<circle cx="' + wpts[i][0] + '" cy="' + wpts[i][1] + '" r="' + (i===1?11:8) + '" stroke-width="1.8" opacity="0.85" fill="' + col + '" fill-opacity="' + (i===1?'0.5':'0.15') + '"/>';
      }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'dividers') { /* 创世：绘图圆规（落笔之手） */
      g += '<circle cx="0" cy="-80" r="7" stroke-width="2" opacity="0.85"/>' +
           '<line x1="-4" y1="-74" x2="-46" y2="62" stroke-width="2.4" opacity="0.85"/>' +
           '<line x1="4" y1="-74" x2="46" y2="62" stroke-width="2.4" opacity="0.85"/>' +
           '<line x1="0" y1="-74" x2="0" y2="10" stroke-width="1.1" opacity="0.4"/>' +
           '<path d="M-46 62 A 96 96 0 0 1 46 62" stroke-width="1.3" opacity="0.5" stroke-dasharray="2 6"/>' +
           '<circle cx="46" cy="62" r="3.6" fill="' + col + '" stroke="none"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'globe') {    /* 世界：经纬地球 */
      g += '<circle r="86" stroke-width="2.2" opacity="0.85"/>' +
           '<ellipse rx="86" ry="33" stroke-width="1.2" opacity="0.5"/>' +
           '<ellipse rx="33" ry="86" stroke-width="1.2" opacity="0.5"/>' +
           '<ellipse rx="62" ry="86" stroke-width="1" opacity="0.35"/>' +
           '<line x1="-86" y1="0" x2="86" y2="0" stroke-width="1.2" opacity="0.5"/>' +
           '<line x1="-74" y1="-43" x2="74" y2="-43" stroke-width="1" opacity="0.4"/>' +
           '<line x1="-74" y1="43" x2="74" y2="43" stroke-width="1" opacity="0.4"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'fasces') {   /* 法团：束棒 */
      for (i = 0; i < 7; i++) {
        var fx = -30 + i*10;
        g += '<line x1="' + fx + '" y1="-82" x2="' + fx + '" y2="82" stroke-width="3" opacity="0.65"/>';
      }
      g += '<rect x="-36" y="-12" width="72" height="22" fill="' + col + '" fill-opacity="0.28" stroke-width="1.6"/>' +
           '<rect x="-36" y="42" width="72" height="14" stroke-width="1.2" opacity="0.5"/>' +
           '<path d="M36 -66 q 34 8 34 34 q 0 26 -34 34" stroke-width="2" fill="' + col + '" fill-opacity="0.15"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'scroll') {   /* 宪政：成文法典与印章 */
      g += '<rect x="-58" y="-80" width="116" height="160" rx="9" stroke-width="2" opacity="0.8"/>';
      for (i = 0; i < 5; i++) {
        var sy = -50 + i*22;
        g += '<line x1="-38" y1="' + sy + '" x2="38" y2="' + sy + '" stroke-width="1.5" opacity="0.45"/>';
      }
      g += '<circle cx="28" cy="58" r="15" fill="' + col + '" fill-opacity="0.22" stroke-width="1.6"/>' +
           '<path d="M28 72 l -7 20 l 7 -7 l 7 7 Z" fill="' + col + '" stroke="none" opacity="0.7"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'brokenchain') { /* 反帝：挣断的锁链 */
      g += '<rect x="-86" y="-24" width="62" height="48" rx="24" stroke-width="3" opacity="0.85"/>' +
           '<rect x="24" y="-24" width="62" height="48" rx="24" stroke-width="3" opacity="0.85"/>';
      for (i = 0; i < 6; i++) {
        a = i * Math.PI / 3;
        g += '<line x1="' + (Math.cos(a)*7).toFixed(1) + '" y1="' + (Math.sin(a)*7).toFixed(1) +
             '" x2="' + (Math.cos(a)*22).toFixed(1) + '" y2="' + (Math.sin(a)*22).toFixed(1) + '" stroke-width="2" opacity="0.7"/>';
      }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'ship') {       /* 殖民：远洋帆船 */
      g += '<path d="M-72 40 L72 40 L52 72 L-52 72 Z" stroke-width="2.4" opacity="0.85" fill="' + col + '" fill-opacity="0.12"/>' +
           '<line x1="0" y1="40" x2="0" y2="-80" stroke-width="2.4" opacity="0.85"/>' +
           '<path d="M0 -72 C 42 -50 42 -8 0 4 Z" stroke-width="1.8" opacity="0.7" fill="' + col + '" fill-opacity="0.1"/>' +
           '<path d="M0 -72 C -42 -50 -42 -8 0 4 Z" stroke-width="1.8" opacity="0.7" fill="' + col + '" fill-opacity="0.1"/>' +
           '<line x1="-30" y1="-66" x2="30" y2="-66" stroke-width="1.6" opacity="0.7"/>' +
           '<path d="M-84 88 q 12 -9 24 0 q 12 9 24 0 q 12 -9 24 0 q 12 9 24 0 q 12 -9 24 0" stroke-width="1.4" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'swords') {     /* 沙文：交叉军刀 */
      for (var s = -1; s <= 1; s += 2) {
        g += '<line x1="' + (s*-62) + '" y1="72" x2="' + (s*60) + '" y2="-74" stroke-width="3" opacity="0.85" stroke-linecap="round"/>' +
             '<line x1="' + (s*-58) + '" y1="52" x2="' + (s*-34) + '" y2="66" stroke-width="2.4" opacity="0.8"/>' +
             '<path d="M' + (s*60) + ' -74 l ' + (s*-4) + ' 16 l 13 3 Z" fill="' + col + '" stroke="none" opacity="0.85"/>';
      }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'center') {     /* 中间：光谱中点 */
      g += '<line x1="-86" y1="0" x2="86" y2="0" stroke-width="2" opacity="0.7"/>' +
           '<line x1="-86" y1="-20" x2="-86" y2="20" stroke-width="2.4" opacity="0.7"/>' +
           '<line x1="86" y1="-20" x2="86" y2="20" stroke-width="2.4" opacity="0.7"/>' +
           '<line x1="-43" y1="-10" x2="-43" y2="10" stroke-width="1.4" opacity="0.4"/>' +
           '<line x1="43" y1="-10" x2="43" y2="10" stroke-width="1.4" opacity="0.4"/>' +
           '<circle r="27" stroke-width="1.4" opacity="0.5"/>' +
           '<path d="M0 -16 L16 0 L0 16 L-16 0 Z" fill="' + col + '" stroke="none" opacity="0.9"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'hourglass') {  /* 官僚：时光沙漏（层层审批） */
      g += '<line x1="-46" y1="-80" x2="46" y2="-80" stroke-width="3" opacity="0.85"/>' +
           '<line x1="-46" y1="80" x2="46" y2="80" stroke-width="3" opacity="0.85"/>' +
           '<path d="M-40 -76 L40 -76 L6 0 L40 76 L-40 76 L-6 0 Z" stroke-width="2.2" opacity="0.8" fill="' + col + '" fill-opacity="0.08"/>' +
           '<path d="M-22 -52 L22 -52 L0 -8 Z" fill="' + col + '" stroke="none" opacity="0.45"/>' +
           '<path d="M-24 62 L24 62 L0 30 Z" fill="' + col + '" stroke="none" opacity="0.6"/>' +
           '<line x1="0" y1="-6" x2="0" y2="30" stroke-width="1.6" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'hammersickle') { /* 马克思主义：锤与镰 */
      g += '<path d="M-64 62 A 92 92 0 0 1 44 -66" stroke-width="7" opacity="0.85" fill="none" stroke-linecap="round"/>' +
           '<line x1="-40" y1="70" x2="52" y2="-42" stroke-width="7" opacity="0.85" stroke-linecap="round"/>' +
           '<path d="M40 -62 L80 -30 L64 -14 L28 -44 Z" fill="' + col + '" stroke="none" opacity="0.85"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'unlock') {       /* 废奴：打开的枷锁 */
      g += '<rect x="-46" y="-6" width="92" height="80" rx="10" stroke-width="3" opacity="0.85"/>' +
           '<path d="M-30 -6 L-30 -42 A 30 30 0 0 1 30 -42 L30 -22" stroke-width="6" opacity="0.85" fill="none" stroke-linecap="round"/>' +
           '<circle cy="26" r="9" fill="' + col + '" stroke="none" opacity="0.8"/>' +
           '<rect x="-4" y="26" width="8" height="26" fill="' + col + '" stroke="none" opacity="0.8"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'crown') {        /* 专制：王冠 */
      g += '<path d="M-70 40 L-70 -22 L-35 10 L0 -48 L35 10 L70 -22 L70 40 Z" stroke-width="3" opacity="0.85" fill="' + col + '" fill-opacity="0.12"/>' +
           '<line x1="-70" y1="54" x2="70" y2="54" stroke-width="3" opacity="0.85"/>' +
           '<circle cy="-48" r="6" fill="' + col + '" stroke="none" opacity="0.85"/>' +
           '<circle cx="-70" cy="-22" r="5" fill="' + col + '" stroke="none" opacity="0.85"/>' +
           '<circle cx="70" cy="-22" r="5" fill="' + col + '" stroke="none" opacity="0.85"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'mirror') {       /* 利己：自照之镜 */
      g += '<ellipse cy="-26" rx="52" ry="64" stroke-width="3" opacity="0.85"/>' +
           '<ellipse cy="-26" rx="38" ry="50" stroke-width="1.4" opacity="0.4"/>' +
           '<rect x="-8" y="38" width="16" height="54" rx="6" stroke-width="2.4" opacity="0.8"/>' +
           '<path d="M-18 -62 L-4 -22" stroke-width="3" opacity="0.5" stroke-linecap="round"/>' +
           '<path d="M-6 -64 L4 -42" stroke-width="2" opacity="0.4" stroke-linecap="round"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'threerings') {   /* 三民：三环相扣 */
      g += '<circle cy="-34" r="46" stroke-width="2.6" opacity="0.8"/>' +
           '<circle cx="-40" cy="30" r="46" stroke-width="2.6" opacity="0.8"/>' +
           '<circle cx="40" cy="30" r="46" stroke-width="2.6" opacity="0.8"/>' +
           '<circle r="6" fill="' + col + '" stroke="none" opacity="0.85"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'eye') {          /* 神秘：全视之眼 */
      g += '<path d="M0 -80 L80 62 L-80 62 Z" stroke-width="2.2" opacity="0.55"/>' +
           '<path d="M-48 0 Q0 -42 48 0 Q0 42 -48 0 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/>' +
           '<circle r="16" stroke-width="2" opacity="0.9"/>' +
           '<circle r="6" fill="' + col + '" stroke="none" opacity="0.95"/>';
      for (i = 0; i < 7; i++) {
        a = (-140 + i * 20) * Math.PI / 180;
        g += '<line x1="' + (Math.cos(a)*54).toFixed(1) + '" y1="' + (Math.sin(a)*54).toFixed(1) +
             '" x2="' + (Math.cos(a)*66).toFixed(1) + '" y2="' + (Math.sin(a)*66).toFixed(1) + '" stroke-width="1.4" opacity="0.5"/>';
      }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'solo') {         /* 个人：众中独立 */
      for (var gy = -1; gy <= 1; gy++) {
        for (var gx = -2; gx <= 2; gx++) {
          if (gx === 0 && gy === 0) continue;
          g += '<circle cx="' + (gx*40) + '" cy="' + (gy*46) + '" r="7" stroke-width="1.4" opacity="0.3"/>';
        }
      }
      g += '<circle r="16" fill="' + col + '" fill-opacity="0.9" stroke="none"/>' +
           '<circle r="26" stroke-width="1.6" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'door') {         /* 存在：虚掩之门 */
      g += '<rect x="-38" y="-80" width="78" height="160" stroke-width="2.4" opacity="0.55"/>' +
           '<path d="M-38 -80 L-84 -60 L-84 92 L-38 80 Z" stroke-width="2.4" opacity="0.85" fill="' + col + '" fill-opacity="0.12"/>' +
           '<path d="M-34 -58 L32 -78 M-34 0 L46 -10 M-34 58 L32 78" stroke-width="1.4" opacity="0.4"/>' +
           '<circle cx="-52" cy="6" r="4" fill="' + col + '" stroke="none" opacity="0.85"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'castle') {       /* 封建：城堡与旗 */
      g += '<path d="M-62 70 L-62 -18 L-48 -18 L-48 -32 L-34 -32 L-34 -18 L-20 -18 L-20 -32 L-6 -32 L-6 -18 L8 -18 L8 -32 L22 -32 L22 -18 L38 -18 L38 -32 L52 -32 L52 -18 L62 -18 L62 70 Z" stroke-width="2.4" opacity="0.85" fill="' + col + '" fill-opacity="0.07"/>' +
           '<path d="M-16 70 L-16 34 A 16 16 0 0 1 16 34 L16 70 Z" stroke-width="2" opacity="0.8"/>' +
           '<line x1="0" y1="-32" x2="0" y2="-72" stroke-width="2" opacity="0.8"/>' +
           '<path d="M0 -72 L26 -63 L0 -54 Z" fill="' + col + '" stroke="none" opacity="0.85"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'sunrise') {      /* 毛泽东思想：东方日出 */
      g += '<line x1="-88" y1="44" x2="88" y2="44" stroke-width="2.4" opacity="0.8"/>' +
           '<path d="M-52 44 A 52 52 0 0 1 52 44 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.14"/>';
      for (i = 0; i < 7; i++) {
        a = Math.PI + i * (Math.PI / 6);
        g += '<line x1="' + (Math.cos(a)*62).toFixed(1) + '" y1="' + (44 + Math.sin(a)*62).toFixed(1) +
             '" x2="' + (Math.cos(a)*84).toFixed(1) + '" y2="' + (44 + Math.sin(a)*84).toFixed(1) + '" stroke-width="1.6" opacity="0.5"/>';
      }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'star5') {        /* 列宁主义：五角星 */
      var sp = '';
      for (i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5, sr = (i % 2 === 0) ? 88 : 36;
        sp += (i === 0 ? 'M' : 'L') + (Math.cos(ang) * sr).toFixed(1) + ' ' + (Math.sin(ang) * sr).toFixed(1) + ' ';
      }
      g += '<path d="' + sp + 'Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.16"/>' +
           '<circle r="8" fill="' + col + '" stroke="none" opacity="0.7"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'parcels') {      /* 地主所有制：田亩与界桩 */
      g += '<path d="M-72 -46 L72 -58 L82 58 L-62 68 Z" stroke-width="2.4" opacity="0.8"/>' +
           '<line x1="-22" y1="-52" x2="-16" y2="63" stroke-width="1.4" opacity="0.5"/>' +
           '<line x1="30" y1="-55" x2="34" y2="60" stroke-width="1.4" opacity="0.5"/>' +
           '<line x1="-67" y1="6" x2="78" y2="0" stroke-width="1.4" opacity="0.5"/>' +
           '<line x1="0" y1="4" x2="0" y2="-72" stroke-width="2.2" opacity="0.85"/>' +
           '<path d="M0 -72 L28 -63 L0 -54 Z" fill="' + col + '" stroke="none" opacity="0.85"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'island') {       /* 孤立主义：孤岛 */
      g += '<path d="M-88 46 q 14 -10 28 0 q 14 10 28 0 q 14 -10 28 0 q 14 10 28 0" stroke-width="1.6" opacity="0.5"/>' +
           '<path d="M-88 68 q 14 -10 28 0 q 14 10 28 0 q 14 -10 28 0 q 14 10 28 0" stroke-width="1.4" opacity="0.35"/>' +
           '<path d="M-50 46 Q -20 -18 0 -28 Q 26 -16 52 46 Z" stroke-width="2.4" opacity="0.85" fill="' + col + '" fill-opacity="0.1"/>' +
           '<line x1="0" y1="-28" x2="0" y2="-58" stroke-width="2" opacity="0.8"/>' +
           '<circle cy="-64" r="12" stroke-width="1.8" opacity="0.75"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'reach') {        /* 干涉主义：越界之手 */
      g += '<line x1="12" y1="-80" x2="12" y2="80" stroke-width="1.6" opacity="0.5" stroke-dasharray="4 8"/>' +
           '<path d="M-72 8 L-72 -14 Q-72 -26 -58 -26 L-8 -26 Q 2 -26 2 -14 L2 14 Q2 26 -10 26 L-58 26 Q-72 26 -72 14 Z" stroke-width="2.2" opacity="0.85" fill="' + col + '" fill-opacity="0.1"/>' +
           '<path d="M2 -18 L36 -18 M2 -4 L42 -4 M2 10 L36 10" stroke-width="2.2" opacity="0.8" stroke-linecap="round"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'king') {         /* 霸权主义：棋中之王 */
      g += '<line x1="0" y1="-88" x2="0" y2="-64" stroke-width="3" opacity="0.85"/>' +
           '<line x1="-10" y1="-78" x2="10" y2="-78" stroke-width="3" opacity="0.85"/>' +
           '<path d="M-14 -64 Q0 -72 14 -64 L26 -22 Q0 -10 -26 -22 Z" stroke-width="2.2" opacity="0.85" fill="' + col + '" fill-opacity="0.1"/>' +
           '<path d="M-30 -18 Q0 -6 30 -18 L36 6 Q0 20 -36 6 Z" stroke-width="2.2" opacity="0.8"/>' +
           '<path d="M-28 14 L-40 66 L40 66 L28 14" stroke-width="2.2" opacity="0.8" fill="' + col + '" fill-opacity="0.08"/>' +
           '<line x1="-46" y1="72" x2="46" y2="72" stroke-width="3" opacity="0.85"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'openbook') {     /* 原教旨主义：启示之书 */
      g += '<path d="M0 -18 L-70 -34 L-70 54 L0 68 Z" stroke-width="2.4" opacity="0.85" fill="' + col + '" fill-opacity="0.08"/>' +
           '<path d="M0 -18 L70 -34 L70 54 L0 68 Z" stroke-width="2.4" opacity="0.85" fill="' + col + '" fill-opacity="0.08"/>' +
           '<line x1="0" y1="-18" x2="0" y2="68" stroke-width="1.8" opacity="0.6"/>' +
           '<path d="M-56 -14 L-14 -6 M-56 6 L-14 14 M-56 26 L-14 34" stroke-width="1.2" opacity="0.4"/>' +
           '<path d="M56 -14 L14 -6 M56 6 L14 14 M56 26 L14 34" stroke-width="1.2" opacity="0.4"/>' +
           '<path d="M0 -78 L7 -50 L-7 -50 Z" fill="' + col + '" stroke="none" opacity="0.8"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'federation') {   /* 联邦：中央与成员分权 */
      for (i = 0; i < 6; i++) {
        a = i * 60 * Math.PI / 180;
        var sx = Math.cos(a) * 66, sy = Math.sin(a) * 66;
        g += '<line x1="0" y1="0" x2="' + sx.toFixed(1) + '" y2="' + sy.toFixed(1) + '" stroke-width="1.6" opacity="0.45"/>' +
             '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="15" stroke-width="2.2" opacity="0.8"/>';
      }
      g += '<circle r="24" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.12"/>' +
           '<circle r="90" stroke-width="1" opacity="0.22"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'column') {       /* 保守：承继的制度之柱 */
      g += '<line x1="-44" y1="-70" x2="44" y2="-70" stroke-width="3" opacity="0.85"/>' +
           '<path d="M-34 -70 L-34 -56 L34 -56 L34 -70 Z" stroke-width="2" opacity="0.7" fill="' + col + '" fill-opacity="0.1"/>' +
           '<line x1="-26" y1="-56" x2="-26" y2="56" stroke-width="2" opacity="0.8"/>' +
           '<line x1="-9" y1="-56" x2="-9" y2="56" stroke-width="1.3" opacity="0.4"/>' +
           '<line x1="9" y1="-56" x2="9" y2="56" stroke-width="1.3" opacity="0.4"/>' +
           '<line x1="26" y1="-56" x2="26" y2="56" stroke-width="2" opacity="0.8"/>' +
           '<path d="M-34 56 L-34 72 L34 72 L34 56 Z" stroke-width="2" opacity="0.8" fill="' + col + '" fill-opacity="0.1"/>' +
           '<line x1="-46" y1="72" x2="46" y2="72" stroke-width="2.4" opacity="0.8"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'braid') {        /* 集体：拧成一股绳 */
      g += '<path d="M-26 -84 C 26 -60 -26 -36 26 -12 C -26 12 26 36 -26 60 L-26 84" stroke-width="3" opacity="0.8"/>' +
           '<path d="M26 -84 C -26 -60 26 -36 -26 -12 C 26 12 -26 36 26 60 L26 84" stroke-width="3" opacity="0.8"/>' +
           '<path d="M0 -80 L0 80" stroke-width="1.6" opacity="0.35" stroke-dasharray="5 9"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'sunflower') {    /* 乐观：向阳而开 */
      for (i = 0; i < 12; i++) {
        a = i * 30 * Math.PI / 180;
        g += '<path d="M' + (Math.cos(a) * 30).toFixed(1) + ' ' + (Math.sin(a) * 30).toFixed(1) +
             ' L' + (Math.cos(a - 0.18) * 70).toFixed(1) + ' ' + (Math.sin(a - 0.18) * 70).toFixed(1) +
             ' Q ' + (Math.cos(a) * 84).toFixed(1) + ' ' + (Math.sin(a) * 84).toFixed(1) + ' ' +
             (Math.cos(a + 0.18) * 70).toFixed(1) + ' ' + (Math.sin(a + 0.18) * 70).toFixed(1) + ' Z" stroke-width="1.5" opacity="0.7"/>';
      }
      g += '<circle r="30" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.14"/>' +
           '<circle r="16" stroke-width="1" opacity="0.4"/>' +
           '<line x1="0" y1="84" x2="0" y2="118" stroke-width="2.4" opacity="0.7"/>';
      return '<g transform="translate(' + C + ',' + (CY - 16) + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'grapes') {       /* 享乐：酒与丰饶 */
      g += '<path d="M0 -80 C 12 -90 26 -86 34 -74" stroke-width="2" opacity="0.7"/>' +
           '<path d="M2 -74 C 26 -78 38 -62 46 -54" stroke-width="1.6" opacity="0.55"/>' +
           '<path d="M-2 -74 C -24 -78 -34 -62 -44 -54" stroke-width="1.6" opacity="0.55"/>';
      var gp = [[-30,-48],[0,-48],[30,-48],[-15,-24],[15,-24],[-30,0],[0,0],[30,0],[-15,24],[15,24],[0,48]];
      for (i = 0; i < gp.length; i++) g += '<circle cx="' + gp[i][0] + '" cy="' + gp[i][1] + '" r="14" stroke-width="1.8" opacity="0.7"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'clasp') {        /* 共产主义：团结之握 */
      g += '<path d="M-84 -8 L-44 -8 Q-30 -8 -22 2" stroke-width="2.6" opacity="0.85" stroke-linecap="round"/>' +
           '<path d="M84 22 L44 22 Q30 22 22 12" stroke-width="2.6" opacity="0.85" stroke-linecap="round"/>' +
           '<path d="M-22 2 Q-8 -12 10 -8 Q30 -2 22 12 Q8 24 -10 20 Q-22 16 -22 2 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/>' +
           '<line x1="-14" y1="0" x2="14" y2="-4" stroke-width="1.6" opacity="0.5"/>' +
           '<line x1="-12" y1="8" x2="16" y2="4" stroke-width="1.6" opacity="0.5"/>' +
           '<line x1="-8" y1="16" x2="16" y2="12" stroke-width="1.6" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'rose') {        /* 社会民主主义：玫瑰 */
      g += '<circle r="16" stroke-width="2" opacity="0.85" fill="' + col + '" fill-opacity="0.12"/>' +
           '<path d="M-24 -8 Q-26 -30 0 -32 Q26 -30 24 -8 Q22 16 0 18 Q-22 16 -24 -8 Z" stroke-width="2" opacity="0.8"/>' +
           '<path d="M-12 -6 Q-12 -20 0 -20 Q12 -20 12 -6 Q12 8 0 8 Q-12 8 -12 -6 Z" stroke-width="1.5" opacity="0.6"/>' +
           '<line x1="0" y1="30" x2="0" y2="86" stroke-width="2.4" opacity="0.8"/>' +
           '<path d="M0 50 Q-24 44 -28 62 Q-8 68 0 56 Z" stroke-width="1.6" opacity="0.7"/>' +
           '<path d="M0 64 Q22 60 26 76 Q8 80 0 70 Z" stroke-width="1.6" opacity="0.7"/>';
      return '<g transform="translate(' + C + ',' + (CY - 12) + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'fist') {         /* 民主社会主义：高举的拳头 */
      g += '<path d="M-30 -14 Q-30 -36 -6 -38 L22 -38 Q42 -38 42 -16 L42 22 Q42 44 18 44 L-12 44 Q-30 44 -30 22 Z" stroke-width="2.8" opacity="0.92" fill="' + col + '" fill-opacity="0.1"/>' +
           '<line x1="-10" y1="-38" x2="-10" y2="-10" stroke-width="1.8" opacity="0.5"/>' +
           '<line x1="7" y1="-38" x2="7" y2="-10" stroke-width="1.8" opacity="0.5"/>' +
           '<line x1="24" y1="-38" x2="24" y2="-10" stroke-width="1.8" opacity="0.5"/>' +
           '<path d="M-30 2 Q-48 2 -48 -18 Q-48 -30 -34 -30 L-30 -24" stroke-width="2.6" opacity="0.85"/>' +
           '<line x1="-24" y1="44" x2="30" y2="44" stroke-width="2.4" opacity="0.6"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'syndical') {     /* 安那其工团主义：黑红分裂旗 */
      g += '<line x1="-52" y1="-78" x2="-52" y2="82" stroke-width="3" opacity="0.8"/>' +
           '<path d="M-52 -74 L46 -74 L46 -4 L-52 -4 Z" stroke-width="2.4" opacity="0.85"/>' +
           '<path d="M-52 -74 L46 -74 L-52 -4 Z" stroke-width="1.4" opacity="0.5" fill="' + col + '" fill-opacity="0.18"/>' +
           '<path d="M46 -74 L46 -4 L-52 -4 Z" stroke-width="1.4" opacity="0.5" fill="' + col + '" fill-opacity="0.05"/>' +
           '<circle cx="-52" cy="-80" r="5" fill="' + col + '" stroke="none" opacity="0.8"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'handaxe') {      /* 原始主义：打制石手斧 */
      g += '<path d="M0 -80 Q34 -50 30 6 Q26 60 0 84 Q-26 60 -30 6 Q-34 -50 0 -80 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/>' +
           '<path d="M0 -80 L0 84" stroke-width="1.4" opacity="0.4"/>' +
           '<path d="M-24 -30 L0 -20 L24 -30 M-26 4 L0 14 L26 4 M-20 42 L0 50 L20 42" stroke-width="1.4" opacity="0.45" fill="none"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'taiji') {        /* 安那其道家主义：太极 */
      var R = 62;
      g += '<circle r="' + R + '" stroke-width="2.6" opacity="0.9"/>' +
           '<path d="M0 ' + (-R) + ' A ' + R + ' ' + R + ' 0 0 1 0 ' + R + ' A ' + (R / 2) + ' ' + (R / 2) + ' 0 0 1 0 0 A ' + (R / 2) + ' ' + (R / 2) + ' 0 0 0 0 ' + (-R) + ' Z" stroke-width="2" opacity="0.8" fill="' + col + '" fill-opacity="0.14"/>' +
           '<circle cy="' + (-R / 2) + '" r="' + (R / 8) + '" stroke-width="1.6" opacity="0.85"/>' +
           '<circle cy="' + (R / 2) + '" r="' + (R / 8) + '" stroke-width="1.6" opacity="0.85" fill="' + col + '" fill-opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'circleA') {      /* 安那其资本主义：圈A（无政府） */
      g += '<circle r="70" stroke-width="3" opacity="0.85"/>' +
           '<path d="M-34 46 L0 -48 L34 46" stroke-width="4" opacity="0.9" stroke-linecap="round" fill="none"/>' +
           '<line x1="-18" y1="12" x2="18" y2="12" stroke-width="4" opacity="0.9" stroke-linecap="round"/>' +
           '<line x1="-46" y1="-48" x2="-22" y2="-24" stroke-width="3" opacity="0.6" stroke-linecap="round"/>' +
           '<line x1="46" y1="-48" x2="22" y2="-24" stroke-width="3" opacity="0.6" stroke-linecap="round"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'progress') {   /* 进步主义：上升折线箭头 */
      g += '<line x1="-72" y1="70" x2="72" y2="70" stroke-width="2" opacity="0.5"/>' +
           '<line x1="-72" y1="70" x2="-72" y2="-70" stroke-width="2" opacity="0.5"/>' +
           '<path d="M-70 58 L-30 8 L0 32 L40 -34" stroke-width="3" opacity="0.9" fill="none"/>' +
           '<path d="M40 -34 L14 -34 M40 -34 L40 -8" stroke-width="3" opacity="0.9"/>' +
           '<circle cx="-30" cy="8" r="4" fill="' + col + '" stroke="none" opacity="0.8"/>' +
           '<circle cx="0" cy="32" r="4" fill="' + col + '" stroke="none" opacity="0.8"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'lens') {       /* 经验主义：放大镜 */
      g += '<circle cx="-14" cy="-14" r="46" stroke-width="3" opacity="0.9"/>' +
           '<circle cx="-14" cy="-14" r="36" stroke-width="1.4" opacity="0.4"/>' +
           '<line x1="20" y1="20" x2="60" y2="60" stroke-width="8" opacity="0.7"/>' +
           '<path d="M-34 -30 Q-24 -44 -6 -40" stroke-width="2" opacity="0.5" fill="none"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'crownscroll') { /* 君主立宪：王冠加于宪章之上 */
      g += '<path d="M-40 -34 L-40 -66 L-20 -48 L0 -70 L20 -48 L40 -66 L40 -34 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.12"/>' +
           '<line x1="-44" y1="-30" x2="44" y2="-30" stroke-width="2.4" opacity="0.7"/>' +
           '<rect x="-46" y="-8" width="92" height="70" rx="4" stroke-width="2.4" opacity="0.85" fill="' + col + '" fill-opacity="0.06"/>' +
           '<line x1="-30" y1="12" x2="30" y2="12" stroke-width="1.6" opacity="0.5"/>' +
           '<line x1="-30" y1="26" x2="30" y2="26" stroke-width="1.6" opacity="0.5"/>' +
           '<line x1="-30" y1="40" x2="14" y2="40" stroke-width="1.6" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'scepter') {    /* 开明君主：权杖（哲学王） */
      g += '<line x1="0" y1="70" x2="0" y2="-30" stroke-width="4" opacity="0.8"/>' +
           '<circle cx="0" cy="-48" r="18" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/>' +
           '<path d="M0 -80 L7 -60 L-7 -60 Z" fill="' + col + '" stroke="none" opacity="0.85"/>' +
           '<path d="M-18 -48 L18 -48 M0 -66 L0 -30" stroke-width="1.4" opacity="0.4"/>' +
           '<path d="M-14 34 L14 34 M-12 48 L12 48" stroke-width="2" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'polyhedron') { /* 本质主义：几何共相 */
      g += '<ellipse rx="84" ry="30" stroke-width="1.4" opacity="0.4" transform="rotate(-24)"/>' +
           '<path d="M0 -50 L44 -22 L44 26 L0 54 L-44 26 L-44 -22 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.08"/>' +
           '<path d="M0 -50 L0 54 M-44 -22 L44 26 M44 -22 L-44 26" stroke-width="1.2" opacity="0.45"/>' +
           '<circle r="6" fill="' + col + '" stroke="none" opacity="0.8"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'chip') {       /* 技术官僚：芯片（专家决策） */
      g += '<rect x="-46" y="-46" width="92" height="92" rx="8" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.06"/>' +
           '<rect x="-24" y="-24" width="48" height="48" rx="3" stroke-width="1.6" opacity="0.6"/>' +
           '<circle r="7" fill="' + col + '" stroke="none" opacity="0.7"/>';
      for (i = 0; i < 4; i++) {
        var off = -27 + i * 18;
        g += '<line x1="' + off + '" y1="-46" x2="' + off + '" y2="-62" stroke-width="2.2" opacity="0.6"/>' +
             '<line x1="' + off + '" y1="46" x2="' + off + '" y2="62" stroke-width="2.2" opacity="0.6"/>' +
             '<line x1="-46" y1="' + off + '" x2="-62" y2="' + off + '" stroke-width="2.2" opacity="0.6"/>' +
             '<line x1="46" y1="' + off + '" x2="62" y2="' + off + '" stroke-width="2.2" opacity="0.6"/>';
      }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'chainedbook') { /* 教条主义：被锁链束缚的经书 */
      g += '<rect x="-44" y="-62" width="88" height="124" rx="6" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.08"/>' +
           '<line x1="-30" y1="-62" x2="-30" y2="62" stroke-width="1.6" opacity="0.5"/>' +
           '<path d="M-44 -20 L44 -20 M-44 20 L44 20" stroke-width="2.4" opacity="0.6"/>' +
           '<circle cx="0" cy="0" r="12" stroke-width="2.4" opacity="0.9"/>' +
           '<path d="M-7 -12 Q-7 -26 0 -26 Q7 -26 7 -12" stroke-width="2.4" opacity="0.8"/>' +
           '<circle cx="0" cy="0" r="3" fill="' + col + '" stroke="none"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'sparkle') {     /* 理想主义：引路星光 */
      g += '<path d="M0 -78 L13 -13 L78 0 L13 13 L0 78 L-13 13 L-78 0 L-13 -13 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.12"/>' +
           '<path d="M40 -44 l5 -14 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5 Z" stroke-width="1.6" opacity="0.7" fill="' + col + '" fill-opacity="0.1"/>' +
           '<circle cx="-46" cy="44" r="4" fill="' + col + '" stroke="none" opacity="0.7"/>' +
           '<circle cx="52" cy="40" r="3" fill="' + col + '" stroke="none" opacity="0.6"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'givingheart') { /* 利他主义：捧出的心 */
      g += '<path d="M0 60 C-52 20 -54 -30 -22 -34 C-8 -36 0 -24 0 -24 C0 -24 8 -36 22 -34 C54 -30 52 20 0 60 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.12"/>' +
           '<line x1="0" y1="-56" x2="0" y2="-78" stroke-width="2" opacity="0.6"/>' +
           '<line x1="-26" y1="-48" x2="-38" y2="-66" stroke-width="2" opacity="0.5"/>' +
           '<line x1="26" y1="-48" x2="38" y2="-66" stroke-width="2" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + (CY + 6) + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'turnstile') {   /* 逻辑实证主义：可证实（⊢） */
      g += '<line x1="-40" y1="-64" x2="-40" y2="64" stroke-width="3" opacity="0.85"/>' +
           '<line x1="-40" y1="0" x2="20" y2="0" stroke-width="3" opacity="0.85"/>' +
           '<path d="M20 0 L4 -14 M20 0 L4 14" stroke-width="3" opacity="0.85" stroke-linecap="round"/>' +
           '<path d="M34 40 L48 56 L74 22" stroke-width="4" opacity="0.9" stroke-linecap="round" stroke-linejoin="round"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'geoscale') {    /* 乔治主义：土地与价值的天平 */
      g += '<circle cx="0" cy="-64" r="5" fill="' + col + '" stroke="none" opacity="0.8"/>' +
           '<line x1="0" y1="-60" x2="0" y2="-40" stroke-width="2.4" opacity="0.7"/>' +
           '<line x1="-50" y1="-40" x2="50" y2="-40" stroke-width="2.6" opacity="0.85"/>' +
           '<line x1="-50" y1="-40" x2="-50" y2="-14" stroke-width="1.6" opacity="0.6"/>' +
           '<rect x="-68" y="-14" width="36" height="30" stroke-width="2.2" opacity="0.85" fill="' + col + '" fill-opacity="0.1"/>' +
           '<line x1="50" y1="-40" x2="50" y2="-14" stroke-width="1.6" opacity="0.6"/>' +
           '<circle cx="50" cy="4" r="18" stroke-width="2.2" opacity="0.85"/>';
      return '<g transform="translate(' + C + ',' + (CY + 6) + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'earthcenter') { /* 人类中心主义：人居天地之中 */
      g += '<circle r="46" stroke-width="2.6" opacity="0.9"/>' +
           '<ellipse rx="46" ry="18" stroke-width="1.4" opacity="0.5"/>' +
           '<ellipse rx="18" ry="46" stroke-width="1.4" opacity="0.5"/>' +
           '<ellipse rx="84" ry="30" stroke-width="1.4" opacity="0.4" transform="rotate(-24)"/>' +
           '<circle r="7" fill="' + col + '" stroke="none" opacity="0.9"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'starwall') {    /* 斯大林主义：星与城垣 */
      g += '<path d="M0 -78 L10 -52 L38 -52 L16 -34 L24 -8 L0 -24 L-24 -8 L-16 -34 L-38 -52 L-10 -52 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.14"/>' +
           '<path d="M-72 30 L-72 6 L-54 6 L-54 30 L-36 30 L-36 6 L-18 6 L-18 30 L0 30 L0 6 L18 6 L18 30 L36 30 L36 6 L54 6 L54 30 L72 30 L72 66 L-72 66 Z" stroke-width="2.4" opacity="0.85" fill="' + col + '" fill-opacity="0.06"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'bridge') {      /* 实用主义：连接观念与事实之桥 */
      g += '<path d="M-84 24 Q0 -54 84 24" stroke-width="3" opacity="0.9" fill="none"/>' +
           '<line x1="-84" y1="24" x2="84" y2="24" stroke-width="3" opacity="0.85"/>' +
           '<line x1="-52" y1="24" x2="-52" y2="-8" stroke-width="2" opacity="0.5"/>' +
           '<line x1="0" y1="24" x2="0" y2="-30" stroke-width="2" opacity="0.5"/>' +
           '<line x1="52" y1="24" x2="52" y2="-8" stroke-width="2" opacity="0.5"/>' +
           '<line x1="-70" y1="24" x2="-70" y2="54" stroke-width="2.6" opacity="0.7"/>' +
           '<line x1="70" y1="24" x2="70" y2="54" stroke-width="2.6" opacity="0.7"/>';
      return '<g transform="translate(' + C + ',' + (CY + 6) + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'crescent') {    /* 心灵主义：新月与灵光 */
      g += '<path d="M20 -60 A60 60 0 1 0 20 60 A46 46 0 1 1 20 -60 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.12"/>' +
           '<circle cx="-40" cy="-4" r="9" stroke-width="1.8" opacity="0.7"/>' +
           '<path d="M-40 -22 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 l9 -3 Z" fill="' + col + '" stroke="none" opacity="0.6"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'glasslow') {    /* 悲观主义：半空之杯 */
      g += '<path d="M-34 -60 L-24 66 L24 66 L34 -60 Z" stroke-width="2.6" opacity="0.9" fill="none"/>' +
           '<path d="M-29 24 L29 24 L25 64 L-25 64 Z" fill="' + col + '" fill-opacity="0.14" stroke="none"/>' +
           '<line x1="-29" y1="24" x2="29" y2="24" stroke-width="1.6" opacity="0.6"/>' +
           '<line x1="-36" y1="-60" x2="36" y2="-60" stroke-width="2" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'duality') {     /* 二元论：两分之圆 */
      g += '<circle r="62" stroke-width="2.6" opacity="0.9"/>' +
           '<path d="M0 -62 A62 62 0 0 1 0 62 Z" fill="' + col + '" fill-opacity="0.5" stroke="none"/>' +
           '<line x1="0" y1="-62" x2="0" y2="62" stroke-width="2" opacity="0.8"/>' +
           '<circle cx="0" cy="-30" r="7" fill="' + col + '" stroke="none" opacity="0.9"/>' +
           '<circle cx="0" cy="30" r="7" stroke-width="1.8" opacity="0.9" fill="none"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'sisyphus') {    /* 荒诞主义：西西弗斯的巨石 */
      g += '<path d="M-80 66 L70 -30" stroke-width="3" opacity="0.7"/>' +
           '<circle cx="-6" cy="14" r="34" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/>' +
           '<path d="M-22 4 Q-6 -8 10 6" stroke-width="1.4" opacity="0.5" fill="none"/>' +
           '<path d="M44 -46 q22 -14 30 6 M74 -40 l-2 -12 M74 -40 l-12 2" stroke-width="2" opacity="0.6" fill="none" stroke-linecap="round"/>';
      return '<g transform="translate(' + C + ',' + (CY + 4) + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'lantern') {     /* 犬儒主义：第欧根尼的灯笼 */
      g += '<path d="M0 -72 q14 0 14 12" stroke-width="2" opacity="0.7" fill="none"/>' +
           '<line x1="-26" y1="-52" x2="26" y2="-52" stroke-width="2.6" opacity="0.85"/>' +
           '<path d="M-24 -52 L-30 40 L30 40 L24 -52 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.06"/>' +
           '<line x1="-27" y1="-16" x2="27" y2="-16" stroke-width="1.4" opacity="0.5"/>' +
           '<line x1="-28" y1="16" x2="28" y2="16" stroke-width="1.4" opacity="0.5"/>' +
           '<circle cx="0" cy="6" r="8" fill="' + col + '" stroke="none" opacity="0.7"/>' +
           '<line x1="-32" y1="40" x2="32" y2="40" stroke-width="2.6" opacity="0.85"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'helix') {       /* 社会达尔文主义：螺旋与选择 */
      for (i = 0; i < 5; i++) {
        var yy = -66 + i * 33;
        var xh = Math.cos(i * 1.25) * 34;
        g += '<circle cx="' + xh.toFixed(1) + '" cy="' + yy + '" r="5" fill="' + col + '" stroke="none" opacity="0.85"/>' +
             '<circle cx="' + (-xh).toFixed(1) + '" cy="' + (yy + 16) + '" r="5" fill="' + col + '" stroke="none" opacity="0.85"/>' +
             '<line x1="' + xh.toFixed(1) + '" y1="' + yy + '" x2="' + (-xh).toFixed(1) + '" y2="' + (yy + 16) + '" stroke-width="1.6" opacity="0.5"/>';
      }
      g += '<path d="M-34 -66 C 34 -40 -34 -6 34 20 C -34 46 34 66 -20 78" stroke-width="2.2" opacity="0.7" fill="none"/>' +
           '<path d="M34 -66 C -34 -40 34 -6 -34 20 C 34 46 -34 66 20 78" stroke-width="2.2" opacity="0.7" fill="none"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'ecocycle') {    /* 生态中心主义：生态循环 */
      g += '<path d="M0 -60 A60 60 0 1 1 -42 -42" stroke-width="2.6" opacity="0.85" fill="none"/>' +
           '<path d="M-42 -42 l-2 -14 M-42 -42 l14 -2" stroke-width="2.6" opacity="0.85" stroke-linecap="round"/>' +
           '<path d="M0 60 A60 60 0 1 1 42 42" stroke-width="2.6" opacity="0.85" fill="none"/>' +
           '<path d="M42 42 l2 14 M42 42 l-14 2" stroke-width="2.6" opacity="0.85" stroke-linecap="round"/>' +
           '<path d="M0 -18 C16 -6 16 14 0 26 C-16 14 -16 -6 0 -18 Z" stroke-width="2" opacity="0.9" fill="' + col + '" fill-opacity="0.14"/>' +
           '<line x1="0" y1="-10" x2="0" y2="24" stroke-width="1.4" opacity="0.6"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'swordstar') {   /* 英雄主义：荣耀之剑 */
      g += '<line x1="0" y1="-84" x2="0" y2="46" stroke-width="3.4" opacity="0.9"/>' +
           '<path d="M0 -84 L7 -68 L-7 -68 Z" fill="' + col + '" stroke="none" opacity="0.9"/>' +
           '<line x1="-26" y1="46" x2="26" y2="46" stroke-width="3.4" opacity="0.9"/>' +
           '<line x1="0" y1="46" x2="0" y2="72" stroke-width="3.4" opacity="0.9"/>' +
           '<circle cx="0" cy="76" r="5" fill="' + col + '" stroke="none"/>' +
           '<path d="M22 -50 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" fill="' + col + '" stroke="none" opacity="0.7"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'fan') {         /* 折衷主义：合众之扇 */
      g += '<path d="M0 70 L-70 -20 A88 88 0 0 1 70 -20 Z" stroke-width="2.4" opacity="0.85" fill="' + col + '" fill-opacity="0.06"/>';
      for (i = 0; i < 7; i++) {
        a = (-60 + i * 20) * Math.PI / 180;
        g += '<line x1="0" y1="70" x2="' + (Math.sin(a) * 84).toFixed(1) + '" y2="' + (70 - Math.cos(a) * 84).toFixed(1) + '" stroke-width="1.4" opacity="0.5"/>';
      }
      g += '<circle cx="0" cy="70" r="4" fill="' + col + '" stroke="none"/>';
      return '<g transform="translate(' + C + ',' + (CY - 6) + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'peony') {       /* 中国特色社会主义：牡丹 */
      for (i = 0; i < 8; i++) {
        a = i * 45 * Math.PI / 180;
        var px = (Math.cos(a) * 34).toFixed(1), py = (Math.sin(a) * 34).toFixed(1);
        g += '<ellipse cx="' + px + '" cy="' + py + '" rx="24" ry="15" transform="rotate(' + (i * 45) + ' ' + px + ' ' + py + ')" stroke-width="1.6" opacity="0.6" fill="none"/>';
      }
      g += '<circle r="26" stroke-width="2.2" opacity="0.85" fill="' + col + '" fill-opacity="0.1"/>' +
           '<circle r="12" stroke-width="1.6" opacity="0.7"/>' +
           '<circle r="4" fill="' + col + '" stroke="none" opacity="0.8"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'sprig') {       /* 自然主义：植物标本 */
      g += '<path d="M0 82 C 6 30 -6 -10 0 -78" stroke-width="2.4" opacity="0.85" fill="none"/>' +
           '<path d="M0 30 C-30 22 -34 0 -8 -4 C-2 14 0 22 0 30 Z" stroke-width="1.8" opacity="0.7" fill="' + col + '" fill-opacity="0.12"/>' +
           '<path d="M0 0 C30 -8 34 -30 8 -34 C2 -16 0 -8 0 0 Z" stroke-width="1.8" opacity="0.7" fill="' + col + '" fill-opacity="0.12"/>' +
           '<circle cx="0" cy="-70" r="7" stroke-width="1.8" opacity="0.8"/>' +
           '<circle cx="-14" cy="-52" r="4" fill="' + col + '" stroke="none" opacity="0.7"/>' +
           '<circle cx="14" cy="-58" r="4" fill="' + col + '" stroke="none" opacity="0.7"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'feather') {     /* 唯美主义：孔雀翎 */
      g += '<path d="M0 84 C 22 30 24 -30 0 -76 C -24 -30 -22 30 0 84 Z" stroke-width="2.2" opacity="0.85" fill="' + col + '" fill-opacity="0.06"/>' +
           '<line x1="0" y1="84" x2="0" y2="-60" stroke-width="1.6" opacity="0.6"/>' +
           '<ellipse cx="0" cy="-44" rx="15" ry="22" stroke-width="2" opacity="0.9"/>' +
           '<ellipse cx="0" cy="-44" rx="7" ry="11" stroke-width="1.6" opacity="0.8" fill="' + col + '" fill-opacity="0.2"/>';
      for (i = 0; i < 6; i++) {
        var fy = -20 + i * 16;
        g += '<line x1="0" y1="' + fy + '" x2="' + (18 - i * 2) + '" y2="' + (fy - 6) + '" stroke-width="1" opacity="0.4"/>' +
             '<line x1="0" y1="' + fy + '" x2="' + (-18 + i * 2) + '" y2="' + (fy - 6) + '" stroke-width="1" opacity="0.4"/>';
      }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'plumb') {       /* 现实主义：铅垂线 */
      g += '<line x1="0" y1="-84" x2="0" y2="44" stroke-width="2" opacity="0.8" stroke-dasharray="2 7"/>' +
           '<path d="M0 44 L-16 66 Q0 88 16 66 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.14"/>' +
           '<circle cx="0" cy="-84" r="5" fill="' + col + '" stroke="none" opacity="0.8"/>' +
           '<line x1="-40" y1="84" x2="40" y2="84" stroke-width="2" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + (CY - 4) + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'mondrian') {    /* 形式主义：新造型网格 */
      g += '<rect x="-72" y="-72" width="144" height="144" stroke-width="3" opacity="0.9"/>' +
           '<line x1="20" y1="-72" x2="20" y2="72" stroke-width="3" opacity="0.9"/>' +
           '<line x1="-72" y1="16" x2="20" y2="16" stroke-width="3" opacity="0.9"/>' +
           '<line x1="-24" y1="16" x2="-24" y2="72" stroke-width="3" opacity="0.9"/>' +
           '<rect x="20" y="-72" width="52" height="40" fill="' + col + '" fill-opacity="0.5" stroke="none"/>' +
           '<rect x="-72" y="-72" width="30" height="30" fill="' + col + '" fill-opacity="0.16" stroke="none"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'flagA') {       /* 安那其主义：旗上的圈A */
      g += '<line x1="-64" y1="-84" x2="-64" y2="84" stroke-width="3" opacity="0.8"/>' +
           '<path d="M-64 -70 L68 -70 L50 -36 L68 -2 L-64 -2 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/>' +
           '<circle cx="2" cy="-36" r="20" stroke-width="2.4" opacity="0.9"/>' +
           '<path d="M2 -56 L-10 -16 M2 -56 L14 -16 M-4 -38 L8 -38" stroke-width="2.4" opacity="0.9"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'wrench') {      /* 安那其共产主义：扳手（工人自治） */
      g += '<line x1="-40" y1="40" x2="40" y2="-40" stroke-width="11" opacity="0.45" stroke-linecap="round"/>' +
           '<circle cx="46" cy="-46" r="18" stroke-width="7" opacity="0.5"/>' +
           '<circle cx="46" cy="-46" r="18" stroke-width="2.4" opacity="0.9"/>' +
           '<line x1="46" y1="-64" x2="46" y2="-52" stroke-width="7" opacity="0.9"/>' +
           '<circle cx="-46" cy="46" r="12" stroke-width="2.4" opacity="0.9"/>' +
           '<circle cx="-46" cy="46" r="5" fill="' + col + '" stroke="none" opacity="0.4"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'brokencrown') { /* 安那其汉族主义：崩裂之冠（无君） */
      g += '<path d="M-52 40 L-52 -20 L-26 4 L0 -28 L26 4 L52 -20 L52 40 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/>' +
           '<line x1="-52" y1="48" x2="52" y2="48" stroke-width="2.6" opacity="0.8"/>' +
           '<path d="M0 -28 L-6 6 L6 22 L-2 48" stroke-width="2.4" opacity="0.9" fill="none"/>' +
           '<line x1="-30" y1="-24" x2="-30" y2="-40" stroke-width="2" opacity="0.6"/>' +
           '<line x1="30" y1="-24" x2="30" y2="-40" stroke-width="2" opacity="0.6"/>';
      return '<g transform="translate(' + C + ',' + (CY + 4) + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'eagle') {       /* 法西斯主义：鹰徽 */
      g += '<path d="M0 -10 L-70 -40 L-40 -14 L-72 -4 L-30 8 L0 4 Z" stroke-width="2.2" opacity="0.85" fill="' + col + '" fill-opacity="0.1"/>' +
           '<path d="M0 -10 L70 -40 L40 -14 L72 -4 L30 8 L0 4 Z" stroke-width="2.2" opacity="0.85" fill="' + col + '" fill-opacity="0.1"/>' +
           '<path d="M0 -10 L-8 24 L0 40 L8 24 Z" stroke-width="2" opacity="0.9" fill="' + col + '" fill-opacity="0.15"/>' +
           '<circle cx="0" cy="-16" r="6" fill="' + col + '" stroke="none" opacity="0.9"/>' +
           '<path d="M0 -22 L10 -18 L0 -14" fill="' + col + '" stroke="none" opacity="0.8"/>';
      return '<g transform="translate(' + C + ',' + (CY - 6) + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'imperialorb') { /* 帝国主义：君权宝球 */
      g += '<circle cy="18" r="46" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.08"/>' +
           '<ellipse cy="18" rx="46" ry="16" stroke-width="1.4" opacity="0.5"/>' +
           '<line x1="0" y1="-28" x2="0" y2="64" stroke-width="1.4" opacity="0.5"/>' +
           '<line x1="-46" y1="18" x2="46" y2="18" stroke-width="1.4" opacity="0.4"/>' +
           '<line x1="0" y1="-30" x2="0" y2="-58" stroke-width="3" opacity="0.9"/>' +
           '<line x1="-14" y1="-46" x2="14" y2="-46" stroke-width="3" opacity="0.9"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'abacus') {      /* 功利主义：幸福算盘 */
      g += '<rect x="-66" y="-52" width="132" height="104" rx="6" stroke-width="2.6" opacity="0.9"/>' +
           '<line x1="-66" y1="-16" x2="66" y2="-16" stroke-width="2" opacity="0.6"/>' +
           '<line x1="-66" y1="20" x2="66" y2="20" stroke-width="2" opacity="0.6"/>';
      for (i = 0; i < 4; i++) {
        var bx = -42 + i * 28;
        g += '<line x1="' + bx + '" y1="-52" x2="' + bx + '" y2="52" stroke-width="1.6" opacity="0.5"/>' +
             '<circle cx="' + bx + '" cy="-34" r="7" fill="' + col + '" stroke="none" opacity="0.8"/>' +
             '<circle cx="' + bx + '" cy="4" r="7" fill="' + col + '" stroke="none" opacity="0.8"/>' +
             '<circle cx="' + bx + '" cy="38" r="7" stroke-width="1.6" opacity="0.6"/>';
      }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'shieldlock') {  /* 最小政府主义：守夜之盾 */
      g += '<path d="M0 -70 L54 -50 L54 12 Q54 54 0 78 Q-54 54 -54 12 L-54 -50 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.08"/>' +
           '<circle cy="-6" r="16" stroke-width="2.4" opacity="0.9"/>' +
           '<path d="M-9 -6 L-9 -26 Q-9 -38 0 -38 Q9 -38 9 -26 L9 -6" stroke-width="2.4" opacity="0.8"/>' +
           '<line x1="0" y1="-6" x2="0" y2="14" stroke-width="3" opacity="0.8"/>' +
           '<circle cy="6" r="4" fill="' + col + '" stroke="none"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'coinstack') {   /* 阿戈拉主义：自由市集的钱 */
      for (i = 0; i < 3; i++) {
        var cy = 30 - i * 22;
        g += '<ellipse cy="' + cy + '" rx="42" ry="15" stroke-width="2.4" opacity="0.85" fill="' + col + '" fill-opacity="0.08"/>';
      }
      g += '<ellipse cy="-36" rx="42" ry="15" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.14"/>' +
           '<text x="0" y="-30" text-anchor="middle" font-size="20" font-family="serif" font-weight="700" fill="' + col + '" stroke="none" opacity="0.9">A</text>' +
           '<line x1="-42" y1="-36" x2="-42" y2="30" stroke-width="2.2" opacity="0.7"/>' +
           '<line x1="42" y1="-36" x2="42" y2="30" stroke-width="2.2" opacity="0.7"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'voidring') {    /* 虚无主义：残缺之环 */
      g += '<path d="M0 -66 A66 66 0 1 1 -47 -47" stroke-width="3" opacity="0.85" fill="none"/>' +
           '<path d="M0 -66 A66 66 0 0 0 -47 -47" stroke-width="1.4" opacity="0.3" stroke-dasharray="4 9" fill="none"/>' +
           '<circle r="9" fill="' + col + '" stroke="none" opacity="0.7"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'torch') {       /* 自由意志主义：火炬 */
      g += '<line x1="0" y1="78" x2="0" y2="6" stroke-width="6" opacity="0.7" stroke-linecap="round"/>' +
           '<path d="M0 -66 C22 -44 16 -18 0 -8 C-16 -18 -22 -44 0 -66 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.14"/>' +
           '<path d="M0 -46 C10 -34 7 -20 0 -14 C-7 -20 -10 -34 0 -46 Z" fill="' + col + '" stroke="none" opacity="0.4"/>' +
           '<line x1="-16" y1="10" x2="16" y2="10" stroke-width="3" opacity="0.7"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'dove') {        /* 自由主义：鸽 */
      g += '<path d="M-58 6 C-30 -22 6 -26 30 -46 C40 -30 34 -12 12 -2 C34 6 46 4 60 -6 C48 26 12 34 -18 22 C-38 14 -52 14 -58 6 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/>' +
           '<circle cx="30" cy="-40" r="3" fill="' + col + '" stroke="none"/>';
      return '<g transform="translate(' + C + ',' + (CY - 4) + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'transcend') {   /* 超人类主义：破环向上 */
      g += '<circle r="52" stroke-width="2.6" opacity="0.85"/>' +
           '<line x1="0" y1="60" x2="0" y2="-70" stroke-width="3" opacity="0.9"/>' +
           '<path d="M0 -70 L-16 -48 M0 -70 L16 -48" stroke-width="3" opacity="0.9" stroke-linecap="round"/>' +
           '<path d="M-40 24 A52 52 0 0 0 40 24" stroke-width="1.4" opacity="0.4" fill="none"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'unitnode') {    /* 方法论个人主义：以个人为单位 */
      g += '<circle r="20" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.5"/>';
      var angs = [-60, 60, 180, 0];
      for (i = 0; i < 4; i++) { a = angs[i] * Math.PI / 180; g += '<circle cx="' + (Math.cos(a) * 58).toFixed(1) + '" cy="' + (Math.sin(a) * 58).toFixed(1) + '" r="10" stroke-width="1.6" opacity="0.5"/>'; }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'quill') {       /* 古典自由主义：羽毛笔 */
      g += '<path d="M40 -70 C10 -50 -18 -18 -34 26 C-6 20 22 -8 40 -70 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/>' +
           '<path d="M34 -60 L-30 22" stroke-width="1.4" opacity="0.5"/>' +
           '<line x1="-34" y1="26" x2="-48" y2="52" stroke-width="3" opacity="0.85" stroke-linecap="round"/>' +
           '<line x1="-58" y1="66" x2="30" y2="66" stroke-width="2" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + (CY - 4) + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'gearcoin') {    /* 国家资本主义：齿轮与钱 */
      g += '<circle cx="-22" cy="14" r="34" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.08"/>' +
           '<rect x="-34" y="2" width="24" height="24" rx="2" stroke-width="1.6" opacity="0.6"/>' +
           '<circle cx="34" cy="-30" r="20" stroke-width="2.4" opacity="0.9"/>' +
           '<circle cx="34" cy="-30" r="8" stroke-width="1.6" opacity="0.6"/>';
      for (i = 0; i < 8; i++) { a = i * 45 * Math.PI / 180; g += '<line x1="' + (34 + Math.cos(a) * 20).toFixed(1) + '" y1="' + (-30 + Math.sin(a) * 20).toFixed(1) + '" x2="' + (34 + Math.cos(a) * 28).toFixed(1) + '" y2="' + (-30 + Math.sin(a) * 28).toFixed(1) + '" stroke-width="3" opacity="0.8"/>'; }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'padlock') {     /* 加密无政府主义：挂锁 */
      g += '<rect x="-40" y="-12" width="80" height="74" rx="10" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/>' +
           '<path d="M-24 -12 L-24 -40 Q-24 -62 0 -62 Q24 -62 24 -40 L24 -12" stroke-width="3" opacity="0.85"/>' +
           '<circle cy="18" r="9" stroke-width="2.4" opacity="0.9"/>' +
           '<line x1="0" y1="24" x2="0" y2="44" stroke-width="3" opacity="0.85"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'ffwd') {        /* 加速主义：快进 */
      g += '<path d="M-64 -44 L-8 0 L-64 44 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.14"/>' +
           '<path d="M-8 -44 L48 0 L-8 44 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.14"/>' +
           '<line x1="-72" y1="-64" x2="-24" y2="-64" stroke-width="2" opacity="0.4"/>' +
           '<line x1="-72" y1="64" x2="-24" y2="64" stroke-width="2" opacity="0.4"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'helmet') {      /* 军国主义：军盔 */
      g += '<path d="M-52 20 A52 52 0 0 1 52 20 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/>' +
           '<line x1="-60" y1="20" x2="60" y2="20" stroke-width="3" opacity="0.85"/>' +
           '<path d="M0 -52 L0 -78 M-8 -66 L8 -66" stroke-width="3" opacity="0.8" stroke-linecap="round"/>' +
           '<path d="M-30 20 L-30 48 M30 20 L30 48" stroke-width="2.4" opacity="0.6"/>';
      return '<g transform="translate(' + C + ',' + (CY + 6) + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'starcoin') {    /* 客观主义：星币 */
      g += '<circle r="58" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.08"/>' +
           '<circle r="48" stroke-width="1.4" opacity="0.4"/>' +
           '<path d="M0 -34 L10 -11 L35 -11 L15 5 L23 30 L0 15 L-23 30 L-15 5 L-35 -11 L-10 -11 Z" stroke-width="2" opacity="0.9" fill="' + col + '" fill-opacity="0.16"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'heartA') {      /* 酷儿安那其主义：心与A */
      g += '<path d="M0 58 C-50 22 -52 -26 -22 -30 C-8 -32 0 -20 0 -20 C0 -20 8 -32 22 -30 C52 -26 50 22 0 58 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.12"/>' +
           '<path d="M0 -8 L-11 20 M0 -8 L11 20 M-6 10 L6 10" stroke-width="2.4" opacity="0.9" stroke-linecap="round"/>';
      return '<g transform="translate(' + C + ',' + (CY + 2) + ')" stroke="' + col + '" fill="none" stroke-linecap="round">' + g + '</g>';
    }
    if (motif === 'candles') {     /* 新自由主义：K线 */
      var cd = [[-44, -6, 26], [0, -30, 40], [44, 10, 30]];
      for (i = 0; i < 3; i++) { var x = cd[i][0], top = cd[i][1], hh = cd[i][2]; g += '<line x1="' + x + '" y1="' + (top - 14) + '" x2="' + x + '" y2="' + (top + hh + 14) + '" stroke-width="1.6" opacity="0.5"/><rect x="' + (x - 9) + '" y="' + top + '" width="18" height="' + hh + '" stroke-width="2.2" opacity="0.9" fill="' + col + '" fill-opacity="0.14"/>'; }
      g += '<path d="M-64 66 L60 -20" stroke-width="2.4" opacity="0.6" stroke-linecap="round"/>' +
           '<path d="M60 -20 L44 -18 M60 -20 L58 -4" stroke-width="2.4" opacity="0.7" stroke-linecap="round"/>';
      return '<g transform="translate(' + C + ',' + (CY + 4) + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'abscepter') {   /* 绝对主义：权杖与宝球 */
      g += '<line x1="0" y1="70" x2="0" y2="-40" stroke-width="4" opacity="0.85" stroke-linecap="round"/><circle cy="-52" r="12" stroke-width="2.4" opacity="0.9"/><path d="M-12 -66 L-12 -80 M0 -66 L0 -84 M12 -66 L12 -80" stroke-width="2.4" opacity="0.8"/><circle cy="72" r="14" stroke-width="2.4" opacity="0.85"/><path d="M-14 72 L14 72 M0 58 L0 86" stroke-width="1.4" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'qmark') {       /* 怀疑主义：悬置之问 */
      g += '<path d="M-24 -46 C-24 -74 24 -74 22 -46 C20 -26 -2 -24 -2 -2" stroke-width="4" opacity="0.9" stroke-linecap="round"/><circle cy="30" r="6" fill="' + col + '" stroke="none"/><circle r="66" stroke-width="1.4" opacity="0.3" stroke-dasharray="3 9"/>';
      return '<g transform="translate(' + C + ',' + (CY + 4) + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'spontnet') {    /* 哈耶克主义：自发秩序网络 */
      var pts = [[-50, -30], [10, -56], [52, -8], [-24, 30], [36, 44], [-4, 4]];
      g += '<path d="M-50 -30 L-4 4 L10 -56 M-4 4 L52 -8 M-4 4 L-24 30 M-4 4 L36 44" stroke-width="1.4" opacity="0.5"/>';
      for (i = 0; i < pts.length; i++) { g += '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="' + (i === 3 ? 9 : 6) + '" stroke-width="2" opacity="0.85" fill="' + col + '" fill-opacity="0.4"/>'; }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'prism') {       /* 观点主义：棱镜折射（视角） */
      g += '<path d="M0 -56 L52 40 L-52 40 Z" stroke-width="2.6" opacity="0.9" fill="' + col + '" fill-opacity="0.08"/><line x1="-70" y1="-6" x2="-14" y2="-6" stroke-width="2" opacity="0.6"/><path d="M22 -2 L70 -22 M26 8 L70 6 M30 18 L70 34" stroke-width="2" opacity="0.6" stroke-linecap="round"/>';
      return '<g transform="translate(' + C + ',' + (CY + 4) + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'crownslash') {  /* 安那其君主主义：王冠加斜杠 */
      g += '<path d="M-40 24 L-40 -20 L-20 0 L0 -28 L20 0 L40 -20 L40 24 Z" stroke-width="2.4" opacity="0.85" fill="' + col + '" fill-opacity="0.08"/><line x1="-56" y1="46" x2="56" y2="-46" stroke-width="3.4" opacity="0.9" stroke-linecap="round"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'starA') {       /* 安那其毛泽东主义：五角星含A */
      g += '<path d="M0 -60 L15 -18 L58 -18 L23 8 L36 50 L0 24 L-36 50 L-23 8 L-58 -18 L-15 -18 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.1"/><path d="M0 -6 L-8 16 M0 -6 L8 16 M-4 8 L4 8" stroke-width="2.2" opacity="0.9" stroke-linecap="round"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'heartwave') {   /* 情感主义：心与表达波 */
      g += '<path d="M0 40 C-34 16 -36 -18 -16 -20 C-6 -21 0 -12 0 -12 C0 -12 6 -21 16 -20 C36 -18 34 16 0 40 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.12"/><path d="M-52 56 Q-38 46 -26 56 T0 56 T26 56 T52 56" stroke-width="2" opacity="0.6"/>';
      return '<g transform="translate(' + C + ',' + (CY - 4) + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'spiralall') {   /* 泛神论：环中螺（万物即神） */
      g += '<circle r="58" stroke-width="2.4" opacity="0.85"/>';
      var sp = 'M0 0'; for (var t = 0; t < 6.28; t += 0.22) { var rr = 4 + t * 8; sp += ' L' + (Math.cos(t) * rr).toFixed(1) + ' ' + (Math.sin(t) * rr).toFixed(1); }
      g += '<path d="' + sp + '" stroke-width="2" opacity="0.8"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'deductree') {   /* 演绎主义：公理推出诸结论 */
      g += '<circle cy="-52" r="12" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.4"/>';
      var lx = [-48, 0, 48];
      for (i = 0; i < 3; i++) { g += '<line x1="0" y1="-40" x2="' + lx[i] + '" y2="14" stroke-width="1.6" opacity="0.55"/><circle cx="' + lx[i] + '" cy="26" r="10" stroke-width="2.2" opacity="0.85"/><line x1="' + lx[i] + '" y1="36" x2="' + lx[i] + '" y2="58" stroke-width="1.4" opacity="0.5"/>'; }
      return '<g transform="translate(' + C + ',' + (CY - 4) + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'patchwork') {   /* 新反动主义：Patchwork 拼图 */
      g += '<rect x="-56" y="-56" width="52" height="52" stroke-width="2.2" opacity="0.85"/><rect x="4" y="-56" width="52" height="52" stroke-width="2.2" opacity="0.85"/><rect x="-56" y="4" width="52" height="52" stroke-width="2.2" opacity="0.85"/><rect x="4" y="4" width="52" height="52" stroke-width="2.2" opacity="0.85" fill="' + col + '" fill-opacity="0.12"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'relarrows') {   /* 相对主义：双向回旋 */
      g += '<path d="M0 -56 A56 56 0 1 1 -40 -40" stroke-width="2.6" opacity="0.85"/><path d="M0 -56 L-14 -48 M0 -56 L-2 -40" stroke-width="2.6" opacity="0.9"/><path d="M0 56 A56 56 0 1 1 40 40" stroke-width="2.6" opacity="0.85"/><path d="M0 56 L14 48 M0 56 L2 40" stroke-width="2.6" opacity="0.9"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'halospark') {   /* 唯心主义：光环与灵光 */
      g += '<ellipse cx="0" cy="-44" rx="46" ry="14" stroke-width="2.4" opacity="0.85"/><path d="M0 6 L0 50 M-22 28 L22 28 M-15 13 L15 43 M15 13 L-15 43" stroke-width="2.2" opacity="0.8" stroke-linecap="round"/>';
      return '<g transform="translate(' + C + ',' + (CY + 4) + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    if (motif === 'geode') {       /* 唯物主义：晶石与地层 */
      g += '<path d="M0 -50 L40 -26 L40 22 L0 46 L-40 22 L-40 -26 Z" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.08"/><path d="M0 -50 L0 46 M-40 -26 L40 22 M40 -26 L-40 22" stroke-width="1.2" opacity="0.4"/><path d="M-52 58 L52 58 M-46 70 L46 70" stroke-width="2" opacity="0.5"/>';
      return '<g transform="translate(' + C + ',' + (CY - 4) + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'flagwheat') {   /* 民族主义：旗与麦穗 */
      g += '<line x1="-40" y1="-70" x2="-40" y2="70" stroke-width="2.6" opacity="0.85"/><path d="M-40 -66 L44 -66 L28 -40 L44 -14 L-40 -14" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.08"/><path d="M24 60 L24 12 M24 22 Q12 18 8 26 M24 22 Q36 18 40 26 M24 36 Q12 32 8 40 M24 36 Q36 32 40 40" stroke-width="2" opacity="0.8"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'astrolabe') {   /* 理性主义：星盘 */
      g += '<circle r="56" stroke-width="2.6" opacity="0.9"/><circle r="38" stroke-width="1.4" opacity="0.5"/><line x1="-56" y1="14" x2="56" y2="-14" stroke-width="2.4" opacity="0.8"/><circle r="5" fill="' + col + '" stroke="none" opacity="0.8"/><path d="M30 -34 L34 -24 L44 -22 L36 -15 L39 -5 L30 -11 L21 -5 L24 -15 L16 -22 L26 -24 Z" stroke-width="1.6" opacity="0.85" fill="' + col + '" fill-opacity="0.3"/>';
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none" stroke-linejoin="round">' + g + '</g>';
    }
    if (motif === 'ideacity') {    /* 乌托邦主义：理想城 */
      g += '<circle r="56" stroke-width="2.4" opacity="0.85"/><circle r="16" stroke-width="2.4" opacity="0.9" fill="' + col + '" fill-opacity="0.15"/>';
      for (i = 0; i < 8; i++) { a = i * 45 * Math.PI / 180; g += '<line x1="' + (Math.cos(a) * 16).toFixed(1) + '" y1="' + (Math.sin(a) * 16).toFixed(1) + '" x2="' + (Math.cos(a) * 56).toFixed(1) + '" y2="' + (Math.sin(a) * 56).toFixed(1) + '" stroke-width="1.4" opacity="0.5"/>'; }
      return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' + g + '</g>';
    }
    /* 默认：菱形徽记 + 同心细环 */
    return '<g transform="translate(' + C + ',' + CY + ')" stroke="' + col + '" fill="none">' +
      '<circle r="92" stroke-width="1" opacity="0.25"/>' +
      '<path d="M0,-64 L64,0 L0,64 L-64,0 Z" stroke-width="2" opacity="0.75"/>' +
      '<path d="M0,-34 L34,0 L0,34 L-34,0 Z" fill="' + col + '" fill-opacity="0.18" stroke-width="1.4"/>' +
      '</g>';
  }

  function designIdeologyCover(ideo, withName) {
    var th = ideo.theme || {};
    var a1 = th.accent || '#d8b25a';
    var a2 = th.accent2 || '#5a4a2f';
    var W = 400, H = 600;
    var bgTop = mixHex(a2, '#08070b', 0.42);
    var bgBot = mixHex(a2, '#08070b', 0.8);
    var line = mixHex(a1, '#08070b', 0.4);
    var spaced = ideo.name ? ideo.name.split('').join(' ') : '';
    var nameSize = spaced.length > 8 ? 27 : (spaced.length > 6 ? 32 : 38);
    var glow = mixHex(a1, '#000000', 0.1);
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
        '<defs>' +
          '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + bgTop + '"/><stop offset="1" stop-color="' + bgBot + '"/></linearGradient>' +
          '<radialGradient id="aura" cx="0.5" cy="0.4" r="0.7">' +
            '<stop offset="0" stop-color="' + a1 + '" stop-opacity="0.26"/>' +
            '<stop offset="0.55" stop-color="' + a1 + '" stop-opacity="0.07"/>' +
            '<stop offset="1" stop-color="' + a1 + '" stop-opacity="0"/></radialGradient>' +
          '<radialGradient id="vig" cx="0.5" cy="0.42" r="0.88">' +
            '<stop offset="0.55" stop-color="#000" stop-opacity="0"/>' +
            '<stop offset="1" stop-color="#000" stop-opacity="0.62"/></radialGradient>' +
          '<filter id="soft" x="-60%" y="-60%" width="220%" height="220%">' +
            '<feGaussianBlur stdDeviation="30"/></filter>' +
        '</defs>' +
        '<rect width="' + W + '" height="' + H + '" fill="url(#bg)"/>' +
        /* 横向细线：像纸张/铜版纹理 */
        (function () { var s = ''; for (var y = 26; y < H; y += 7) s += '<rect y="' + y + '" width="' + W + '" height="1" fill="' + line + '" opacity="0.06"/>'; return s; })() +
        '<rect width="' + W + '" height="' + H + '" fill="url(#aura)"/>' +
        '<circle cx="200" cy="256" r="118" fill="' + a1 + '" opacity="0.14" filter="url(#soft)"/>' +
        /* 徽章环：细双环 + 刻度，托住中央纹样，让封面像一枚徽章 */
        (function () {
          var g = '<g fill="none" stroke="' + a1 + '" transform="translate(200 256)">' +
            '<circle r="152" stroke-width="1" opacity="0.28"/>' +
            '<circle r="140" stroke-width="0.8" opacity="0.16" stroke-dasharray="2 6"/>';
          for (var k = 0; k < 48; k++) {
            var ang = k * 7.5 * Math.PI / 180, big = k % 6 === 0, r1 = big ? 152 : 152, r2 = big ? 162 : 158;
            g += '<line x1="' + (Math.cos(ang) * r1).toFixed(1) + '" y1="' + (Math.sin(ang) * r1).toFixed(1) +
                 '" x2="' + (Math.cos(ang) * r2).toFixed(1) + '" y2="' + (Math.sin(ang) * r2).toFixed(1) +
                 '" stroke-width="' + (big ? 1.4 : 0.8) + '" opacity="' + (big ? 0.5 : 0.26) + '"/>';
          }
          return g + '</g>';
        })() +
        motifDeco(th.motif, a1) +
        '<rect width="' + W + '" height="' + H + '" fill="url(#vig)"/>' +
        /* 双层细框 + 四角刻度 */
        '<rect x="16" y="16" width="' + (W - 32) + '" height="' + (H - 32) + '" fill="none" stroke="' + a1 + '" stroke-width="1" opacity="0.4"/>' +
        '<rect x="24" y="24" width="' + (W - 48) + '" height="' + (H - 48) + '" fill="none" stroke="' + a1 + '" stroke-width="1" opacity="0.16"/>' +
        '<path d="M16,44 L16,16 L44,16 M' + (W - 44) + ',16 L' + (W - 16) + ',16 L' + (W - 16) + ',44 M' + (W - 16) + ',' + (H - 44) + ' L' + (W - 16) + ',' + (H - 16) + ' L' + (W - 44) + ',' + (H - 16) + ' M44,' + (H - 16) + ' L16,' + (H - 16) + ' L16,' + (H - 44) + '" fill="none" stroke="' + a1 + '" stroke-width="2.4" opacity="0.85"/>' +
        /* 饰线菱形（withName=false 时不画字，名称交给卡片铭牌，避免重复） */
        '<g stroke="' + a1 + '" fill="none">' +
          '<line x1="112" y1="496" x2="178" y2="496" stroke-width="1" opacity="0.55"/>' +
          '<line x1="222" y1="496" x2="288" y2="496" stroke-width="1" opacity="0.55"/>' +
          '<path d="M200,488 L208,496 L200,504 L192,496 Z" fill="' + a1 + '" stroke="none" opacity="0.9"/>' +
        '</g>' +
        (withName !== false
          ? '<text x="200" y="538" text-anchor="middle" font-family="Noto Serif SC,Source Han Serif SC,STSong,SimSun,serif" font-size="' + nameSize + '" font-weight="700" letter-spacing="4" fill="' + a1 + '">' + spaced + '</text>'
          : '') +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function paintTheme(el, entry) {
    var t = themeColors(entry);
    setAcc(el, t.a1);
    if (t.a2) el.style.setProperty('--ca2', t.a2);
    if (t.hi) el.style.setProperty('--ch', t.hi);
    return el;
  }

  /* ============ 首字母索引 ============ */
  function groupByInitial(list, getInitial) {
    var groups = {};
    list.forEach(function (item) {
      var L = (getInitial(item) || '#').toUpperCase().charAt(0);
      if (!/[A-Z]/.test(L)) L = '#';
      (groups[L] = groups[L] || []).push(item);
    });
    return Object.keys(groups).sort().map(function (L) {
      return { letter: L, items: groups[L] };
    });
  }

  function renderIndex() {
    var box = $('#galIndex');
    var empty = $('#galEmpty');
    box.innerHTML = '';

    var list, getInitial, renderItem;
    if (state.cat === 'ideology') {
      list = DATA;
      getInitial = function (e) { return e.initial; };
      renderItem = renderIdeologyCard;
    } else {
      list = allCharacters();
      getInitial = function (p) { return p.ch.initial; };
      renderItem = renderCharacterCard;
    }

    empty.hidden = list.length > 0;
    if (!list.length) return;

    var groups = groupByInitial(list, getInitial);
    groups.forEach(function (g) {
      var sec = document.createElement('section');
      sec.className = 'gal-letter-group';
      sec.id = 'galLetter-' + g.letter;
      sec.innerHTML = '<h2 class="gal-letter">' + g.letter + '</h2>' +
        '<div class="gal-grid-inner"></div>';
      var inner = sec.querySelector('.gal-grid-inner');
      g.items.forEach(function (item, i) {
        var fig = renderItem(item);
        fig.style.opacity = '0';
        fig.style.transform = 'translateY(18px)';
        inner.appendChild(fig);
        setTimeout(function () {
          fig.style.transition = 'opacity .6s cubic-bezier(.22,1,.36,1), transform .6s cubic-bezier(.22,1,.36,1)';
          fig.style.opacity = '1';
          fig.style.transform = 'none';
        }, 40 + Math.min(i, 8) * 55);
      });
      box.appendChild(sec);
    });

    // 字母导航
    var nav = document.createElement('nav');
    nav.className = 'gal-letter-nav';
    nav.setAttribute('aria-label', '首字母导航');
    nav.innerHTML = groups.map(function (g) {
      var letter = esc(g.letter);
      return '<button type="button" data-letter-target="galLetter-' + letter + '" aria-label="跳到 ' + letter + ' 开头的项目">' + letter + '</button>';
    }).join('');
    nav.addEventListener('click', function (ev) {
      var button = ev.target.closest('button[data-letter-target]');
      if (!button || !nav.contains(button)) return;
      ev.preventDefault();
      ev.stopPropagation();
      var target = document.getElementById(button.dataset.letterTarget);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    box.insertBefore(nav, box.firstChild);
  }

  /* 卡片：意识形态 */
  function renderIdeologyCard(ideo) {
    var fig = document.createElement('figure');
    fig.className = 'gal-item';
    fig.tabIndex = 0;
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', ideo.name);
    var cCount = (ideo.characters || []).length;
    fig.innerHTML =
      '<div class="gal-thumb">' + (ideoCover(ideo, false)
        ? '<img src="' + esc(ideoCover(ideo, false)) + '" alt="' + esc(ideo.name) + '" loading="lazy">'
        : '<span class="gal-thumb-empty">暂无图</span>') +
        (cCount ? '<span class="gal-thumb-badge">' + cCount + ' 角色</span>' : '') +
      '</div>' +
      '<figcaption class="gal-name">' + esc(ideo.name) + '</figcaption>';
    paintTheme(fig, ideo, ideoCover(ideo));
    fig.addEventListener('click', function () { openIdeology(ideo); });
    fig.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openIdeology(ideo); }
    });
    return fig;
  }

  /* 卡片：角色 */
  function renderCharacterCard(pair) {
    var fig = document.createElement('figure');
    fig.className = 'gal-item';
    fig.tabIndex = 0;
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', pair.ch.name);
    fig.innerHTML =
      '<div class="gal-thumb">' + (chCover(pair)
        ? '<img src="' + esc(chCover(pair)) + '" alt="' + esc(pair.ch.name) + '" loading="lazy">'
        : '<span class="gal-thumb-empty">暂无图</span>') +
        '<span class="gal-sub">' + esc(pair.ideo.name) + '</span>' +
      '</div>' +
      '<figcaption class="gal-name">' + esc(pair.ch.name) + '</figcaption>';
    paintTheme(fig, mergedTheme(pair.ch, pair.ideo), chCover(pair));
    fig.addEventListener('click', function () {
      /* 触屏无 hover：轻点先浮现意识形态横框，再点才进详情（等效双击） */
      if (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches && !fig.classList.contains('show-sub')) {
        var prev = document.querySelector('.gal-item.show-sub');
        if (prev && prev !== fig) prev.classList.remove('show-sub');
        fig.classList.add('show-sub');
        return;
      }
      openCharacter(pair);
    });
    fig.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openCharacter(pair); }
    });
    return fig;
  }

  /* ============ 意识形态内页（旗下角色） ============ */
  function openIdeology(ideo) {
    var key = layerKey('ideology', ideo.id);
    var restoreY = layerScrolls[key] || 0;               /* 先取该层上次离开位置，防被随后 scrollTo(0) 覆盖 */
    layerScrolls[currentLayer] = window.scrollY || 0;    /* 存离开层的位置 */
    currentLayer = key;
    var box = $('#galDetailBody');
    var chs = ideo.characters || [];

    var chHtml = chs.map(function (c) {
      var cover = c.images && c.images.length ? imgThumb(c.images[0]) : '';
      return (
        '<figure class="ide-ch" data-ch="' + esc(c.id) + '" tabindex="0" role="button" aria-label="' + esc(c.name) + '">' +
          '<div class="ide-ch-thumb">' + (cover
            ? '<img src="' + esc(cover) + '" alt="' + esc(c.name) + '" loading="lazy" decoding="async">'
            : '<span class="gal-thumb-empty">暂无图</span>') +
          '</div>' +
          '<figcaption>' + esc(c.name) + '</figcaption>' +
        '</figure>'
      );
    }).join('');

    box.innerHTML =
      '<nav class="gal-crumbs"><a href="#" id="crumbHome">画廊</a><span class="crumb-sep">›</span><span>' + esc(ideo.name) + '</span></nav>' +
      '<h2 class="gal-detail-name">' + esc(ideo.name) + '</h2>' +
      '<p class="gal-detail-kind">意识形态' + (chs.length ? ' · ' + chs.length + ' 名角色' : '') + '</p>' +
      (ideo.desc ? '<div class="ch-body ideo-desc">' + textHtml(ideo.desc) + '</div>' : '') +
      (chs.length
        ? '<div class="ide-ch-grid">' + chHtml + '</div>'
        : '<div class="void-note" style="margin-top:1.2rem"><span class="diamond"></span><span>暂无绑定角色</span></div>') +
      versionFold(ideo.id, 'ideo');

    // 角色卡点击 → 角色相册
    $$('.ide-ch', box).forEach(function (el) {
      el.addEventListener('click', function () {
        var pair = findCharacter(el.dataset.ch);
        if (pair) openCharacter(pair, ideo);
      });
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          var pair = findCharacter(el.dataset.ch);
          if (pair) openCharacter(pair, ideo);
        }
      });
    });
    $('#crumbHome').addEventListener('click', function (e) { e.preventDefault(); closeDetail(); });

    paintStage(mergedTheme(ideo, null), ideoCover(ideo));
    showDetailPage('ideology', ideo.id);
    restoreScroll(restoreY);   /* 首次进入 restoreY=0 自动跳过；返回则回到上次位置 */
  }

  /* ============ 详情整页 显示/隐藏 ============ */
  var suppressPush = false;   /* popstate 还原时不再重复写历史 */

  /* 左上角返回键：优先走浏览器历史（浏览位置都在），
     没有站内历史可退时才降级为直接关闭详情页 */
  function backOut() {
    if (state.canGoBack) {
      history.back();
      return;
    }
    closeDetail();
  }

  /* 返回键显示/隐藏 + 滚动进度保存恢复
     最简方案：每个"层"（列表 / 每个意识形态内页 / 每个角色页）各自存自己的滚动位置。
     离开某层时存，回到某层时取。互相不干扰，也与浏览器历史解耦。 */
  var layerScrolls = {};        /* { 层key: 该层离开时的scrollY } */
  var currentLayer = null;      /* 当前所在层；稍后在 init 里按 listKey() 初始化 */
  function listKey() { return 'list:' + state.cat; }
  function layerKey(kind, id) { return (kind === 'character' ? 'char:' : 'ideo:') + id; }
  /* 列表可见时（非详情层），切换分类后同步 currentLayer */
  function syncListLayer() {
    if ($('#galDetailPage').hidden) currentLayer = listKey();
  }
  window.addEventListener('scroll', function () {
    if (!currentLayer) return;
    layerScrolls[currentLayer] = window.scrollY || 0;
  }, { passive: true });

  function showBackBtn(on) {
    var b = $('#detailBack');
    if (b) b.hidden = !on;
  }

  /* 恢复滚动：一次性，等一帧布局稳定后滚到位即可，绝不循环（循环会在滚不到
     目标时反复干扰用户操作）。滚不动就是内容不够长，钳到最大本身就是正确结果。 */
  function restoreScroll(target) {
    if (!target) return;
    setTimeout(function () { window.scrollTo({ top: target, behavior: 'auto' }); }, 60);
  }

  function pushDetail(kind, id) {
    var u = new URL(window.location.href);
    u.searchParams.set('cat', kind || state.cat);
    if (id) u.searchParams.set('open', id); else u.searchParams.delete('open');
    history.pushState({ gal: kind, id: id }, '', u);
    state.canGoBack = true;
  }

  function showDetailPage(kind, id) {
    var pg = $('#galDetailPage');
    $$('.gal-toolbar, #galIndex, #galEmpty', document).forEach(function (el) {
      el.hidden = true;
    });
    var head = $('.page-head');
    if (head) head.style.display = 'none';
    pg.hidden = false;
    pg.classList.add('show');
    showBackBtn(true);
    var topBtn = $('#galleryToTop');
    if (topBtn) topBtn.hidden = true;
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (!suppressPush) {
      try { pushDetail(kind, id); } catch (e) {}
    }
  }

  function closeDetail(noPush) {
    var pg = $('#galDetailPage');
    pg.classList.remove('show');
    pg.hidden = true;
    showBackBtn(false);
    $$('.gal-toolbar').forEach(function (el) { el.hidden = false; });
    var head = $('.page-head');
    if (head) head.style.display = '';
    var index = $('#galIndex');
    if (index) index.hidden = false;
    renderIndex();   // 重新显示列表并渲染
    currentLayer = listKey();
    var target = layerScrolls[currentLayer] || 0;
    restoreScroll(target);
    if (!noPush && !suppressPush) {
      try {
        var u = new URL(window.location.href);
        u.searchParams.delete('open');
        history.pushState({ gal: null }, '', u);
      } catch (e) {}
    }
  }

  /* 按 URL 还原页面（首次进入 & 前进/后退共用）。恢复滚动已由 open* 内部完成 */
  function resolveFromUrl() {
    var qs = new URLSearchParams(window.location.search);
    var qOpen = qs.get('open');
    if (qOpen) {
      var ideo = findIdeology(qOpen);
      if (ideo) { openIdeology(ideo); return; }
      var pair = findCharacter(qOpen);
      if (pair) { openCharacter(pair); return; }
    }
    if (!$('#galDetailPage').hidden) closeDetail(true);
  }

  /* 浏览器前进/后退：按 URL 重新渲染对应页面 */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';   /* 原生恢复与渲染时序打架，接管 */
  window.addEventListener('popstate', function () {
    suppressPush = true;
    try { resolveFromUrl(); } finally { suppressPush = false; }
  });
  /* 每次真实回退后重新评估：URL 已无 open 参数 → 已退回列表，返回键降级 */
  window.addEventListener('popstate', function () {
    state.canGoBack = /[?&]open=/.test(window.location.search);
  });

  /* ============ 角色界面：原图 + 后续文本 ============ */
  var album = { idx: 0 };

  /* 还没写人设的角色：右栏给一块克制的占位（所属意识形态 + 一句释义 + 整理中），避免大片空白 */
  function pendingHtml(pair, e) {
    if (e.bio || (e.info && e.info.length) || e.desc || e.text) return '';
    var ideo = pair.ideo || {};
    var first = String(ideo.desc || '').split(/\n\s*\n/)[0].replace(/\s+/g, ' ');
    var cut = first.length > 96 ? first.slice(0, 96).replace(/[，、；：\s]+$/, '') + '…' : first;
    return '<div class="ch-pending">' +
      '<dl class="ch-facts"><div class="fact-row"><dt>意识形态</dt><dd>' + esc(ideo.name || '') + '</dd></div></dl>' +
      (cut ? '<p class="ch-pending-def">' + esc(cut) + '</p>' : '') +
      '<p class="ch-pending-note"><span class="diamond"></span>人物设定整理中</p>' +
    '</div>';
  }
  function openCharacter(pair, fromIdeo) {
    var key = layerKey('character', pair.ch.id);
    var restoreY = layerScrolls[key] || 0;               /* 先取该层上次离开位置 */
    layerScrolls[currentLayer] = window.scrollY || 0;
    currentLayer = key;
    album.idx = 0;
    renderAlbum(pair, fromIdeo);
    paintStage(mergedTheme(pair.ch, pair.ideo), chCover(pair) || imgFull(pair.ch.images && pair.ch.images[0]));
    showDetailPage('character', pair.ch.id);
    restoreScroll(restoreY);
  }

  /* 正文：空行分段，段内换行保留 */
  function textHtml(t) {
    return String(t).split(/\n\s*\n/).map(function (para) {
      return '<p>' + esc(para).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  /* 角色页下方板块：杂图（统一比例对齐，带序号与从文件名取的标题，点击用站内灯箱看大图） */
  function charMisc(e) {
    if (!e.misc || !e.misc.length) return '';
    return '<section class="ch-misc">' +
      '<h3 class="ch-sec-title">杂图</h3>' +
      '<div class="ch-misc-grid">' + e.misc.map(function (u, idx) {
        var title = miscTitle(u);
        var no = (idx + 1 < 10 ? '0' : '') + (idx + 1);
        return '<button type="button" class="ch-misc-item" data-full="' + esc(u) + '" aria-label="' + esc(title) + '">' +
                 '<span class="ch-misc-no">' + no + '</span>' +
                 '<img src="' + esc(u) + '" alt="' + esc(title) + '" loading="lazy" decoding="async">' +
                 '<span class="ch-misc-cap">' + esc(title) + '</span>' +
               '</button>';
      }).join('') + '</div>' +
    '</section>';
  }

  /* 从文件名取标题：去路径与扩展名，取最后一段（如 …_表情包横屏Q版 → 表情包横屏Q版） */
  function miscTitle(u) {
    var base = String(u).split('/').pop().replace(/\.[^.]+$/, '');
    var parts = base.split('_');
    return parts.length > 1 ? parts[parts.length - 1] : base;
  }

  /* ===== 历史版本 / 其他版本：可折叠、点开才加载、带标注 ===== */
  var _verBound = false;
  function ensureVerHandlers() {
    if (_verBound) return; _verBound = true;
    document.addEventListener('toggle', function (ev) {
      var d = ev.target;
      if (!d || !d.classList || !d.classList.contains('ver-fold') || !d.open) return;
      var grid = d.querySelector('.ver-fold-grid');
      if (!grid || grid.getAttribute('data-built')) return;
      var scope = d.getAttribute('data-ver-scope'), id = d.getAttribute('data-ver-id');
      var src = (window.VERSION_DATA || {})[scope === 'char' ? 'chars' : 'ideologies'] || {};
      var list = src[id] || [];
      grid.innerHTML = list.map(function (v) {
        return '<button type="button" class="ver-item" data-full="' + esc(v.url) + '" data-label="' + esc(v.label) + '" data-note="' + esc(v.note || '') + '" aria-label="' + esc(v.label) + '">' +
                 '<span class="ver-tag">' + esc(v.label) + '</span>' +
                 '<img src="' + esc(v.url) + '" alt="' + esc(v.label) + '" loading="lazy" decoding="async">' +
               '</button>';
      }).join('');
      grid.setAttribute('data-built', '1');
    }, true);
    document.addEventListener('click', function (ev) {
      var it = ev.target && ev.target.closest ? ev.target.closest('.ver-item') : null;
      if (it) { ev.preventDefault(); openVerView(it.getAttribute('data-full'), it.getAttribute('data-label'), it.getAttribute('data-note')); }
    });
  }

  /* 版本图查看：页面内小窗口（非全屏），下方留 标注+说明 区域 */
  function ensureVerView() {
    var vv = document.getElementById('galVerView');
    if (vv) return vv;
    vv = document.createElement('div');
    vv.id = 'galVerView';
    vv.className = 'ver-view';
    vv.hidden = true;
    vv.innerHTML = '<div class="ver-view-card" role="dialog" aria-modal="true">' +
      '<div class="ver-view-head"><span class="ver-view-tag"></span><button type="button" class="ver-view-x" id="verViewX" aria-label="关闭">×</button></div>' +
      '<div class="ver-view-body">' +
        '<div class="ver-view-img"><img alt=""></div>' +
        '<aside class="ver-view-side"><h4 class="ver-view-side-h">站主说</h4><p class="ver-view-note"></p></aside>' +
      '</div>' +
      '</div>';
    document.body.appendChild(vv);
    vv.addEventListener('click', function (ev) { if (ev.target === vv) closeVerView(); });
    vv.querySelector('#verViewX').addEventListener('click', closeVerView);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !vv.hidden) closeVerView(); });
    return vv;
  }
  function openVerView(url, label, note) {
    if (!url) return;
    var vv = ensureVerView();
    var pg = document.getElementById('galDetailPage');
    if (pg) { var cs = getComputedStyle(pg); var cad = cs.getPropertyValue('--ca-d').trim(), cal = cs.getPropertyValue('--ca-l').trim(); var ca2 = cs.getPropertyValue('--ca2').trim(); if (cad) vv.style.setProperty('--ca-d', cad); if (cal) vv.style.setProperty('--ca-l', cal); if (ca2) vv.style.setProperty('--ca2', ca2); var chh = cs.getPropertyValue('--ch').trim(); if (chh) vv.style.setProperty('--ch', chh); }
    vv.querySelector('img').src = url;
    vv.querySelector('.ver-view-tag').textContent = label || '';
    var side = vv.querySelector('.ver-view-side');
    vv.querySelector('.ver-view-note').textContent = note || '';
    side.style.display = note ? '' : 'none';
    vv.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeVerView() {
    var vv = document.getElementById('galVerView');
    if (vv) { vv.hidden = true; document.body.style.overflow = ''; }
  }
  function versionFold(id, scope) {
    var src = (window.VERSION_DATA || {})[scope === 'char' ? 'chars' : 'ideologies'] || {};
    var list = src[id];
    if (!list || !list.length) return '';
    ensureVerHandlers();
    return '<details class="ver-fold" data-ver-scope="' + scope + '" data-ver-id="' + esc(id) + '">' +
      '<summary class="ver-fold-sum">历史版本 · 其他版本<span class="ver-fold-n">' + list.length + '</span></summary>' +
      '<div class="ver-fold-grid"></div></details>';
  }

  /* 站内灯箱：全屏看大图，点图 / Esc 关闭（不跳新标签） */
  function ensureLightbox() {
    var lb = document.getElementById('galLightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.id = 'galLightbox';
    lb.className = 'gal-lightbox';
    lb.hidden = true;
    lb.innerHTML = '<img alt="查看大图">';
    document.body.appendChild(lb);
    lb.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !lb.hidden) closeLightbox();
    });
    return lb;
  }
  function openLightbox(src) {
    if (!src) return;
    var lb = ensureLightbox();
    lb.querySelector('img').src = src;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    var lb = document.getElementById('galLightbox');
    if (lb) { lb.hidden = true; document.body.style.overflow = ''; }
  }

  function renderAlbum(pair, fromIdeo) {
    var e = pair.ch;
    var ideo = fromIdeo || pair.ideo;
    var imgs = e.images || [];
    var total = imgs.length;
    var cur = total ? imgs[album.idx] : null;
    /* 角色界面显示原图：长按保存 / 右键新窗口拿到的就是它 */
    var src = cur ? imgFull(cur) : '';
    var caption = (cur && typeof cur === 'object' && cur.caption) ? cur.caption : '';

    var counter = total > 1
      ? '<div class="gal-album-nav">' +
          '<button type="button" class="alb-btn" id="albPrev"' + (album.idx === 0 ? ' disabled' : '') + '>‹</button>' +
          '<span class="alb-count">' + (album.idx + 1) + ' / ' + total + '</span>' +
          '<button type="button" class="alb-btn" id="albNext"' + (album.idx === total - 1 ? ' disabled' : '') + '>›</button>' +
        '</div>'
      : '';

    $('#galDetailBody').innerHTML =
      '<nav class="gal-crumbs"><a href="#" id="crumbHome">画廊</a>' +
        '<span class="crumb-sep">›</span><a href="#" id="crumbIdeo">' + esc(ideo.name) + '</a>' +
        '<span class="crumb-sep">›</span><span>' + esc(e.name) + '</span></nav>' +

      '<div class="ch-layout">' +

        /* 左：立绘（原图，等比完整显示，不裁切） */
        '<div class="ch-visual">' +
          '<figure class="ch-figure">' + (src
            ? '<img class="ch-fullimg" src="' + esc(src) + '" alt="' + esc(e.name) + '" decoding="async">'
            : '<div class="void-note"><span class="diamond"></span><span>暂无图</span></div>') +
            (caption ? '<figcaption class="ch-cap">' + esc(caption) + '</figcaption>' : '') +
          '</figure>' +
          counter +
        '</div>' +

        /* 右：名字 + 介绍 */
        '<div class="ch-info">' +
          '<header class="ch-head">' +
            '<h2 class="ch-name" style="--name-ch:' + Math.max(4, e.name.length + 1) + '">' + esc(e.name) + '</h2>' +
          '</header>' +
          (e.bio ? '<div class="ch-bio">' + textHtml(e.bio) + '</div>' : '') +
          (e.info && e.info.length ? '<dl class="ch-facts">' + e.info.map(function (f) { return '<div class="fact-row"><dt>' + esc(f.k) + '</dt><dd>' + linkifyPlaces(f.v) + '</dd></div>'; }).join('') + '</dl>' : '') +
          (e.desc ? '<div class="ch-body ch-body-note">' + textHtml(e.desc) + '</div>' : '') +
          (e.text ? '<div class="ch-body">' + textHtml(e.text) + '</div>' : '') +
          pendingHtml(pair, e) +
        '</div>' +

      '</div>' +

      charMisc(e) + versionFold(e.id, 'char');

    $('#crumbHome').addEventListener('click', function (ev) { ev.preventDefault(); closeDetail(); });
    $('#crumbIdeo').addEventListener('click', function (ev) { ev.preventDefault(); openIdeology(ideo); });

    $$('.ch-misc-item', $('#galDetailBody')).forEach(function (el) {
      el.addEventListener('click', function () { openLightbox(el.getAttribute('data-full')); });
    });

    $$('.loc-link', $('#galDetailBody')).forEach(function (el) {
      el.addEventListener('click', function () { openLocView(el.getAttribute('data-loc')); });
    });

    if (total > 1) {
      $('#albPrev').addEventListener('click', function () {
        if (album.idx > 0) { album.idx--; renderAlbum(pair, ideo); fitChInfo(); }
      });
      $('#albNext').addEventListener('click', function () {
        if (album.idx < total - 1) { album.idx++; renderAlbum(pair, ideo); fitChInfo(); }
      });
    }

    fitChInfo();   /* 文本量自适应初调 */
  }

  /* ===== 地点志：把 属地/身份 里的地名做成可点击链接，点开看介绍 ===== */
  function linkifyPlaces(v) {
    return String(v).split('·').map(function (part) {
      var name = part.trim();
      var key = name;
      if (typeof LOCATION_DATA !== 'undefined' && !LOCATION_DATA[key] && typeof LOCATION_ALIAS !== 'undefined' && LOCATION_ALIAS[key]) key = LOCATION_ALIAS[key];
      if (typeof LOCATION_DATA !== 'undefined' && LOCATION_DATA[key]) {
        return '<a class="loc-link" data-loc="' + esc(key) + '">' + esc(name) + '</a>';
      }
      return esc(part);
    }).join(' · ');
  }
  function openLocView(name) {
    var d = (typeof LOCATION_DATA !== 'undefined' && LOCATION_DATA[name]) ? LOCATION_DATA[name] : null;
    if (!d) return;
    var el = document.getElementById('locView');
    if (!el) { el = document.createElement('div'); el.id = 'locView'; el.className = 'loc-view'; document.body.appendChild(el); }
    var parentLine = d.parent ? '<p class="loc-view-parent">隶属 · <a class="loc-link" data-loc="' + esc(d.parent) + '">' + esc(d.parent) + '</a></p>' : '';
    el.innerHTML = '<div class="loc-view-card"><div class="loc-view-head"><span class="loc-view-kind">' + esc(d.kind || '地点') + '</span><button class="loc-view-x" aria-label="关闭">×</button></div><h3 class="loc-view-name">' + esc(name) + '</h3><p class="loc-view-desc">' + esc(d.desc || '') + '</p>' + parentLine + '</div>';
    var src = document.getElementById('galDetailPage');
    if (src) { var cs = getComputedStyle(src); el.style.setProperty('--ca-d', cs.getPropertyValue('--ca-d')); el.style.setProperty('--ca-l', cs.getPropertyValue('--ca-l')); el.style.setProperty('--ca2', cs.getPropertyValue('--ca2')); }
    el.classList.add('show');
    el.querySelector('.loc-view-x').onclick = function () { el.classList.remove('show'); };
    el.onclick = function (ev) { if (ev.target === el) el.classList.remove('show'); };
    var pl = el.querySelector('.loc-view-parent .loc-link');
    if (pl) pl.addEventListener('click', function () { openLocView(pl.getAttribute('data-loc')); });
  }

  /* ===== 角色页右栏文本自适应 =====
     目标：右栏内容高度 ≤ 立绘高度（左右分栏时）。
     文本放不下就按比例缩字号（只缩不放），保底 0.72rem；
     图片加载后会再校一次（立绘高度此时才真实）。 */
  var CH_FS_MIN = 11.5;   /* px，最低保底字号 */
  function fitChInfo() {
    var layout = document.querySelector('.ch-layout');
    var info = document.querySelector('.ch-info');
    var visual = document.querySelector('.ch-visual');
    if (!layout || !info || !visual) return;
    /* 手机窄屏(<560px)左右栏仍并排，同样适用；无立绘时跳过 */
    var fig = visual.querySelector('.ch-figure');
    var img = fig && fig.querySelector('.ch-fullimg');
    if (!img) return;

    /* 变量设在右栏容器上：作者的话 / 人物介绍等所有 .ch-body 一起继承 */
    info.style.removeProperty('--body-fs');

    var tryFit = function () {
      var figH = fig.getBoundingClientRect().height;
      if (!figH || !info.scrollHeight) return;
      if (info.scrollHeight <= figH + 2) return;   /* 放得下，用默认字号 */
      var rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize);
      var fs = parseFloat(getComputedStyle(info).getPropertyValue('--body-fs')) || rootFs * 0.93;
      /* 迭代逼近：缩字→重量→再缩（段距/行高非线性，一轮比例算不准），最多 12 轮 */
      for (var i = 0; i < 12; i++) {
        var ratio = figH / info.scrollHeight;
        if (ratio >= 1) break;
        fs = Math.max(CH_FS_MIN, Math.floor(fs * ratio * 20) / 20);
        info.style.setProperty('--body-fs', fs.toFixed(2) + 'px');
        if (info.scrollHeight <= figH + 2) break;  /* 放下了 */
        if (fs <= CH_FS_MIN) break;                /* 到保底：交给页面纵向滚动 */
      }
    };

    /* 立绘已缓存时高度即刻可用；否则加载完再校 */
    if (img.complete && img.naturalHeight) requestAnimationFrame(tryFit);
    else img.addEventListener('load', tryFit, { once: true });
    requestAnimationFrame(function () { requestAnimationFrame(tryFit); });
  }

  /* ============ 分类切换 ============ */
  function setCat(cat) {
    state.cat = cat;
    renderIndex();
    syncListLayer();
  }

  /* ============ 启动 ============ */
  function init() {
    $$('[data-gal-cat]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        $$('[data-gal-cat]').forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
        setCat(chip.dataset.galCat);
      });
    });
    document.addEventListener('keydown', function (e) {
      if ($('#galDetailPage').hidden) return;
      if (e.key === 'Escape') closeDetail();
      if (e.key === 'ArrowLeft') { var b1 = $('#albPrev'); if (b1 && !b1.disabled) b1.click(); }
      if (e.key === 'ArrowRight') { var b2 = $('#albNext'); if (b2 && !b2.disabled) b2.click(); }
    });

    /* 返回键（全局唯一实例，页面加载时绑定一次） */
    var backBtn = $('#detailBack');
    if (backBtn) backBtn.addEventListener('click', function () { backOut(); });

    /* 列表滚动后显示右下角「返回页首」，方便重新选首字母 */
    var topBtn = $('#galleryToTop');
    if (topBtn) {
      var syncTopBtn = function () {
        var inList = $('#galDetailPage').hidden;
        var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        topBtn.hidden = !inList || scrollY < 120;
      };
      window.addEventListener('scroll', syncTopBtn, { passive: true });
      window.addEventListener('resize', syncTopBtn);
      topBtn.addEventListener('click', function () {
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      syncTopBtn();
    }

    /* ---- 深链 / 初始状态：gallery.html?cat=&open=<id> ---- */
    var qs = new URLSearchParams(window.location.search);
    var qCat = qs.get('cat');

    if (qCat === 'character' || qCat === 'ideology') {
      state.cat = qCat;
      $$('[data-gal-cat]').forEach(function (c) {
        c.setAttribute('aria-pressed', c.dataset.galCat === qCat ? 'true' : 'false');
      });
    }

    renderIndex();
    syncListLayer();
    suppressPush = true;   // 首次进入按 URL 还原，不重复写历史
    try { resolveFromUrl(); } finally { suppressPush = false; }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
