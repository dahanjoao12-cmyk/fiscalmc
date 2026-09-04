-- Public PostgREST entry point for the existing private, membership-checked
-- reservation function. SECURITY INVOKER preserves the caller's auth.uid().
create or replace function public.reserve_dps_number(
  target_org uuid,
  target_env public.nfse_environment,
  target_series text
)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.reserve_dps_number(target_org, target_env, target_series);
$$;

revoke all on function public.reserve_dps_number(uuid, public.nfse_environment, text) from public, anon;
grant execute on function public.reserve_dps_number(uuid, public.nfse_environment, text) to authenticated;
