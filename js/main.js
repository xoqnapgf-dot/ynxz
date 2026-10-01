/* ============================================================
   意拟小站 · 全站脚本
   —— 入场动效（IntersectionObserver，合成器动画，60fps）
   —— 画廊图片淡入
   —— 站内搜索入口（主页搜索条 → search.html）
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- 入场动效 ---------- */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el, i) {
      if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', (Math.min(i, 6) * 0.07).toFixed(2) + 's');
      io.observe(el);
    });
  }

  /* ---------- 画廊图片淡入 ---------- */
  function initGallery() {
    $$('img[data-gallery-img]').forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', function () { img.classList.add('loaded'); }, { once: true });
        img.addEventListener('error', function () { img.classList.add('loaded'); }, { once: true });
      }
    });
  }

  /* ---------- 站内搜索入口 ----------
     所有 data-search-form 的表单：跳转 search.html 并带上关键词。
     搜索页自身的检索逻辑在 js/search.js
  */
  function initSearch() {
    $$('[data-search-form]').forEach(function (form) {
      var input = $('input[type="search"], input[type="text"]', form);
      if (!input) return;
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var q = (input.value || '').trim();
        if (!q) { input.focus(); return; }
        var base = form.dataset.action || 'search.html';
        window.location.href = base + '?q=' + encodeURIComponent(q);
      });
    });
  }

  /* ---------- DOM ready ---------- */
  function boot() {
    initReveal();
    initGallery();
    initSearch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
