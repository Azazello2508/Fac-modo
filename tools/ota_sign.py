#!/usr/bin/env python3
"""Подпись самообновления: пишет <site>/version.json.

  python3 tools/ota_sign.py <папка сайта> <номер сборки> <store_ok 0|1> [ключ.pem]

Ключ — закрытый ключ ECDSA P-256 (PEM, секрет OTA_SIGN_KEY). Без ключа (или пустой файл) —
version.json без подписи, как раньше ({"build":N}), чтобы публикация не падала.
С ключом в version.json добавляются sha256 (hex файла index.html) и sig — подпись (base64, r||s по 32 байта)
сообщения "fm-ota\\n<сборка>\\n<store_ok>\\n<sha256>". Приложение проверяет её открытым ключом OTA_PUB в блоке ota-js.
Подписывает openssl (есть на ubuntu runner), остальное — стандартная библиотека Python.
"""
import base64, hashlib, json, os, subprocess, sys, tempfile


def der_to_raw(der):
    # SEQUENCE { INTEGER r, INTEGER s }
    if der[0] != 0x30:
        raise ValueError("not a DER sequence")
    i = 2 if der[1] < 0x80 else 2 + (der[1] & 0x7F)
    out = b""
    for _ in range(2):
        if der[i] != 0x02:
            raise ValueError("not a DER integer")
        n = der[i + 1]
        v = der[i + 2:i + 2 + n].lstrip(b"\x00")
        if len(v) > 32:
            raise ValueError("integer too long")
        out += v.rjust(32, b"\x00")
        i += 2 + n
    return out


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    site, build, so = sys.argv[1], int(sys.argv[2]), sys.argv[3] == "1"
    key = sys.argv[4] if len(sys.argv) > 4 else ""
    data = open(os.path.join(site, "index.html"), "rb").read()
    h = hashlib.sha256(data).hexdigest()
    v = {"build": build}
    if so:
        v["store_ok"] = True
    if key and os.path.isfile(key) and os.path.getsize(key) > 0:
        msg = ("fm-ota\n%d\n%d\n%s" % (build, 1 if so else 0, h)).encode()
        with tempfile.TemporaryDirectory() as t:
            m, s, p = os.path.join(t, "m"), os.path.join(t, "s"), os.path.join(t, "p")
            open(m, "wb").write(msg)
            subprocess.run(["openssl", "dgst", "-sha256", "-sign", key, "-out", s, m], check=True)
            # проверка сразу же открытым ключом из того же PEM — чтобы не выложить битую подпись
            subprocess.run(["openssl", "pkey", "-in", key, "-pubout", "-out", p], check=True)
            subprocess.run(["openssl", "dgst", "-sha256", "-verify", p, "-signature", s, m], check=True, stdout=subprocess.DEVNULL)
            pub = subprocess.run(["openssl", "pkey", "-in", key, "-pubout", "-outform", "DER"], check=True, stdout=subprocess.PIPE).stdout
            v["sha256"] = h
            v["sig"] = base64.b64encode(der_to_raw(open(s, "rb").read())).decode()
        pk = base64.b64encode(pub).decode()
        if ('OTA_PUB="%s"' % pk).encode() not in data:
            sys.exit("OTA_SIGN_KEY не подходит к открытому ключу OTA_PUB в index.html — подпись не выкладываю")
        print("signed, public key:", pk)
    else:
        print("no key: version.json without signature")
    open(os.path.join(site, "version.json"), "w").write(json.dumps(v, separators=(",", ":")))
    print(json.dumps(v))


if __name__ == "__main__":
    main()
