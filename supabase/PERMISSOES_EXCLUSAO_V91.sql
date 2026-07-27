-- VALLE v92 — correção do bloqueio real de exclusões
-- Corrige o erro causado pelo identificador reservado CURRENT_ROLE.
-- Pode ser executado novamente sem duplicar função ou gatilhos.

alter table if exists public.service_permissions
  add column if not exists can_delete_client boolean not null default false;

alter table if exists public.service_permissions
  add column if not exists can_delete_vale boolean not null default false;

create or replace function public.valle_enforce_workspace_delete_permissions_v91()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_role public.user_role;
  v_allow_delete_client boolean := false;
  v_allow_delete_vale boolean := false;
  v_old_clients jsonb;
  v_new_clients jsonb;
  v_old_vales jsonb;
  v_new_vales jsonb;
begin
  select public.my_role()
    into v_user_role;

  -- Apenas usuários de serviço dependem das permissões individuais.
  -- O usuário de sessão continua administrando os dados da própria sessão.
  if v_user_role is distinct from 'service'::public.user_role then
    return new;
  end if;

  select
    coalesce(sp.can_delete_client, false),
    coalesce(sp.can_delete_vale, false)
  into
    v_allow_delete_client,
    v_allow_delete_vale
  from public.service_permissions sp
  where sp.service_user_id = auth.uid();

  if not found then
    v_allow_delete_client := false;
    v_allow_delete_vale := false;
  end if;

  -- Evita erro caso alguma instalação tenha uma estrutura JSON incompleta.
  v_old_clients := case
    when jsonb_typeof(coalesce(old.data -> 'clientes', '[]'::jsonb)) = 'array'
      then coalesce(old.data -> 'clientes', '[]'::jsonb)
    else '[]'::jsonb
  end;

  v_new_clients := case
    when jsonb_typeof(coalesce(new.data -> 'clientes', '[]'::jsonb)) = 'array'
      then coalesce(new.data -> 'clientes', '[]'::jsonb)
    else '[]'::jsonb
  end;

  v_old_vales := case
    when jsonb_typeof(coalesce(old.data -> 'vales', '[]'::jsonb)) = 'array'
      then coalesce(old.data -> 'vales', '[]'::jsonb)
    else '[]'::jsonb
  end;

  v_new_vales := case
    when jsonb_typeof(coalesce(new.data -> 'vales', '[]'::jsonb)) = 'array'
      then coalesce(new.data -> 'vales', '[]'::jsonb)
    else '[]'::jsonb
  end;

  if not v_allow_delete_client and exists (
    select 1
    from jsonb_array_elements(v_old_clients) as old_client
    where nullif(old_client ->> 'id', '') is not null
      and not exists (
        select 1
        from jsonb_array_elements(v_new_clients) as new_client
        where new_client ->> 'id' = old_client ->> 'id'
      )
  ) then
    raise exception 'Usuário sem permissão para excluir clientes.'
      using errcode = '42501';
  end if;

  if not v_allow_delete_vale and exists (
    select 1
    from jsonb_array_elements(v_old_vales) as old_vale
    where nullif(old_vale ->> 'id', '') is not null
      and not exists (
        select 1
        from jsonb_array_elements(v_new_vales) as new_vale
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

-- Cria os gatilhos somente nas tabelas que realmente existem na instalação.
do $$
begin
  if to_regclass('public.session_workspaces') is not null then
    execute 'drop trigger if exists valle_workspace_delete_permissions_v91 on public.session_workspaces';
    execute $trigger$
      create trigger valle_workspace_delete_permissions_v91
      before update of data on public.session_workspaces
      for each row
      execute function public.valle_enforce_workspace_delete_permissions_v91()
    $trigger$;
  end if;

  if to_regclass('public.workspace_states') is not null then
    execute 'drop trigger if exists valle_workspace_states_delete_permissions_v91 on public.workspace_states';
    execute $trigger$
      create trigger valle_workspace_states_delete_permissions_v91
      before update of data on public.workspace_states
      for each row
      execute function public.valle_enforce_workspace_delete_permissions_v91()
    $trigger$;
  end if;
end;
$$;
