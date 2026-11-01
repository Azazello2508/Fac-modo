// Взлом через вставку кода (XSS): в каждое поле каждого раздела вписывается «вредный» текст,
// потом все строки в данных подменяются таким текстом (как будто данные пришли из чужой копии).
// Если где-то код сработает — вызовется __x(номер), и мы узнаем, какое поле дырявое.
const { suite, rec, ok, warn, openApp, TILE_WALK, baseState } = require('./lib');

const PAY = n => `X${n}"'><img src=xq${n} onerror=__x(${n})></textarea></title><svg/onload=__x(${n})><svg id=xq${n} onload=__x(${n})>`;

// Шаг 1 (в странице): заполнить поля раздела и нажать кнопки «добавить/сохранить»
const FILL = async (box, name) => {
  const W = ms => new Promise(r => setTimeout(r, ms));
  window.__fid = window.__fid || 0; window.__fmap = window.__fmap || {};
  const pay = n => `X${n}"'><img src=xq${n} onerror=__x(${n})></textarea></title><svg/onload=__x(${n})><svg id=xq${n} onload=__x(${n})>`;
  const set = (el, v) => { const pr = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(pr, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const fields = [...box.querySelectorAll('input:not([type]),input[type=text],input[type=search],input[type=url],input[type=email],input[type=tel],textarea')]
    .filter(x => x.offsetParent && !x.readOnly && !x.disabled);
  for (const f of fields) { const n = ++window.__fid; window.__fmap[n] = name.slice(0, 30) + ' / ' + (f.id || f.placeholder || f.name || f.tagName).slice(0, 30); set(f, pay(n)); }
  const BAD = /Удал|Сброс|Очист|Стереть|Delete|Reset|Clear|Выйти|Восстанов|Загруз|Скача|Поделит|Экспорт|Импорт|Скопир|Камер|Подключ|Перенос|Шаг|✕|×|🗑|Закрыть|Отмена|PIN|Начать заново|обновлен/i;
  const GOOD = /Добав|Сохран|Запис|Постав|Готово|Создать|Отправ|Провер|Посчит|Рассчит|Найти|^\s*(➕|\+|OK|ОК)\s*/i;
  const btns = [...box.querySelectorAll('button')].filter(b => b.offsetParent && GOOD.test(b.textContent) && !BAD.test(b.textContent));
  for (const b of btns.slice(0, 12)) { try { b.click(); } catch (e) {} await W(15); }
  for (const f of fields) { if (!f.isConnected) continue; f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); f.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })); }
  await W(30);
};

// Сколько «вредного» кода сработало и сколько чужой разметки попало на страницу
const CHECK = () => { const t = [...document.querySelectorAll('img[src^="xq"],svg[id^="xq"]')].map(e => (e.getAttribute('src') || e.id).slice(2));
  return { hits: [...new Set(window.__XSS)], tags: t.length, tagIds: [...new Set(t)] }; };

module.exports = async function (browser, URL) {
  suite('11. Взлом через поля ввода (XSS)');
  const { ctx, p, errs } = await openApp(browser, URL);
  // prompt() тоже получает вредный текст
  p.removeAllListeners('dialog'); p.on('dialog', d => d.type() === 'prompt' ? d.accept(PAY(9999)).catch(() => {}) : d.accept().catch(() => {}));
  await p.evaluate(f => { window.__fill = new Function('return (' + f + ')')(); }, FILL.toString());
  const tiles = await p.evaluate(TILE_WALK, { act: '__fill' });
  const filled = await p.evaluate(() => ({ n: window.__fid, map: window.__fmap }));
  let c = await p.evaluate(CHECK);
  const fmap = filled.map;
  // после перезагрузки: все сохранённые тексты рисуются заново
  await p.reload(); await p.waitForTimeout(1800);
  await p.evaluate(TILE_WALK, { wait: 150 });
  const c2 = await p.evaluate(CHECK);
  const hits = [...new Set([...c.hits, ...c2.hits])];
  const where = hits.map(h => (fmap[h] || (h === '9999' ? 'окно prompt' : h)));
  ok(hits.length === 0, 'Вредный код в ' + filled.n + ' полях ' + tiles.length + ' разделов не сработал ни при вводе, ни после перезапуска',
    'сработал: ' + where.join('; '));
  const tg = [...new Set([...c.tagIds, ...c2.tagIds])];
  warn(tg.length === 0, 'Текст из полей не превращается в разметку (картинки, кнопки) на странице', tg.length + ' полей: ' + tg.map(h => fmap[h] || h).join('; '));
  warn(errs.length === 0, 'Странный текст в полях не ломает приложение', errs.slice(0, 4).join(' | '));
  // Сколько данных реально записалось (чтобы следующий шаг подменил настоящие поля)
  const rich = await p.evaluate(() => localStorage.getItem('quest-v2'));
  const fmKeys = await p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^fm_/.test(k)) o[k] = localStorage.getItem(k); } return o; });
  await ctx.close();

  suite('12. Взлом через подменённые данные (чужая копия, перенос с другого телефона)');
  // Каждой строке в данных приписываем вредный код со своим номером
  let k = 0; const where2 = {};
  const poison = (v, path) => {
    if (typeof v === 'string') { const n = 20000 + (++k); where2[n] = path; return v + PAY(n); }
    if (Array.isArray(v)) return v.map((x, i) => poison(x, path + '[' + i + ']'));
    if (v && typeof v === 'object') { const o = {}; for (const key in v) o[key] = poison(v[key], path + '.' + key); return o; }
    return v;
  };
  const st0 = JSON.parse(rich);
  // добавим поля, которых могло не быть после заполнения
  Object.assign(st0, { name: st0.name || 'Имя', goal: 'Цель', cv: Object.assign({ n: 'Имя', pos: 'Должность', ph: 'тел', em: 'a@b.c', ex: [{ s: 'Судно', r: 'Должность', f: '2020', t: '2021' }] }, st0.cv || {}),
    vis: Object.assign({ c: { FR: '2024-01-01' }, p: ['Порт'] }, st0.vis || {}), flmc: (st0.flmc || []).concat([{ t: 'Фильм', y: 2000 }]) });
  const bad = poison(st0, 'st');
  const badLs = {};
  for (const key in fmKeys) { try { badLs[key] = JSON.stringify(poison(JSON.parse(fmKeys[key]), key)); } catch (e) { const n = 20000 + (++k); where2[n] = key; badLs[key] = fmKeys[key] + PAY(n); } }
  // имя, поле «тема» и язык оставляем рабочими, чтобы приложение открылось как обычно
  bad.ux = st0.ux; bad.lang = 'ru';
  const res = {};
  for (const lang of ['ru', 'en']) {
    bad.lang = lang;
    const o = await openApp(browser, URL, { state: JSON.stringify(bad), ls: badLs });
    await o.p.evaluate(TILE_WALK, { wait: 120 });
    // сводка «Сегодня», плитки, «Моё» — тоже рисуются из данных
    for (const t of ['today', 'me', 'diary', 'game', 'shore', 'know', 'set']) await o.p.evaluate(t => { const b = document.querySelector('#nav [data-n="' + t + '"]'); b && b.click(); }, t);
    await o.p.waitForTimeout(400);
    res[lang] = { c: await o.p.evaluate(CHECK), errs: o.errs.slice() };
    await o.ctx.close();
  }
  const allHits = [...new Set([...res.ru.c.hits, ...res.en.c.hits])];
  ok(allHits.length === 0, 'Вредный код в ' + k + ' строках данных не сработал ни на русском, ни на английском',
    'сработал: ' + allHits.slice(0, 12).map(h => where2[h] || h).join('; '));
  const tg2 = [...new Set([...res.ru.c.tagIds, ...res.en.c.tagIds])];
  warn(tg2.length === 0, 'Строки из данных не превращаются в разметку на странице', tg2.length + ' полей: ' + tg2.map(h => where2[h] || h).join('; '));
  const er = [...new Set([...res.ru.errs, ...res.en.errs])];
  warn(er.length === 0, 'Испорченные строки в данных не ломают приложение', er.length + ' ошибок: ' + er.slice(0, 4).join(' | '));
  rec('info', 'Подменено строк в данных: ' + k + ' (основные данные и ' + Object.keys(badLs).length + ' ключей fm_*)');
};
