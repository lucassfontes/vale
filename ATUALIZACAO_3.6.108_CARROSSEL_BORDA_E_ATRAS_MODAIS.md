# VALLE 3.6.108 — Carrossel na borda inferior e atrás dos modais

- Carrossel mobile agora usa `bottom: 0`, encostando visualmente na borda inferior.
- Removido o afastamento causado por `env(safe-area-inset-bottom)` no dock.
- `z-index` do dock reduzido para 50, ficando abaixo dos modais existentes do sistema.
- Quando um modal Bootstrap abre (`body.modal-open`), o dock cai para `z-index: 1`.
- Mantida a animação suave de ocultar/mostrar por gesto vertical.
- Sem alterações no banco de dados, Realtime, autenticação, tema ou regras de negócio.
- Cache-busting atualizado para 3.6.108.
