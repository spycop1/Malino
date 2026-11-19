// Repo-Pfad-sicherer Offline-Cache für GitHub Pages.
const CACHE = 'malino-magicpad-0.6.1';
const FILES = ['./','./index.html','./app.js','./cloud.js','./auth-flow.js','./local-store.js','./config.js','./styles.css','./favicon.svg','./demo-a4.svg','./manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET' || new URL(req.url).origin!==location.origin) return;
  if(new URL(req.url).pathname.includes('/functions/v1/') || new URL(req.url).pathname.includes('/api/')) return;
  event.respondWith(fetch(req).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}
    return response;
  }).catch(async()=> (await caches.match(req)) || (req.mode==='navigate'?await caches.match('./index.html'):Response.error())));
});
