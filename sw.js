// 서비스워커: 앱 셸 오프라인 캐시 + OCR 라이브러리(CDN) 런타임 캐시 + 푸시 알림 수신.
const APP_CACHE = 'jot-app-v6';
const CDN_CACHE = 'jot-cdn-v1';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/app.js',
  './src/config.js',
  './src/github.js',
  './src/db.js',
  './src/entries.js',
  './src/collections.js',
  './src/search.js',
  './src/ocr.js',
  './src/push.js',
  './src/stats.js',
  './src/vendor/flexsearch.min.js',
  './src/vendor/idb.min.js',
  './src/ui/shared.js',
  './src/ui/capture.js',
  './src/ui/feed.js',
  './src/ui/collection.js',
  './src/ui/retro.js',
  './src/ui/dashboard.js',
  './src/ui/settings.js',
  './assets/brand/wordmark-light.png',
  './assets/brand/wordmark-dark.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/fonts/GothicA1-400-korean.woff2',
  './assets/fonts/GothicA1-400-latin.woff2',
  './assets/fonts/GothicA1-600-korean.woff2',
  './assets/fonts/GothicA1-600-latin.woff2',
  './assets/fonts/GothicA1-700-korean.woff2',
  './assets/fonts/GothicA1-700-latin.woff2',
  './assets/fonts/GothicA1-800-korean.woff2',
  './assets/fonts/GothicA1-800-latin.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== APP_CACHE && k !== CDN_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isCdnAsset(url) {
  return url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'tessdata.projectnaptha.com';
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (isCdnAsset(url)) {
    // OCR 관련 CDN 자원: 최초 1회만 받고 이후엔 캐시에서 (오프라인 재사용).
    event.respondWith(
      caches.open(CDN_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    // 앱 셸: 캐시 우선, 실패 시 네트워크.
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});

// 회고 알림 수신 (GitHub Actions 크론 -> Web Push -> 여기)
self.addEventListener('push', (event) => {
  let payload = { title: '파도파도', body: '회고를 남길 시간이에요.' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: './assets/icons/icon-192.png',
      badge: './assets/icons/icon-192.png',
      data: { url: payload.url || './index.html#/retro' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './index.html#/retro';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
