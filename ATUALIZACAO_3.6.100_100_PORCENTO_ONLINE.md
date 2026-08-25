# VALLE 3.6.100 — 100% ONLINE

- Removido o modo offline do sistema.
- Removido o armazenamento de clientes, vales, configurações, auditoria e filas no `localStorage`.
- Removidos caches/fallbacks offline do Service Worker.
- Service Worker mantido somente para Web Push e atualização do app.
- Removidas filas de reenvio offline do workspace e da auditoria.
- Operações agora exigem internet e confirmação do Supabase.
- O login continua salvo pelo Supabase (`persistSession: true`).
- Tema do usuário passa a ser obtido/salvo no banco, sem persistência local própria.
- Backup automático local removido; backup JSON manual continua disponível.
- Resíduos locais de versões antigas são apagados automaticamente, preservando somente as chaves de autenticação do Supabase.
