-- VALLE v3.6.93 — fila transacional de gravações no banco
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase antes de usar a versão 3.6.93.
-- É idempotente e pode ser executado novamente com segurança.

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
