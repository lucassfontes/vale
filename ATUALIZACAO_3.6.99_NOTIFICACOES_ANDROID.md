# Atualização 3.6.99 — notificações web + APK Android

- O Web Push existente do navegador/PWA permanece funcionando com Service Worker + VAPID + Supabase.
- O mesmo arquivo `push-notifications.js` agora detecta quando está sendo executado dentro do APK e, nesse caso, usa a ponte nativa Android.
- No navegador, o comportamento anterior permanece: a inscrição continua sendo salva em `push_subscriptions` e a Edge Function `send-due-push` continua enviando os avisos Web Push.
- No APK, o Android usa notificações nativas e uma tarefa periódica protegida pela sessão autenticada do Supabase.
- Somente usuários de serviço recebem os avisos, mantendo a regra já existente.
- O fuso dos avisos de vencimento continua `America/Sao_Paulo`.
