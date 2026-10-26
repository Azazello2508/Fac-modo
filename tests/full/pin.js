// PIN документов: подбор, обход замка перезапуском, действия без ввода PIN.
const { suite, ok, openApp, baseState } = require('./lib');

module.exports = async function (browser, URL) {
  suite('20. Подбор PIN-кода документов');
  // PIN 1234 ставим через сам раздел, чтобы отпечаток считался как в приложении
  const o = await openApp(browser, URL, { state: baseState({ dc: [{ id: 'd1', n: 'Паспорт моряка', e: '2030-01-01' }] }) });
  const p = o.p;
  const openDocs = () => p.evaluate(() => { document.getElementById('fmx').click(); const t = [...document.querySelectorAll('.fmt')].find(x => /Документы и (сроки|стаж)/.test(x.textContent)); t && t.click(); });
  await openDocs();
  await p.evaluate(async () => {
    const W = ms => new Promise(r => setTimeout(r, ms));
    const s = await new Promise(r => { const sl = 'testsalt'; crypto.subtle.digest('SHA-256', new TextEncoder().encode(sl + ':1234')).then(b => r({ s: sl, h: [...new Uint8Array(b)].map(x => ('0' + x.toString(16)).slice(-2)).join('') })); });
    st.pin = s; save(); location.reload();
  }).catch(() => {});
  await p.waitForTimeout(2000); await openDocs(); await p.waitForTimeout(200);
  const tryPin = async v => { await p.evaluate(v => { const i = document.getElementById('dpn'); if (!i) return; i.value = v; document.querySelector('[data-dk="unlock"]').click(); }, v); await p.waitForTimeout(150); };
  for (const v of ['0000', '1111', '2222', '3333', '4444']) await tryPin(v);
  await tryPin('1234');
  const locked1 = await p.evaluate(() => !!document.getElementById('dpn'));
  ok(locked1, 'После 5 неверных PIN даже верный не принимается (пауза)');
  // перезапуск не сбрасывает паузу
  await p.reload(); await p.waitForTimeout(1800); await openDocs(); await p.waitForTimeout(200);
  await tryPin('1234');
  const locked2 = await p.evaluate(() => ({ locked: !!document.getElementById('dpn'), t: JSON.parse(localStorage.getItem('fm_pintry') || '{}') }));
  ok(locked2.locked && locked2.t.u > Date.now(), 'Перезапуск приложения не сбрасывает паузу после неверных PIN', JSON.stringify(locked2.t));
  // действия раздела под замком не работают, даже если «нажать» кнопку из кода
  const r = await p.evaluate(async () => {
    const before = JSON.stringify(st.dc || st.docs || null);
    for (const a of ['del', 'add', 'pinoff', 'edit']) { const b = document.createElement('button'); b.dataset.dk = a; b.dataset.v = 'd1'; document.getElementById('dc').appendChild(b); b.click(); b.remove(); }
    const inp = document.createElement('input'); inp.type = 'date'; inp.dataset.dce = 'd1'; inp.value = '2001-01-01'; document.getElementById('dc').appendChild(inp); inp.dispatchEvent(new Event('change', { bubbles: true })); inp.remove();
    await new Promise(r => setTimeout(r, 200));
    return { same: JSON.stringify(st.dc || st.docs || null) === before, pin: !!st.pin };
  });
  ok(r.same && r.pin, 'Под замком нельзя удалить, изменить документ или снять PIN «в обход» кнопок', JSON.stringify(r));
  // после паузы верный PIN открывает
  await p.evaluate(() => { localStorage.setItem('fm_pintry', JSON.stringify({ n: 0, u: 0, k: 0 })); });
  await p.reload(); await p.waitForTimeout(1800); await openDocs(); await p.waitForTimeout(200);
  await tryPin('1234'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById('dpn')), 'Верный PIN открывает документы');
  // в журнале действий есть записи о неудачных попытках
  const aud = await p.evaluate(() => (JSON.parse(localStorage.getItem('fm_log') || '[]')).filter(x => /audit:pin-fail/.test(x.ev)).length);
  ok(aud >= 5, 'Неудачные попытки записаны в журнал действий (' + aud + ')');
  ok(o.errs.length === 0, 'PIN: без ошибок', o.errs.slice(0, 3).join(' | '));
  await o.ctx.close();
};
