// Даты и часовые пояса: полночь (штрафы записываются один раз), Новый год, 29 февраля, перевод часов,
// телефон с часами «в прошлом», экзотические часовые пояса (судно в любой точке мира).
const { suite, rec, ok, warn, openApp, baseState, TILE_WALK } = require('./lib');

module.exports = async function (browser, URL) {
  suite('26. Часовые пояса по всему миру');
  const TZ = ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Kathmandu', 'America/St_Johns', 'Asia/Vladivostok', 'Europe/Kiev', 'UTC'];
  const bad = [];
  for (const tz of TZ) {
    const o = await openApp(browser, URL, { ctx: { timezoneId: tz, locale: tz === 'UTC' ? 'en-US' : 'ru-RU' } });
    await o.p.evaluate(TILE_WALK, { wait: 20 });
    const today = await o.p.evaluate(() => today);
    if (o.errs.length) bad.push(tz + ': ' + o.errs[0]);
    rec('info', tz + ': «сегодня» в приложении = ' + today);
    await o.ctx.close();
  }
  ok(bad.length === 0, 'Во всех ' + TZ.length + ' часовых поясах (от −11 до +14 ч) все разделы открываются без ошибок', bad.join('; '));

  suite('27. Полночь, Новый год, 29 февраля, перевод часов');
  // 1) Полночь: штраф за вчера записывается один раз и не меняется при повторных запусках
  const st = baseState({ pn: { s: '2026-12-01', d: {} }, done: { '2026-12-31': { q1: { x: 5, c: 'life' } } } });
  const o = await openApp(browser, URL, { state: st, clock: new Date('2026-12-31T23:59:00+02:00'), ctx: { timezoneId: 'Europe/Kiev' } });
  const before = await o.p.evaluate(() => ({ today, xp: calc().xp }));
  await o.p.clock.fastForward('02:00'); // 00:01 1 января (приложение может само перезагрузиться в новый день)
  await o.p.waitForTimeout(1500); await o.p.goto(URL + 'index.html').catch(() => {}); await o.p.waitForTimeout(1500);
  const a1 = await o.p.evaluate(() => ({ today, pen: JSON.stringify(st.pn.d['2026-12-31'] || null), xp: calc().xp }));
  await o.p.goto(URL + 'index.html').catch(() => {}); await o.p.waitForTimeout(1500);
  const a2 = await o.p.evaluate(() => ({ pen: JSON.stringify(st.pn.d['2026-12-31'] || null), xp: calc().xp }));
  ok(before.today === '2026-12-31' && a1.today === '2027-01-01', 'Смена года: «сегодня» переходит с 31.12.2026 на 01.01.2027', before.today + ' → ' + a1.today);
  ok(a1.pen !== 'null' && a1.pen === a2.pen && a1.xp === a2.xp, 'Итог дня с штрафами записывается после полуночи один раз и не меняется при перезапуске', JSON.stringify({ a1, a2 }).slice(0, 200));
  ok(o.errs.length === 0, 'Переход через полночь и Новый год без ошибок', o.errs.slice(0, 3).join(' | '));
  await o.ctx.close();

  // 2) 29 февраля и перевод часов на летнее время
  for (const [name, t, tz] of [['29 февраля 2028', '2028-02-29T12:00:00+02:00', 'Europe/Kiev'], ['Перевод часов (29.03.2026, 03:30)', '2026-03-29T03:30:00+03:00', 'Europe/Kiev'], ['Обратный перевод (25.10.2026, 03:30)', '2026-10-25T03:30:00+02:00', 'Europe/Kiev']]) {
    const x = await openApp(browser, URL, { clock: new Date(t), ctx: { timezoneId: tz } });
    await x.p.evaluate(TILE_WALK, { wait: 20 });
    const d = await x.p.evaluate(() => today);
    ok(x.errs.length === 0, name + ': все разделы без ошибок (сегодня = ' + d + ')', x.errs.slice(0, 2).join(' | '));
    await x.ctx.close();
  }

  // 3) Часы телефона ушли назад (сбились или переставили): XP и штрафы не уходят в минус, ничего не ломается
  const fut = baseState({ pn: { s: '2027-01-01', d: { '2027-01-05': { x: 30, miss: [], n: 5, of: 10 } } }, done: { '2027-01-10': { a: { x: 50, c: 'read' } } } });
  const y = await openApp(browser, URL, { state: fut, clock: new Date('2026-06-01T12:00:00') });
  await y.p.evaluate(TILE_WALK, { wait: 20 });
  const r = await y.p.evaluate(() => { const c = calc(); return { xp: c.xp, pen: c.pen, lvl: c.level || c.lvl }; });
  ok(y.errs.length === 0 && isFinite(r.xp) && r.xp >= 0, 'Часы телефона «в прошлом» (данные из будущего): ничего не ломается, XP не отрицательный', JSON.stringify(r));
  await y.ctx.close();
};
