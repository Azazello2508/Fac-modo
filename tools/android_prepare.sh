#!/bin/bash
# Готовит проект Android (Capacitor) для сборки: файлы приложения, иконки, заставка, разрешения, номер версии.
# Использует android.yml. Запускать из корня репозитория на Linux после npm install.
set -euo pipefail

# --- файлы приложения (те же, что в iPhone) ---
rm -rf www && mkdir www
cp index.html manifest.webmanifest apple-touch-icon.png icon-192.png icon-512.png www/
# номер версии = время последнего изменения; по нему приложение понимает, что вышло обновление
sed -i "s/__FM_BUILD__/$(git log -1 --format=%ct)/" www/index.html
grep -c 'FM_BUILD=parseInt("[0-9]' www/index.html

# --- проект Android ---
npx cap add android
npx cap sync android

# --- иконка и заставка: картинки из assets/ вписываются в размеры, которые уже есть в проекте ---
R=android/app/src/main/res
rm -rf "$R/mipmap-anydpi-v26"   # без «адаптивной» иконки Android берёт обычные картинки ниже
python3 - "$R" <<'PY'
import sys, glob
from PIL import Image, ImageOps, ImageDraw
r = sys.argv[1]
icon = Image.open("assets/icon-1024.png").convert("RGBA")
splash = Image.open("assets/splash-2732.png").convert("RGBA")
n = 0
for f in glob.glob(r + "/mipmap-*/ic_launcher*.png"):
    w, h = Image.open(f).size
    im = icon.resize((w, h), Image.LANCZOS)
    if f.endswith("_round.png"):
        m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).ellipse((0, 0, w - 1, h - 1), fill=255)
        im.putalpha(m)
    im.save(f); n += 1
for f in glob.glob(r + "/drawable*/splash.png"):
    w, h = Image.open(f).size
    ImageOps.fit(splash, (w, h), Image.LANCZOS).convert("RGB").save(f); n += 1
print("иконок и заставок заменено:", n)
PY

# --- разрешения: камера (фото в журнал ремонтов, QR-код для игры по сети) ---
M=android/app/src/main/AndroidManifest.xml
grep -q 'android.permission.CAMERA' "$M" || sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#&\n    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />#' "$M"
grep -c 'android.permission.CAMERA' "$M"

# --- номер версии: для людей — version из package.json, для телефона — время коммита ---
G=android/app/build.gradle
sed -i -E "s/versionCode [0-9]+/versionCode $(git log -1 --format=%ct)/; s/versionName \"[^\"]*\"/versionName \"$(node -p "require('./package.json').version")\"/" "$G"
grep -E 'versionCode|versionName' "$G"
