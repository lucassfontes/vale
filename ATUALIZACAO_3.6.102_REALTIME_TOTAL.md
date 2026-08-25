# VALLE — Versão 3.6.102 — Realtime Total

Esta versão mantém o sistema 100% online para os dados. Somente a sessão/login do Supabase e a preferência de tema permanecem salvas localmente.

## O que mudou

- Clientes, vales, crediários e configurações compartilhadas atualizam em tempo real entre aparelhos através de `session_workspaces`.
- Lançamentos e auditoria recebem `INSERT`, `UPDATE` e `DELETE` do Postgres em tempo real.
- Permissões e configurações financeiras do usuário de serviço atualizam em tempo real.
- Criação, edição, bloqueio e exclusão de usuários/perfis aparecem automaticamente nos outros aparelhos/painéis.
- Pagamentos PIX informados e alterações de status atualizam em tempo real.
- Mensagens do administrador e leitura da mensagem são sincronizadas em tempo real.
- A Área do Cliente passa a receber atualização em tempo real sem ter acesso ao JSON completo da sessão.
- Foram removidas consultas atrasadas usadas apenas para segunda atualização após o login.
- Não existe polling periódico para manter os dados atualizados.
- Quando o celular/PWA volta do segundo plano ou recupera a internet, é feita uma única reconciliação com o banco para recuperar qualquer evento que o sistema operacional tenha suspendido.
- O Service Worker continua sem cache offline de dados.

## Banco de dados — obrigatório

Para ativar todos os novos canais Realtime em um banco que já existe, execute no **SQL Editor do Supabase** o arquivo:

`EXECUTAR_NO_SUPABASE_V102.sql`

Esse SQL habilita a publicação Realtime das tabelas necessárias e cria `client_portal_updates`, uma tabela de sinalização segura para atualizar a Área do Cliente sem expor dados de outros clientes.
