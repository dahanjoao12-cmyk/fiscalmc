begin;

-- The synthetic Auth email is operational metadata. Authenticated users may
-- read their display profile, but never the technical email column.
revoke select, update on public.profiles from authenticated;
grant select(user_id, full_name, created_at, updated_at) on public.profiles to authenticated;
grant update(full_name) on public.profiles to authenticated;

-- Auth user creation and password changes stay in Supabase Auth. These RPCs
-- only make the relational side of client access atomic and auditable.
create or replace function public.register_client_access(
  p_organization_id uuid,
  p_user_id uuid,
  p_technical_email text,
  p_full_name text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists(select 1 from public.client_accesses where organization_id = p_organization_id) then
    raise exception 'CLIENT_ACCESS_ALREADY_EXISTS';
  end if;

  insert into public.profiles(user_id, full_name, email)
  values (p_user_id, p_full_name, p_technical_email);

  insert into public.memberships(user_id, organization_id, role, active)
  values (p_user_id, p_organization_id, 'CLIENT_USER', true);

  insert into public.client_accesses(organization_id, user_id, technical_email, enabled)
  values (p_organization_id, p_user_id, p_technical_email, true);

  insert into public.audit_logs(actor_user_id, organization_id, action, entity, entity_id)
  values (p_actor_user_id, p_organization_id, 'client_access_created', 'client_access', p_user_id::text);
end;
$$;

create or replace function public.set_client_access_state(
  p_organization_id uuid,
  p_user_id uuid,
  p_enabled boolean,
  p_actor_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.client_accesses
     set enabled = p_enabled,
         blocked_at = case when p_enabled then null else now() end,
         updated_at = now()
   where organization_id = p_organization_id
     and user_id = p_user_id;
  if not found then raise exception 'CLIENT_ACCESS_NOT_FOUND'; end if;

  update public.memberships
     set active = p_enabled
   where organization_id = p_organization_id
     and user_id = p_user_id
     and role = 'CLIENT_USER';
  if not found then raise exception 'CLIENT_MEMBERSHIP_NOT_FOUND'; end if;

  insert into public.audit_logs(actor_user_id, organization_id, action, entity, entity_id)
  values (
    p_actor_user_id,
    p_organization_id,
    case when p_enabled then 'client_access_reactivated' else 'client_access_blocked' end,
    'client_access',
    p_user_id::text
  );
end;
$$;

create or replace function public.record_client_password_reset(
  p_organization_id uuid,
  p_user_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists(
    select 1 from public.client_accesses
     where organization_id = p_organization_id and user_id = p_user_id
  ) then
    raise exception 'CLIENT_ACCESS_NOT_FOUND';
  end if;

  insert into public.audit_logs(actor_user_id, organization_id, action, entity, entity_id)
  values (p_actor_user_id, p_organization_id, 'client_password_reset', 'client_access', p_user_id::text);
end;
$$;

revoke all on function public.register_client_access(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.set_client_access_state(uuid, uuid, boolean, uuid) from public, anon, authenticated;
revoke all on function public.record_client_password_reset(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.register_client_access(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.set_client_access_state(uuid, uuid, boolean, uuid) to service_role;
grant execute on function public.record_client_password_reset(uuid, uuid, uuid) to service_role;

commit;
