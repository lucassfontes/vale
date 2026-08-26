
-- VALLE - Estrutura multiusuário Supabase
create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('admin','session','service');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role public.user_role not null,
  session_user_id uuid references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id),
  active boolean not null default true,
  valid_until date,
  admin_whatsapp text,
  user_theme text not null default 'auto' check (user_theme in ('auto','light','dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_requires_session check (role <> 'service' or session_user_id is not null)
);
create index if not exists profiles_session_idx on public.profiles(session_user_id);

create table if not exists public.service_permissions (
 service_user_id uuid primary key references public.profiles(id) on delete cascade,
 session_user_id uuid not null references public.profiles(id) on delete cascade,
 can_view_dashboard boolean not null default true,
 can_create_client boolean not null default true,
 can_edit_client boolean not null default true,
 can_delete_client boolean not null default false,
 can_create_vale boolean not null default true,
 can_edit_vale boolean not null default true,
 can_delete_vale boolean not null default false,
 can_receive_payment boolean not null default true,
 can_view_history boolean not null default true,
 can_view_reports boolean not null default true,
 can_view_transactions boolean not null default true,
 can_manage_backup boolean not null default false,
 can_change_settings boolean not null default false,
 can_view_session_data boolean not null default false,
 updated_at timestamptz not null default now()
);


-- Configurações financeiras individuais de cada usuário de serviço.
alter table public.service_permissions add column if not exists can_view_transactions boolean not null default true;
alter table public.service_permissions add column if not exists interest_percent numeric not null default 30;
alter table public.service_permissions add column if not exists late_fee_type text not null default 'percentual';
alter table public.service_permissions add column if not exists late_fee_value numeric not null default 0;
alter table public.service_permissions drop constraint if exists service_permissions_late_fee_type_check;
alter table public.service_permissions add constraint service_permissions_late_fee_type_check check (late_fee_type in ('percentual','reais'));

create table if not exists public.workspace_states (
 service_user_id uuid primary key references public.profiles(id) on delete cascade,
 session_user_id uuid not null references public.profiles(id) on delete cascade,
 data jsonb not null default '{"settings":{},"clientes":[],"vales":[]}'::jsonb,
 updated_at timestamptz not null default now()
);
create index if not exists workspace_session_idx on public.workspace_states(session_user_id);

alter table public.profiles enable row level security;
alter table public.service_permissions enable row level security;
alter table public.workspace_states enable row level security;

create or replace function public.my_role() returns public.user_role language sql stable security definer set search_path=public as $$select role from public.profiles where id=auth.uid()$$;
create or replace function public.my_session_id() returns uuid language sql stable security definer set search_path=public as $$select case when role='session' then id when role='service' then session_user_id else null end from public.profiles where id=auth.uid()$$;

-- Perfis: o próprio usuário lê o perfil; sessão lê seus serviços; ADM lê a hierarquia de usuários.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
 id=auth.uid() or
 (public.my_role()='session' and (session_user_id=auth.uid() or id=auth.uid())) or
 (public.my_role()='service' and (id=auth.uid() or id=public.my_session_id())) or
 public.my_role()='admin'
);
-- Alterações de perfis são feitas apenas pela Edge Function com service_role.

-- Permissões: sessão administra seus serviços; serviço lê as próprias permissões.
drop policy if exists permissions_select on public.service_permissions;
create policy permissions_select on public.service_permissions for select to authenticated using (
 service_user_id=auth.uid() or (public.my_role()='session' and session_user_id=auth.uid())
);
drop policy if exists permissions_insert on public.service_permissions;
create policy permissions_insert on public.service_permissions for insert to authenticated with check (
 public.my_role()='session' and session_user_id=auth.uid()
);
drop policy if exists permissions_update on public.service_permissions;
create policy permissions_update on public.service_permissions for update to authenticated using (
 public.my_role()='session' and session_user_id=auth.uid()
) with check (public.my_role()='session' and session_user_id=auth.uid());

-- Dados financeiros: serviço acessa só o próprio; sessão pode ler dados dos seus serviços; ADM não acessa.
drop policy if exists workspace_select on public.workspace_states;
create policy workspace_select on public.workspace_states for select to authenticated using (
 service_user_id=auth.uid() or (public.my_role()='session' and session_user_id=auth.uid())
);
drop policy if exists workspace_insert on public.workspace_states;
create policy workspace_insert on public.workspace_states for insert to authenticated with check (
 public.my_role()='service' and service_user_id=auth.uid() and session_user_id=public.my_session_id()
);
drop policy if exists workspace_update on public.workspace_states;
create policy workspace_update on public.workspace_states for update to authenticated using (
 public.my_role()='service' and service_user_id=auth.uid()
) with check (service_user_id=auth.uid() and session_user_id=public.my_session_id());

-- Depois de criar o primeiro usuário no Supabase Auth, promova-o manualmente:
-- insert into public.profiles(id,name,email,role,active)
-- values ('UUID_DO_USUARIO','Administrador','admin@exemplo.com','admin',true);


-- Atualização segura das funções auxiliares e da política de perfis.
-- Pode ser executada novamente em projetos já configurados.
create or replace function public.my_role()
returns public.user_role
language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;

create or replace function public.my_session_id()
returns uuid
language sql stable security definer set search_path=public
as $$
  select case when role='session' then id when role='service' then session_user_id else null end
  from public.profiles where id=auth.uid()
$$;

comment on column public.workspace_states.data is
'Banco completo do usuário de serviço: configurações, clientes, vales, pagamentos, observações e histórico.';


-- ================================================================
-- BANCO COMPARTILHADO POR SESSÃO
-- Cada sessão possui exatamente um conjunto de clientes, vales, histórico,
-- pagamentos e configurações, compartilhado por todos os usuários de serviço.
-- Sessões diferentes permanecem totalmente isoladas.
-- ================================================================
create table if not exists public.session_workspaces (
  session_user_id uuid primary key references public.profiles(id) on delete cascade,
  updated_by uuid references public.profiles(id) on delete set null,
  data jsonb not null default '{"settings":{},"clientes":[],"vales":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.session_workspaces enable row level security;

drop policy if exists session_workspace_select on public.session_workspaces;
create policy session_workspace_select
on public.session_workspaces
for select
to authenticated
using (
  session_user_id = public.my_session_id()
  and public.my_role() in ('session','service')
);

drop policy if exists session_workspace_insert on public.session_workspaces;
create policy session_workspace_insert
on public.session_workspaces
for insert
to authenticated
with check (
  public.my_role() in ('session','service')
  and session_user_id = public.my_session_id()
  and updated_by = auth.uid()
);

drop policy if exists session_workspace_update on public.session_workspaces;
create policy session_workspace_update
on public.session_workspaces
for update
to authenticated
using (
  public.my_role() in ('session','service')
  and session_user_id = public.my_session_id()
)
with check (
  public.my_role() in ('session','service')
  and session_user_id = public.my_session_id()
  and updated_by = auth.uid()
);

comment on table public.session_workspaces is
'Banco único da sessão, compartilhado entre todos os usuários de serviço vinculados.';

-- Migração automática: em instalações que já usavam workspace_states,
-- copia para cada sessão o registro atualizado mais recentemente.
insert into public.session_workspaces(session_user_id, updated_by, data, updated_at)
select distinct on (w.session_user_id)
  w.session_user_id,
  w.service_user_id,
  w.data,
  w.updated_at
from public.workspace_states w
where w.session_user_id is not null
order by w.session_user_id, w.updated_at desc
on conflict (session_user_id) do nothing;


-- Tema individual por usuário. Não faz parte do banco compartilhado da sessão.
alter table public.profiles
  add column if not exists user_theme text not null default 'auto';

alter table public.profiles
  alter column user_theme set default 'auto';

alter table public.profiles drop constraint if exists profiles_user_theme_check;
alter table public.profiles
  add constraint profiles_user_theme_check check (user_theme in ('auto','light','dark'));

create or replace function public.set_my_theme(new_theme text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_theme not in ('auto','light','dark') then
    raise exception 'Tema inválido';
  end if;
  update public.profiles
     set user_theme = new_theme, updated_at = now()
   where id = auth.uid();
  if not found then raise exception 'Perfil não encontrado'; end if;
  return new_theme;
end;
$$;
revoke all on function public.set_my_theme(text) from public;
grant execute on function public.set_my_theme(text) to authenticated;

-- Auditoria detalhada e permanente dos usuários de serviço
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  session_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_name text not null,
  actor_role public.user_role not null,
  action text not null,
  module text not null default 'SISTEMA',
  title text not null default 'Ação registrada',
  description text not null default '',
  entity_type text not null,
  entity_id text not null default '',
  client_name text,
  vale_number text,
  old_data jsonb,
  new_data jsonb,
  changes jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  signature text not null,
  created_at timestamptz not null default now()
);
alter table public.audit_logs add column if not exists module text not null default 'SISTEMA';
alter table public.audit_logs add column if not exists title text not null default 'Ação registrada';
alter table public.audit_logs add column if not exists description text not null default '';
alter table public.audit_logs add column if not exists client_name text;
alter table public.audit_logs add column if not exists vale_number text;
alter table public.audit_logs add column if not exists old_data jsonb;
alter table public.audit_logs add column if not exists new_data jsonb;
alter table public.audit_logs add column if not exists changes jsonb not null default '{}'::jsonb;
alter table public.audit_logs add column if not exists signature text;
update public.audit_logs set signature=coalesce(signature, md5(id::text || created_at::text)) where signature is null;
alter table public.audit_logs alter column signature set not null;
create index if not exists audit_logs_session_date_idx on public.audit_logs(session_user_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id);
create index if not exists audit_logs_action_idx on public.audit_logs(action);
create index if not exists audit_logs_module_idx on public.audit_logs(module);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated using (
  (public.my_role()='session' and session_user_id=auth.uid())
  or
  (
    public.my_role()='service'
    and session_user_id=public.my_session_id()
    and exists (
      select 1 from public.service_permissions sp
      where sp.service_user_id=auth.uid()
        and sp.session_user_id=public.my_session_id()
        and sp.can_view_transactions=true
    )
    and action in ('CRIAR_VALE','REABRIR_VALE','QUITAR_VALE','QUITAR_SO_CAPITAL','PAGAMENTO_PARCIAL','PAGAMENTO_JUROS','PAGAMENTO_ENTRADA')
  )
);
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert to authenticated with check (
  actor_user_id=auth.uid() and session_user_id=public.my_session_id()
);
drop policy if exists audit_logs_delete_session on public.audit_logs;
create policy audit_logs_delete_session on public.audit_logs for delete to authenticated using (
  public.my_role()='session' and session_user_id=auth.uid()
);
comment on table public.audit_logs is 'Histórico detalhado da sessão. O usuário de sessão pode excluir registros da própria sessão.';


-- VALLE v59 — mensagens de atualização enviadas pelo administrador

create table if not exists public.admin_messages (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references public.profiles(id) on delete restrict,
  title text not null default 'ATUALIZAÇÃO DO SISTEMA',
  message text not null,
  active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint admin_messages_message_not_empty check (length(trim(message)) > 0)
);

create table if not exists public.admin_message_reads (
  message_id bigint not null references public.admin_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists admin_messages_published_idx on public.admin_messages(active, published_at desc);
create index if not exists admin_message_reads_user_idx on public.admin_message_reads(user_id, seen_at desc);

alter table public.admin_messages enable row level security;
alter table public.admin_message_reads enable row level security;

drop policy if exists admin_messages_select on public.admin_messages;
create policy admin_messages_select on public.admin_messages
for select to authenticated
using (
  public.my_role() = 'admin'
  or (active = true and published_at <= now())
);

drop policy if exists admin_messages_insert on public.admin_messages;
create policy admin_messages_insert on public.admin_messages
for insert to authenticated
with check (public.my_role() = 'admin' and admin_user_id = auth.uid());

drop policy if exists admin_messages_update on public.admin_messages;
create policy admin_messages_update on public.admin_messages
for update to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

drop policy if exists admin_messages_delete on public.admin_messages;
create policy admin_messages_delete on public.admin_messages
for delete to authenticated
using (public.my_role() = 'admin');

drop policy if exists admin_message_reads_select on public.admin_message_reads;
create policy admin_message_reads_select on public.admin_message_reads
for select to authenticated
using (user_id = auth.uid() or public.my_role() = 'admin');

drop policy if exists admin_message_reads_insert on public.admin_message_reads;
create policy admin_message_reads_insert on public.admin_message_reads
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists admin_message_reads_update on public.admin_message_reads;
create policy admin_message_reads_update on public.admin_message_reads
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

comment on table public.admin_messages is 'Mensagens globais de atualização enviadas pelo administrador.';
comment on table public.admin_message_reads is 'Controle para cada MSG ADM aparecer apenas uma vez por usuário de sessão ou de serviço.';


-- VALLE v60 — mensagens direcionadas por sessão

alter table public.admin_messages
  add column if not exists target_session_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='admin_messages_target_session_user_id_fkey'
  ) then
    alter table public.admin_messages
      add constraint admin_messages_target_session_user_id_fkey
      foreign key (target_session_user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

create index if not exists admin_messages_target_session_idx
  on public.admin_messages(target_session_user_id, active, published_at desc);

drop policy if exists admin_messages_select on public.admin_messages;
create policy admin_messages_select on public.admin_messages
for select to authenticated
using (
  public.my_role() = 'admin'
  or (
    active = true
    and published_at <= now()
    and (
      target_session_user_id is null
      or target_session_user_id = public.my_session_id()
    )
  )
);

drop policy if exists admin_messages_insert on public.admin_messages;
create policy admin_messages_insert on public.admin_messages
for insert to authenticated
with check (
  public.my_role() = 'admin'
  and admin_user_id = auth.uid()
);

drop policy if exists admin_messages_update on public.admin_messages;
create policy admin_messages_update on public.admin_messages
for update to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

comment on column public.admin_messages.target_session_user_id is
'Sessão destinatária. NULL envia a mensagem para todas as sessões.';


-- VALLE v91 — bloqueio real de exclusões conforme permissões do usuário de serviço
-- Execute no SQL Editor do Supabase.

create or replace function public.valle_enforce_workspace_delete_permissions_v91()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_role public.user_role;
  allow_delete_client boolean := false;
  allow_delete_vale boolean := false;
begin
  v_user_role := public.my_role();

  -- Usuário de sessão continua administrando integralmente o banco da própria sessão.
  if v_user_role <> 'service' then
    return new;
  end if;

  select
    coalesce(sp.can_delete_client, false),
    coalesce(sp.can_delete_vale, false)
  into allow_delete_client, allow_delete_vale
  from public.service_permissions sp
  where sp.service_user_id = auth.uid();

  if not found then
    allow_delete_client := false;
    allow_delete_vale := false;
  end if;

  if not allow_delete_client and exists (
    select 1
    from jsonb_array_elements(coalesce(old.data -> 'clientes', '[]'::jsonb)) old_client
    where nullif(old_client ->> 'id', '') is not null
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(new.data -> 'clientes', '[]'::jsonb)) new_client
        where new_client ->> 'id' = old_client ->> 'id'
      )
  ) then
    raise exception 'Usuário sem permissão para excluir clientes.'
      using errcode = '42501';
  end if;

  if not allow_delete_vale and exists (
    select 1
    from jsonb_array_elements(coalesce(old.data -> 'vales', '[]'::jsonb)) old_vale
    where nullif(old_vale ->> 'id', '') is not null
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(new.data -> 'vales', '[]'::jsonb)) new_vale
        where new_vale ->> 'id' = old_vale ->> 'id'
      )
  ) then
    raise exception 'Usuário sem permissão para excluir vales.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.valle_enforce_workspace_delete_permissions_v91() from public;
grant execute on function public.valle_enforce_workspace_delete_permissions_v91() to authenticated;

drop trigger if exists valle_workspace_delete_permissions_v91 on public.session_workspaces;
create trigger valle_workspace_delete_permissions_v91
before update of data on public.session_workspaces
for each row
execute function public.valle_enforce_workspace_delete_permissions_v91();

-- Proteção equivalente para instalações antigas que ainda utilizam workspace_states.
drop trigger if exists valle_workspace_states_delete_permissions_v91 on public.workspace_states;
create trigger valle_workspace_states_delete_permissions_v91
before update of data on public.workspace_states
for each row
execute function public.valle_enforce_workspace_delete_permissions_v91();



-- VALLE 3.6.36 — Área do Cliente
-- Execute este arquivo no SQL Editor do Supabase.
-- É seguro executar novamente (idempotente).

create table if not exists public.client_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null,
  name text not null,
  email text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_user_id, client_id)
);

create index if not exists client_accounts_session_idx
  on public.client_accounts(session_user_id, client_id);

alter table public.client_accounts enable row level security;

drop policy if exists client_accounts_self_select on public.client_accounts;
create policy client_accounts_self_select
on public.client_accounts for select to authenticated
using (user_id = auth.uid());

-- O cliente nunca recebe a linha completa de session_workspaces.
-- Esta função filtra o JSON no servidor e devolve somente o cadastro e os vales do cliente autenticado.


-- =========================================================
-- VALLE 3.6.43 — Pagamentos PIX informados pelo cliente
-- =========================================================
create table if not exists public.client_payment_requests (
  id uuid primary key default gen_random_uuid(),
  session_user_id uuid not null references public.profiles(id) on delete cascade,
  client_user_id uuid not null,
  client_id text not null,
  client_name text not null default '',
  vale_id text not null,
  vale_numero text not null default '',
  crediario_id text,
  parcela_numero integer,
  parcela_total integer,
  amount numeric(14,2) not null default 0,
  client_message text not null default '',
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  review_note text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_payment_requests_session_idx
  on public.client_payment_requests(session_user_id, created_at desc);
create index if not exists client_payment_requests_client_idx
  on public.client_payment_requests(client_user_id, created_at desc);
create unique index if not exists client_payment_requests_one_pending_idx
  on public.client_payment_requests(session_user_id, client_id, vale_id)
  where status='pending';

alter table public.client_payment_requests enable row level security;

drop policy if exists client_payment_requests_client_select on public.client_payment_requests;
create policy client_payment_requests_client_select
on public.client_payment_requests for select to authenticated
using (client_user_id = auth.uid());

drop policy if exists client_payment_requests_session_select on public.client_payment_requests;
create policy client_payment_requests_session_select
on public.client_payment_requests for select to authenticated
using (
  public.my_role() in ('session','service')
  and session_user_id = public.my_session_id()
);

drop policy if exists client_payment_requests_session_update on public.client_payment_requests;
create policy client_payment_requests_session_update
on public.client_payment_requests for update to authenticated
using (
  public.my_role() in ('session','service')
  and session_user_id = public.my_session_id()
)
with check (
  public.my_role() in ('session','service')
  and session_user_id = public.my_session_id()
);

create or replace function public.create_client_payment_request(
  p_vale_id text,
  p_amount numeric default 0,
  p_client_message text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.client_accounts%rowtype;
  workspace_data jsonb;
  vale_data jsonb;
  existing public.client_payment_requests%rowtype;
  inserted public.client_payment_requests%rowtype;
begin
  select * into a from public.client_accounts where user_id=auth.uid();
  if not found then raise exception 'Acesso de cliente não encontrado.'; end if;
  if not a.active then raise exception 'Acesso do cliente bloqueado.'; end if;

  if coalesce(trim(p_vale_id),'')='' then raise exception 'Vale inválido.'; end if;
  if coalesce(p_amount,0)<=0 then raise exception 'Valor de pagamento inválido.'; end if;

  select sw.data into workspace_data
  from public.session_workspaces sw
  where sw.session_user_id=a.session_user_id;

  if workspace_data is null then raise exception 'Dados da sessão indisponíveis.'; end if;

  select v into vale_data
  from jsonb_array_elements(coalesce(workspace_data->'vales','[]'::jsonb)) v
  where v->>'id'=p_vale_id
    and (
      v->>'clienteId'=a.client_id
      or (coalesce(v->>'clienteId','')='' and upper(coalesce(v->>'cliente',''))=upper(coalesce(a.name,'')))
    )
  limit 1;

  if vale_data is null then raise exception 'Vale não encontrado para este cliente.'; end if;
  if upper(coalesce(vale_data->>'status','')) in ('PAGO','QUITADO') then
    raise exception 'Este vale já está quitado.';
  end if;

  select * into existing
  from public.client_payment_requests
  where session_user_id=a.session_user_id
    and client_id=a.client_id
    and vale_id=p_vale_id
    and status='pending'
  order by created_at desc
  limit 1;

  if found then
    update public.client_payment_requests
      set amount=p_amount,
          client_message=left(coalesce(p_client_message,''),180),
          updated_at=now()
    where id=existing.id
    returning * into inserted;
  else
    insert into public.client_payment_requests(
      session_user_id,client_user_id,client_id,client_name,vale_id,vale_numero,
      crediario_id,parcela_numero,parcela_total,amount,client_message
    ) values (
      a.session_user_id,a.user_id,a.client_id,coalesce(a.name,''),p_vale_id,coalesce(vale_data->>'numero',''),
      nullif(vale_data->>'crediarioId',''),nullif(vale_data->>'parcelaNumero','')::integer,
      nullif(vale_data->>'parcelaTotal','')::integer,p_amount,left(coalesce(p_client_message,''),180)
    ) returning * into inserted;
  end if;

  return to_jsonb(inserted);
end;
$$;

revoke all on function public.create_client_payment_request(text,numeric,text) from public;
grant execute on function public.create_client_payment_request(text,numeric,text) to authenticated;

create or replace function public.get_my_client_portal()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a public.client_accounts%rowtype;
  s public.profiles%rowtype;
  workspace_data jsonb;
  client_data jsonb;
  client_vales jsonb;
  client_payment_history jsonb;
begin
  select * into a
  from public.client_accounts
  where user_id = auth.uid();

  if not found then
    raise exception 'Acesso de cliente não encontrado.';
  end if;

  if not a.active then
    raise exception 'Acesso do cliente bloqueado.';
  end if;

  select * into s
  from public.profiles
  where id = a.session_user_id;

  if not found or not s.active or (s.valid_until is not null and s.valid_until < current_date) then
    raise exception 'Esta sessão está temporariamente indisponível.';
  end if;

  select sw.data into workspace_data
  from public.session_workspaces sw
  where sw.session_user_id = a.session_user_id;

  if workspace_data is null then
    raise exception 'Dados da sessão ainda não estão disponíveis.';
  end if;

  select elem into client_data
  from jsonb_array_elements(coalesce(workspace_data -> 'clientes', '[]'::jsonb)) elem
  where elem ->> 'id' = a.client_id
  limit 1;

  if client_data is null then
    raise exception 'Cadastro do cliente não foi encontrado nesta sessão.';
  end if;

  select coalesce(jsonb_agg(v order by coalesce(v ->> 'dataFinal',''), coalesce(v ->> 'numero','')), '[]'::jsonb)
  into client_vales
  from jsonb_array_elements(coalesce(workspace_data -> 'vales', '[]'::jsonb)) v
  where v ->> 'clienteId' = a.client_id
     or (
       coalesce(v ->> 'clienteId','') = ''
       and upper(coalesce(v ->> 'cliente','')) = upper(coalesce(client_data ->> 'nome',''))
     );

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
  into client_payment_history
  from (
    select id,vale_id,vale_numero,crediario_id,parcela_numero,parcela_total,amount,
           client_message,status,review_note,created_at,updated_at,reviewed_at
    from public.client_payment_requests
    where client_user_id=auth.uid()
    order by created_at desc
    limit 100
  ) r;

  return jsonb_build_object(
    'account', jsonb_build_object(
      'user_id', a.user_id,
      'client_id', a.client_id,
      'name', a.name,
      'email', a.email
    ),
    'session', jsonb_build_object(
      'name', s.name,
      'whatsapp', s.admin_whatsapp
    ),
    'payment', jsonb_build_object(
      'pix_key', coalesce(workspace_data #>> '{settings,pixKey}', ''),
      'pix_name', coalesce(workspace_data #>> '{settings,pixBeneficiaryName}', ''),
      'pix_city', coalesce(workspace_data #>> '{settings,pixCity}', '')
    ),
    'cliente', client_data,
    'vales', client_vales,
    'payment_requests', client_payment_history
  );
end;
$$;

revoke all on function public.get_my_client_portal() from public;
grant execute on function public.get_my_client_portal() to authenticated;

comment on table public.client_accounts is
'Contas de acesso do Portal do Cliente. Cada Auth user é vinculado a exatamente um cliente de uma sessão.';
comment on function public.get_my_client_portal() is
'Retorna somente os dados do cliente autenticado e seus próprios vales, sem expor o workspace completo da sessão.';

-- ================================================================
-- VALLE v3.6.93 — fila transacional de gravações
-- ================================================================
create or replace function public.valle_merge_jsonb_array_by_id_v93(
  p_current jsonb,
  p_upserts jsonb,
  p_deletes jsonb
) returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb := '[]'::jsonb;
  item jsonb;
  replacement jsonb;
  item_id text;
  seen text[] := array[]::text[];
begin
  if p_current is null or jsonb_typeof(p_current) <> 'array' then p_current := '[]'::jsonb; end if;
  if p_upserts is null or jsonb_typeof(p_upserts) <> 'array' then p_upserts := '[]'::jsonb; end if;
  if p_deletes is null or jsonb_typeof(p_deletes) <> 'array' then p_deletes := '[]'::jsonb; end if;

  for item in select value from jsonb_array_elements(p_current)
  loop
    item_id := coalesce(item->>'id','');
    if item_id <> '' and p_deletes ? item_id then continue; end if;
    replacement := null;
    if item_id <> '' then
      select value into replacement
      from jsonb_array_elements(p_upserts)
      where value->>'id'=item_id
      limit 1;
    end if;
    result := result || jsonb_build_array(coalesce(replacement,item));
    if item_id <> '' then seen := array_append(seen,item_id); end if;
  end loop;

  for item in select value from jsonb_array_elements(p_upserts)
  loop
    item_id := coalesce(item->>'id','');
    if item_id = '' or not (item_id = any(seen)) then
      result := result || jsonb_build_array(item);
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.valle_apply_workspace_patch_v93(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sid uuid := public.my_session_id();
  v_role text := public.my_role();
  v_current jsonb;
  v_next jsonb;
  v_updated_at timestamptz := clock_timestamp();
begin
  if v_uid is null or v_sid is null or v_role not in ('session','service') then
    raise exception 'Usuário sem permissão para gravar nesta sessão.' using errcode='42501';
  end if;

  -- Uma única gravação por sessão entra na região crítica por vez, inclusive
  -- quando usuários diferentes clicam simultaneamente.
  perform pg_advisory_xact_lock(hashtextextended(v_sid::text, 93693));

  select data into v_current
  from public.session_workspaces
  where session_user_id=v_sid
  for update;

  if v_current is null then
    v_current := '{"settings":{},"clientes":[],"vales":[]}'::jsonb;
    insert into public.session_workspaces(session_user_id,updated_by,data,updated_at)
    values(v_sid,v_uid,v_current,v_updated_at)
    on conflict(session_user_id) do nothing;
    select data into v_current from public.session_workspaces where session_user_id=v_sid for update;
  end if;

  v_next := jsonb_set(
    v_current,
    '{settings}',
    coalesce(v_current->'settings','{}'::jsonb) || coalesce(p_patch->'settings_patch','{}'::jsonb),
    true
  );
  v_next := jsonb_set(v_next,'{clientes}',public.valle_merge_jsonb_array_by_id_v93(
    coalesce(v_next->'clientes','[]'::jsonb),
    coalesce(p_patch->'clientes_upsert','[]'::jsonb),
    coalesce(p_patch->'clientes_delete','[]'::jsonb)
  ),true);
  v_next := jsonb_set(v_next,'{vales}',public.valle_merge_jsonb_array_by_id_v93(
    coalesce(v_next->'vales','[]'::jsonb),
    coalesce(p_patch->'vales_upsert','[]'::jsonb),
    coalesce(p_patch->'vales_delete','[]'::jsonb)
  ),true);

  update public.session_workspaces
  set data=v_next,updated_by=v_uid,updated_at=v_updated_at
  where session_user_id=v_sid;

  return jsonb_build_object('data',v_next,'updated_at',v_updated_at,'updated_by',v_uid);
end;
$$;

revoke all on function public.valle_apply_workspace_patch_v93(jsonb) from public;
grant execute on function public.valle_apply_workspace_patch_v93(jsonb) to authenticated;


-- VALLE v97 — REALTIME
-- Para habilitar a publicação das mudanças em instalações existentes, execute também REALTIME_BANCO_V97.sql.

-- ================================================================
-- VALLE v97 — Supabase Realtime orientado a mudanças do banco
-- ================================================================
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

do $$
declare
  t text;
  realtime_tables text[] := array[
    'session_workspaces','audit_logs','service_permissions','client_payment_requests','admin_messages'
  ];
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array realtime_tables loop
      if to_regclass('public.' || t) is not null
         and not exists (
           select 1 from pg_publication_tables
           where pubname='supabase_realtime' and schemaname='public' and tablename=t
         ) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;


-- ============================================================================
-- VALLE v102 — REALTIME TOTAL
-- Para instalações existentes, execute também: REALTIME_TOTAL_V102.sql
-- ============================================================================

create table if not exists public.client_portal_updates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_user_id uuid not null references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists client_portal_updates_session_idx on public.client_portal_updates(session_user_id,updated_at desc);
alter table public.client_portal_updates enable row level security;
drop policy if exists client_portal_updates_self_select on public.client_portal_updates;
create policy client_portal_updates_self_select on public.client_portal_updates for select to authenticated using(user_id=auth.uid());
grant select on public.client_portal_updates to authenticated;

insert into public.client_portal_updates(user_id,session_user_id,updated_at)
select ca.user_id,ca.session_user_id,clock_timestamp() from public.client_accounts ca
on conflict(user_id) do update set session_user_id=excluded.session_user_id,updated_at=excluded.updated_at;

create or replace function public.valle_touch_client_portal_v102(p_user_id uuid,p_session_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_user_id is null or p_session_user_id is null then return; end if;
  insert into public.client_portal_updates(user_id,session_user_id,updated_at)
  values(p_user_id,p_session_user_id,clock_timestamp())
  on conflict(user_id) do update set session_user_id=excluded.session_user_id,updated_at=clock_timestamp();
end;$$;
revoke all on function public.valle_touch_client_portal_v102(uuid,uuid) from public;

create or replace function public.valle_touch_session_clients_v102(p_session_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_session_user_id is null then return; end if;
  insert into public.client_portal_updates(user_id,session_user_id,updated_at)
  select ca.user_id,ca.session_user_id,clock_timestamp() from public.client_accounts ca where ca.session_user_id=p_session_user_id
  on conflict(user_id) do update set session_user_id=excluded.session_user_id,updated_at=clock_timestamp();
end;$$;
revoke all on function public.valle_touch_session_clients_v102(uuid) from public;

create or replace function public.valle_workspace_realtime_touch_clients_v102()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then perform public.valle_touch_session_clients_v102(old.session_user_id); return old; end if;
  perform public.valle_touch_session_clients_v102(new.session_user_id); return new;
end;$$;
drop trigger if exists trg_valle_workspace_realtime_touch_clients_v102 on public.session_workspaces;
create trigger trg_valle_workspace_realtime_touch_clients_v102 after insert or update or delete on public.session_workspaces for each row execute function public.valle_workspace_realtime_touch_clients_v102();

create or replace function public.valle_client_account_realtime_touch_v102()
returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.valle_touch_client_portal_v102(new.user_id,new.session_user_id); return new; end;$$;
drop trigger if exists trg_valle_client_account_realtime_touch_v102 on public.client_accounts;
create trigger trg_valle_client_account_realtime_touch_v102 after insert or update on public.client_accounts for each row execute function public.valle_client_account_realtime_touch_v102();

create or replace function public.valle_payment_realtime_touch_client_v102()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then perform public.valle_touch_client_portal_v102(old.client_user_id,old.session_user_id); return old; end if;
  perform public.valle_touch_client_portal_v102(new.client_user_id,new.session_user_id); return new;
end;$$;
drop trigger if exists trg_valle_payment_realtime_touch_client_v102 on public.client_payment_requests;
create trigger trg_valle_payment_realtime_touch_client_v102 after insert or update or delete on public.client_payment_requests for each row execute function public.valle_payment_realtime_touch_client_v102();

create or replace function public.valle_profile_realtime_touch_clients_v102()
returns trigger language plpgsql security definer set search_path=public as $$
begin if new.role::text='session' then perform public.valle_touch_session_clients_v102(new.id);end if;return new;end;$$;
drop trigger if exists trg_valle_profile_realtime_touch_clients_v102 on public.profiles;
create trigger trg_valle_profile_realtime_touch_clients_v102 after update on public.profiles for each row execute function public.valle_profile_realtime_touch_clients_v102();

alter table public.session_workspaces replica identity full;
alter table public.audit_logs replica identity full;
alter table public.service_permissions replica identity full;
alter table public.profiles replica identity full;
alter table public.client_accounts replica identity full;
alter table public.client_payment_requests replica identity full;
alter table public.admin_messages replica identity full;
alter table public.admin_message_reads replica identity full;
alter table public.client_portal_updates replica identity full;

do $$
declare t text; realtime_tables text[]:=array['session_workspaces','audit_logs','service_permissions','profiles','client_accounts','client_payment_requests','admin_messages','admin_message_reads','client_portal_updates'];
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array realtime_tables loop
      if to_regclass('public.'||t) is not null and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end$$;
