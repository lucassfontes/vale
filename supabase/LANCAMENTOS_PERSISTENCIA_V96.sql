-- VALLE v96 — persistência dos Lançamentos
-- Execute no SQL Editor do Supabase.
--
-- A assinatura identifica unicamente cada lançamento. Isso permite retry seguro
-- (upsert) quando a internet cai depois que o Supabase já recebeu o registro.

create unique index if not exists audit_logs_signature_uidx
on public.audit_logs(signature);

-- Reforça a política de inserção usada pelo aplicativo.
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert
on public.audit_logs
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and session_user_id = public.my_session_id()
);

-- Garante a consulta por sessão usada pela aba Lançamentos.
create index if not exists audit_logs_session_date_idx
on public.audit_logs(session_user_id, created_at desc);
