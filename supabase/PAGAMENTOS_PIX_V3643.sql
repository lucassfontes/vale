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
