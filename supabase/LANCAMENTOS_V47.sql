-- VALLE v47 — Aba Lançamentos e permissão dos usuários de serviço
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

alter table public.service_permissions
  add column if not exists can_view_transactions boolean not null default true;

-- Usuário de sessão vê todos os lançamentos da própria sessão.
-- Usuário de serviço só vê os lançamentos quando a permissão estiver ativa.
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
for select to authenticated
using (
  (public.my_role()='session' and session_user_id=auth.uid())
  or
  (
    public.my_role()='service'
    and session_user_id=public.my_session_id()
    and exists (
      select 1
      from public.service_permissions sp
      where sp.service_user_id=auth.uid()
        and sp.session_user_id=public.my_session_id()
        and sp.can_view_transactions=true
    )
    and action in ('CRIAR_VALE','QUITAR_VALE','QUITAR_SO_CAPITAL','PAGAMENTO_PARCIAL','PAGAMENTO_JUROS')
  )
);

comment on column public.service_permissions.can_view_transactions
is 'Permite ao usuário de serviço visualizar a aba Lançamentos e os pagamentos/novos vales da sessão.';
