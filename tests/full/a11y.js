// Доступность (axe-core): каждая вкладка и каждый раздел. Критичные нарушения — ошибка, серьёзные — совет.
const { suite, rec, ok, warn, openApp } = require('./lib');

module.exports = async function (browser, URL) {
  suite('29. Доступность (для слабого зрения и экранного диктора)');
  let axe = null; try { axe = require.resolve('axe-core/axe.min.js'); } catch (e) {}
  if (!axe) { rec('warn', 'axe-core не установлен — проверка доступности пропущена (npm i axe-core)'); return; }
  const o = await openApp(browser, URL); await o.p.addScriptTag({ path: axe });
  const res = await o.p.evaluate(async () => {
    const W = ms => new Promise(r => setTimeout(r, ms)), agg = {};
    // увеличение экрана отключено намеренно (CLAUDE.md «Без увеличения экрана»)
    const run = async (ctx, where) => { const r = await axe.run(ctx, { rules: { 'meta-viewport': { enabled: false } } });
      for (const v of r.violations) { const k = v.impact + '|' + v.id; agg[k] = agg[k] || { n: 0, where: new Set(), help: v.help }; agg[k].n += v.nodes.length; agg[k].where.add(where); } };
    const tabs = [...new Set([...document.querySelectorAll('#nav [data-n]')].map(e => e.dataset.n))]; const seen = new Set();
    for (const n of tabs) {
      document.querySelector('#nav [data-n="' + n + '"]').click(); await W(80); await run(document, 'вкладка ' + n);
      for (const t of [...document.querySelectorAll('.fmt')].filter(t => t.offsetParent)) {
        const name = t.textContent.trim(); if (seen.has(name)) continue; seen.add(name);
        t.click(); await W(60); await run(document.getElementById('fmb'), name.slice(0, 24)); document.getElementById('fmx').click(); await W(20);
      }
    }
    return Object.entries(agg).map(([k, v]) => ({ impact: k.split('|')[0], id: k.split('|')[1], n: v.n, help: v.help, where: [...v.where].slice(0, 4).join(', ') + (v.where.size > 4 ? ' и ещё ' + (v.where.size - 4) : '') }));
  });
  const crit = res.filter(r => r.impact === 'critical'), ser = res.filter(r => r.impact === 'serious');
  ok(crit.length === 0, 'Нет критичных нарушений доступности ни в одном разделе', crit.map(r => r.id + ' ×' + r.n + ' (' + r.where + ')').join('; '));
  warn(ser.length === 0, 'Нет серьёзных нарушений доступности', ser.map(r => r.id + ' ×' + r.n + ' (' + r.where + ')').join('; '));
  const minor = res.filter(r => r.impact !== 'critical' && r.impact !== 'serious');
  if (minor.length) rec('info', 'Мелкие замечания доступности: ' + minor.map(r => r.id + ' ×' + r.n).join(', '));
  await o.ctx.close();
};
