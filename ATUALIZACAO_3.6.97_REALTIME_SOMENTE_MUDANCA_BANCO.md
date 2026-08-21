# VALLE — Versão 3.6.97

## Sincronização por mudança real no banco

- Removido o polling de **3 segundos** do banco compartilhado.
- Removido o polling de **4 segundos** da aba Lançamentos.
- Removido o polling de **15 segundos** das permissões.
- Removido o polling de **30 segundos** dos pagamentos PIX informados.
- Removido o polling de **5 segundos** da MSG ADM.
- Agora o sistema usa **Supabase Realtime / postgres_changes**.
- O outro aparelho é atualizado quando o Postgres realmente altera `session_workspaces`.
- A aba Lançamentos recebe `audit_logs` em tempo real, inclusive **VALE REABERTO**.
- Pagamentos PIX, permissões e MSG ADM também passam a reagir a eventos do banco.
- Ao voltar de segundo plano ou recuperar a internet é feita apenas uma reconciliação; a tela só é redesenhada se o conteúdo do banco estiver diferente.

## Correção importante de RLS

A política anterior de `audit_logs` para usuário de serviço não liberava a ação `REABRIR_VALE`. A v3.6.97 corrige essa regra.

## Obrigatório

Execute no SQL Editor do Supabase:

`EXECUTAR_NO_SUPABASE_V97.sql`

Sem esse SQL, o Realtime pode não publicar as mudanças para os outros aparelhos.
