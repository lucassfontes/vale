-- ================================================================
-- VALLE 3.6.97 — REALTIME: atualizar somente quando o banco mudar
-- Execute UMA VEZ no SQL Editor do Supabase.
-- ================================================================

-- 1) Corrige a leitura da aba Lançamentos para usuário de serviço.
-- A regra antiga não incluía REABRIR_VALE, por isso a reabertura podia existir
-- no banco e ainda assim não aparecer no outro aparelho.
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

-- 2) Mantém dados completos nos eventos UPDATE/DELETE do Realtime.
alter table public.session_workspaces replica identity full;
alter table public.audit_logs replica identity full;
alter table public.service_permissions replica identity full;

do $$
begin
  if to_regclass('public.client_payment_requests') is not null then
    execute 'alter table public.client_payment_requests replica identity full';
  end if;
  if to_regclass('public.admin_messages') is not null then
    execute 'alter table public.admin_messages replica identity full';
  end if;
end $$;

-- 3) Habilita as tabelas usadas pelo aplicativo na publicação do Supabase Realtime.
-- O bloco é idempotente: pode ser executado novamente sem duplicar tabelas.
do $$
declare
  t text;
  realtime_tables text[] := array[
    'session_workspaces',
    'audit_logs',
    'service_permissions',
    'client_payment_requests',
    'admin_messages'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'A publicação supabase_realtime não existe neste projeto.';
  end if;

  foreach t in array realtime_tables loop
    if to_regclass('public.' || t) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Conferência opcional: deve listar as tabelas habilitadas acima.
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in (
    'session_workspaces',
    'audit_logs',
    'service_permissions',
    'client_payment_requests',
    'admin_messages'
  )
order by tablename;
