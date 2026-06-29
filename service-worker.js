const CACHE='emprestimos-v2-cache';
const ASSETS=['./','index.html','css/style.css','css/dark.css','css/print.css','js/util.js','js/storage.js','js/pdf.js','js/whatsapp.js','js/clientes.js','js/historico.js','js/dashboard.js','js/backup.js','js/app.js','manifest.json','icons/icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
