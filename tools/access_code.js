// Коды доступа для друзей и тестировщиков (Play-версия): бесплатный «Полный доступ» без покупки.
// Коды подписаны закрытым ключом, в приложении (pro-js) — только открытая часть: код проверяется без интернета и без сервера.
//
//   Один раз — создать пару ключей (закрытый ключ класть НЕ в репозиторий, а в свою папку, никому не показывать):
//     node tools/access_code.js keygen "C:\путь\fm-access-private.pem"      (печатает открытый ключ для pro-js — ACC_PUB)
//   Выдать код (имя только для вас, чтобы помнить, кому выдан; срок необязателен):
//     node tools/access_code.js sign "C:\путь\fm-access-private.pem" "Имя" [ГГГГ-ММ-ДД]
//
// Код выглядит как FM1.<данные>.<подпись>. Отозвать один код нельзя (всё работает без сервера), поэтому для временных людей ставьте срок.
const crypto = require('crypto'), fs = require('fs');
const [, , cmd, keyPath, name, exp] = process.argv;
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
if (cmd === 'keygen' && keyPath) {
  if (fs.existsSync(keyPath)) { console.error('Файл уже есть, перезаписывать не буду: ' + keyPath); process.exit(1); }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  console.log('Закрытый ключ сохранён в ' + keyPath + ' (не показывать, не класть в репозиторий).');
  console.log('Открытый ключ для pro-js (ACC_PUB):\n' + publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
} else if (cmd === 'sign' && keyPath && name) {
  const key = crypto.createPrivateKey(fs.readFileSync(keyPath));
  const o = { n: String(name).slice(0, 40) }; if (exp) { if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) { console.error('Срок — ГГГГ-ММ-ДД'); process.exit(1) } o.e = exp }
  const data = Buffer.from(JSON.stringify(o));
  const sig = crypto.sign('sha256', data, { key, dsaEncoding: 'ieee-p1363' });
  console.log('FM1.' + b64u(data) + '.' + b64u(sig));
} else { console.error('Использование: см. комментарий в начале файла'); process.exit(1) }
