// Большой тест Fac Modo — проверяет всё, что можно проверить без телефона.
// Запуск: node tests/full.js            — всё (≈10–15 минут)
//         node tests/full.js static xss  — только выбранные части
// Части: static (секреты, опасный код, вирусы, сборка, библиотеки), smoke (все разделы на 3 языках, игры, телефоны),
//        xss (взлом через поля и подделанные данные), data (подделанные копии), net (взлом игр по сети),
//        upload (поддельные файлы), pin (подбор PIN), load (нагрузка, «обезьяна», память), time (даты и часовые пояса),
//        offline (без интернета), a11y (доступность).
// Нужен Playwright (и axe-core для a11y). Итог — tests/out/report.md и report.json.
const fs = require('fs'), path = require('path');
const lib = require('./full/lib');
const ALL = ['static', 'smoke', 'xss', 'data', 'net', 'upload', 'pin', 'load', 'time', 'offline', 'a11y'];
const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
const run = want.length ? want : ALL;

(async () => {
  const t0 = Date.now();
  let browser = null, server = null;
  const needBrowser = run.some(x => x !== 'static');
  if (needBrowser) {
    const { chromium } = require('playwright');
    browser = await chromium.launch();
    server = await lib.startServer();
  }
  for (const name of run) {
    if (!ALL.includes(name)) { console.log('Нет такой части: ' + name); continue; }
    const s0 = Date.now();
    try { await require('./full/' + name)(browser, server && server.url); }
    catch (e) { lib.suite(name); lib.rec('fail', 'Часть «' + name + '» упала', e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)); }
    console.log('   (' + ((Date.now() - s0) / 1000).toFixed(0) + ' с)');
  }
  if (browser) await browser.close();
  if (server) server.srv.close();

  const R = lib.results, c = l => R.filter(r => r.level === l).length;
  const out = process.env.FM_OUT || path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(R, null, 1));
  let md = '# Большой тест Fac Modo\n\n' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC · ' + ((Date.now() - t0) / 60000).toFixed(1) + ' мин\n\n' +
    `✅ прошло: ${c('ok')} · ❌ не прошло: ${c('fail')} · ⚠️ советы: ${c('warn')} · ℹ️ сведения: ${c('info')}\n`;
  let cur = '';
  for (const r of R) {
    if (r.suite !== cur) { cur = r.suite; md += '\n## ' + cur + '\n\n'; }
    md += '- ' + { ok: '✅', fail: '❌', warn: '⚠️', info: 'ℹ️' }[r.level] + ' ' + r.name + (r.detail ? ' — ' + String(r.detail).replace(/\n/g, ' ') : '') + '\n';
  }
  fs.writeFileSync(path.join(out, 'report.md'), md);
  console.log(`\nИтог: ✅ ${c('ok')} · ❌ ${c('fail')} · ⚠️ ${c('warn')} · ℹ️ ${c('info')} — отчёт tests/out/report.md`);
  process.exit(c('fail') ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
