begin;

-- Office staff previously needed an explicit per-organization membership row
-- to see that organization anywhere RLS is enforced (organizations, service_
-- templates, invoices, customers, digital_certificates, audit_logs, storage
-- objects, ...). Nothing in the "Nova empresa" flow ever created that row,
-- so every organization registered after initial setup was invisible to the
-- office the moment it was saved: 404 on its own detail page, absent from the
-- companies list, no way to configure fiscal profile/certificate/services.
--
-- The platform is single-office (one accounting firm serving many client
-- organizations), so "is this user office staff at all" is the correct check
-- for office-side access -- not "does this user have a membership row for
-- this specific organization", which only makes sense for CLIENT_USER.
-- private.is_office_user() (added for the national catalog tables) already
-- expresses exactly that, org-independently; is_member/has_org_role are now
-- widened to use it too, additively -- a CLIENT_USER's own per-org check is
-- completely unchanged, since they never hold an OFFICE_STAFF/SUPER_ADMIN
-- membership anywhere.

create or replace function private.is_member(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m where m.user_id = (select auth.uid()) and m.organization_id = target_org and m.active)
      or private.is_office_user();
$$;

create or replace function private.has_org_role(target_org uuid, allowed public.membership_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m where m.user_id = (select auth.uid()) and m.organization_id = target_org and m.active and m.role = any(allowed))
      or ((allowed && array['OFFICE_STAFF','SUPER_ADMIN']::public.membership_role[]) and private.is_office_user());
$$;

commit;
