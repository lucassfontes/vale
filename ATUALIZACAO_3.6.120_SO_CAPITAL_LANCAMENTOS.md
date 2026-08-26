# VALLE 3.6.120 — Só capital nos Lançamentos

- Corrige a política RLS do Supabase para permitir que usuários de serviço com permissão de Lançamentos vejam `QUITAR_SO_CAPITAL`.
- A operação aparece em tempo real na aba **Lançamentos** com o selo **SÓ CAPITAL**.
- O valor principal é identificado como **CAPITAL RECEBIDO**.
- O card mostra também **JUROS DISPENSADOS**, sem somá-los ao lucro.
- Adicionado filtro específico **SÓ CAPITAL**.
- Incluído `EXECUTAR_NO_SUPABASE_V120.sql` para atualizar projetos já existentes.
