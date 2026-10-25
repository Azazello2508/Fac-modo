// Загрузка файлов: поддельные «фото» (страница, программа, SVG со скриптом, картинка с приписанным кодом),
// огромные файлы, вредное имя файла видео, поддельная резервная копия.
const { suite, rec, ok, warn, openApp } = require('./lib');
const zlib = require('zlib');

// Настоящая маленькая PNG 4×4 (красная)
function png() {
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(4, 0); ih.writeUInt32BE(4, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc(4 * 13); for (let y = 0; y < 4; y++) { raw[y * 13] = 0; for (let x = 0; x < 4; x++) raw.set([255, 0, 0], y * 13 + 1 + x * 3); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = async function (browser, URL) {
  suite('19. Загрузка фото и файлов');
  const o = await openApp(browser, URL); const p = o.p;
  const photo = () => p.evaluate(() => st.photo || '');
  const F = {
    'страница HTML под видом фото (.jpg)': { name: 'cat.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<html><script>__x(1)</script></html>') },
    'программа Windows под видом фото (.png)': { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(5000)]) },
    'SVG со скриптом': { name: 'pic.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="__x(2)"><script>__x(3)</script></svg>') },
    'файл без типа и расширения': { name: 'file', mimeType: '', buffer: Buffer.from('hello') },
    'пустой файл .jpg': { name: 'empty.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(0) },
    'фото больше 30 МБ': { name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(31 * 1024 * 1024, 1) },
  };
  const bad = [];
  await p.evaluate(() => { st.photo = ''; save(); });
  for (const [name, f] of Object.entries(F)) {
    await p.setInputFiles('#pf', f); await p.waitForTimeout(500);
    const ph = await photo();
    if (ph) { bad.push(name + ' — принят'); await p.evaluate(() => { delete st.photo; save(); }); }
  }
  ok(bad.length === 0, 'Поддельные и слишком большие «фото» не принимаются (' + Object.keys(F).length + ' видов)', bad.join('; '));

  // Настоящая картинка с приписанным в конце кодом: принимается, но перерисовывается — от кода ничего не остаётся
  const poly = Buffer.concat([png(), Buffer.from('<script>__x(4)</script><?php system($_GET[c]); ?>')]);
  await p.setInputFiles('#pf', { name: 'poly.png', mimeType: 'image/png', buffer: poly }); await p.waitForTimeout(800);
  const ph = await photo();
  const clean = /^data:image\/jpeg;base64,/.test(ph) && !/script|php/i.test(Buffer.from(ph.split(',')[1] || '', 'base64').toString('latin1'));
  ok(clean, 'Картинка с приписанным кодом перерисовывается в чистый JPEG — код из файла не сохраняется', ph.slice(0, 40));

  // То же для журнала ремонтов
  await p.evaluate(() => { const t = [...document.querySelectorAll('.fmt')].find(x => /Журнал ремонтов/.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(200);
  if (await p.$('#rlf')) {
    await p.setInputFiles('#rlf', F['страница HTML под видом фото (.jpg)']); await p.waitForTimeout(400);
    await p.setInputFiles('#rlf', F['SVG со скриптом']); await p.waitForTimeout(400);
    const rl = await p.evaluate(() => typeof rlPh !== 'undefined' ? rlPh : (document.querySelector('#rlg img[src^="data:"]') ? 'есть' : ''));
    ok(!rl, 'Журнал ремонтов: поддельное фото не прикрепляется', String(rl).slice(0, 40));
  }
  await p.evaluate(() => document.getElementById('fmx').click());

  // Фото из данных показывается, только если это настоящая JPEG-картинка
  const r = await p.evaluate(async () => {
    for (const v of ['javascript:__x(5)', 'data:image/svg+xml,<svg onload="__x(6)">', '"><img src=x onerror=__x(7)>', 'https://evil.example/track.png']) { st.photo = v; save(); render(); }
    await new Promise(r => setTimeout(r, 300));
    return { xss: window.__XSS.slice(), ext: [...document.querySelectorAll('img')].filter(i => /evil\.example|svg\+xml,<svg onload|^javascript:/.test(i.getAttribute('src') || '')).length };
  });
  ok(r.xss.length === 0 && r.ext === 0, 'Подменённое фото в данных (javascript:, SVG, чужой сайт) не показывается', JSON.stringify(r));
  await p.evaluate(() => { delete st.photo; save(); });

  // Видео: не видео не принимается, вредное имя файла не срабатывает
  const v = await p.evaluate(async () => {
    const W = ms => new Promise(r => setTimeout(r, ms)), inp = document.getElementById('flvf'); if (!inp) return 'нет поля';
    return 'ok';
  });
  if (v === 'ok') {
    // открываем свой фильм, чтобы появился список файлов
    await p.evaluate(() => { const b = document.querySelector('[data-flv],[data-fl="my"],[data-fm="file"]'); b && b.click(); });
    await p.setInputFiles('#flvf', { name: 'virus.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') }); await p.waitForTimeout(400);
    const exeSaved = await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('fm_flv') || '{}')).includes('virus.exe'));
    await p.setInputFiles('#flvf', { name: '<img src=x onerror=__x(8)>.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(1000) }); await p.waitForTimeout(800);
    const r2 = await p.evaluate(() => ({ xss: window.__XSS.slice(), tags: document.querySelectorAll('#flvp img[src="x"]').length }));
    ok(!exeSaved, 'Видео: программа (.exe) не принимается как видеофайл');
    ok(r2.xss.length === 0 && r2.tags === 0, 'Видео: вредное имя файла показывается как текст и не срабатывает', JSON.stringify(r2));
  }

  // Резервная копия: огромная и не JSON не принимаются, данные остаются
  await p.evaluate(() => { st.name = 'Живые данные'; save(); });
  await p.setInputFiles('#fi', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.alloc(41 * 1024 * 1024, 32) }); await p.waitForTimeout(500);
  await p.setInputFiles('#fi', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from('MZ\x90\x00 это не json') }); await p.waitForTimeout(500);
  await p.setInputFiles('#fi', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from('{"done":[],"custom":1}') }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => st.name) === 'Живые данные', 'Поддельные и огромные файлы резервной копии не принимаются, данные не теряются');
  ok(o.errs.filter(e => !/xq|404/.test(e)).length === 0 && (await p.evaluate(() => window.__XSS.length)) === 0, 'Загрузки не вызвали ошибок и не выполнили чужой код', o.errs.slice(0, 3).join(' | '));
  await o.ctx.close();
};
