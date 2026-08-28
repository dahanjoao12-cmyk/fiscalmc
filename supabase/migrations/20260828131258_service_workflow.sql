begin;

create type public.service_workflow_status as enum (
  'DRAFT',
  'PENDING_REVIEW',
  'NEEDS_INFO',
  'REVIEWED',
  'INACTIVE'
);

create type public.service_created_via as enum ('CLIENT', 'OFFICE');

alter table public.service_templates
  alter column national_tax_code drop not null,
  add column workflow_status public.service_workflow_status not null default 'DRAFT',
  add column created_by uuid references public.profiles(user_id) on delete set null,
  add column created_via public.service_created_via not null default 'OFFICE',
  add column client_service_location text,
  add column client_note text,
  add column review_note text,
  add column submitted_at timestamptz,
  add column needs_info_message text;

-- Existing templates could only be created through the office workflow. Preserve
-- reviewed services without manufacturing approval for incomplete legacy rows.
update public.service_templates
set workflow_status = case
  when not active then 'INACTIVE'::public.service_workflow_status
  when reviewed_at is not null and reviewed_by is not null then 'REVIEWED'::public.service_workflow_status
  else 'DRAFT'::public.service_workflow_status
end,
created_via = 'OFFICE'::public.service_created_via;

update public.service_templates
set active = false
where workflow_status <> 'REVIEWED';

alter table public.service_templates
  add constraint service_templates_reviewed_workflow_check
    check (
      workflow_status <> 'REVIEWED'
      or (active and reviewed_at is not null and reviewed_by is not null)
    ),
  add constraint service_templates_non_reviewed_inactive_check
    check (workflow_status = 'REVIEWED' or not active),
  add constraint service_templates_needs_info_message_check
    check (
      workflow_status <> 'NEEDS_INFO'
      or nullif(btrim(needs_info_message), '') is not null
    ),
  add constraint service_templates_submitted_workflow_check
    check (
      workflow_status not in ('PENDING_REVIEW', 'NEEDS_INFO')
      or submitted_at is not null
    );

create index service_templates_review_queue_idx
  on public.service_templates(workflow_status, submitted_at desc)
  where workflow_status in ('PENDING_REVIEW', 'NEEDS_INFO');

create index service_templates_client_list_idx
  on public.service_templates(organization_id, updated_at desc);

-- Client-facing reads are deliberately column-limited. Fiscal classification,
-- mapping, review actor and DPS configuration remain server/office-only.
revoke select on public.service_templates from authenticated;
grant select (
  id,
  organization_id,
  name,
  description,
  default_description,
  active,
  workflow_status,
  created_via,
  client_service_location,
  client_note,
  needs_info_message,
  submitted_at,
  created_at,
  updated_at
) on public.service_templates to authenticated;

create or replace function private.is_office_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.active
      and m.role in ('SUPER_ADMIN', 'OFFICE_STAFF')
  );
$$;

revoke all on function private.is_office_user() from public;
grant execute on function private.is_office_user() to authenticated;

drop policy if exists national_codes_authenticated_select on public.national_service_codes;
drop policy if exists municipal_mappings_authenticated_select on public.municipal_service_mappings;

create policy national_codes_office_select
  on public.national_service_codes
  for select
  to authenticated
  using (private.is_office_user());

create policy municipal_mappings_office_select
  on public.municipal_service_mappings
  for select
  to authenticated
  using (private.is_office_user());

comment on column public.service_templates.workflow_status is
  'Commercial-to-fiscal review workflow. REVIEWED never replaces reviewed_at/reviewed_by audit fields.';
comment on column public.service_templates.created_via is
  'Origin of the service request: CLIENT or OFFICE.';
comment on column public.service_templates.client_note is
  'Commercial context supplied by the client. Must not contain fiscal classification.';
comment on column public.service_templates.client_service_location is
  'Human-readable location supplied by the client. Null means the organization municipality; it never replaces the reviewed DPS municipality code.';
comment on column public.service_templates.needs_info_message is
  'Human-safe message shown to the client when more operational information is required.';

commit;
