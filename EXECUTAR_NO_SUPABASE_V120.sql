-- ================================================================
-- VALLE 3.6.120 — SÓ CAPITAL VISÍVEL EM LANÇAMENTOS
-- Execute UMA VEZ no SQL Editor do Supabase.
--
-- Motivo: a operação QUITAR_SO_CAPITAL já é gravada em audit_logs,
-- mas a política de SELECT do usuário de serviço não incluía esse tipo.
-- ================================================================

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
      and action in (
        'CRIAR_VALE',
        'REABRIR_VALE',
        'QUITAR_VALE',
        'QUITAR_SO_CAPITAL',
        'PAGAMENTO_PARCIAL',
        'PAGAMENTO_JUROS',
        'PAGAMENTO_ENTRADA'
      )
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

comment on policy audit_logs_select on public.audit_logs is
'VALLE 3.6.120: sessão vê seus lançamentos; serviço autorizado também vê QUITAR_SO_CAPITAL.';
