-- VALLE v75 — isolamento obrigatório dos lançamentos por sessão
-- Execute no SQL Editor do Supabase.

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select
on public.audit_logs
for select
to authenticated
using (
  session_user_id = public.my_session_id()
  and (
    public.my_role() = 'session'
    or (
      public.my_role() = 'service'
      and action in ('CRIAR_VALE','QUITAR_VALE','QUITAR_SO_CAPITAL','PAGAMENTO_PARCIAL','PAGAMENTO_JUROS')
      and exists (
        select 1
        from public.service_permissions sp
        where sp.service_user_id = auth.uid()
          and sp.session_user_id = public.my_session_id()
          and sp.can_view_transactions = true
      )
    )
  )
);

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert
on public.audit_logs
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and session_user_id = public.my_session_id()
);

-- Índice para garantir consultas rápidas por sessão e data.
create index if not exists audit_logs_session_date_idx
on public.audit_logs(session_user_id, created_at desc);
