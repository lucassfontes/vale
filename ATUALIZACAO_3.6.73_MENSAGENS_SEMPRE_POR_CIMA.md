# VALLE 3.6.73 — Mensagens sempre por cima

- Mensagens globais agora usam o `z-index` máximo da interface.
- Alertas ficam acima de modais, menus, backdrops e overlays.
- O container de mensagens é garantido como filho direto do `body` para evitar conflitos de stacking context.
- A confirmação de PIX copiado também recebe prioridade máxima.
