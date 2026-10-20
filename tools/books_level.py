"""Уровни английских книг (A2…C2) для раздела «Книги».
Запуск: python3 tools/books_level.py index.html            — посчитать уровни из tools/books_stats.json и вписать в блок /*BKLV-DATA*/
        python3 tools/books_level.py index.html measure    — заново скачать тексты из Project Gutenberg и обновить tools/books_stats.json (около 30 минут)
Оценка: доля редких слов (не входящих в 10 000 самых частых слов современного английского, список FrequencyWords по субтитрам)
и средняя длина слова. Для авторов со старым или запутанным языком — нижняя граница уровня (FLOOR).
Аудиокниги берут уровень у текстовой версии той же книги (ALT)."""
import json, re, sys, os, urllib.request, concurrent.futures as cf

P = sys.argv[1]
STATS = 'tools/books_stats.json'
CUT = [62, 70, 82, 95]  # границы баллов: <62 A2, <70 B1, <82 B2, <95 C1, иначе C2
FLOOR = [  # (автор или название, не ниже уровня 1=A2 … 5=C2)
    (r'Henry James', 4), (r'Fielding|Smollett|Sterne|Richardson|Swift', 4), (r'Defoe', 3), (r'Austen', 3),
    (r'Dickens', 3), (r'Hawthorne|Melville', 4), (r'Joyce', 4), (r'Shakespeare', 4), (r'Chaucer|Spenser|Milton|Middle English', 5),
    (r'Huckleberry|Dracula|Karamazov|Anna Karenina|Sons and Lovers|Constitution|Federalist|Iliad|Odyss', 3),
]
NOFLOOR = r'Beautiful Stories from Shakespeare|for Boys and Girls|Lamb'


def level(sc):
    return 1 + sum(sc >= c for c in CUT)


def build():
    s = open(P, encoding='utf-8', newline='').read()
    meta = json.loads(re.search(r'var BKD=\{en:\[(\{.*?\}),\[', s).group(1))
    st = json.load(open(STATS, encoding='utf-8'))
    out, cnt = {}, [0] * 6
    for i, (t, a) in meta.items():
        d = st.get(i)
        if not d:
            continue
        lv = level(400 * d[0] + 10 * d[1])
        if not re.search(NOFLOOR, t):
            for rx, mn in FLOOR:
                if re.search(rx, t + ' | ' + a):
                    lv = max(lv, mn)
        out[i] = lv
        cnt[lv] += 1
    data = json.dumps(out, separators=(',', ':'))
    a = s.find('/*BKLV-DATA*/'); b = s.find('/*BKLV-DATA-END*/')
    assert a > 0 and b > a, 'markers not found'
    s = s[:a + len('/*BKLV-DATA*/')] + data + s[b:]
    open(P, 'w', encoding='utf-8', newline='').write(s)
    print('books', len(meta), 'levelled', len(out), 'A2..C2', cnt[1:])


def measure():
    """Скачивает тексты книг (и текстовые версии аудиокниг из ALT), пишет [доля редких слов, средняя длина слова]."""
    s = open(P, encoding='utf-8', newline='').read()
    meta = json.loads(re.search(r'var BKD=\{en:\[(\{.*?\}),\[', s).group(1))
    rank = {}
    freq = urllib.request.urlopen('https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt').read().decode('utf-8')
    for k, l in enumerate(freq.splitlines()):
        rank.setdefault(l.split(' ')[0], k + 1)
    W = re.compile(r"[A-Za-z]+(?:'[a-z]+)?")
    alt = json.load(open('tools/books_alt.json', encoding='utf-8'))

    def stat(i):
        for u in ('https://www.gutenberg.org/cache/epub/%s/pg%s.txt' % (i, i), 'https://www.gutenberg.org/ebooks/%s.txt.utf-8' % i):
            try:
                t = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'fac-modo-levels'}), timeout=60).read().decode('utf-8', 'replace')
                break
            except Exception:
                t = None
        if not t:
            return None
        a = t.find('*** START'); b = t.find('*** END')
        if a >= 0: t = t[t.find('\n', a) + 1:]
        if b > 0: t = t[:t.find('*** END')]
        n = len(t); t = t[n // 5:n * 4 // 5][:400000]
        ws = [w.lower() for w in W.findall(t) if not w[0].isupper()]  # имена собственные и начало фраз не считаем
        if len(ws) < 300:
            return None
        return [round(sum(rank.get(w, 99999) > 10000 for w in ws) / len(ws), 4), round(sum(map(len, ws)) / len(ws), 3)]

    ids = sorted(set(meta) | set(alt.values()), key=int)
    with cf.ThreadPoolExecutor(4) as ex:
        res = dict(zip(ids, ex.map(stat, ids)))
    out = {i: res.get(i) or res.get(alt.get(i)) for i in meta}
    json.dump({k: v for k, v in out.items() if v}, open(STATS, 'w', encoding='utf-8'), separators=(',', ':'))


if len(sys.argv) > 2 and sys.argv[2] == 'measure':
    measure()
build()
