-- ============================================================================
-- VALLE 3.6.102 — REALTIME TOTAL
-- Execute UMA VEZ no SQL Editor do Supabase.
-- Pode ser executado novamente: os blocos são idempotentes.
--
-- Objetivo:
--   • clientes, vales e configurações da sessão em tempo real;
--   • auditoria/lançamentos em tempo real;
--   • permissões em tempo real;
--   • usuários/perfis em tempo real;
--   • pagamentos PIX informados em tempo real;
--   • MSG ADM e leitura da mensagem em tempo real;
--   • Área do Cliente atualizada em tempo real SEM expor o JSON completo da sessão.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) Sinal seguro para a Área do Cliente
-- O cliente NÃO recebe session_workspaces. Ele recebe somente um "toque" e,
-- ao recebê-lo, consulta novamente get_my_client_portal(), que filtra os dados
-- no servidor e devolve apenas o cadastro/vales daquele cliente autenticado.
-- --------------------------------------------------------------------------
create table if not exists public.client_portal_updates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_user_id uuid not null references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists client_portal_updates_session_idx
  on public.client_portal_updates(session_user_id, updated_at desc);

alter table public.client_portal_updates enable row level security;

drop policy if exists client_portal_updates_self_select on public.client_portal_updates;
create policy client_portal_updates_self_select
on public.client_portal_updates
for select
to authenticated
using (user_id = auth.uid());

grant select on public.client_portal_updates to authenticated;

insert into public.client_portal_updates(user_id,session_user_id,updated_at)
select ca.user_id,ca.session_user_id,clock_timestamp()
from public.client_accounts ca
on conflict (user_id) do update
set session_user_id=excluded.session_user_id,
    updated_at=excluded.updated_at;

create or replace function public.valle_touch_client_portal_v102(
  p_user_id uuid,
  p_session_user_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_user_id is null or p_session_user_id is null then return; end if;
  insert into public.client_portal_updates(user_id,session_user_id,updated_at)
  values(p_user_id,p_session_user_id,clock_timestamp())
  on conflict (user_id) do update
    set session_user_id=excluded.session_user_id,
        updated_at=clock_timestamp();
end;
$$;

revoke all on function public.valle_touch_client_portal_v102(uuid,uuid) from public;

create or replace function public.valle_touch_session_clients_v102(p_session_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_session_user_id is null then return; end if;
  insert into public.client_portal_updates(user_id,session_user_id,updated_at)
  select ca.user_id,ca.session_user_id,clock_timestamp()
  from public.client_accounts ca
  where ca.session_user_id=p_session_user_id
  on conflict (user_id) do update
    set session_user_id=excluded.session_user_id,
        updated_at=clock_timestamp();
end;
$$;

revoke all on function public.valle_touch_session_clients_v102(uuid) from public;

-- Mudou qualquer cliente/vale/configuração do workspace: avisa todos os
-- clientes vinculados àquela sessão sem liberar o conteúdo do workspace.
create or replace function public.valle_workspace_realtime_touch_clients_v102()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    perform public.valle_touch_session_clients_v102(old.session_user_id);
    return old;
  end if;
  perform public.valle_touch_session_clients_v102(new.session_user_id);
  return new;
end;
$$;

drop trigger if exists trg_valle_workspace_realtime_touch_clients_v102 on public.session_workspaces;
create trigger trg_valle_workspace_realtime_touch_clients_v102
after insert or update or delete on public.session_workspaces
for each row execute function public.valle_workspace_realtime_touch_clients_v102();

-- Mudou nome/status/vínculo da conta do cliente: sinaliza o próprio cliente.
create or replace function public.valle_client_account_realtime_touch_v102()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.valle_touch_client_portal_v102(new.user_id,new.session_user_id);
  return new;
end;
$$;

drop trigger if exists trg_valle_client_account_realtime_touch_v102 on public.client_accounts;
create trigger trg_valle_client_account_realtime_touch_v102
after insert or update on public.client_accounts
for each row execute function public.valle_client_account_realtime_touch_v102();

-- Mudou o status/valor de pagamento informado: atualiza imediatamente o portal.
create or replace function public.valle_payment_realtime_touch_client_v102()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    perform public.valle_touch_client_portal_v102(old.client_user_id,old.session_user_id);
    return old;
  end if;
  perform public.valle_touch_client_portal_v102(new.client_user_id,new.session_user_id);
  return new;
end;
$$;

drop trigger if exists trg_valle_payment_realtime_touch_client_v102 on public.client_payment_requests;
create trigger trg_valle_payment_realtime_touch_client_v102
after insert or update or delete on public.client_payment_requests
for each row execute function public.valle_payment_realtime_touch_client_v102();

-- Se o ADM bloquear/reativar/alterar a sessão, todos os clientes daquela sessão
-- recebem o sinal e revalidam o acesso através da função segura do portal.
create or replace function public.valle_profile_realtime_touch_clients_v102()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.role::text='session' then
    perform public.valle_touch_session_clients_v102(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_valle_profile_realtime_touch_clients_v102 on public.profiles;
create trigger trg_valle_profile_realtime_touch_clients_v102
after update on public.profiles
for each row execute function public.valle_profile_realtime_touch_clients_v102();

-- --------------------------------------------------------------------------
-- 2) Payload completo em UPDATE/DELETE para as telas que precisam aplicar o
--    evento sem fazer uma consulta intermediária.
-- --------------------------------------------------------------------------
alter table public.session_workspaces replica identity full;
alter table public.audit_logs replica identity full;
alter table public.service_permissions replica identity full;
alter table public.profiles replica identity full;
alter table public.client_accounts replica identity full;
alter table public.client_payment_requests replica identity full;
alter table public.admin_messages replica identity full;
alter table public.admin_message_reads replica identity full;
alter table public.client_portal_updates replica identity full;

-- --------------------------------------------------------------------------
-- 3) Publica todas as tabelas de dados que precisam gerar evento Realtime.
-- --------------------------------------------------------------------------
do $$
declare
  t text;
  realtime_tables text[] := array[
    'session_workspaces',
    'audit_logs',
    'service_permissions',
    'profiles',
    'client_accounts',
    'client_payment_requests',
    'admin_messages',
    'admin_message_reads',
    'client_portal_updates'
  ];
begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    raise exception 'A publicação supabase_realtime não existe neste projeto.';
  end if;

  foreach t in array realtime_tables loop
    if to_regclass('public.'||t) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname='supabase_realtime'
           and schemaname='public'
           and tablename=t
       ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 4) Conferência. O resultado deve listar as 9 tabelas abaixo.
-- --------------------------------------------------------------------------
select schemaname,tablename
from pg_publication_tables
where pubname='supabase_realtime'
  and schemaname='public'
  and tablename in (
    'session_workspaces','audit_logs','service_permissions','profiles',
    'client_accounts','client_payment_requests','admin_messages',
    'admin_message_reads','client_portal_updates'
  )
order by tablename;
