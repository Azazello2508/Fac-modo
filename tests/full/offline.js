// Без интернета: сайт открывается из кэша (service worker), все разделы работают.
const { suite, ok, warn, openApp, TILE_WALK } = require('./lib');

module.exports = async function (browser, URL) {
  suite('28. Без интернета');
  const o = await openApp(browser, URL);
  const sw = await o.p.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'нет';
    const r = await Promise.race([navigator.serviceWorker.ready.then(() => 'ok'), new Promise(r => setTimeout(() => r('timeout'), 8000))]);
    await new Promise(r => setTimeout(r, 1000));
    return r;
  });
  ok(sw === 'ok', 'Офлайн-кэш (service worker) включается при первом открытии', sw);
  await o.ctx.setOffline(true);
  o.errs.length = 0;
  let loaded = true;
  try { await o.p.reload({ timeout: 15000 }); await o.p.waitForTimeout(1500); } catch (e) { loaded = false; }
  const alive = loaded && await o.p.evaluate(() => !!(window.st && document.querySelector('#nav'))).catch(() => false);
  ok(alive, 'Без интернета приложение открывается из кэша');
  if (alive) {
    const tiles = await o.p.evaluate(TILE_WALK, { wait: 30 });
    const errs = o.errs.filter(e => !/net::|Failed to fetch|NetworkError|ERR_INTERNET/.test(e));
    ok(errs.length === 0, 'Без интернета все ' + tiles.length + ' разделов открываются без ошибок', errs.slice(0, 3).join(' | '));
    // игры тоже работают без сети
    const g = await o.p.evaluate(async () => { window.__FERR = []; fmGame('cs-src', 'Шахматы'); await new Promise(r => setTimeout(r, 1000)); const ok = !!document.querySelector('#tkw iframe'); document.getElementById('tkx').click(); return ok && !(window.__FERR || []).length; });
    ok(g, 'Без интернета игры запускаются');
    const badge = await o.p.evaluate(() => document.querySelectorAll('[data-net]').length);
    warn(badge > 0, 'Разделы, которым нужен интернет, помечены значком 📶 (' + badge + ')');
  }
  await o.ctx.close();
};
