// service-worker.js — cache-first shell with runtime caching for media
const CACHE = 'nara-console-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './console.js',
  './manifest.json',
  // Do NOT pre-cache large videos by default. Cache on demand in the fetch handler.
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (e)=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e)=>{
  const { request } = e;
  if(request.method !== 'GET') return;
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c=>c.put(request, copy)).catch(()=>{});
      return resp;
    }).catch(()=> cached))
  );
});
