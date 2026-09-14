begin;

-- Lets the office mark an item on the operational queue (/admin/pendencias) as
-- resolved. The queue itself is computed live from invoices/certificates/
-- service_templates/etc, so this is a separate, permanent acknowledgement
-- keyed by the same synthetic id (e.g. "invoice-<uuid>") rather than a mutation
-- of the underlying fiscal/operational row.
create table public.pendency_dismissals (
  id uuid primary key default gen_random_uuid(),
  item_id text not null unique,
  item_type text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dismissed_by uuid not null references public.profiles(user_id),
  dismissed_at timestamptz not null default now()
);

create index pendency_dismissals_organization_idx on public.pendency_dismissals(organization_id);

alter table public.pendency_dismissals enable row level security;
grant select, insert, delete on public.pendency_dismissals to authenticated;
create policy pendency_dismissals_office_select on public.pendency_dismissals for select to authenticated using (private.has_org_role(organization_id, array['SUPER_ADMIN','OFFICE_STAFF']::public.membership_role[]));
create policy pendency_dismissals_office_insert on public.pendency_dismissals for insert to authenticated with check (private.has_org_role(organization_id, array['SUPER_ADMIN','OFFICE_STAFF']::public.membership_role[]) and dismissed_by = (select auth.uid()));
create policy pendency_dismissals_office_delete on public.pendency_dismissals for delete to authenticated using (private.has_org_role(organization_id, array['SUPER_ADMIN','OFFICE_STAFF']::public.membership_role[]));

commit;
