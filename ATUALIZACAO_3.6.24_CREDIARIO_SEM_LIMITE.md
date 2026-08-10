# VALLE 3.6.24 — Crediário sem limite fixo de parcelas

- Removido o limite máximo de 60 parcelas do campo Novo Vale.
- Removida a validação JavaScript que bloqueava quantidades acima de 60.
- Agora o crediário aceita qualquer quantidade inteira de 2 parcelas ou mais, sem limite de negócio predefinido.
- A prévia visual exibe até 120 parcelas para evitar travamento da interface; ao salvar, todas as parcelas solicitadas são geradas.
- Atualizado versionamento e cache do PWA para 3.6.24.
