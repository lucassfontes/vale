alter table public.service_permissions add column if not exists can_view_transactions boolean not null default true;

-- Execute este arquivo no SQL Editor do Supabase caso o schema principal já tenha sido instalado.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  session_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_name text not null,
  actor_role public.user_role not null,
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_session_date_idx on public.audit_logs(session_user_id, created_at desc);
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated using (
  (public.my_role()='session' and session_user_id=auth.uid())
  or
  (
    public.my_role()='service'
    and session_user_id=public.my_session_id()
    and action in ('CRIAR_VALE','QUITAR_VALE','QUITAR_SO_CAPITAL','PAGAMENTO_PARCIAL','PAGAMENTO_JUROS')
    and exists (
      select 1 from public.service_permissions sp
      where sp.service_user_id=auth.uid()
        and sp.session_user_id=public.my_session_id()
        and sp.can_view_transactions=true
    )
  )
);
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert to authenticated with check (actor_user_id=auth.uid() and session_user_id=public.my_session_id());
