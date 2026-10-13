"""Собирает статьи «Библиотеки знаний» из tools/library/*.json и встраивает их в index.html.
Запуск: python3 tools/library_build.py index.html, затем python3 tools/i18n_build.py index.html

Файл темы tools/library/<id>.json: {"sec": "el", "articles": [...]}, id темы как в LB (el, me, na, sh, fi, ho, mo, ps).
Статья: {"i": номер в LB,
         "t": [название, title], "l": [кратко, lead]   — только для новых статей (их ещё нет в LB),
         "w": [[ru, en], ...]  — «Как это работает», абзацы,
         "p": [[ru, en], ...]  — «На практике»,
         "e": [[ru, en], ...]  — «Ошибки и опасности»,
         "q": [[[вопрос, question], [ответ, answer]], ...] — «Проверь себя»}
Русский текст попадает в index.html (между /*LBA-DATA*/ и /*LBA-DATA-END*/),
пары [русский, английский] — в tools/i18n_lib.json для английского режима.
Числа в русском и английском тексте должны совпадать и идти в том же порядке (словарь заменяет их на #)."""
import glob, json, os, re, sys

ORDER = ['el', 'me', 'na', 'sh', 'fi', 'ho', 'mo', 'ps']
NUM = re.compile(r'\d+')
p = sys.argv[1]
s = open(p, encoding='utf-8', newline='').read()

secs = {}
for f in glob.glob(os.path.join('tools', 'library', '*.json')):
    d = json.load(open(f, encoding='utf-8'))
    secs[d['sec']] = d['articles']

A, N, pairs, errors = {}, {}, [], []

def pair(x, where):
    ru, en = x
    if NUM.findall(ru) != NUM.findall(en):
        errors.append('%s: числа не совпадают\n  ru: %s\n  en: %s' % (where, ru, en))
    pairs.append([NUM.sub('#', ru), NUM.sub('#', en), 0])
    return ru

for sec in sorted(secs, key=lambda k: ORDER.index(k) if k in ORDER else 99):
    for a in sorted(secs[sec], key=lambda a: a['i']):
        key = '%s%d' % (sec, a['i'])
        if 't' in a:
            N.setdefault(sec, []).append([a['i'], pair(a['t'], key + '.t'), pair(a['l'], key + '.l')])
        o = {}
        for k in ('w', 'p', 'e'):
            if a.get(k):
                o[k] = [pair(x, '%s.%s%d' % (key, k, n)) for n, x in enumerate(a[k])]
        if a.get('q'):
            o['q'] = [[pair(q, '%s.q%d' % (key, n)), pair(r, '%s.a%d' % (key, n))] for n, (q, r) in enumerate(a['q'])]
        A[key] = o

if errors:
    print('\n'.join(errors)); sys.exit(1)

data = 'var LBA=' + json.dumps(A, ensure_ascii=False, separators=(',', ':')) + ',LBN=' + json.dumps(N, ensure_ascii=False, separators=(',', ':')) + ';'
a = s.find('/*LBA-DATA*/'); b = s.find('/*LBA-DATA-END*/')
assert a > 0 and b > a, 'markers not found'
s = s[:a + len('/*LBA-DATA*/')] + data + s[b:]
open(p, 'w', encoding='utf-8', newline='').write(s)

seen, out = set(), []
for x in pairs:
    if x[0] not in seen:
        seen.add(x[0]); out.append(x)
json.dump(out, open(os.path.join('tools', 'i18n_lib.json'), 'w', encoding='utf-8', newline=''), ensure_ascii=False, indent=0)
print('articles', len(A), 'new', sum(len(v) for v in N.values()), 'strings', len(out), 'bytes', len(data.encode('utf-8')))
