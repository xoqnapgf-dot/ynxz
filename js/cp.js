/* ============================================================
   CP乱炖 · 内容系统
   分类（图/文/图文）· 排序（最新/最热）· 浏览量 · 投稿
   数据保存在浏览器 localStorage，图片压缩后以 dataURL 存储
   ============================================================ */
(function () {
  'use strict';

  var STORE_KEY = 'ynxz_cp_posts_v1';

  /* 内置种子投稿：始终展示、不可删除，且不写回 localStorage（与用户投稿合并） */
  var SEED_POSTS = [
    { id: 'seed-kang-anzi', official: true, title: '安康 × 安资', body: '', images: ['素材/CP区/安康&安资_cp图.PNG'], created: 0, views: 0 }
  ];

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var state = {
    posts: [],
    filter: 'all',   // all | image | text | mixed
    sort: 'new'      // new | hot
  };

  /* ---------- 存储 ---------- */
  function load() {
    var user = [];
    try {
      var raw = localStorage.getItem(STORE_KEY);
      user = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(user)) user = [];
    } catch (e) { user = []; }
    var seeds = SEED_POSTS.map(function (p) {
      return { id: p.id, seed: true, official: !!p.official, title: p.title, body: p.body, images: p.images.slice(), created: p.created || 0, views: p.views || 0 };
    });
    state.posts = seeds.concat(user);
  }
  function save() {
    try {
      var persist = state.posts.filter(function (p) { return !p.seed; });
      localStorage.setItem(STORE_KEY, JSON.stringify(persist));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 工具 ---------- */
  function uid() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function typeOf(post) {
    var hasImg = post.images && post.images.length > 0;
    var hasTxt = !!(post.body && post.body.trim());
    if (hasImg && hasTxt) return 'mixed';
    if (hasImg) return 'image';
    return 'text';
  }
  var TYPE_LABEL = { image: '图', text: '文', mixed: '图文' };

  function fmtDate(ts) {
    var d = new Date(ts);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fmtViews(n) {
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 图片压缩：限制最长边，控制 localStorage 体积 */
  var MAX_EDGE = 1280;
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) { reject(new Error('不是图片文件')); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('读取失败')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('解码失败')); };
        img.onload = function () {
          var scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale);
          var h = Math.round(img.height * scale);
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- 站内灯箱（点图看大图，不跳新标签） ---------- */
  function ensureLightbox() {
    var lb = document.getElementById('cpLightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.id = 'cpLightbox';
    lb.className = 'cp-lightbox';
    lb.hidden = true;
    lb.innerHTML = '<img alt="查看大图">';
    document.body.appendChild(lb);
    lb.addEventListener('click', function () { closeLightbox(); });
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
  }
  function closeLightbox() {
    var lb = document.getElementById('cpLightbox');
    if (lb) lb.hidden = true;
  }

  /* ---------- 列表渲染 ---------- */
  function visiblePosts() {
    var list = state.posts.filter(function (p) {
      if (state.filter === 'all') return true;
      return typeOf(p) === state.filter;
    });
    if (state.sort === 'hot') {
      list.sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
    } else {
      list.sort(function (a, b) { return (b.created || 0) - (a.created || 0); });
    }
    return list;
  }

  function render() {
    var grid = $('#cpGrid');
    var empty = $('#cpEmpty');
    if (!grid) return;
    var list = visiblePosts();
    grid.innerHTML = '';
    empty.hidden = list.length > 0;

    list.forEach(function (p) {
      var t = typeOf(p);
      var card = document.createElement('article');
      card.className = 'cp-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', p.title);

      var coverHtml;
      if (p.images && p.images.length) {
        coverHtml = '<div class="cp-card-cover"><img src="' + p.images[0] + '" alt="" loading="lazy">' +
          (p.images.length > 1 ? '<span class="cp-count cp-card-count">' + p.images.length + ' 图</span>' : '') + '</div>';
      } else if (p.body && p.body.trim()) {
        coverHtml = '<div class="cp-card-cover text-cover"><p class="text-excerpt">' + esc(p.body.trim().slice(0, 120)) + '</p></div>';
      } else {
        coverHtml = '<div class="cp-card-cover"><span class="no-visual">CP乱炖</span></div>';
      }

      card.innerHTML =
        coverHtml +
        '<span class="cp-card-type">' + TYPE_LABEL[t] + '</span>' +
        '<div class="cp-card-body">' +
          '<h3 class="cp-card-title">' + esc(p.title) + '</h3>' +
          (t !== 'image' && p.body
            ? '<p class="cp-card-excerpt">' + esc(p.body.trim().slice(0, 60)) + '</p>'
            : '') +
          '<div class="cp-card-meta">' +
            '<span class="meta-item">' + (p.official ? '官方' : fmtDate(p.created)) + '</span>' +
            '<span class="meta-grow"></span>' +
            '<span class="meta-item">浏览 ' + fmtViews(p.views || 0) + '</span>' +
          '</div>' +
        '</div>';

      function open() { p.views = (p.views || 0) + 1; save(); openPostWindow(p); }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
      grid.appendChild(card);
    });
  }

  /* ---------- 详情 ---------- */
  function openDetail(id) {
    var p = null;
    for (var i = 0; i < state.posts.length; i++) {
      if (state.posts[i].id === id) { p = state.posts[i]; break; }
    }
    if (!p) return;
    p.views = (p.views || 0) + 1;
    save();
    render();

    var t = typeOf(p);
    var imgsHtml = '';
    if (p.images && p.images.length) {
      imgsHtml = '<div class="cp-detail-images">' +
        p.images.map(function (src) { return '<img class="cp-detail-img" src="' + src + '" alt="" loading="lazy">'; }).join('') +
        '</div>';
    }
    $('#cpDetailBody').innerHTML =
      '<h2 class="cp-detail-title">' + esc(p.title) + '</h2>' +
      '<div class="cp-detail-meta">' +
        '<span class="cp-detail-type">' + TYPE_LABEL[t] + '</span>' +
        '<span>' + (p.official ? '官方' : fmtDate(p.created)) + '</span>' +
        '<span>浏览 ' + fmtViews(p.views) + '</span>' +
      '</div>' +
      imgsHtml +
      (p.body && p.body.trim() ? '<div class="cp-detail-body">' + esc(p.body) + '</div>' : '');
    $$('#cpDetailBody .cp-detail-img').forEach(function (im) {
      im.addEventListener('click', function () { openLightbox(im.getAttribute('src')); });
    });
    openOverlay($('#cpDetailOverlay'));
  }

  /* ---------- 新窗口打开投稿：跳到真实页面 cp-view.html（有真 URL，图片走相对路径） ---------- */
  function openPostWindow(p) {
    window.open('cp-view.html?post=' + encodeURIComponent(p.id), '_blank');
  }

  /* ---------- 弹层控制 ---------- */
  function openOverlay(ov) {
    ov.hidden = false;
    requestAnimationFrame(function () { ov.classList.add('open'); });
    document.body.style.overflow = 'hidden';
  }
  function closeOverlay(ov) {
    ov.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () { ov.hidden = true; }, 280);
  }

  /* ---------- 投稿表单 ---------- */
  var pendingImages = [];

  function renderThumbs() {
    var box = $('#cpThumbs');
    box.innerHTML = '';
    pendingImages.forEach(function (src, i) {
      var div = document.createElement('div');
      div.className = 'cp-thumb';
      div.innerHTML = '<img src="' + src + '" alt=""><button type="button" class="rm" aria-label="移除">&times;</button>';
      div.querySelector('.rm').addEventListener('click', function () {
        pendingImages.splice(i, 1);
        renderThumbs();
      });
      box.appendChild(div);
    });
  }

  function addFiles(files) {
    var arr = Array.prototype.slice.call(files);
    arr.forEach(function (f) {
      compressImage(f).then(function (dataUrl) {
        pendingImages.push(dataUrl);
        renderThumbs();
      }).catch(function () { /* 忽略无法读取的文件 */ });
    });
  }

  function showError(msg) {
    var el = $('#cpFormError');
    el.textContent = msg;
    el.hidden = false;
  }
  function hideError() { $('#cpFormError').hidden = true; }

  function initSubmit() {
    var overlay = $('#cpSubmitOverlay');
    var form = $('#cpSubmitForm');
    var fileInput = $('#cpFileInput');
    var drop = $('#cpDropArea');

    $('#cpOpenSubmit').addEventListener('click', function () {
      hideError();
      openOverlay(overlay);
    });

    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener('change', function () {
      addFiles(fileInput.files);
      fileInput.value = '';
    });
    ['dragover', 'dragenter'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('dragover'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideError();
      var title = form.title.value.trim();
      var body = form.body.value;
      if (!title) { showError('请填写标题。'); return; }
      if (!pendingImages.length && !body.trim()) { showError('图片和正文至少填写一项。'); return; }

      var btn = $('#cpSubmitBtn');
      btn.disabled = true;
      btn.textContent = '上传中…';

      // 让 UI 先刷新
      setTimeout(function () {
        var post = {
          id: uid(),
          title: title,
          body: body,
          images: pendingImages.slice(),
          created: Date.now(),
          views: 0
        };
        state.posts.push(post);
        var ok = save();
        btn.disabled = false;
        btn.textContent = '上传';
        if (!ok) {
          /* 存不进 localStorage 就回滚内存里的这条，避免列表出现刷新即消失的幽灵投稿 */
          state.posts.pop();
          showError('保存失败：内容过大，浏览器存储空间不足。请减少图片数量或尺寸后再上传。');
          return;
        }
        pendingImages = [];
        renderThumbs();
        form.reset();
        closeOverlay(overlay);
        render();
      }, 60);
    });
  }

  /* ---------- 通用关闭 ---------- */
  function initOverlays() {
    $$('.cp-overlay').forEach(function (ov) {
      ov.addEventListener('click', function (e) {
        if (e.target === ov) closeOverlay(ov);
      });
      $$('[data-cp-close]', ov).forEach(function (btn) {
        btn.addEventListener('click', function () { closeOverlay(ov); });
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      $$('.cp-overlay').forEach(function (ov) {
        if (!ov.hidden) closeOverlay(ov);
      });
    });
  }

  /* ---------- 筛选 / 排序 ---------- */
  function initToolbar() {
    $$('[data-cp-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.filter = chip.dataset.cpFilter;
        $$('[data-cp-filter]').forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
        render();
      });
    });
    $$('[data-cp-sort]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.sort = chip.dataset.cpSort;
        $$('[data-cp-sort]').forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
        render();
      });
    });
  }

  /* ---------- 启动 ---------- */
  load();
  initToolbar();
  initSubmit();
  initOverlays();
  render();
})();
