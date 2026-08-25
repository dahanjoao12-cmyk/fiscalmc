begin;

-- Authentication remains in Supabase Auth. This table maps its opaque user id to
-- an organization; it deliberately never stores a customer password.
create table public.client_accesses (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  technical_email text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  blocked_at timestamptz
);

create table public.national_service_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{6}$'),
  display_code text not null unique check (display_code ~ '^[0-9]{2}\.[0-9]{2}\.[0-9]{2}$'),
  item text not null,
  subitem text,
  national_split text,
  description text not null,
  active boolean not null default true,
  valid_from date,
  valid_until date,
  source text not null,
  source_version text not null,
  source_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create table public.municipal_service_mappings (
  id uuid primary key default gen_random_uuid(),
  municipality_code text not null check (municipality_code ~ '^[0-9]{7}$'),
  national_service_code_id uuid not null references public.national_service_codes(id) on delete restrict,
  municipal_service_code text not null,
  valid_from date,
  valid_until date,
  source text not null,
  source_version text,
  fetched_at timestamptz not null default now(),
  unique (municipality_code, national_service_code_id, municipal_service_code, valid_from)
);

alter table public.service_templates add column national_service_code_id uuid references public.national_service_codes(id) on delete restrict;
alter table public.tax_profiles add constraint tax_profiles_administrative_regime_check check (tax_regime in ('SIMPLES_NACIONAL','LUCRO_PRESUMIDO','LUCRO_REAL')) not valid;

alter table public.client_accesses enable row level security;
alter table public.national_service_codes enable row level security;
alter table public.municipal_service_mappings enable row level security;
grant select on public.national_service_codes, public.municipal_service_mappings to authenticated;
grant select on public.client_accesses to authenticated;
create policy client_access_office_select on public.client_accesses for select to authenticated using (private.has_org_role(organization_id,array['SUPER_ADMIN','OFFICE_STAFF']::public.membership_role[]));
create policy national_codes_authenticated_select on public.national_service_codes for select to authenticated using (true);
create policy municipal_mappings_authenticated_select on public.municipal_service_mappings for select to authenticated using (true);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('certificates','certificates',false,5242880,array['application/json']) on conflict (id) do nothing;

create index client_accesses_enabled_idx on public.client_accesses(user_id) where enabled;
create index municipal_service_mappings_lookup_idx on public.municipal_service_mappings(municipality_code,national_service_code_id);
create index service_templates_national_service_code_idx on public.service_templates(national_service_code_id);

commit;
