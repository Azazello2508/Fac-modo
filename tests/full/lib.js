// Общие помощники большого теста: локальный сервер, запуск браузера, запись результатов.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };

// Результаты: level "fail" — надо чинить, "warn" — совет/риск, "ok" — прошло, "info" — для сведения
const results = [];
let curSuite = '';
function suite(name) { curSuite = name; console.log('\n━━ ' + name); }
function rec(level, name, detail) {
  results.push({ suite: curSuite, level, name, detail: detail || '' });
  const ic = { ok: '✅', fail: '❌', warn: '⚠️ ', info: 'ℹ️ ' }[level];
  console.log(ic + ' ' + name + (detail ? ' — ' + String(detail).slice(0, 400) : ''));
}
const ok = (cond, name, detailIfBad, detailIfOk) => rec(cond ? 'ok' : 'fail', name, cond ? detailIfOk : detailIfBad);
const warn = (cond, name, detailIfBad, detailIfOk) => rec(cond ? 'ok' : 'warn', name, cond ? detailIfOk : detailIfBad);

// Сервер: файлы репозитория + страницы-стенды для игр по сети (/__harness.html, /__attack.html)
const HARNESS = fs.readFileSync(path.join(__dirname, 'harness.html'), 'utf8');
function startServer() {
  const srv = http.createServer((q, r) => {
    let u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/__harness.html') { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return r.end(HARNESS); }
    if (u.endsWith('/')) u += 'index.html';
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => srv.listen(0, () => res({ srv, url: 'http://localhost:' + srv.address().port + '/' })));
}

// Состояние «уже прошёл первый запуск», чтобы мастер не закрывал экран
function baseState(extra) {
  return Object.assign({ ux: { ob: 1, all: 1, r: 'el', i: ['work', 'home', 'rest', 'gym', 'shore', 'diary'] }, name: 'Тест' }, extra || {});
}

// Открыть приложение. opts.state — начальные данные (кладутся до запуска), opts.ls — другие ключи localStorage
async function openApp(browser, URL, opts) {
  opts = opts || {};
  const ctx = await browser.newContext(opts.ctx || {});
  const errs = [];
  await ctx.addInitScript(({ st, ls }) => {
    window.__XSS = []; window.__x = n => window.__XSS.push(String(n));
    window.alert = m => window.__XSS.push('alert:' + m);
    // ошибки внутри игр (iframe) собираем в главное окно
    if (window !== window.top) addEventListener('error', e => { try { (window.top.__FERR = window.top.__FERR || []).push((document.title || 'игра') + ': ' + e.message); } catch (x) {} });
    // начальные данные — только в главном окне (игра в песочнице gamebox не имеет доступа к хранилищу)
    if (window !== window.top) return;
    if (sessionStorage.getItem('__init')) return;
    sessionStorage.setItem('__init', '1');
    try {
      if (st) localStorage.setItem('quest-v2', typeof st === 'string' ? st : JSON.stringify(st));
      if (ls) for (const k in ls) localStorage.setItem(k, ls[k]);
    } catch (e) { console.error('init: ' + e.name); }
  }, { st: opts.state === undefined ? baseState() : opts.state, ls: opts.ls || null });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('JS: ' + e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|Blocked call to navigator\.vibrate/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  p.on('dialog', d => { errs.dialogs = (errs.dialogs || 0) + 1; d.accept().catch(() => {}); });
  if (opts.clock) await p.clock.install({ time: opts.clock });
  await p.goto(URL + 'index.html' + (opts.query || ''));
  await p.waitForTimeout(opts.wait || 1800);
  return { ctx, p, errs };
}

// Код для страницы: обойти все вкладки и все плитки, открыть и закрыть каждую
const TILE_WALK = async ({ act, wait }) => {
  const W = ms => new Promise(r => setTimeout(r, ms));
  const tabs = [...new Set([...document.querySelectorAll('#nav [data-n]')].map(e => e.dataset.n))];
  const seen = new Set(), out = [];
  for (const n of tabs) {
    const tb = document.querySelector('#nav [data-n="' + n + '"]'); if (!tb) continue; tb.click(); await W(60);
    const tiles = [...document.querySelectorAll('.fmt')].filter(t => t.offsetParent);
    for (const t of tiles) {
      const name = t.textContent.trim();
      if (seen.has(name)) continue; seen.add(name);
      try {
        t.click(); await W(wait || 90);
        const box = document.getElementById('fmc');
        if (act && box) await window[act](box, name);
        out.push(name);
      } catch (e) { out.push(name + ' ✗ ' + e.message); }
      const x = document.getElementById('fmx'); if (x) x.click(); await W(30);
    }
  }
  return out;
};

module.exports = { ROOT, results, suite, rec, ok, warn, startServer, openApp, baseState, TILE_WALK };
