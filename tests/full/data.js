// Подделанные и испорченные данные: чужая резервная копия, перенос, повреждённая память.
// Приложение не должно зависать, падать насовсем или «заражаться» (prototype pollution).
const { suite, rec, ok, warn, openApp, baseState } = require('./lib');

// Открыть приложение с такими данными и пройти по всем вкладкам; вернуть ошибки и признак зависания
async function tryState(browser, URL, state, ls) {
  const ctx = await browser.newContext(); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await ctx.addInitScript(({ s, ls }) => { if (sessionStorage.i) return; sessionStorage.i = 1; try { localStorage.setItem('quest-v2', s); if (ls) for (const k in ls) localStorage.setItem(k, ls[k]); } catch (e) {} }, { s: state, ls: ls || null });
  let hang = false;
  try { await p.goto(URL + 'index.html', { timeout: 12000 }); await p.waitForTimeout(600);
    hang = !(await Promise.race([p.evaluate(async () => { for (const b of document.querySelectorAll('#nav [data-n]')) { b.click(); await new Promise(r => setTimeout(r, 20)); }
      for (const t of [...document.querySelectorAll('.fmt')].slice(0, 200)) { if (!t.offsetParent && !t.textContent.trim()) continue; t.click(); await new Promise(r => setTimeout(r, 0)); document.getElementById('fmx').click(); await new Promise(r => setTimeout(r, 0)); } return true; }), new Promise(r => setTimeout(() => r(false), 12000))]));
  } catch (e) { hang = true; }
  const alive = !hang && await p.evaluate(() => !!(window.st && document.querySelector('#nav') && typeof calc === 'function' && isFinite(calc().xp))).catch(() => false);
  const polluted = !hang && await p.evaluate(() => ({}).polluted !== undefined || ({}).isAdmin !== undefined).catch(() => false);
  await ctx.close();
  return { hang, alive, errs: [...new Set(errs)], polluted };
}

module.exports = async function (browser, URL) {
  suite('13. Подделанные резервные копии');
  const base = baseState();
  const CASES = {
    'prototype pollution (__proto__)': '{"__proto__":{"polluted":1,"isAdmin":true},"ux":{"ob":1,"all":1},"done":{"__proto__":{"polluted":2}}}',
    'constructor.prototype': '{"constructor":{"prototype":{"polluted":3}},"ux":{"ob":1,"all":1}}',
    'данные — массив': '[1,2,3]',
    'данные — число': '42',
    'данные — null': 'null',
    'данные — строка': '"привет"',
    'пустой объект': '{}',
    'обрезанный JSON': JSON.stringify(base).slice(0, 20),
    'вложенность 5000 уровней': '{"ux":{"ob":1,"all":1},"x":' + '['.repeat(5000) + ']'.repeat(5000) + '}',
    'done с мусором': JSON.stringify(Object.assign({}, base, { done: { '2026-01-01': null, 'не дата': { a: { x: 'много', c: 5 } }, '9999-99-99': [1, 2], '2026-02-02': { q: { x: 1e308, c: 'read' }, w: { x: -1e9 }, e: { x: NaN } } } })),
    'XP огромное (переполнение)': JSON.stringify(Object.assign({}, base, { bonus: { '2026-01-01': 1e308 }, done: { '2026-01-01': { a: { x: Infinity, c: 'read' } } } })),
    'отрицательный XP': JSON.stringify(Object.assign({}, base, { done: { '2026-01-01': { a: { x: -999999999, c: 'read' } } } })),
    'дата начала штрафов 0001 год': JSON.stringify(Object.assign({}, base, { pn: { s: '0001-01-01', d: {} } })),
    'имя 1 МБ': JSON.stringify(Object.assign({}, base, { name: 'Я'.repeat(1 << 20) })),
    'юникод и RTL': JSON.stringify(Object.assign({}, base, { name: '‮\u0000￿\ud800😀' + 'ا'.repeat(50) })),
  };
  let worst = [];
  for (const [name, s] of Object.entries(CASES)) {
    const r = await tryState(browser, URL, s);
    const good = !r.hang && r.alive && !r.polluted;
    if (!good) worst.push(name + (r.hang ? ' — зависло' : r.polluted ? ' — «заражён» Object.prototype' : ' — приложение не работает: ' + r.errs.slice(0, 2).join(' | ')));
    else if (r.errs.length) rec('warn', 'Копия «' + name + '»: приложение работает, но с ошибками', r.errs.slice(0, 2).join(' | '));
  }
  ok(worst.length === 0, 'Ни одна из ' + Object.keys(CASES).length + ' подделанных копий не вешает и не ломает приложение, Object.prototype не заражается', worst.join('; '));

  // Загрузка через «Резервная копия → Загрузить» (applyData): плохое не принимается, старые данные остаются
  const o = await openApp(browser, URL);
  const imp = await o.p.evaluate(async () => {
    st.name = 'До загрузки'; save(); const out = [];
    for (const bad of ['[1]', 'null', '{"__proto__":{"polluted":1}}', '{}', 'не json', '"str"']) {
      let thrown = false; try { applyData(bad); } catch (e) { thrown = true; }
      out.push({ bad, thrown, name: st.name, polluted: ({}).polluted !== undefined });
    }
    return out;
  });
  const keep = imp.filter(x => x.name !== 'До загрузки' || x.polluted);
  ok(keep.length === 0, 'Загрузка испорченной копии не стирает текущие данные и не заражает приложение', keep.map(x => x.bad + ' → имя «' + String(x.name).slice(0, 20) + '»' + (x.polluted ? ', заражено' : '')).join('; '));
  await o.ctx.close();

  suite('14. Неправильные типы в каждом поле данных');
  // Берём заполненные данные и по очереди портим каждое поле: null, строка, число, массив
  const full = await openApp(browser, URL);
  const keys = await full.p.evaluate(() => Object.keys(st).filter(k => !['ux', 'lang', '_v'].includes(k)));
  const rich = await full.p.evaluate(() => JSON.stringify(st));
  await full.ctx.close();
  const BAD = { 'null': null, 'строка': 'мусор<>', 'число': 7, 'массив': [1, 'x'] };
  const crash = [], soft = [];
  for (const k of keys) for (const [tn, v] of Object.entries(BAD)) {
    const s = JSON.parse(rich); s[k] = v;
    const r = await tryState(browser, URL, JSON.stringify(s));
    if (r.hang || !r.alive) crash.push('st.' + k + ' = ' + tn + (r.hang ? ' (зависло)' : ' (' + r.errs[0] + ')'));
    else if (r.errs.length) soft.push('st.' + k + ' = ' + tn + ': ' + r.errs[0]);
  }
  ok(crash.length === 0, 'Испорченное любое из ' + keys.length + ' полей (4 вида порчи) не вешает и не ломает приложение', crash.slice(0, 10).join('; ') + (crash.length > 10 ? ' … всего ' + crash.length : ''));
  warn(soft.length === 0, 'Испорченные поля не вызывают ошибок в отдельных разделах', soft.length + ' случаев: ' + soft.slice(0, 8).join('; ') + (soft.length > 8 ? ' …' : ''));

  suite('15. Книги из интернета (EPUB) не могут внедрить код');
  const b = await openApp(browser, URL);
  const ep = await b.p.evaluate(() => {
    if (typeof bkoClean !== 'function') return 'нет bkoClean';
    const evil = '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><script>__x(1)</script></head><body><p onclick="__x(2)">Текст<img src="x" onerror="__x(3)"/></p>' +
      '<a href="javascript:__x(4)">ссылка</a><iframe src="https://evil.example"></iframe><svg onload="__x(5)"><script>__x(6)</script></svg><style>body{display:none}</style>' + '<p>' + 'нормальный текст '.repeat(30) + '</p></body></html>';
    const out = bkoClean(evil) + bkoClean(evil.replace('<?xml version="1.0"?>', '<<<broken'));
    const d = document.createElement('div'); d.innerHTML = out; document.body.appendChild(d);
    return { html: out.slice(0, 200), bad: /<(script|iframe|svg|style|a)\b|on\w+=|javascript:/i.test(out), hits: window.__XSS.length };
  });
  ok(ep.bad === false && ep.hits === 0, 'Книга с вредным кодом очищается: остаются только текст и простое оформление', JSON.stringify(ep).slice(0, 200));
  await b.ctx.close();
};
