/* ============================================================
   意拟小站 · 站内搜索
   检索本站自身内容：CP乱炖投稿 / 讨论区帖子 / 画廊作品
   数据源与各板块共用 localStorage 键，后续板块接入同一索引
   ============================================================ */
(function () {
  'use strict';

  var SOURCES = [
    {
      scope: 'cp',
      label: 'CP乱炖',
      color: '#cf6a6a',
      url: 'cp.html',
      read: function () {
        try {
          var raw = localStorage.getItem('ynxz_cp_posts_v1');
          var arr = raw ? JSON.parse(raw) : [];
          return arr.map(function (p) {
            return {
              id: p.id,
              title: p.title || '',
              body: p.body || '',
              images: p.images || [],
              created: p.created,
              views: p.views || 0,
              url: 'cp.html'
            };
          });
        } catch (e) { return []; }
      }
    },
    {
      scope: 'forum',
      label: '讨论区',
      color: '#6a93cf',
      url: 'forum.html',
      read: function () {
        try {
          var raw = localStorage.getItem('ynxz_forum_posts_v1');
          var arr = raw ? JSON.parse(raw) : [];
          return arr.map(function (p) {
            return {
              id: p.id,
              title: p.title || '',
              body: p.body || '',
              images: [],
              created: p.created,
              views: p.views || 0,
              url: 'forum.html'
            };
          });
        } catch (e) { return []; }
      }
    },
    {
      scope: 'gallery',
      label: '画廊',
      color: '#d8b25a',
      url: 'gallery.html',
      read: function () {
        /* 画廊为静态数据（js/gallery-data.js）：意识形态 + 其下角色 */
        var DATA = (typeof GALLERY_DATA !== 'undefined') ? GALLERY_DATA : [];
        var out = [];
        DATA.forEach(function (ideo) {
          out.push({
            id: ideo.id,
            kind: 'ideology',
            title: ideo.name,
            body: ideo.desc || '',
            images: ideo.cover ? [ideo.cover] : [],
            created: 0,
            views: 0,
            url: 'gallery.html?cat=ideology&open=' + encodeURIComponent(ideo.id)
          });
          (ideo.characters || []).forEach(function (c) {
            out.push({
              id: c.id,
              kind: 'character',
              title: c.name,
              sub: ideo.name,
              body: (c.desc || '') + ' ' + (c.text || ''),
              images: (c.images || []).map(function (im) {
                return typeof im === 'string' ? im : (im.thumb || im.full);
              }),
              created: 0,
              views: 0,
              url: 'gallery.html?cat=character&open=' + encodeURIComponent(c.id)
            });
          });
        });
        return out;
      }
    }
  ];

  var state = { scope: 'all' };

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 高亮命中词 */
  function highlight(text, kw) {
    var safe = esc(text);
    if (!kw) return safe;
    var ekw = esc(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(ekw, 'gi'), function (m) {
      return '<mark>' + m + '</mark>';
    });
  }

  function fmtDate(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function searchAll(q) {
    var kw = q.trim().toLowerCase();
    var results = [];
    SOURCES.forEach(function (src) {
      if (state.scope !== 'all' && state.scope !== src.scope) return;
      src.read().forEach(function (item) {
        var titleHit = item.title.toLowerCase().indexOf(kw) !== -1;
        var bodyHit = item.body.toLowerCase().indexOf(kw) !== -1;
        if (!titleHit && !bodyHit) return;
        // 摘录：优先正文命中处前后文，否则正文开头
        var excerpt = '';
        if (bodyHit) {
          var idx = item.body.toLowerCase().indexOf(kw);
          var start = Math.max(0, idx - 24);
          excerpt = (start > 0 ? '…' : '') + item.body.slice(start, idx + kw.length + 40) + '…';
        } else {
          excerpt = item.body.slice(0, 80) + (item.body.length > 80 ? '…' : '');
        }
        results.push({
          source: src,
          item: item,
          titleHit: titleHit,
          excerpt: excerpt,
          created: item.created || 0,
          views: item.views || 0
        });
      });
    });
    results.sort(function (a, b) { return b.created - a.created; });
    return results;
  }

  function render(q) {
    var box = $('#searchResults');
    var kw = q.trim();
    if (!kw) {
      box.innerHTML = '<div class="search-hint">输入关键词，检索本站内容</div>';
      return;
    }
    var results = searchAll(kw);
    if (!results.length) {
      box.innerHTML = '<div class="void-note"><span class="diamond"></span><span>未找到相关内容</span></div>';
      return;
    }
    box.innerHTML = results.map(function (r) {
      var thumb = r.item.images && r.item.images.length
        ? '<div class="sr-thumb"><img src="' + r.item.images[0] + '" alt="" loading="lazy"></div>'
        : '';
      return (
        '<a class="sr-item" href="' + (r.item.url || r.source.url) + '" style="--src-color:' + r.source.color + '">' +
          thumb +
          '<div class="sr-main">' +
            '<div class="sr-head">' +
              '<span class="sr-source">' + r.source.label + (r.item.sub ? ' · ' + esc(r.item.sub) : '') + '</span>' +
              '<h3 class="sr-title">' + highlight(r.item.title, kw) + '</h3>' +
            '</div>' +
            (r.excerpt ? '<p class="sr-excerpt">' + highlight(r.excerpt, kw) + '</p>' : '') +
            '<div class="sr-meta">' +
              (r.item.created ? '<span>' + fmtDate(r.item.created) + '</span>' : '') +
              '<span>浏览 ' + r.views + '</span>' +
            '</div>' +
          '</div>' +
        '</a>'
      );
    }).join('') +
    '<p class="search-hint">共 ' + results.length + ' 条结果</p>';
  }

  function init() {
    var form = $('#siteSearchForm');
    var input = $('#siteSearchInput');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (q) {
        try { history.replaceState(null, '', 'search.html?q=' + encodeURIComponent(q)); } catch (err) {}
      }
      render(q);
    });

    $$('.scope-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.scope = chip.dataset.scope;
        $$('.scope-chip').forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
        var q = input.value;
        if (q) render(q);
      });
    });

    // 从 URL 读取初始关键词（主页搜索条跳转过来）
    var params = new URLSearchParams(window.location.search);
    var q = (params.get('q') || '').trim();
    if (q) {
      input.value = q;
    }
    render(q);
    if (q) input.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
