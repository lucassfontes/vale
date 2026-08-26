# VALLE — Versão 3.6.120

## Novo botão “Só capital”

No modal **Ações de cobrança** foi adicionado o botão **Só capital**.

Ao usar esta opção:
- recebe somente o saldo do capital/principal ainda em aberto;
- não cobra juros nem acréscimos de atraso restantes;
- marca o vale como quitado;
- registra na observação o capital recebido e o valor de juros dispensado;
- registra a operação na Auditoria como `QUITAR_SO_CAPITAL`;
- registra em Lançamentos como **SÓ CAPITAL**;
- contabiliza o valor recebido como capital recuperado, não como lucro/juros;
- pode ser desfeito pela Auditoria usando o estado anterior;
- ao reabrir o vale, ele volta ao saldo contratual normal.

Não exige SQL novo no Supabase.
