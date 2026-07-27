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
comment on table public.admin_message_reads is 'Controle para cada mensagem aparecer apenas uma vez por usuário.';
