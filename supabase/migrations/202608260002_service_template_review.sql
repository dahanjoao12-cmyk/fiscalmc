begin;

alter table public.service_templates
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles(user_id) on delete set null,
  add column municipal_service_mapping_id uuid references public.municipal_service_mappings(id) on delete restrict,
  add column dps_municipal_tax_code_source text;

create index service_templates_reviewed_active_idx
  on public.service_templates(organization_id)
  where active and reviewed_at is not null;

create index service_templates_municipal_mapping_idx
  on public.service_templates(municipal_service_mapping_id)
  where municipal_service_mapping_id is not null;

commit;
