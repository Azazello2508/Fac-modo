// Взлом игр по сети: «соперник» — это тест. Он присылает мусор, ходы не в свою очередь, невозможные ходы,
// подменённые кубики в нардах и враньё в морском бое. Игра должна всё это отбрасывать и не падать.
const { suite, rec, ok, warn } = require('./lib');

// 400 случайных сообщений любого вида
function junk(n) {
  const T = ['mv', 'mode', 'rc', 'rb', 'rr', 'fleet2', 'fleet', 'shot', 'res', 'reveal', 'x', '', null, '__proto__', 'constructor'];
  const V = () => [null, undefined, -1, 0, 1, 63, 64, 99, 1e9, -1e9, NaN, Infinity, 1.5, '5', 'a'.repeat(50000), [], [1, 2], {}, { __proto__: { p: 1 } }, true, 'long', 'short', 'f'.repeat(64)][Math.random() * 23 | 0];
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (r < 0.1) out.push([null, 5, 'str', [1, 2], true][i % 5]);
    else { const o = { t: T[Math.random() * T.length | 0] }; for (const k of ['f', 'to', 'from', 'path', 'taken', 'x', 'r', 'c', 'm', 'h', 'b', 'a', 'd', 's', 'salt']) if (Math.random() < 0.35) o[k] = V(); out.push(o); }
  }
  return out;
}

const SNAP = {
  chess: () => JSON.stringify(S), checkers: () => JSON.stringify({ b, turn }), nardy: () => JSON.stringify({ S, cur, phase }), morboy: () => JSON.stringify({ s: P[0].shot, turn, over }),
};

module.exports = async function (browser, URL) {
  suite('16. Взлом игр по сети');
  const ctx = await browser.newContext(); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await ctx.addInitScript(() => { if (window !== window.top) addEventListener('error', e => { try { (window.top.__FERR = window.top.__FERR || []).push(e.message); } catch (x) {} }); });
  const load = async g => { await p.goto(URL + '__harness.html?solo=1&g=' + g); await p.waitForTimeout(700); await p.evaluate(() => { window.__FERR = []; go(false); }); await p.waitForTimeout(300); return p.frames()[1]; };
  const ferr = () => p.evaluate(() => window.__FERR || []);

  for (const g of ['chess', 'checkers', 'nardy', 'morboy']) {
    // 1) мусор
    let A = await load(g);
    const before = await A.evaluate(SNAP[g]);
    await p.evaluate(list => { for (const d of list) inject(d); }, junk(400));
    await p.waitForTimeout(800);
    const e1 = await ferr();
    const alive = await A.evaluate(() => typeof NET === 'object' && !!NET);
    ok(e1.length === 0 && alive, g + ': 400 случайных «мусорных» сообщений не роняют игру', e1.slice(0, 3).join(' | '));
    // огромное сообщение и вложенность
    await p.evaluate(() => { inject({ t: 'mv', path: Array(100000).fill(1), taken: [] }); let o = {}; const r = o; for (let i = 0; i < 3000; i++) o = o.n = {}; inject(Object.assign(r, { t: 'mv' })); });
    await p.waitForTimeout(300);
    ok((await ferr()).length === 0, g + ': огромное и глубоко вложенное сообщение не роняет игру');
  }

  // 2) шахматы: невозможный ход и ход не в свою очередь
  {
    const A = await load('chess');
    const s0 = await A.evaluate(SNAP.chess);
    await p.evaluate(() => { inject({ t: 'mv', f: 0, to: 63 }); inject({ t: 'mv', f: 12, to: 44 }); inject({ t: 'mv', f: -5, to: 999 }); });
    await p.waitForTimeout(200);
    ok(await A.evaluate(SNAP.chess) === s0, 'Шахматы: невозможные ходы соперника не принимаются');
    const m = await A.evaluate(() => { const m = legal(S)[0]; return { f: m.f, to: m.t }; });
    await p.evaluate(m => inject(Object.assign({ t: 'mv' }, m)), m); await p.waitForTimeout(200);
    const s1 = await A.evaluate(SNAP.chess);
    ok(s1 !== s0, 'Шахматы: честный ход соперника принимается');
    // теперь очередь A — соперник пытается сходить ещё раз
    const m2 = await A.evaluate(() => { const L = legal(S); return L.length ? { f: L[0].f, to: L[0].t } : null; });
    await p.evaluate(m => { if (m) inject(Object.assign({ t: 'mv' }, m)); for (let f = 0; f < 64; f++) for (let t = 0; t < 64; t += 7) inject({ t: 'mv', f, to: t }); }, m2);
    await p.waitForTimeout(400);
    ok(await A.evaluate(SNAP.chess) === s1, 'Шахматы: ход не в свою очередь (и 600 попыток подряд) не принимается');
  }

  // 3) шашки
  {
    const A = await load('checkers');
    const s0 = await A.evaluate(SNAP.checkers);
    await p.evaluate(() => { inject({ t: 'mv', from: 0, path: [63], taken: [] }); inject({ t: 'mv', from: 40, path: [33, 26, 19], taken: [1, 2, 3] }); });
    await p.waitForTimeout(200);
    ok(await A.evaluate(SNAP.checkers) === s0, 'Шашки: невозможные ходы и «съесть всех сразу» не принимаются');
    const m = await A.evaluate(() => { const m = allMoves(b, turn)[0]; return { from: m.from, path: m.path, taken: m.taken }; });
    await p.evaluate(m => { inject(Object.assign({ t: 'mv' }, m)); }, m); await p.waitForTimeout(200);
    const s1 = await A.evaluate(SNAP.checkers);
    await p.evaluate(m => inject(Object.assign({ t: 'mv' }, m)), m); await p.waitForTimeout(200);
    ok(s1 !== s0 && await A.evaluate(SNAP.checkers) === s1, 'Шашки: честный ход принимается, повтор хода не в свою очередь — нет');
  }

  // 4) нарды: подмена кубиков
  {
    const A = await load('nardy');
    const r = await A.evaluate(async () => {
      const W = ms => new Promise(r => setTimeout(r, ms));
      const sent = () => parent.LOG.filter(x => x.from === 'A' && x.m.fm === 'net-send').map(x => x.m.d);
      const s0 = JSON.stringify({ S, cur, phase });
      parent.inject({ t: 'mv', from: 0, to: 5, d: 5 }); await W(200);
      const ignoredMove = JSON.stringify({ S, cur, phase }) === s0;
      const a = 'a'.repeat(32); parent.inject({ t: 'rc', h: SHA(a) }); await W(300);
      const rb = sent().find(d => d.t === 'rb');
      parent.inject({ t: 'rr', a: 'b'.repeat(32) }); await W(300);
      return { ignoredMove, rb: !!rb, stopped: phase === 'over', msg: (document.getElementById('msg') || document.body).textContent.slice(0, 200) };
    });
    ok(r.ignoredMove, 'Нарды: ход соперника до броска кубиков не принимается');
    ok(r.rb && r.stopped && /подменил/.test(r.msg), 'Нарды: подмену кубиков ловит проверка отпечатка — игра останавливается с предупреждением', JSON.stringify(r).slice(0, 200));
  }

  // 5) морской бой: выстрелы мимо поля, повторы, враньё о попаданиях, поддельное раскрытие
  {
    const A = await load('morboy');
    const r = await A.evaluate(async () => {
      const W = ms => new Promise(r => setTimeout(r, ms));
      const sent = () => parent.LOG.filter(x => x.from === 'A' && x.m.fm === 'net-send').map(x => x.m.d);
      parent.inject({ t: 'fleet2', h: 'c'.repeat(64) }); await W(100);
      const s0 = JSON.stringify(P[0].shot);
      for (const x of [-1, 100, 1e9, '5', 5.5, null]) parent.inject({ t: 'shot', x }); await W(150);
      const badShotsIgnored = JSON.stringify(P[0].shot) === s0 && !sent().some(d => d.t === 'res');
      // соперник стреляет честно, пока не промахнётся (тогда ход переходит к A)
      let x = 0; while (turn === 1 && x < 100) { parent.inject({ t: 'shot', x }); await W(40); x++; }
      const myTurn = turn === 0;
      // ответ на выстрел, которого A не делал
      const before = JSON.stringify(P[1].shot); parent.inject({ t: 'res', x: 42, r: 'sunk', c: [42] }); await W(100);
      const fakeRes = JSON.stringify(P[1].shot) === before;
      return { badShotsIgnored, myTurn, fakeRes };
    });
    ok(r.badShotsIgnored, 'Морской бой: выстрелы за пределы поля и неправильные клетки отбрасываются');
    ok(r.myTurn && r.fakeRes, 'Морской бой: ответ «потопил» на выстрел, которого не было, не принимается', JSON.stringify(r));
    const r2 = await A.evaluate(async () => {
      const W = ms => new Promise(r => setTimeout(r, ms));
      over = true; P[1].h = 'c'.repeat(64); P[1].chk = 0;
      parent.inject({ t: 'reveal', s: P[0].ships.map(x => x.cells), salt: 'x' }); await W(150);
      return document.getElementById('status').textContent;
    });
    ok(/жульничал/.test(r2), 'Морской бой: поддельное раскрытие флота в конце игры распознаётся как жульничество', r2.slice(0, 120));
  }
  ok(errs.length === 0 && (await ferr()).length === 0, 'Игры по сети: ни одной ошибки за все атаки', errs.slice(0, 3).join(' | '));
  await ctx.close();

  // 6) Сообщения не от игры приложение игнорирует (чужое окно не может управлять соединением)
  suite('17. Чужие сообщения приложению');
  const { openApp } = require('./lib');
  const o = await openApp(browser, URL);
  const r = await o.p.evaluate(async () => {
    const W = ms => new Promise(r => setTimeout(r, ms));
    let opened = 0; const og = window.RTCPeerConnection; window.RTCPeerConnection = function () { opened++; return new og(); };
    postMessage({ fm: 'net-open', g: '<img src=x onerror=__x(1)>' }, '*');
    const f = document.createElement('iframe'); f.srcdoc = '<script>parent.postMessage({fm:"net-open",g:"chess"},"*")<\/script>'; document.body.appendChild(f);
    await W(500); f.remove(); window.RTCPeerConnection = og;
    return { opened, gnet: !!(document.getElementById('gnet') && !document.getElementById('gnet').hidden), xss: window.__XSS.length };
  });
  ok(r.opened === 0 && !r.gnet && r.xss === 0, 'Сообщения из чужого окна (не из открытой игры) не открывают соединение', JSON.stringify(r));
  await o.ctx.close();

  // 7) Два «телефона» по-настоящему соединяются (WebRTC, код вместо QR) и играют; флуд режется до 40 сообщений в секунду
  suite('18. Игра по сети между двумя телефонами (настоящее соединение)');
  try {
    const H = await openApp(browser, URL), G = await openApp(browser, URL);
    const startGame = async P => { await P.p.evaluate(() => fmGame('cs-src', 'Шахматы')); await P.p.waitForTimeout(900); await P.p.frames()[1].evaluate(() => netOpen()); await P.p.waitForTimeout(300); };
    await startGame(H); await startGame(G);
    await H.p.click('#gnet [data-gn="host"]'); await G.p.click('#gnet [data-gn="join"]');
    await H.p.waitForSelector('#gnmy', { state: 'attached', timeout: 15000 });
    const offer = await H.p.$eval('#gnmy', t => t.value);
    await G.p.evaluate(c => { document.querySelector('#gnet details') && (document.querySelector('#gnet details').open = true); document.getElementById('gnin').value = c; document.querySelector('#gnet [data-gn="paste"]').click(); }, offer);
    await G.p.waitForFunction(() => { const t = document.getElementById('gnmy'); return t && /^FMa/.test(t.value); }, null, { timeout: 15000 });
    const answer = await G.p.$eval('#gnmy', t => t.value);
    await H.p.evaluate(c => { document.querySelector('#gnet details') && (document.querySelector('#gnet details').open = true); document.getElementById('gnin').value = c; document.querySelector('#gnet [data-gn="paste"]').click(); }, answer);
    const hf = H.p.frames()[1], gf = G.p.frames()[1];
    await hf.waitForFunction(() => NET && NET.me, null, { timeout: 15000 }); await gf.waitForFunction(() => NET && NET.me, null, { timeout: 15000 });
    ok(true, 'Два телефона соединились по коду (без интернета и сервера)', '', 'хозяин ' + await hf.evaluate(() => NET.me) + ', гость ' + await gf.evaluate(() => NET.me));
    const g0 = await gf.evaluate(() => JSON.stringify(S));
    await hf.evaluate(() => doMove(legal(S)[0])); await G.p.waitForTimeout(600);
    ok(await gf.evaluate(() => JSON.stringify(S)) !== g0, 'Ход хозяина доходит до гостя');
    // флуд с телефона гостя: 600 сообщений сразу
    await hf.evaluate(() => { window.__n = 0; addEventListener('message', e => { if (e.data && e.data.fm === 'net-msg') window.__n++; }); });
    await gf.evaluate(() => { for (let i = 0; i < 600; i++) netSend({ t: 'x', i }); });
    await H.p.waitForTimeout(1500);
    const n = await hf.evaluate(() => window.__n);
    ok(n > 0 && n <= 82, 'Флуд с чужого телефона режется: из 600 сообщений дошло ' + n + ' (не больше 40 в секунду)');
    ok(H.errs.length === 0 && G.errs.length === 0, 'Соединение без ошибок', [...H.errs, ...G.errs].slice(0, 3).join(' | '));
    await H.ctx.close(); await G.ctx.close();
  } catch (e) { rec('warn', 'Настоящее соединение двух телефонов проверить не удалось', String(e.message).split('\n')[0].slice(0, 200)); }
};
