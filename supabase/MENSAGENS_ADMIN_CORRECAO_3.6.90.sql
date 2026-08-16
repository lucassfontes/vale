-- VALLE 3.6.90 — Correção da MSG ADM
-- Execute uma vez no SQL Editor do Supabase se a MSG ADM não chegar aos usuários de sessão.

alter table public.admin_messages
  add column if not exists target_session_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'admin_messages_target_session_user_id_fkey'
  ) then
    alter table public.admin_messages
      add constraint admin_messages_target_session_user_id_fkey
      foreign key (target_session_user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

create index if not exists admin_messages_target_session_idx
  on public.admin_messages(target_session_user_id, active, published_at desc);

alter table public.admin_messages enable row level security;
alter table public.admin_message_reads enable row level security;

drop policy if exists admin_messages_select on public.admin_messages;
create policy admin_messages_select on public.admin_messages
for select to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() = 'session'
    and active = true
    and published_at <= now()
    and (target_session_user_id is null or target_session_user_id = auth.uid())
  )
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
using (public.my_role() = 'admin' or (public.my_role() = 'session' and user_id = auth.uid()));

drop policy if exists admin_message_reads_insert on public.admin_message_reads;
create policy admin_message_reads_insert on public.admin_message_reads
for insert to authenticated
with check (public.my_role() = 'session' and user_id = auth.uid());

drop policy if exists admin_message_reads_update on public.admin_message_reads;
create policy admin_message_reads_update on public.admin_message_reads
for update to authenticated
using (public.my_role() = 'session' and user_id = auth.uid())
with check (public.my_role() = 'session' and user_id = auth.uid());
