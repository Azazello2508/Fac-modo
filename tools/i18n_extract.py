"""Собирает все русские строки приложения для перевода на английский.
Запуск: python3 tools/i18n_extract.py index.html > tools/i18n_ru.json
Пропускает встроенные игры (text/plain) и каталог книг (BKD)."""
import re, sys, json, html

CYR = re.compile(r'[А-Яа-яЁё]')
src = open(sys.argv[1], encoding='utf-8').read()

def js_literals(code):
    out = []; i = 0; n = len(code); prev = ''
    while i < n:
        c = code[i]
        if code.startswith('//', i):
            j = code.find('\n', i); i = n if j < 0 else j; continue
        if code.startswith('/*', i):
            j = code.find('*/', i); i = n if j < 0 else j + 2; continue
        if c == '/' and prev in '(,=:[!&|?{};+\n' :
            j = i + 1; cls = False
            while j < n:
                d = code[j]
                if d == '\\': j += 2; continue
                if d == '[': cls = True
                elif d == ']': cls = False
                elif d == '/' and not cls: break
                elif d == '\n': break
                j += 1
            i = j + 1; prev = '/'; continue
        if c in '"\'`':
            j = i + 1; buf = []
            while j < n and code[j] != c:
                if code[j] == '\\' and j + 1 < n:
                    e = code[j + 1]
                    if e == 'u':
                        buf.append(chr(int(code[j + 2:j + 6], 16))); j += 6; continue
                    buf.append({'n': '\n', 't': '\t'}.get(e, e)); j += 2; continue
                buf.append(code[j]); j += 1
            lit = ''.join(buf)
            k = i - 1
            while k >= 0 and code[k] in ' \t': k -= 1
            m = j + 1
            while m < n and code[m] in ' \t': m += 1
            plus = (k >= 0 and code[k] == '+') or (m < n and code[m] == '+')
            out.append((lit, plus))
            i = j + 1; prev = 'x'; continue
        if not c.isspace(): prev = c
        elif c == '\n': prev = prev or '\n'
        i += 1
    return out

def pieces(text):
    res = []
    for m in re.finditer(r'(?:title|placeholder|aria-label|alt|value|data-tip)="([^"]*)"', text):
        res.append(m.group(1))
    for part in re.split(r'<[^>]*>', text):
        res.append(part)
    out = []
    for p in res:
        p = html.unescape(p).strip()
        if CYR.search(p): out.append(p)
    return out

items = {}
def add(t, frag):
    k = re.sub(r'\d+', '#', t)
    if k not in items: items[k] = frag
    else: items[k] = items[k] or frag

# HTML разметка вне скриптов
body = re.sub(r'<script\b[^>]*>.*?</script>', '', src, flags=re.S)
body = re.sub(r'<style\b[^>]*>.*?</style>', '', body, flags=re.S)
for p in pieces(body): add(p, True)

for m in re.finditer(r'<script>(.*?)</script>', src, flags=re.S):
    code = m.group(1)
    a = code.find('var BKD=')
    if a >= 0:
        b = code.find('\n', a); code = code[:a] + code[b:]
    for lit, plus in js_literals(code):
        if not CYR.search(lit): continue
        ps = pieces(lit) if '<' in lit or '&' in lit else [lit.strip()]
        for p in ps:
            add(p, plus or len(p) <= 40 or p != lit.strip())

json.dump([[k, v] for k, v in items.items()], sys.stdout, ensure_ascii=False, indent=0)
