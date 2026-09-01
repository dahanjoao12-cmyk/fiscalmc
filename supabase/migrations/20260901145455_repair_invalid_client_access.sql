begin;

create or replace function public.repair_invalid_client_access(
  p_organization_id uuid,
  p_user_id uuid,
  p_technical_email text,
  p_full_name text,
  p_actor_user_id uuid
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  prior_user_id uuid;
begin
  select user_id into prior_user_id from public.client_accesses where organization_id = p_organization_id for update;
  if prior_user_id is null then raise exception 'CLIENT_ACCESS_NOT_FOUND'; end if;
  if exists(select 1 from public.memberships where organization_id = p_organization_id and user_id = prior_user_id and role = 'CLIENT_USER') then
    raise exception 'CLIENT_ACCESS_ALREADY_VALID';
  end if;

  insert into public.profiles(user_id, full_name, email) values (p_user_id, p_full_name, p_technical_email);
  insert into public.memberships(user_id, organization_id, role, active) values (p_user_id, p_organization_id, 'CLIENT_USER', true);
  update public.client_accesses set user_id = p_user_id, technical_email = p_technical_email, enabled = true, blocked_at = null, updated_at = now() where organization_id = p_organization_id;
  insert into public.audit_logs(actor_user_id, organization_id, actor_type, action, entity, entity_id, safe_metadata)
  values (p_actor_user_id, p_organization_id, 'OFFICE', 'client_access_repaired', 'client_access', p_user_id::text, jsonb_build_object('replacedInvalidAssociation', true));
end;
$$;

revoke all on function public.repair_invalid_client_access(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.repair_invalid_client_access(uuid, uuid, text, text, uuid) to service_role;

commit;
