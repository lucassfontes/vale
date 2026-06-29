/**
 * SERVICE WORKER DO PWA
 * Permite cache básico para o sistema abrir offline quando instalado no celular.
 */

const CACHE='valle-dashboard-financeiro-harmonico-v1';
const FILES=['./','./index.html','./css/style.css','./css/dark.css','./css/print.css','./js/app.js','./js/pdf.js','./js/whatsapp.js','./js/clientes.js','./js/historico.js','./js/dashboard.js','./js/backup.js','./js/storage.js','./js/util.js','./manifest.json','./icons/icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));

self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
