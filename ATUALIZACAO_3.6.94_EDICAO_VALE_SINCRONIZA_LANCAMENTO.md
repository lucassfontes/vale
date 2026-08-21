# VALLE 3.6.94 — Edição do vale sincroniza Lançamentos

## Alteração

Ao editar um vale, o lançamento **NOVO VALE** correspondente passa a refletir imediatamente os dados atuais do vale:

- cliente;
- número do vale;
- valor liberado;
- observações.

Os cards-resumo e os filtros da aba Lançamentos também usam os valores atualizados.

## Regra preservada

A data e o usuário que criaram o vale continuam vindo da auditoria original. Lançamentos de pagamentos já realizados não são reescritos quando o vale é editado.

## Banco de dados

Não há SQL novo nesta versão. A estrutura exigida continua sendo a da versão 3.6.93 (`supabase/FILA_BANCO_V93.sql`).
