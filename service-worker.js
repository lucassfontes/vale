/** SERVICE WORKER DO PWA - cache atualizado */
const CACHE='emprestimos-v2-fix-juros-config-aberto-20260701-1';
const FILES=['./','./index.html','./css/style.css','./css/dark.css','./css/print.css','./js/app.js?v=20260701-4','./js/pdf.js','./js/whatsapp.js','./js/clientes.js','./js/historico.js','./js/dashboard.js','./js/backup.js','./js/storage.js','./js/util.js','./manifest.json','./icons/icon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request)));
});
