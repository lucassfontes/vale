# VALLE 3.6.93 — Confirmação real no banco e fila de operações

- Tela inteira bloqueada durante qualquer gravação do workspace.
- Feedback central estilo iPhone: spinner sem texto; após confirmação real, ✓ verde.
- Em erro, × vermelho e mensagem curta; o estado local volta ao último estado confirmado.
- Mensagens antigas de sucesso são absorvidas pelo novo feedback e não aparecem antecipadamente.
- Gravações offline não são mais tratadas como sucesso.
- Nova função transacional no Supabase serializa gravações da mesma sessão.
- Alterações de usuários diferentes são aplicadas como patch sobre o estado mais recente, evitando que criação/edição/recebimento simultâneos se sobrescrevam.

## Obrigatório no Supabase
Execute `supabase/FILA_BANCO_V93.sql` no SQL Editor antes de usar a versão 3.6.93.
