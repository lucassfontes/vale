# VALLE 3.6.23 — Crediário / Parcelamento

## Novo Vale
- Nova escolha **À vista / Crediário**.
- Crediário com 2 a 60 parcelas.
- Periodicidade mensal, quinzenal ou semanal.
- O campo Data Final passa a representar **Primeiro Vencimento** no modo crediário.
- Prévia automática de todas as parcelas, vencimentos e valores.
- Divisão monetária feita em centavos para o total fechar exatamente.

## Integração
Cada parcela é salva como um vale individual ligado pelo `crediarioId`, preservando o funcionamento já existente de:
- Histórico;
- Calendário;
- Recebimentos;
- Lançamentos e auditoria;
- Notificações de vencimento;
- Dashboard e relatórios.

Campos adicionados aos vales: `formaPagamento`, `crediarioId`, `parcelaNumero`, `parcelaTotal`, `periodicidade`, `crediarioValorPrincipal` e `crediarioValorTotal`.

## Histórico / PDF
- Parcelas mostram identificação `PARCELA X/Y` no Histórico.
- O PDF do vale identifica quando o registro pertence a um crediário.

## Edição
Ao editar uma parcela de crediário, a quantidade e periodicidade ficam bloqueadas para impedir que uma edição individual recrie ou desconfigure o plano inteiro.
