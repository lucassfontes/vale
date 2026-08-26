/** VALLE PWA v3.6.126 — 100% online. Service Worker mantido somente para Web Push/atualização. */
importScripts('./js/version.js?v=3.6.126');

self.addEventListener('install', () => {
  // Não pré-carrega nem armazena arquivos do aplicativo.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Remove qualquer cache criado por versões antigas com suporte offline.
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch (_) {}
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Não intercepta fetch. Todo HTML, JS, CSS, API e mídia usa a rede diretamente.
// Sem conexão, o navegador não recebe fallback offline do VALLE.

// Recebe mensagens Web Push mesmo quando o VALLE está fechado.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = { body: event.data?.text?.() || '' }; }
  const title = payload.title || 'VALLE — vale vencido';
  const options = {
    body: payload.body || 'Existe um vale que precisa da sua atenção.',
    icon: payload.icon || './icons/android-chrome-192x192.png',
    badge: payload.badge || './icons/favicon-48x48.png',
    tag: payload.tag || 'valle-vencimento',
    renotify: true,
    requireInteraction: true,
    vibrate: [250, 100, 250],
    data: { url: payload.url || './index.html#notificacoes', ...(payload.data || {}) }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './index.html#notificacoes', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});
