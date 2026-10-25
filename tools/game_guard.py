"""Сторож игр: проверяет игру перед встраиванием в Fac Modo.

Игры работают внутри приложения с теми же правами, что само приложение (могли бы прочитать данные
пользователя). Поэтому новая версия игры встраивается, только если в ней нет опасного:
доступа к данным приложения, чужих сайтов, спрятанного кода, внешних скриптов.

Запуск: python3 tools/game_guard.py <игра.html> <id блока>  — печатает найденное, код выхода 1, если есть проблемы.
Используется в tools/embed_tanchiki.py (ежечасная проверка tanchiki.yml) и в большом тесте tests/full.
"""
import re, sys, json

# Какие сайты разрешены каждой игре (игра вдвоём через интернет — свой сервер Танчиков)
ALLOW_HOSTS = {
    "tk-src": {"tanchiki-server.pinkovskyi2508.workers.dev"},
    "sm-src": {"tanchiki-server.pinkovskyi2508.workers.dev"},
}

RULES = [
    (r"quest-v2", "читает или меняет данные приложения (quest-v2)"),
    (r"""["']fm_(dev|pintry|bkx|flags|log|dlq|alert|flv)["']""", "трогает служебные ключи приложения"),
    (r"localStorage\.clear\s*\(|Object\.(keys|entries)\s*\(\s*localStorage|localStorage\.key\s*\(|for\s*\([^)]*\bin\s+localStorage", "перебирает или стирает всю память приложения"),
    (r"\bindexedDB\b", "открывает базы приложения (indexedDB)"),
    (r"document\.cookie", "читает cookie"),
    (r"(?<![\w.$])eval\s*\(", "eval — выполняет текст как код"),
    (r"new\s+Function\s*\(", "new Function — выполняет текст как код"),
    (r"set(Timeout|Interval)\s*\(\s*[\"'`]", "выполняет строку как код"),
    (r"(?<![\w.$])import\s*\(", "подгружает код на лету (import)"),
    (r"(?<![\w.$])(window\.)?parent\.(?!postMessage\b)\w+", "лезет в окно приложения (parent.…)"),
    (r"window\.top\b|(?<![\w.$])top\.(document|location|localStorage|window|frames|st|save|fmTx|applyData)\b", "лезет в окно приложения (top.…)"),
    (r"\bopener\b|\bframeElement\b", "лезет в окно приложения (opener/frameElement)"),
    (r"<script[^>]+src\s*=", "подгружает внешний скрипт"),
    (r"<(iframe|embed|object)\b", "встраивает чужую страницу"),
    (r"<link[^>]+rel\s*=\s*[\"']?(stylesheet|import|preload|modulepreload)[^>]+href\s*=\s*[\"']?(https?:)?//", "подгружает внешний файл"),
    (r"(eval|Function)\s*\(\s*(atob|unescape)", "спрятанный код"),
    (r"coinhive|cryptonight|webminer", "майнер"),
]
NET = r"\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|sendBeacon|EventSource|RTCPeerConnection"


def check(html, block_id):
    found = []
    for pat, msg in RULES:
        if re.search(pat, html, re.I if "coinhive" in pat else 0):
            found.append(msg)
    hosts = set(re.findall(r"(?:https?|wss?)://([a-z0-9.-]+)", html, re.I)) - {"www.w3.org"}
    allowed = ALLOW_HOSTS.get(block_id, set())
    bad = sorted(h for h in hosts if h.lower() not in allowed)
    if bad:
        found.append("обращается к сайтам: " + ", ".join(bad))
    if re.search(NET, html) and not allowed:
        found.append("ходит в интернет (fetch/WebSocket), хотя этой игре это не нужно")
    return found


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit("Запуск: python3 tools/game_guard.py <игра.html> <id блока>  (или - вместо файла: читать из stdin)")
    src = sys.stdin.read() if sys.argv[1] == "-" else open(sys.argv[1], encoding="utf-8").read()
    r = check(src, sys.argv[2])
    if "--json" in sys.argv:
        print(json.dumps(r, ensure_ascii=False))
        sys.exit(0)
    for x in r:
        print("⚠ " + sys.argv[2] + ": " + x)
    sys.exit(1 if r else 0)
