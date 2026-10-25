"""Распаковывает всё, что спрятано внутри index.html (встроенные игры и картинки base64), в папку —
чтобы антивирус (ClamAV) проверил и их, а не только сам файл. Запуск: python3 tests/full/unpack.py <папка>"""
import base64, os, re, sys

out = sys.argv[1] if len(sys.argv) > 1 else "unpacked"
os.makedirs(out, exist_ok=True)
s = open(os.path.join(os.path.dirname(__file__), "..", "..", "index.html"), encoding="utf-8").read()
n = 0
for m in re.finditer(r'<script type="text/plain" id="([a-z0-9-]+)">([^<]*)</script>', s):
    open(os.path.join(out, m.group(1) + ".html"), "wb").write(base64.b64decode(m.group(2).strip()))
    n += 1
EXT = {"image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "font/ttf": "ttf", "audio/wav": "wav"}
for i, m in enumerate(re.finditer(r"data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=]{16,})", s)):
    open(os.path.join(out, "data%03d.%s" % (i, EXT.get(m.group(1), "bin"))), "wb").write(base64.b64decode(m.group(2)))
    n += 1
print("Распаковано файлов:", n)
