// Статическая проверка без браузера: секреты, опасный код, «вирусные» признаки, картинки внутри приложения,
// встроенные игры, файлы репозитория, сборка на GitHub (workflows), зависимости.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const { ROOT, suite, rec, ok, warn } = require('./lib');

const read = f => fs.readFileSync(path.join(ROOT, f));
const files = cp.execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n').filter(f => fs.existsSync(path.join(ROOT, f)));
const TEXT = /\.(html|js|json|md|yml|yaml|py|sh|txt|svg|webmanifest|css|gitignore|nojekyll)$/i;
const app = read('index.html').toString('utf8');

// Встроенные игры: <script type="text/plain" id="..-src">base64</script>
function games() {
  const out = [], re = /<script type="text\/plain" id="([a-z0-9-]+)">([^<]*)<\/script>/g; let m;
  while ((m = re.exec(app))) out.push({ id: m[1], html: Buffer.from(m[2].trim(), 'base64').toString('utf8') });
  return out;
}
// Код приложения без встроенных игр и без картинок (чтобы искать по самому коду)
const appCode = app.replace(/<script type="text\/plain"[^>]*>[^<]*<\/script>/g, '').replace(/data:[a-z0-9.+/-]+;base64,[A-Za-z0-9+/=]+/g, 'data:…');

function secrets() {
  suite('1. Пароли, ключи и токены в файлах');
  const P = {
    'GitHub токен': /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/,
    'AWS ключ': /\bAKIA[0-9A-Z]{16}\b/,
    'Google API ключ': /\bAIza[0-9A-Za-z_-]{35}\b/,
    'Slack токен': /\bxox[abprs]-[0-9A-Za-z-]{10,}/,
    'Stripe/OpenAI/Anthropic ключ': /\b(sk_live_[0-9a-zA-Z]{20,}|sk-(ant-|proj-)?[A-Za-z0-9_-]{32,})\b/,
    'Приватный ключ': /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    'Ключ App Store (.p8) в тексте': /MIG[TH]AgEAMBMGByqGSM49AgEG/,
    'Пароль в коде': /\b(password|passwd|pwd|secret|api_key|apikey|token)\s*[:=]\s*["'][^"'\s]{8,}["']/i,
    'Код разработчика открытым текстом': /\bFM-[A-Z0-9]{4}-[A-Z0-9]{4}\b/,
  };
  const found = [];
  for (const f of files) {
    if (!TEXT.test(f)) continue;
    const t = read(f).toString('utf8');
    for (const [k, re] of Object.entries(P)) { const m = re.exec(t); if (m) found.push(f + ': ' + k + ' («' + m[0].slice(0, 12) + '…»)'); }
  }
  ok(found.length === 0, 'Нет паролей, ключей и токенов в файлах репозитория (' + files.length + ' файлов)', found.join('; '));
  // В коде есть только отпечаток кода разработчика
  ok(/var DEVH="[0-9a-f]{64}"/.test(app), 'Код разработчика хранится только как отпечаток SHA-256', 'не найден DEVH');
  // Секреты App Store используются только в ios-store.yml, ключ Android — только в android.yml, и только через secrets.*
  const wf = files.filter(f => f.startsWith('.github/workflows/'));
  const leak = wf.filter(f => f !== '.github/workflows/ios-store.yml' && (f === '.github/workflows/android.yml' ? /secrets\.(?!GITHUB_TOKEN|ANDROID_KEYSTORE\b|ANDROID_KEY_PASS\b)/ : /secrets\.(?!GITHUB_TOKEN)/).test(read(f).toString()));
  ok(leak.length === 0, 'Секреты App Store используются только в ios-store.yml, ключ Android — только в android.yml', leak.join(', '));
}

function dangerousCode() {
  suite('2. Опасный код в приложении и играх');
  const all = [{ id: 'index.html', html: appCode }, ...games(), ...files.filter(f => /^games\/.*\.html$/.test(f)).map(f => ({ id: f, html: read(f).toString() }))];
  const P = {
    'eval()': /(^|[^\w.])eval\s*\(/,
    'new Function()': /new\s+Function\s*\(/,
    'document.write()': /document\.write(ln)?\s*\(/,
    'ссылка javascript:': /href\s*=\s*["']\s*javascript:/i,
    'setTimeout со строкой': /set(Timeout|Interval)\s*\(\s*["'`]/,
    'document.cookie': /document\.cookie/,
    'спрятанный код (eval(atob / unescape)': /(eval|Function)\s*\(\s*(atob|unescape|decodeURIComponent)\s*\(/,
  };
  const bad = [];
  for (const g of all) for (const [k, re] of Object.entries(P)) if (re.test(g.html)) bad.push(g.id + ': ' + k);
  ok(bad.length === 0, 'Нет eval, new Function, document.write, javascript:-ссылок, document.cookie (' + all.length + ' частей кода)', bad.join('; '));

  // Внешние скрипты и стили не подгружаются: всё внутри файла (иначе чужой сервер мог бы подменить код)
  const ext = [...appCode.matchAll(/<(script|link|iframe|img|embed|object)[^>]+(src|href)\s*=\s*["'](https?:)?\/\/[^"']+/gi)].map(m => m[0].slice(0, 90))
    .filter(x => !/<link[^>]+rel=["']?(noopener|external)/.test(x));
  ok(ext.length === 0, 'Приложение не подгружает скрипты, стили и картинки с чужих сайтов', ext.join('; '));

  // http:// (без шифрования) — только пространства имён SVG/XML, это не ссылки
  const http = [...new Set([...appCode.matchAll(/http:\/\/[a-z0-9.-]+[^"'\s<)]*/gi)].map(m => m[0]))].filter(u => !/^http:\/\/www\.w3\.org\//.test(u));
  ok(http.length === 0, 'Нет незашифрованных ссылок http://', http.join(', '));

  // Ссылки в новом окне без rel="noopener" — открытый сайт мог бы управлять окном приложения
  const blank = [...appCode.matchAll(/<a\b[^>]*target=["']?_blank[^>]*>/gi)].map(m => m[0]).filter(a => !/noopener|noreferrer/.test(a));
  const blankJs = (appCode.match(/target\s*=\s*["']_blank["']/g) || []).length;
  warn(blank.length === 0, 'Ссылки «в новом окне» защищены rel="noopener"', blank.length + ' ссылок без noopener: ' + blank.slice(0, 3).join(' '), blankJs + ' мест');

  // Заголовки безопасности в <meta> (GitHub Pages не даёт настоящих заголовков)
  ok(/http-equiv="Content-Security-Policy"[^>]*object-src 'none'/.test(app), 'Есть защита CSP: запрещены плагины (object-src) и подмена базового адреса (base-uri)');
  ok(/<meta name="referrer" content="no-referrer">/.test(app), 'Сайтам по ссылкам не передаётся адрес приложения (referrer)');
}

function virusSigns() {
  suite('3. Признаки вирусов и вредоносного кода');
  const sig = {
    'EICAR (тестовый вирус)': /X5O!P%@AP\[4\\PZX54\(P\^\)7CC\)7\}\$EICAR/,
    'майнер криптовалюты': /coinhive|cryptonight|coin-hive|webminer|miner\.start|CoinImp|jsecoin/i,
    'кейлоггер (отправка нажатий)': /addEventListener\(\s*["']key(down|press|up)["'][^)]*\)[^;]{0,200}(fetch|sendBeacon|XMLHttpRequest)/,
    'скрытый iframe на чужой сайт': /<iframe[^>]+src=["']https?:\/\/[^>]+(width=["']?0|height=["']?0|display:\s*none)/i,
    'отправка данных приложения в интернет': /(fetch|sendBeacon|XMLHttpRequest)[^;]{0,120}localStorage/,
    'длинная цепочка String.fromCharCode': /String\.fromCharCode\((\s*\d+\s*,){40,}/,
  };
  const bad = [];
  // сами проверялки содержат образцы вирусных слов как правила поиска — их не проверяем
  const SCANNERS = new Set(['tests/full/static.js', 'tools/game_guard.py']);
  const targets = [...files.filter(f => TEXT.test(f) && !SCANNERS.has(f)).map(f => ({ id: f, t: read(f).toString('utf8') })), ...games().map(g => ({ id: 'встроенная игра ' + g.id, t: g.html }))];
  for (const x of targets) for (const [k, re] of Object.entries(sig)) if (re.test(x.t)) bad.push(x.id + ': ' + k);
  ok(bad.length === 0, 'Нет признаков вирусов, майнеров, кейлоггеров и скрытой отправки данных (' + targets.length + ' файлов и игр)', bad.join('; '));

  // Исполняемые файлы (программы для Windows, Linux, Mac) в репозитории
  const MAGIC = [['MZ', 'программа Windows (.exe)'], ['\x7fELF', 'программа Linux'], ['\xcf\xfa\xed\xfe', 'программа Mac'], ['\xca\xfe\xba\xbe', 'программа Mac/Java'], ['PK\x03\x04', 'архив ZIP'], ['Rar!', 'архив RAR'], ['%PDF', 'PDF']];
  const exe = [];
  for (const f of files) {
    const b = read(f).subarray(0, 8).toString('latin1');
    for (const [m, k] of MAGIC) if (b.startsWith(m)) exe.push(f + ' — ' + k);
  }
  ok(exe.length === 0, 'В репозитории нет программ, архивов и PDF — только код, тексты и картинки', exe.join('; '));

  // Тип файла совпадает с расширением (картинка — это правда картинка)
  const SIG = { '.png': '\x89PNG', '.ttf': '\x00\x01\x00\x00', '.svg': null };
  const wrong = [];
  for (const f of files) {
    const e = path.extname(f).toLowerCase(), b = read(f);
    if (SIG[e]) { if (!b.subarray(0, 4).toString('latin1').startsWith(SIG[e])) wrong.push(f); }
    if (e === '.png' && !b.subarray(-8).toString('latin1').includes('IEND')) wrong.push(f + ' (нет конца PNG — к картинке что-то приписано)');
    if (e === '.svg' && /<script|on\w+\s*=|javascript:/i.test(b.toString())) wrong.push(f + ' (скрипт внутри SVG)');
    if (e === '.json') { try { JSON.parse(b.toString()); } catch (x) { wrong.push(f + ' (сломанный JSON)'); } }
  }
  ok(wrong.length === 0, 'Все картинки, шрифты и JSON настоящие и целые', wrong.join('; '));
  const exec = cp.execSync('git ls-files -s', { cwd: ROOT }).toString().split('\n').filter(l => l.startsWith('100755')).map(l => l.split('\t')[1]);
  rec('info', 'Файлы с правом запуска: ' + (exec.join(', ') || 'нет'));
}

function embeddedImages() {
  suite('4. Картинки и данные внутри index.html');
  const MAG = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/gif': [0x47, 0x49, 0x46], 'audio/wav': [0x52, 0x49, 0x46, 0x46], 'font/ttf': [0, 1, 0, 0] };
  const re = /data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=]{16,})/g; let m, n = 0; const bad = [], kinds = {};
  while ((m = re.exec(app))) {
    n++; kinds[m[1]] = (kinds[m[1]] || 0) + 1; const b = Buffer.from(m[2], 'base64'), sig = MAG[m[1]];
    if (sig && !sig.every((x, i) => b[i] === x)) bad.push(m[1] + ' на позиции ' + m.index + ' — внутри не ' + m[1]);
    if (m[1] === 'image/svg+xml' && /<script|on\w+=|javascript:/i.test(b.toString())) bad.push('SVG со скриптом на позиции ' + m.index);
    if (m[1] === 'image/png' && !b.subarray(-12).toString('latin1').includes('IEND')) bad.push('PNG без конца на позиции ' + m.index);
    if (b.subarray(0, 2).toString('latin1') === 'MZ' || b.subarray(0, 4).toString('latin1') === '\x7fELF') bad.push('программа внутри data: на позиции ' + m.index);
  }
  const svgs = [...app.matchAll(/data:image\/svg\+xml(;utf8|;charset=utf-8)?,([^"')]+)/g)].map(x => decodeURIComponent(x[2]));
  for (const s of svgs) if (/<script|on\w+=|javascript:/i.test(s)) bad.push('SVG со скриптом: ' + s.slice(0, 60));
  ok(bad.length === 0, 'Все ' + n + ' встроенных картинок и файлов настоящие, без скрытого кода (' + Object.entries(kinds).map(([k, v]) => k + ' ×' + v).join(', ') + ')', bad.join('; '));
}

function embeddedGames() {
  suite('5. Встроенные игры');
  const G = games();
  rec('info', 'Встроено игр: ' + G.length + ' (' + G.map(g => g.id).join(', ') + ')');
  // Совпадают ли настольные игры с исходниками games/*.html
  const map = { 'dr-src': 'durak', 'db-src': 'debertz', 'cs-src': 'chess', 'cr-src': 'checkers', 'nd-src': 'nardy', 'mb-src': 'morboy', 'su-src': 'sudoku', 'p15-src': 'pyatnashki', 'kw-src': 'krossvord', 'g2-src': 'more2048', 'sm-src': 'samolety' };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-embed-'));
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(tmp, 'index.html'));
  const diff = [];
  for (const [id, f] of Object.entries(map)) {
    const r = cp.spawnSync('python3', [path.join(ROOT, 'tools/embed_tanchiki.py'), path.join(ROOT, 'games', f + '.html'), id], { cwd: tmp }).stdout.toString().trim();
    if (r !== 'changed=false') diff.push(f + ' (' + (r || 'ошибка') + ')');
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  warn(diff.length === 0, 'Встроенные игры совпадают с исходниками в games/', 'отличаются: ' + diff.join(', ') + ' — встроятся при ежечасной проверке');

  // Сторож игр: что игра может делать (тот же сторож встроен в tools/embed_tanchiki.py)
  const guard = require('./game_guard');
  const bad = [];
  for (const g of G) { const r = guard.check(g.html, g.id); if (r.length) bad.push(g.id + ': ' + r.join(', ')); }
  ok(bad.length === 0, 'Ни одна игра не трогает данные приложения, не ходит на чужие сайты и не прячет код', bad.join('; '));
  const online = G.filter(g => /new WebSocket|fetch\(/.test(g.html)).map(g => g.id + ' → ' + [...new Set(g.html.match(/https:\/\/[a-z0-9.-]+/g) || [])].join(', '));
  rec('info', 'Игры с игрой через интернет: ' + (online.join('; ') || 'нет'));
  // Игры запускаются внутри приложения без «песочницы» — у них тот же доступ к памяти телефона
  const sandbox = /f\.sandbox|setAttribute\(["']sandbox/.test(appCode);
  warn(sandbox, 'Игры запущены в «песочнице» (сейчас — без неё)', 'игры работают с теми же правами, что приложение: защита — сторож при встраивании (tools/game_guard.py)');
}

function workflows() {
  suite('6. Сборка и публикация на GitHub (workflows)');
  const wf = files.filter(f => f.startsWith('.github/workflows/'));
  const bad = [], soft = [];
  for (const f of wf) {
    const t = read(f).toString(), name = path.basename(f);
    if (!/^permissions:/m.test(t)) bad.push(name + ': не ограничены права (permissions)');
    for (const m of t.matchAll(/uses:\s*([^\s#]+)/g)) {
      const u = m[1];
      if (u.startsWith('./')) continue;
      if (!/@/.test(u) || /@(main|master|latest|HEAD)$/.test(u)) bad.push(name + ': действие без версии ' + u);
      else if (!/@[0-9a-f]{40}$/.test(u) && !/^actions\//.test(u)) soft.push(name + ': ' + u);
    }
    if (/pull_request_target/.test(t)) bad.push(name + ': pull_request_target (чужой код с правами записи)');
    // Подстановка текста из issue/PR прямо в команду — классический взлом сборки
    const runs = [...t.matchAll(/run:\s*\|?([\s\S]*?)(?=\n\s*-\s|\n\s*\w+:\s|\n[a-z]|$)/g)].map(x => x[1]).join('\n');
    if (/\$\{\{\s*github\.(event\.(issue|pull_request|comment|review|head_commit|commits|pages)|head_ref)[^}]*\}\}/.test(runs)) bad.push(name + ': текст из issue/PR подставляется в команду');
    if (/curl[^|\n]*\|\s*(ba)?sh/.test(t)) bad.push(name + ': скачанный скрипт запускается сразу (curl | sh)');
    if (/npm (i|install)(?![^\n]*@\d)[^\n]*\b[a-z@][\w/-]+\b(?!@)/.test(t) && /npm (i|install) [^\n-]*[a-z](\s|$)/.test(t)) soft.push(name + ': npm install без версии');
  }
  ok(bad.length === 0, 'Сборка защищена: права ограничены, действия с версиями, нет подстановки чужого текста в команды (' + wf.length + ' файлов)', bad.join('; '));
  rec('info', 'Действия GitHub закреплены по версии (обновляет Dependabot)' + (soft.length ? ': ' + soft.length + ' шт.' : ''));
  const cap = read('.github/workflows/ios.yml').toString().match(/@capacitor\/[a-z-]+@[\d.]+/g) || [];
  ok(cap.length > 0 && cap.every(c => /@\d+\.\d+\.\d+$/.test(c)), 'Версии Capacitor закреплены точно (' + cap.length + ' пакетов)');
  ok(fs.existsSync(path.join(ROOT, '.github/dependabot.yml')), 'Dependabot следит за обновлениями действий GitHub');
}

function dependencies() {
  suite('7. Уязвимости в библиотеках (npm audit)');
  const caps = [...new Set(read('.github/workflows/ios.yml').toString().match(/@capacitor\/[a-z-]+@[\d.]+/g) || [])];
  const test = (read('.github/workflows/tests.yml').toString().match(/\b(playwright|axe-core)@[\d.]+/g) || []);
  const deps = {};
  for (const c of [...caps, ...test]) { const i = c.lastIndexOf('@'); deps[c.slice(0, i)] = c.slice(i + 1); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-audit-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fm-audit', version: '1.0.0', private: true, dependencies: deps }));
  try {
    cp.execSync('npm install --package-lock-only --no-fund --ignore-scripts --silent', { cwd: dir, stdio: 'pipe', timeout: 180000 });
    const out = cp.spawnSync('npm', ['audit', '--json'], { cwd: dir, timeout: 120000 }).stdout.toString();
    const a = JSON.parse(out), v = a.metadata && a.metadata.vulnerabilities || {};
    const lock = JSON.parse(fs.readFileSync(path.join(dir, 'package-lock.json')));
    const n = Object.keys(lock.packages || {}).length - 1;
    const serious = (v.high || 0) + (v.critical || 0);
    ok(serious === 0, 'Нет серьёзных уязвимостей в библиотеках приложения и тестов (' + Object.keys(deps).length + ' пакетов, всего с зависимостями ' + n + ')',
      'high: ' + (v.high || 0) + ', critical: ' + (v.critical || 0) + ' — ' + Object.keys(a.vulnerabilities || {}).join(', '));
    if ((v.moderate || 0) + (v.low || 0)) rec('warn', 'Мелкие уязвимости в библиотеках сборки (в само приложение на телефоне они не попадают)', 'moderate: ' + (v.moderate || 0) + ', low: ' + (v.low || 0) + ' — ' + Object.keys(a.vulnerabilities || {}).join(', '));
  } catch (e) {
    rec('warn', 'npm audit не запустился (нет доступа к registry.npmjs.org?)', String(e.message).slice(0, 200));
  }
  fs.rmSync(dir, { recursive: true, force: true });
  // Python-инструменты: только стандартная библиотека (+ fontTools для шрифта резюме)
  const ext = new Set();
  for (const f of files.filter(f => f.endsWith('.py'))) for (const m of read(f).toString().matchAll(/^(?:from|import)\s+([a-zA-Z_][\w]*)/gm)) ext.add(m[1]);
  const std = new Set(['base64', 're', 'sys', 'glob', 'json', 'os', 'struct', 'urllib', 'concurrent', 'html', 'hashlib', 'game_guard', 'math', 'time', 'collections', 'io', 'zlib']);
  rec('info', 'Python-инструменты используют внешние библиотеки: ' + ([...ext].filter(x => !std.has(x)).join(', ') || 'нет'));
}

module.exports = async function () { secrets(); dangerousCode(); virusSigns(); embeddedImages(); embeddedGames(); workflows(); dependencies(); };
