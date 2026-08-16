# VALLE 3.6.25 — Crediário profissional

## Estrutura segura e compatível
- Mantida a estrutura atual: cada parcela continua sendo um vale individual.
- Criada uma camada de contrato que agrupa as parcelas pelo `crediarioId`.
- Crediários antigos da 3.6.23/3.6.24 são reconhecidos automaticamente.
- Nenhuma nova tabela obrigatória foi criada no Supabase.

## Novo Vale / Crediário
- Entrada em R$ antes do financiamento.
- Juros aplicados somente sobre o valor efetivamente financiado.
- Multa percentual única por atraso.
- Mantida a taxa diária de atraso já existente no VALLE.
- Resumo ao vivo: valor base, entrada, financiado e total parcelado.
- Quantidade de parcelas continua sem limite máximo fixo.
- Prévia limitada visualmente a 120 itens para proteger o desempenho.

## Contrato de crediário
- Nova aba `Crediários`.
- Código profissional `CRD-000001` para novos contratos.
- Contratos antigos recebem identificação compatível calculada automaticamente.
- Cards com status, progresso, parcelas pagas, saldo atual, entrada, valor do contrato e próxima parcela.
- Status automático: Em dia, Atrasado ou Quitado.
- Saldo atual inclui multa e taxa diária quando houver atraso.

## Detalhes e recebimento
- Modal completo do contrato com todas as informações financeiras.
- Lista das parcelas com status individual.
- Ações por parcela: Receber, PDF e Editar, respeitando permissões.
- Seleção de várias parcelas para quitação em lote.
- Botão para quitar todas as parcelas em aberto, sempre com confirmação.
- Quitações em lote são registradas individualmente na auditoria.

## Pagamentos e auditoria
- Entrada registrada como evento financeiro e na auditoria.
- Quitação passa a registrar data/hora e linha de pagamento na observação do vale.
- Novos campos do crediário entram na normalização do banco e não se perdem após sincronização/salvamento.

## PWA
- Versão e cache atualizados para 3.6.25.
