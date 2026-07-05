// PromptBox Service Worker
const CACHE_NAME = 'promptbox-v1';
const CORE_ASSETS = ['./index.html', './manifest.json'];
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(CORE_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // 仅处理 GET
  if (e.request.method !== 'GET') return;
  // 不拦截 GitHub API 和 AI API（避免缓存敏感请求）
  if (url.hostname === 'api.github.com' || url.pathname.endsWith('/chat/completions')) return;

  // CDN 资源：缓存优先
  if (CDN_ASSETS.includes(e.request.url)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        return resp;
      }).catch(() => cached))
    );
    return;
  }

  // 同源资源：缓存优先，网络更新
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request).then(resp => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
          }
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
