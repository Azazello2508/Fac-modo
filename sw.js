/* Fac Modo: хранит приложение на телефоне, чтобы оно открывалось без интернета.
   Страница (index.html) и файлы .json: сначала пробуем свежие из сети (не дольше 4 с), без сети — копия из кэша.
   Так новая версия видна сразу, а не через один запуск (инвалидация кэша). version.json не кэшируется вовсе.
   Картинки и прочее: сразу из кэша, а в фоне обновляются. При смене CACHE старый кэш удаляется. */
const CACHE = "fac-modo-v2";
const FILES = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
function save(req, res) {
  if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
  return res;
}
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // внешние ссылки — как обычно
  if (/version\.json$/.test(url.pathname)) return; // проверка обновлений — всегда из сети
  const fresh = req.mode === "navigate" || /(\/|\.html|\.json)$/.test(url.pathname);
  if (fresh) {
    const fallback = () => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("index.html"));
    e.respondWith(new Promise(done => {
      let over = false;
      const finish = p => { if (!over) { over = true; done(p); } };
      const t = setTimeout(() => finish(fallback()), 4000); // плохая связь в море — не ждём долго
      fetch(req, { cache: "no-store" }).then(res => { clearTimeout(t); finish(save(req, res)); })
        .catch(() => { clearTimeout(t); finish(fallback()); });
    }));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => save(req, res)).catch(() => hit || caches.match("index.html"));
      return hit || net;
    })
  );
});
