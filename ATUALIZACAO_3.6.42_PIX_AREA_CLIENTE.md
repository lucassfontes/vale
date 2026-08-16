# ATUALIZAÇÃO 3.6.42 — PIX na Área do Cliente

## O que foi feito
- Alterado o texto da Área do Cliente de **A RECEBER** para **A PAGAR**.
- Adicionado botão **PAGAR** em cada vale/parcela em aberto.
- Ao clicar em **PAGAR**, abre um modal com:
  - valor a pagar;
  - QR Code do PIX;
  - chave PIX configurada na sessão;
  - botão para copiar a chave PIX.
- Adicionada a configuração **Chave PIX da sessão** no painel **Configurações**.
- A chave PIX fica salva em `db.settings.pixKey` e vale para todos os usuários de serviço da mesma sessão.
- Atualizadas as funções SQL da Área do Cliente para devolver a chave PIX da sessão no retorno do RPC `get_my_client_portal()`.

## Importante no Supabase
Execute novamente o arquivo `supabase/schema.sql` (ou pelo menos a função `get_my_client_portal()`) para atualizar o retorno do portal do cliente com a chave PIX.
