// Все разделы на трёх языках, все игры, разные телефоны.
const { suite, rec, ok, warn, openApp, TILE_WALK, baseState } = require('./lib');
const { devices } = require('playwright');

// Русские слова, оставшиеся на экране в режиме English (кроме translate="no")
const LEFT_RU = (uk) => {
  const out = new Set(), w = document.createTreeWalker(document.getElementById('fmc') || document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) {
    const t = n.nodeValue.trim(); if (!t || !(uk ? /[а-яё]*[ыэъё][а-яё]*/i : /[а-яё]{3,}/i).test(t)) continue;
    const el = n.parentElement; if (!el || el.closest('[translate="no"],script,style,textarea,option') || !el.offsetParent) continue;
    out.add(t.slice(0, 40));
  }
  return [...out];
};

module.exports = async function (browser, URL) {
  suite('8. Все разделы на трёх языках');
  for (const lang of ['ru', 'en', 'uk']) {
    const { ctx, p, errs } = await openApp(browser, URL, { state: baseState({ lang, name: 'Test' }) });
    await p.evaluate(f => { window.__left = {}; window.__leftFn = new Function('return (' + f + ')(' + (st.lang === 'uk') + ')'); window.__collect = async (box, name) => { const r = window.__leftFn(); if (r.length) window.__left[name] = r; }; }, LEFT_RU.toString());
    const tiles = await p.evaluate(TILE_WALK, { act: lang === 'ru' ? null : '__collect', wait: lang === 'ru' ? 90 : 300 });
    const broken = tiles.filter(t => t.includes('✗'));
    // похожие разделы теперь открываются одним окном с вкладками (one-js), поэтому плиток меньше, чем разделов
    ok(tiles.length >= 40 && broken.length === 0 && errs.length === 0, 'Язык ' + lang.toUpperCase() + ': открываются все ' + tiles.length + ' разделов без ошибок',
      [...broken, ...errs].slice(0, 5).join(' | '));
    if (lang !== 'ru') {
      const left = await p.evaluate(() => window.__left);
      const n = Object.values(left).reduce((a, b) => a + b.length, 0);
      warn(n === 0, 'Язык ' + lang.toUpperCase() + ': нет непереведённых русских строк', n + ' строк в ' + Object.keys(left).length + ' разделах, например: ' +
        Object.entries(left).slice(0, 4).map(([k, v]) => k.slice(2, 22) + ' → «' + v[0] + '»').join('; '));
    }
    await ctx.close();
  }

  suite('9. Все игры запускаются и закрываются');
  {
    const { ctx, p, errs } = await openApp(browser, URL);
    const ids = await p.evaluate(() => [...document.querySelectorAll('script[type="text/plain"][id$="-src"]')].map(s => s.id));
    const res = [];
    for (const id of ids) {
      const r = await p.evaluate(async id => {
        const W = ms => new Promise(r => setTimeout(r, ms)); window.__FERR = [];
        fmGame(id, id); await W(1200);
        const f = document.querySelector('#tkw iframe'); if (!f) return { id, err: 'не открылась' };
        const d = f.contentDocument, W2 = d.documentElement.clientWidth, H = d.documentElement.clientHeight;
        // «обезьяна» внутри игры: 150 случайных нажатий по кнопкам и полю
        const btn = [...d.querySelectorAll('button,canvas,td,.cell,[onclick]')].filter(x => x.offsetParent || x.tagName === 'CANVAS');
        for (let i = 0; i < 150; i++) {
          const el = btn.length && Math.random() < .7 ? btn[Math.random() * btn.length | 0] : d.elementFromPoint(Math.random() * W2, Math.random() * H);
          if (!el || /Выйти|Меню/.test(el.textContent || '')) continue;
          try { const R = el.getBoundingClientRect(), o = { bubbles: true, clientX: R.left + R.width / 2, clientY: R.top + R.height / 2 };
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(t => el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o))); } catch (e) {}
          if (i % 25 === 0) await W(20);
        }
        await W(300);
        document.getElementById('tkx').click(); await W(200);
        return { id, err: (window.__FERR || []).slice(0, 2).join(' | '), left: !!document.querySelector('#tkw iframe') };
      }, id);
      res.push(r);
    }
    const bad = res.filter(r => r.err || r.left);
    ok(bad.length === 0 && errs.length === 0, 'Все ' + ids.length + ' игр открываются, выдерживают 150 случайных нажатий и полностью закрываются',
      bad.map(r => r.id + ': ' + (r.err || 'не закрылась')).concat(errs).slice(0, 5).join('; '));
    await ctx.close();
  }

  suite('10. Разные телефоны');
  const PH = ['iPhone SE', 'iPhone 13', 'iPhone 15 Pro Max', 'iPhone 13 landscape', 'Pixel 7', 'Galaxy S9+'];
  for (const name of PH) {
    const d = devices[name]; if (!d) { rec('info', 'Нет профиля ' + name); continue; }
    const { ctx, p, errs } = await openApp(browser, URL, { ctx: { ...d, defaultBrowserType: undefined } });
    await p.evaluate(() => { window.__wide = []; window.__w = async (box, name) => { const b = document.getElementById('fmb'); if (b && b.scrollWidth > b.clientWidth + 2) window.__wide.push(name.slice(2, 26) + ' +' + (b.scrollWidth - b.clientWidth) + 'px'); }; });
    const tiles = await p.evaluate(TILE_WALK, { act: '__w' });
    const r = await p.evaluate(() => ({ wide: window.__wide, page: document.documentElement.scrollWidth - innerWidth }));
    ok(errs.length === 0 && r.page <= 1, name + ' (' + d.viewport.width + '×' + d.viewport.height + '): ' + tiles.length + ' разделов без ошибок, страница не шире экрана', errs.slice(0, 3).join(' | ') + (r.page > 1 ? ' страница шире на ' + r.page + 'px' : ''));
    warn(r.wide.length === 0, name + ': ни один раздел не вылезает за край экрана', r.wide.length + ' шт.: ' + r.wide.slice(0, 6).join(', '));
    await ctx.close();
  }
};
