# VALLE — Versão 3.6.101

## PWA instalável
- Manifesto PWA atualizado para a versão atual.
- `start_url` e `scope` corrigidos.
- Ícones 192, 512 e Apple Touch mantidos/configurados.
- Modo `standalone` habilitado para abrir como aplicativo.
- Service Worker mantido para instalação, atualização e Web Push.
- O Service Worker não intercepta `fetch` e não cria cache offline.

## Armazenamento local permitido
Somente duas preferências podem permanecer salvas no aparelho:
1. login/sessão gerenciada pelo Supabase;
2. tema visual (`auto`, `light` ou `dark`) na chave `valle_theme_mode`.

Clientes, vales, lançamentos, auditoria, configurações operacionais, filas e snapshots continuam exclusivamente online.
