# VALLE 3.6.126 — Só Juros + Só Capital

- Ao receber **Só juros**, o sistema passa a registrar até qual novo vencimento aquele ciclo de juros está coberto.
- Se **Só capital** for usado até esse vencimento, os juros já pagos não são registrados novamente como **juros dispensados**.
- O lançamento de Só capital registra apenas o capital recebido nesse cenário.
- Se o novo vencimento já tiver passado, a regra normal de juros dispensados volta a ser aplicada.
- Não exige SQL novo.
