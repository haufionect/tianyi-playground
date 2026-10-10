/* 天依小乐园 · 页面路由
   切页 + 通知游戏进入/离开（离开时把音游、街机都停掉，别在后台空转）。 */
(function () {
  const VIEWS = ['home', 'macaron', 'rhythm', 'piano'];
  let current = 'home';

  function show(view) {
    if (VIEWS.indexOf(view) < 0) view = 'home';
    const games = window.TYGames || {};

    if (current !== view) {
      const prev = games[current];
      if (prev && typeof prev.leave === 'function') {
        try { prev.leave(); } catch (err) { /* 停不掉也别炸掉页面 */ }
      }
    }

    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) {
      v.classList.toggle('active', v.id === 'view-' + view);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) {
      b.classList.toggle('active', b.dataset.view === view);
    });

    const next = games[view];
    if (next && typeof next.enter === 'function') {
      try { next.enter(); } catch (err) { /* 同上 */ }
    }

    current = view;
    if (location.hash !== '#' + view) {
      try { history.replaceState(null, '', '#' + view); } catch (err) { location.hash = view; }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (el) {
    el.addEventListener('click', function () {
      show(el.dataset.view || 'home');
    });
  });

  window.addEventListener('hashchange', function () {
    const h = (location.hash || '').replace('#', '');
    if (VIEWS.indexOf(h) >= 0) show(h);
  });

  const initial = (location.hash || '').replace('#', '');
  if (VIEWS.indexOf(initial) >= 0 && initial !== 'home') {
    show(initial);
  }

  window.TYShow = show;
})();
