"""Встраивает шрифт резюме (блок rzf-js) в index.html.
Запуск: python3 tools/cv_font.py index.html
Шрифты: tools/fonts/cv-regular.ttf и cv-bold.ttf — подмножество PT Sans (латиница, кириллица, знаки),
переименовано в FMSans по правилам SIL Open Font License 1.1 (tools/fonts/OFL.txt). Нужен пакет fonttools.
В index.html попадают: файл шрифта (base64), буквы → номер глифа, ширины глифов в единицах 1/1000 кегля."""
import sys, json, base64
from fontTools.ttLib import TTFont

def pack(path):
    f = TTFont(path)
    upm = f['head'].unitsPerEm
    order = f.getGlyphOrder()
    gid = {n: i for i, n in enumerate(order)}
    cmap = f.getBestCmap()
    cs = sorted(c for c in cmap if c < 0x10000)
    hm = f['hmtx']
    h = f['hhea']; hd = f['head']; os2 = f['OS/2']
    k = 1000 / upm
    return {
        'f': base64.b64encode(open(path, 'rb').read()).decode(),
        'c': ''.join(chr(c) for c in cs),
        'g': [gid[cmap[c]] for c in cs],
        'w': [round(hm[n][0] * k) for n in order],
        'a': round(h.ascent * k), 'd': round(h.descent * k), 'ch': round(getattr(os2, 'sCapHeight', 700) * k),
        'bb': [round(v * k) for v in (hd.xMin, hd.yMin, hd.xMax, hd.yMax)],
    }

p = sys.argv[1]
s = open(p, encoding='utf-8', newline='').read()
data = 'window.RZF=' + json.dumps({'r': pack('tools/fonts/cv-regular.ttf'), 'b': pack('tools/fonts/cv-bold.ttf')}, separators=(',', ':'), ensure_ascii=False) + ';'
a = s.find('/*RZF-DATA*/'); b = s.find('/*RZF-DATA-END*/')
assert a > 0 and b > a, 'markers not found'
s = s[:a + len('/*RZF-DATA*/')] + data + s[b:]
open(p, 'w', encoding='utf-8', newline='').write(s)
print('font bytes', len(data))
