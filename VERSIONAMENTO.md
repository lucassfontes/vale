# Versionamento do VALLE

Versão atual: **3.6.97**.

Nesta versão, a sincronização entre aparelhos deixa de consultar o banco em intervalos fixos e passa a usar **Supabase Realtime (`postgres_changes`)**. O sistema reage a mudanças reais no workspace, lançamentos, permissões, pagamentos PIX e MSG ADM.

Também foi corrigida a política de leitura de `audit_logs` para permitir que usuários de serviço autorizados recebam o lançamento **REABRIR_VALE**.

## Atualização obrigatória do banco

Execute `EXECUTAR_NO_SUPABASE_V97.sql` no SQL Editor do Supabase.

A atualização da fila confirmada da v3.6.93 continua necessária em instalações que ainda não executaram `supabase/FILA_BANCO_V93.sql`.

- 3.6.110: carrossel mobile em 100% da largura da viewport.
