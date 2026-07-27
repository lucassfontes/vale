-- VALLE v94 — permitir ao usuário de sessão excluir registros da própria auditoria

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_delete_session on public.audit_logs;

create policy audit_logs_delete_session
on public.audit_logs
for delete
to authenticated
using (
  public.my_role() = 'session'
  and session_user_id = auth.uid()
);

comment on table public.audit_logs is
'Histórico detalhado da sessão. O usuário de sessão pode excluir registros da própria sessão.';
