#!/bin/bash
# Готовит проект iOS (Capacitor) для сборки: файлы приложения, иконки, настройки Info.plist,
# файл конфиденциальности PrivacyInfo.xcprivacy. Используют обе сборки: ios.yml (для Sideloadly)
# и ios-store.yml (для App Store). Запускать из корня репозитория на Mac после npm install.
set -euo pipefail

# --- файлы приложения ---
rm -rf www && mkdir www
cp index.html manifest.webmanifest apple-touch-icon.png icon-192.png icon-512.png www/
# номер версии = время последнего изменения; по нему приложение понимает, что вышло обновление
sed -i '' "s/__FM_BUILD__/$(git log -1 --format=%ct)/" www/index.html
grep -c 'FM_BUILD=parseInt("[0-9]' www/index.html
# сборка для App Store (ios-store.yml задаёт FM_STORE=1): самообновление принимает только обновления с store_ok (только исправления, правило Apple 2.5.2)
if [ "${FM_STORE:-0}" = "1" ]; then sed -i '' 's/__FM_STORE__/1/' www/index.html; grep -c '"1"=="1")?1:0' www/index.html; fi

# --- проект iOS ---
npx cap add ios
npx cap sync ios

# --- иконка и заставка ---
for f in ios/App/App/Assets.xcassets/AppIcon.appiconset/*.png; do cp assets/icon-1024.png "$f"; done
for f in ios/App/App/Assets.xcassets/Splash.imageset/*.png; do cp assets/splash-2732.png "$f"; done

# --- Info.plist ---
PL=ios/App/App/Info.plist
pset() { /usr/libexec/PlistBuddy -c "Delete :$1" "$PL" >/dev/null 2>&1 || true; /usr/libexec/PlistBuddy -c "Add :$1 $2 $3" "$PL"; }
pset CFBundleDisplayName string "Fac Modo"
pset UIStatusBarStyle string UIStatusBarStyleLightContent
pset UIViewControllerBasedStatusBarAppearance bool false
# Звуки для сна играют и при заблокированном экране
/usr/libexec/PlistBuddy -c "Delete :UIBackgroundModes" "$PL" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "$PL"
/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes:0 string audio" "$PL"
# Без апострофов: PlistBuddy считает ' кавычкой, и текст портится
# Зачем камера и фото (без этих текстов iPhone закрывает приложение при выборе «Снять фото»)
pset NSCameraUsageDescription string "Fac Modo uses the camera only when you take a photo yourself (for the repair log or your profile picture) or scan the QR code on another phone to play a game together. Nothing leaves your phone."
# Игра по сети: телефоны соединяются напрямую в одной сети Wi‑Fi или через точку доступа
pset NSLocalNetworkUsageDescription string "Fac Modo connects to another phone on the same Wi-Fi or hotspot so you can play a game together without the internet."
pset NSPhotoLibraryUsageDescription string "Fac Modo opens your photos only when you pick one yourself: for the repair log or your profile picture. The photo stays on your phone."
# Шифрование только стандартное (HTTPS) — App Store не будет спрашивать при каждой загрузке
pset ITSAppUsesNonExemptEncryption bool false
# Языки приложения (видно в App Store)
/usr/libexec/PlistBuddy -c "Delete :CFBundleLocalizations" "$PL" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations array" "$PL"
i=0; for l in ru en uk; do /usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations:$i string $l" "$PL"; i=$((i+1)); done

# Те же тексты разрешений по-русски и по-украински
for l in ru uk; do mkdir -p "ios/App/App/$l.lproj"; done
cat > ios/App/App/ru.lproj/InfoPlist.strings <<'EOF'
"NSCameraUsageDescription" = "Камера нужна, только когда ты сам делаешь фото (для журнала ремонтов или фото профиля) или сканируешь QR-код телефона друга, чтобы сыграть вместе. Ничего не уходит с телефона.";
"NSLocalNetworkUsageDescription" = "Fac Modo соединяется с телефоном друга в той же сети Wi‑Fi или через точку доступа, чтобы играть вместе без интернета.";
"NSPhotoLibraryUsageDescription" = "Фото открываются, только когда ты сам выбираешь снимок: для журнала ремонтов или фото профиля. Фото остаётся на телефоне.";
EOF
cat > ios/App/App/uk.lproj/InfoPlist.strings <<'EOF'
"NSCameraUsageDescription" = "Камера потрібна, лише коли ти сам робиш фото (для журналу ремонтів або фото профілю) або скануєш QR-код телефона друга, щоб пограти разом. Нічого не залишає телефон.";
"NSLocalNetworkUsageDescription" = "Fac Modo з'єднується з телефоном друга в тій самій мережі Wi‑Fi або через точку доступу, щоб грати разом без інтернету.";
"NSPhotoLibraryUsageDescription" = "Фото відкриваються, лише коли ти сам обираєш знімок: для журналу ремонтів або фото профілю. Фото залишається на телефоні.";
EOF

# --- файл конфиденциальности: данные не собираются, слежки нет; причины для системных функций ---
cat > ios/App/App/PrivacyInfo.xcprivacy <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSPrivacyTracking</key>
	<false/>
	<key>NSPrivacyTrackingDomains</key>
	<array/>
	<key>NSPrivacyCollectedDataTypes</key>
	<array/>
	<key>NSPrivacyAccessedAPITypes</key>
	<array>
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array><string>CA92.1</string></array>
		</dict>
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array><string>C617.1</string></array>
		</dict>
	</array>
</dict>
</plist>
EOF

# Добавить файл конфиденциальности и переводы разрешений в проект Xcode
gem list -i xcodeproj >/dev/null || sudo gem install xcodeproj --no-document
ruby <<'RUBY'
require "xcodeproj"
p = Xcodeproj::Project.open("ios/App/App.xcodeproj")
t = p.targets.find { |x| x.name == "App" } or abort "нет цели App"
g = p.main_group["App"] or abort "нет группы App"
unless g.files.any? { |f| f.path == "PrivacyInfo.xcprivacy" }
  t.add_resources([g.new_reference("PrivacyInfo.xcprivacy")])
end
vg = g.children.find { |c| c.isa == "PBXVariantGroup" && c.name == "InfoPlist.strings" } || g.new_variant_group("InfoPlist.strings")
%w[ru uk].each do |l|
  next if vg.files.any? { |f| f.path == "#{l}.lproj/InfoPlist.strings" }
  r = vg.new_reference("#{l}.lproj/InfoPlist.strings"); r.name = l
end
t.add_resources([vg]) unless t.resources_build_phase.files_references.include?(vg)
%w[ru uk].each { |l| p.root_object.known_regions << l unless p.root_object.known_regions.include?(l) }
p.save
puts "PrivacyInfo.xcprivacy и InfoPlist.strings добавлены в проект"
RUBY
