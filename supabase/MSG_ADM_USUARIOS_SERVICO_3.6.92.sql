-- VALLE 3.6.92 — MSG ADM PARA USUÁRIOS DE SESSÃO E DE SERVIÇO
-- Execute UMA VEZ no SQL Editor do Supabase.
-- Esta correção substitui políticas antigas que permitiam MSG ADM somente para role=session.

-- Garante helper da sessão atual.
create or replace function public.my_session_id()
returns uuid
language sql
stable
security definer
set search_path=public
as $$
  select case
    when role='session' then id
    when role='service' then session_user_id
    else null
  end
  from public.profiles
  where id=auth.uid()
$$;

alter table public.admin_messages enable row level security;
alter table public.admin_message_reads enable row level security;

-- ADMIN lê tudo. SESSION e SERVICE leem mensagens globais ou destinadas à sua sessão.
drop policy if exists admin_messages_select on public.admin_messages;
create policy admin_messages_select on public.admin_messages
for select to authenticated
using (
  public.my_role()='admin'
  or (
    public.my_role() in ('session','service')
    and active=true
    and published_at<=now()
    and (
      target_session_user_id is null
      or target_session_user_id=public.my_session_id()
    )
  )
);

-- Somente ADMIN cria/edita/remove mensagens.
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

-- Cada SESSION/SERVICE controla a própria leitura individualmente.
drop policy if exists admin_message_reads_select on public.admin_message_reads;
create policy admin_message_reads_select on public.admin_message_reads
for select to authenticated
using (
  public.my_role()='admin'
  or (
    public.my_role() in ('session','service')
    and user_id=auth.uid()
  )
);

drop policy if exists admin_message_reads_insert on public.admin_message_reads;
create policy admin_message_reads_insert on public.admin_message_reads
for insert to authenticated
with check (
  public.my_role() in ('session','service')
  and user_id=auth.uid()
);

drop policy if exists admin_message_reads_update on public.admin_message_reads;
create policy admin_message_reads_update on public.admin_message_reads
for update to authenticated
using (
  public.my_role() in ('session','service')
  and user_id=auth.uid()
)
with check (
  public.my_role() in ('session','service')
  and user_id=auth.uid()
);

drop policy if exists admin_message_reads_delete on public.admin_message_reads;
create policy admin_message_reads_delete on public.admin_message_reads
for delete to authenticated
using (public.my_role()='admin');

grant select,insert,update,delete on public.admin_messages to authenticated;
grant select,insert,update,delete on public.admin_message_reads to authenticated;

-- Diagnóstico: mostra o papel e a sessão resolvida do usuário que estiver executando autenticado.
-- No SQL Editor auth.uid() normalmente é NULL; isso é esperado.
select public.my_role() as role_atual, public.my_session_id() as sessao_atual;
