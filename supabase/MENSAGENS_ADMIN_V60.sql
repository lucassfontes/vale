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
