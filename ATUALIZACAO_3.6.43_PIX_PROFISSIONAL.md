# VALLE 3.6.43 — PIX profissional e pagamentos informados

## Painel da sessão
Agora possui:
- Chave PIX da sessão;
- Nome do beneficiário PIX;
- Cidade do beneficiário PIX.

Essas informações ficam no workspace da sessão e são compartilhadas com todos os usuários de serviço vinculados.

## Área do Cliente
- `A RECEBER` foi alterado para `A PAGAR`.
- Cada vale/parcela em aberto possui botão `PAGAR`.
- O modal de pagamento mostra valor, beneficiário, chave PIX, QR Code e PIX Copia e Cola.
- O QR Code usa BR Code com o valor atual do vale/parcela.
- O cliente pode tocar em `JÁ PAGUEI` e adicionar uma observação opcional.
- O pedido fica com status `AGUARDANDO CONFERÊNCIA`.
- O cliente possui histórico de pagamentos informados.

## Usuário de serviço
Na aba Lançamentos existe o card `PAGAMENTOS PIX INFORMADOS`, com:
- cliente;
- vale/parcela;
- valor informado;
- data/hora;
- observação;
- status;
- botão para abrir o vale;
- confirmar pedido;
- recusar pedido.

Confirmar o pedido não quita o vale automaticamente. O recebimento continua usando o fluxo normal do VALLE, preservando auditoria, pagamentos parciais e regras existentes.

## Supabase
Execute `supabase/PAGAMENTOS_PIX_V3643.sql` no SQL Editor para criar a tabela e as funções necessárias.
