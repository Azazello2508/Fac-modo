"""Встраивает игру «Танчики» в index.html приложения Fac Modo.

Запуск: python tools/embed_tanchiki.py <путь к index.html Танчиков>
Скрипт меняет только блок <script type="text/plain" id="tk-src">…</script>.
Печатает changed=true, если игра в приложении обновилась.
"""
import base64, re, sys

game_path = sys.argv[1]
app_path = "index.html"
g = open(game_path, encoding="utf-8").read()
s = open(app_path, encoding="utf-8").read()

# Внутри Fac Modo игре не нужны Telegram, свой манифест, иконки и офлайн-кэш.
g = re.sub(r'<script src="https://telegram\.org/js/telegram-web-app\.js"></script>', "", g)
g = re.sub(r'<link rel="(manifest|icon|apple-touch-icon)"[^>]*>', "", g)
g = re.sub(r"if\('serviceWorker' in navigator\)navigator\.serviceWorker\.register\('sw\.js'\)\.catch\(\(\)=>\{\}\);", "", g)

b64 = base64.b64encode(g.encode("utf-8")).decode()
pat = re.compile(r'(<script type="text/plain" id="tk-src">)([^<]*)(</script>)')
m = pat.search(s)
if not m:
    sys.exit("В index.html не найден блок игры tk-src")
if m.group(2) == b64:
    print("changed=false")
    sys.exit(0)
s = s[:m.start(2)] + b64 + s[m.end(2):]
open(app_path, "w", encoding="utf-8").write(s)
print("changed=true")
