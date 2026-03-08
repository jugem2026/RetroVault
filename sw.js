const CACHE_NAME = 'retrovault-v5';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=M+PLUS+Rounded+1c:wght@400;700;800&display=swap'
];

// インストール時にコアファイルをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting()) // 即座に新SWを有効化
  );
});

// 古いキャッシュの削除 → 即座にページを制御
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // 既存のページも即座に制御下に
  );
});

// フェッチ戦略：ネットワーク優先 → キャッシュフォールバック
// アプリを開くたびにサーバーの最新版を取得する
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Wikipedia API リクエストはネットワークのみ
  if (url.hostname.includes('wikipedia.org')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('{}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // アプリのファイル：ネットワーク優先 → オフライン時はキャッシュ
  event.respondWith(
    fetch(event.request).then(response => {
      // 成功したらキャッシュを更新
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // オフライン時：キャッシュから返す
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        // ドキュメントリクエストならindex.htmlを返す
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
