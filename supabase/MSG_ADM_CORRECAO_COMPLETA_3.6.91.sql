-- VALLE 3.6.91 — INSTALAÇÃO/CORREÇÃO COMPLETA DA MSG ADM
-- Pode ser executado mesmo se as tabelas ainda não existirem.
-- Execute UMA VEZ no SQL Editor do Supabase.

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

alter table public.admin_messages
  add column if not exists target_session_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='admin_messages_target_session_user_id_fkey'
      and conrelid='public.admin_messages'::regclass
  ) then
    alter table public.admin_messages
      add constraint admin_messages_target_session_user_id_fkey
      foreign key (target_session_user_id)
      references public.profiles(id)
      on delete cascade;
  end if;
end $$;

create table if not exists public.admin_message_reads (
  message_id bigint not null references public.admin_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (message_id,user_id)
);

create index if not exists admin_messages_published_idx
  on public.admin_messages(active,published_at desc);
create index if not exists admin_messages_target_session_idx
  on public.admin_messages(target_session_user_id,active,published_at desc);
create index if not exists admin_message_reads_user_idx
  on public.admin_message_reads(user_id,seen_at desc);

alter table public.admin_messages enable row level security;
alter table public.admin_message_reads enable row level security;

drop policy if exists admin_messages_select on public.admin_messages;
create policy admin_messages_select on public.admin_messages
for select to authenticated
using (
  public.my_role()='admin'
  or (
    public.my_role()='session'
    and active=true
    and published_at<=now()
    and (target_session_user_id is null or target_session_user_id=auth.uid())
  )
);

drop policy if exists admin_messages_insert on public.admin_messages;
create policy admin_messages_insert on public.admin_messages
for insert to authenticated
with check (public.my_role()='admin' and admin_user_id=auth.uid());

drop policy if exists admin_messages_update on public.admin_messages;
create policy admin_messages_update on public.admin_messages
for update to authenticated
using (public.my_role()='admin')
with check (public.my_role()='admin');

drop policy if exists admin_messages_delete on public.admin_messages;
create policy admin_messages_delete on public.admin_messages
for delete to authenticated
using (public.my_role()='admin');

drop policy if exists admin_message_reads_select on public.admin_message_reads;
create policy admin_message_reads_select on public.admin_message_reads
for select to authenticated
using (
  public.my_role()='admin'
  or (public.my_role()='session' and user_id=auth.uid())
);

drop policy if exists admin_message_reads_insert on public.admin_message_reads;
create policy admin_message_reads_insert on public.admin_message_reads
for insert to authenticated
with check (public.my_role()='session' and user_id=auth.uid());

drop policy if exists admin_message_reads_update on public.admin_message_reads;
create policy admin_message_reads_update on public.admin_message_reads
for update to authenticated
using (public.my_role()='session' and user_id=auth.uid())
with check (public.my_role()='session' and user_id=auth.uid());

drop policy if exists admin_message_reads_delete on public.admin_message_reads;
create policy admin_message_reads_delete on public.admin_message_reads
for delete to authenticated
using (public.my_role()='admin');

-- Garante permissões de tabela para usuários autenticados; o RLS continua
-- decidindo o que cada perfil pode realmente acessar.
grant select,insert,update,delete on public.admin_messages to authenticated;
grant select,insert,update,delete on public.admin_message_reads to authenticated;
grant usage,select on all sequences in schema public to authenticated;

-- Diagnóstico final: deve retornar as duas tabelas e suas políticas.
select 'admin_messages' as tabela, count(*) as registros from public.admin_messages
union all
select 'admin_message_reads', count(*) from public.admin_message_reads;
