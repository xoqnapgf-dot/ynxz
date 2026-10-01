/* 日夜主题：默认夜间；选择记在 localStorage（不可用时静默降级）。
   放在 <head> 里同步执行，先于首帧设好 data-theme，避免闪屏。 */
(function () {
  'use strict';
  var KEY = 'ynxz_theme';
  var root = document.documentElement;

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* 忽略 */ } }
  function apply(t) {
    if (t === 'light') root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = t === 'light' ? '#f4efe5' : '#0a0a0e';
    var b = document.querySelector('.theme-toggle');
    if (b) {
      b.setAttribute('aria-label', t === 'light' ? '切换到夜间模式' : '切换到日间模式');
      b.title = t === 'light' ? '切换到夜间模式' : '切换到日间模式';
    }
  }

  apply(read() === 'light' ? 'light' : 'dark');

  document.addEventListener('DOMContentLoaded', function () {
    var host = document.querySelector('.site-header');
    if (!host || host.querySelector('.theme-toggle')) return;
    var nav = host.querySelector('.site-nav');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-toggle';
    b.innerHTML =
      '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' +
      '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    b.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      apply(next); write(next);
    });
    if (nav) nav.insertAdjacentElement('afterend', b); else host.appendChild(b);
    apply(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  });
})();
