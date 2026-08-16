# VALLE 3.6.36 — Área do Cliente

- Novo Portal do Cliente usando a mesma tela de login.
- Cliente visualiza somente seus próprios vales, crediários, parcelas, vencimentos e saldos.
- Novo botão ACESSO na aba Clientes para criar/editar/bloquear/remover o login do cliente.
- Redefinição de senha pelo usuário de serviço.
- Dados protegidos no Supabase por tabela client_accounts + RPC SECURITY DEFINER que filtra o workspace no servidor.
- O cliente não recebe acesso direto ao session_workspaces.
- Layout responsivo para celular.
- Requer executar supabase/AREA_CLIENTE_V36.sql e publicar novamente a Edge Function manage-user.
