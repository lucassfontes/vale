# VALLE 3.6.45 — Confirmação PIX integrada ao Recebimento

- Em Lançamentos > Pagamentos PIX informados, o botão agora mostra **PAGAMENTO CONFIRMADO**.
- Ao clicar, o sistema pede confirmação e abre o modal **Receber** do vale/parcela correspondente.
- O pedido PIX permanece **AGUARDANDO CONFERÊNCIA** se o operador apenas fechar o modal.
- O pedido muda para **CONFIRMADO** somente quando for registrado:
  - Quitado;
  - Só Juros;
  - Pagamento Parcial.
- Se o vale já estiver quitado, o operador pode confirmar somente o pedido PIX sem abrir um novo recebimento.
- Não exige nova alteração SQL/Supabase nesta versão.
