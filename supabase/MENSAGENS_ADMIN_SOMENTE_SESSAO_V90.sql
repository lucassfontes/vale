-- VALLE v90 — MSG ADM somente para usuários de sessão
-- Execute no SQL Editor do Supabase.

-- O ADM continua vendo e administrando todas as mensagens.
-- Apenas perfis com role=session podem receber mensagens ativas.
drop policy if exists admin_messages_select on public.admin_messages;
create policy admin_messages_select on public.admin_messages
for select to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() = 'session'
    and active = true
    and published_at <= now()
    and (
      target_session_user_id is null
      or target_session_user_id = auth.uid()
    )
  )
);

-- Leituras podem ser consultadas pelo ADM ou pelo próprio usuário de sessão.
drop policy if exists admin_message_reads_select on public.admin_message_reads;
create policy admin_message_reads_select on public.admin_message_reads
for select to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() = 'session'
    and user_id = auth.uid()
  )
);

-- Somente o próprio usuário de sessão registra a leitura.
drop policy if exists admin_message_reads_insert on public.admin_message_reads;
create policy admin_message_reads_insert on public.admin_message_reads
for insert to authenticated
with check (
  public.my_role() = 'session'
  and user_id = auth.uid()
);

drop policy if exists admin_message_reads_update on public.admin_message_reads;
create policy admin_message_reads_update on public.admin_message_reads
for update to authenticated
using (
  public.my_role() = 'session'
  and user_id = auth.uid()
)
with check (
  public.my_role() = 'session'
  and user_id = auth.uid()
);

comment on table public.admin_message_reads is
'Controle para cada mensagem administrativa aparecer somente uma vez ao usuário de sessão.';
