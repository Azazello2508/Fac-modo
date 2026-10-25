// Нагрузка: 10 лет данных, переполненная память телефона, быстрые повторные нажатия,
// «обезьяна» (тысячи случайных нажатий), утечки памяти при долгой работе.
const { suite, rec, ok, warn, openApp, baseState, TILE_WALK } = require('./lib');

function bigState(years) {
  const st = baseState({ done: {}, custom: {}, bonus: {}, dr: {}, rl: [], _v: 3 }), cats = ['work', 'study', 'read', 'sport', 'health'], t0 = new Date();
  for (let i = 0; i < years * 365; i++) {
    const d = new Date(t0); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10), day = {};
    for (let j = 0; j < 10; j++) day['b' + j] = { x: 10 + j, c: cats[j % 5] };
    st.done[k] = day; st.dr[k] = { m: 3, n: 'Запись дневника за ' + k + '. ' + 'Вахта прошла спокойно, проверил генераторы и щиты. '.repeat(4) };
    if (i % 7 === 0) st.rl.push({ id: 'r' + i, d: k, eq: 'Генератор №' + (i % 4 + 1), h: '2', pr: 'Замена подшипника', cs: 'износ', fx: 'заменил' });
  }
  return st;
}

module.exports = async function (browser, URL) {
  suite('21. Нагрузка: 10 лет данных');
  const big = JSON.stringify(bigState(10));
  const t0 = Date.now();
  const o = await openApp(browser, URL, { state: big, wait: 300 });
  await o.p.waitForFunction(() => window.st && Object.keys(st.done).length > 3000, null, { timeout: 30000 });
  const start = Date.now() - t0;
  const m = await o.p.evaluate(async () => {
    const meas = async f => { let s = 0; for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 0)); const a = performance.now(); f(); s += performance.now() - a; } return +(s / 5).toFixed(1); };
    return { mb: +(localStorage.getItem('quest-v2').length / 1048576).toFixed(2), save: await meas(() => save()), calc: await meas(() => calc()), refresh: typeof refreshAll === 'function' ? await meas(() => refreshAll()) : 0 };
  });
  rec('info', 'Данные за 10 лет: ' + m.mb + ' МБ, запуск ' + start + ' мс, сохранение ' + m.save + ' мс, подсчёт XP ' + m.calc + ' мс, перерисовка ' + m.refresh + ' мс');
  warn(start < 4000, 'Запуск с 10 годами данных быстрее 4 секунд', start + ' мс');
  warn(m.save < 60 && m.refresh < 300, 'Сохранение и перерисовка остаются быстрыми', 'сохранение ' + m.save + ' мс, перерисовка ' + m.refresh + ' мс');
  const tw = Date.now(); const tiles = await o.p.evaluate(TILE_WALK, { wait: 30 });
  const per = Math.round((Date.now() - tw) / tiles.length);
  warn(per < 250, 'Разделы открываются быстро и с 10 годами данных (в среднем ' + per + ' мс)', per + ' мс на раздел');
  ok(o.errs.length === 0, '10 лет данных: все ' + tiles.length + ' разделов без ошибок', o.errs.slice(0, 3).join(' | '));
  await o.ctx.close();

  suite('22. Память телефона заполнена');
  const f = await openApp(browser, URL);
  const q = await f.p.evaluate(async () => {
    // забиваем память мусором до отказа
    let i = 0; try { const chunk = 'x'.repeat(256 * 1024); for (; i < 400; i++) localStorage.setItem('junk' + i, chunk); } catch (e) {}
    const name0 = st.name; let threw = null;
    try { st.name = 'Новое имя ' + 'я'.repeat(300000); save(); } catch (e) { threw = e.name; }
    await new Promise(r => setTimeout(r, 300));
    const h = window.fmHealth ? fmHealth() : null;
    const stored = JSON.parse(localStorage.getItem('quest-v2') || '{}').name;
    for (let j = 0; j < i; j++) localStorage.removeItem('junk' + j);
    return { filled: i, threw, keptOld: stored === name0, health: h && JSON.stringify(h).slice(0, 300), alive: typeof calc === 'function' && isFinite(calc().xp) };
  });
  ok(q.alive && !q.threw, 'Когда память заполнена, приложение не падает (сохранение не выбрасывает ошибку)', JSON.stringify(q).slice(0, 300));
  ok(q.keptOld, 'Старые данные в памяти не портятся, если новые не влезли');
  rec('info', 'Проверка здоровья при полной памяти: ' + (q.health || 'нет fmHealth'));
  await f.ctx.close();

  suite('23. Быстрые повторные нажатия');
  const g = await openApp(browser, URL);
  const r = await g.p.evaluate(async () => {
    const W = ms => new Promise(r => setTimeout(r, ms));
    const xp0 = calc().xp;
    // первая отметка в «Квестах дня»: 51 нажатие подряд (нечётное — отметка должна стоять один раз)
    const t = [...document.querySelectorAll('.fmt')].find(x => /Квесты дня/.test(x.textContent)); t.click(); await W(100);
    const box = document.getElementById('fmc'); const q = box.querySelector('#list input[type=checkbox]');
    if (!q) return { skip: 1 };
    for (let i = 0; i < 51; i++) { q.click(); }
    await W(300);
    const xp1 = calc().xp, d = st.done[today] || {}, n = Object.keys(d).length;
    document.getElementById('fmx').click();
    return { xp0, xp1, n, gain: xp1 - xp0 };
  });
  if (r.skip) rec('info', 'Не нашёл кнопку квеста для проверки быстрых нажатий');
  else ok(r.n === 1 && r.gain > 0 && r.gain <= 100, '51 быстрое нажатие на квест засчитывается один раз (XP +' + r.gain + ')', JSON.stringify(r));
  ok(g.errs.length === 0, 'Быстрые нажатия без ошибок', g.errs.slice(0, 3).join(' | '));
  await g.ctx.close();

  suite('24. «Обезьяна»: 3000 случайных действий');
  const mk = await openApp(browser, URL);
  mk.p.removeAllListeners('dialog'); mk.p.on('dialog', d => d.dismiss().catch(() => {})); // на «удалить всё?» отвечаем «нет»
  const CHUNK = async () => {
    const W = ms => new Promise(r => setTimeout(r, ms)); let n = 0, typed = 0;
    const words = ['', 'тест', '12', '-5', '1e9', '2026-13-45', '😀', '<b>x</b>', ' '.repeat(5), 'a'.repeat(300)];
    const BAD = /Удал|Сброс|Очист|Стереть|Delete|Reset|Clear|Восстанов|Перенос|Камер|Подключ|Скача|Загруз|Выйти из режима/i;
    for (let i = 0; i < 300; i++) {
      const vis = [...document.querySelectorAll('button,[data-n],.fmt,input,select,textarea,summary,a[href^="#"],label')].filter(x => x.offsetParent && !BAD.test(x.textContent || '') && !x.closest('#lgm,#lgb,[data-lang],a[href^="http"]'));
      if (!vis.length) { document.getElementById('fmx')?.click(); continue; }
      const el = vis[Math.random() * vis.length | 0];
      try {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          if (['checkbox', 'radio'].includes(el.type)) el.click();
          else if (el.type !== 'file') { el.value = el.type === 'number' ? String(Math.random() * 1000 | 0) : el.type === 'date' ? '2026-0' + (1 + Math.random() * 9 | 0) + '-1' + (Math.random() * 9 | 0) : words[Math.random() * words.length | 0]; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); typed++; }
        } else if (el.tagName === 'SELECT') { if (el.options.length) { el.selectedIndex = Math.random() * el.options.length | 0; el.dispatchEvent(new Event('change', { bubbles: true })); } }
        else el.click();
      } catch (e) {}
      n++;
      if (document.querySelector('#tkw iframe') && Math.random() < 0.3) document.getElementById('tkx')?.click();
      if (i % 20 === 0) await W(5);
    }
    await W(500);
    return { n, typed };
  };
  let stats = { n: 0, typed: 0 }, reloads = 0;
  for (let c = 0; c < 10; c++) {
    try { const r = await mk.p.evaluate(CHUNK); stats.n += r.n; stats.typed += r.typed; }
    catch (e) { reloads++; await mk.p.waitForTimeout(1500); }
  }
  stats.alive = await mk.p.evaluate(() => typeof calc === 'function' && isFinite(calc().xp)).catch(() => false);
  if (reloads) rec('info', '«Обезьяна» ' + reloads + ' раз нажала то, что перезагружает приложение (смена темы, языка и т.п.) — проверка продолжалась после перезагрузки');
  const errs = [...new Set(mk.errs)];
  ok(stats.alive && errs.length === 0, '«Обезьяна»: ' + stats.n + ' случайных нажатий и ' + stats.typed + ' вводов без единой ошибки', errs.length + ' разных ошибок: ' + errs.slice(0, 5).join(' | '));
  await mk.ctx.close();

  suite('25. Утечки памяти при долгой работе');
  const lk = await openApp(browser, URL);
  const cdp = await lk.ctx.newCDPSession(lk.p);
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return lk.p.evaluate(() => performance.memory.usedJSHeapSize); };
  await lk.p.evaluate(TILE_WALK, { wait: 10 });
  const h0 = await heap();
  for (let i = 0; i < 6; i++) await lk.p.evaluate(TILE_WALK, { wait: 5 });
  const h1 = await heap();
  const dom = await lk.p.evaluate(() => document.getElementsByTagName('*').length);
  const grow = ((h1 - h0) / 1048576).toFixed(1);
  warn(h1 - h0 < 15 * 1048576, '6 кругов по всем разделам (≈450 открытий): память выросла на ' + grow + ' МБ', 'рост ' + grow + ' МБ — возможна утечка');
  rec('info', 'Память страницы ' + (h1 / 1048576).toFixed(0) + ' МБ, элементов на странице ' + dom);
  await lk.ctx.close();
};
