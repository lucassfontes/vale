# VALLE 3.6.80 — Reabertura real do vale com lançamento

- Corrigido o botão **ABRIR VALE**: após confirmar a senha, o vale passa de PAGO para ABERTO.
- Criado registro de auditoria **REABRIR_VALE**.
- A reabertura aparece na aba **Lançamentos** com quem reabriu, data, hora e saldo reaberto.
- O vale também guarda `reabertoPor`, `reabertoPorId` e `reabertoEm`.
- Ao desfazer o registro pela Auditoria, o estado anterior do vale pode ser restaurado.
