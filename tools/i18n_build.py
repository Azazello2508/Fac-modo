"""Встраивает английский словарь в index.html.
Запуск: python3 tools/i18n_build.py index.html
Словарь: tools/i18n_en.json (из i18n_extract.py + перевод) и tools/i18n_extra.json (ручные дополнения).
Каждая запись: [русский текст, английский текст, 1 если это короткий фрагмент]. Цифры в текстах заменены на #."""
import json, re, sys, struct

p = sys.argv[1]
s = open(p, encoding='utf-8').read()
items = json.load(open('tools/i18n_en.json', encoding='utf-8'))
items += json.load(open('tools/i18n_extra.json', encoding='utf-8'))

def fnv(t):
    b = t.encode('utf-16-le')
    units = struct.unpack('<%dH' % (len(b) // 2), b)
    h = 2166136261
    for u in units:
        h ^= u
        h = (h * 16777619) & 0xFFFFFFFF
    return base36(h) + '.' + base36(len(units))

def base36(n):
    c = '0123456789abcdefghijklmnopqrstuvwxyz'
    if n == 0: return '0'
    r = ''
    while n: n, k = divmod(n, 36); r = c[k] + r
    return r

X, H = {}, {}
for ru, en, frag in items:
    if frag or len(ru) <= 60: X[ru] = en
    else: H[fnv(ru)] = en
data = 'var I18N={x:' + json.dumps(X, ensure_ascii=False, separators=(',', ':')) + ',h:' + json.dumps(H, ensure_ascii=False, separators=(',', ':')) + '};'
a = s.find('/*I18N-DATA*/'); b = s.find('/*I18N-DATA-END*/')
assert a > 0 and b > a, 'markers not found'
s = s[:a + len('/*I18N-DATA*/')] + data + s[b:]
open(p, 'w', encoding='utf-8').write(s)
print('entries', len(X), len(H), 'bytes', len(data.encode('utf-8')))
