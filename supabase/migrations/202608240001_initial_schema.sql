begin;

create extension if not exists pgcrypto;
create schema if not exists private;

create type public.membership_role as enum ('SUPER_ADMIN','OFFICE_STAFF','CLIENT_USER');
create type public.organization_status as enum ('ONBOARDING','ACTIVE','BLOCKED','INACTIVE');
create type public.invoice_status as enum ('DRAFT','READY','SUBMITTING','ISSUED','REJECTED','UNKNOWN','CANCELLED');
create type public.nfse_environment as enum ('PRODUCTION_RESTRICTED','PRODUCTION');
create type public.certificate_status as enum ('VALID','EXPIRING','EXPIRED','INVALID','REVOKED');

create table public.profiles (
  user_id uuid primary key,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  tax_id text not null unique check (tax_id ~ '^[A-Z0-9]{12}[0-9]{2}$'),
  municipal_registration text,
  municipality_code text not null check (municipality_code ~ '^[0-9]{7}$'),
  status public.organization_status not null default 'ONBOARDING',
  emission_blocked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.membership_role not null,
  active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);
create index memberships_organization_idx on public.memberships(organization_id) where active;

create table public.tax_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  tax_regime text not null,
  special_tax_regime text,
  iss_configuration jsonb not null default '{}'::jsonb,
  default_settings jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  national_tax_code text not null,
  municipal_service_code text,
  tax_configuration jsonb not null default '{}'::jsonb,
  additional_fields jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  default_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index service_templates_active_idx on public.service_templates(organization_id) where active;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  person_type text not null check (person_type in ('INDIVIDUAL','COMPANY','FOREIGN')),
  tax_id text,
  legal_name text not null,
  email text,
  phone text,
  address jsonb not null default '{}'::jsonb,
  municipality_code text,
  state text,
  country_code text not null default 'BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, tax_id)
);
create index customers_search_idx on public.customers(organization_id, lower(legal_name));

create table public.digital_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  private_storage_path text not null,
  encrypted_password jsonb not null,
  serial text not null,
  subject text not null,
  issuer text not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  status public.certificate_status not null,
  created_at timestamptz not null default now(),
  replaced_at timestamptz,
  unique (organization_id, serial)
);
create unique index one_current_certificate_per_org on public.digital_certificates(organization_id) where replaced_at is null;

create table public.dps_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  environment public.nfse_environment not null,
  series text not null,
  next_number bigint not null default 1 check (next_number > 0),
  primary key (organization_id, environment, series)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  service_template_id uuid not null references public.service_templates(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  service_date date not null,
  description text not null check (length(description) between 3 and 1000),
  status public.invoice_status not null default 'DRAFT',
  idempotency_key uuid not null,
  dps_series text,
  dps_number bigint,
  dps_identifier text,
  access_key text,
  nfse_number text,
  issued_at timestamptz,
  xml_storage_path text,
  danfse_storage_path text,
  environment public.nfse_environment not null default 'PRODUCTION_RESTRICTED',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique nulls not distinct (organization_id, environment, dps_series, dps_number),
  unique nulls not distinct (environment, access_key)
);
create index invoices_history_idx on public.invoices(organization_id, created_at desc);
create index invoices_unknown_idx on public.invoices(created_at) where status = 'UNKNOWN';

create table public.invoice_attempts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null unique,
  status public.invoice_status not null,
  error_code text,
  safe_error_message text,
  technical_error_encrypted jsonb,
  environment public.nfse_environment not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index invoice_attempts_invoice_idx on public.invoice_attempts(invoice_id, started_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  safe_metadata jsonb not null default '{}'::jsonb,
  request_id uuid,
  created_at timestamptz not null default now(),
  check (not (safe_metadata ?| array['password','secret','certificate','pfx','private_key','xml']))
);
create index audit_logs_org_time_idx on public.audit_logs(organization_id, created_at desc);

create table public.municipal_parameter_cache (
  id uuid primary key default gen_random_uuid(),
  municipality_code text not null,
  service_code text not null,
  response jsonb not null,
  version text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (municipality_code, service_code)
);
create index municipal_cache_expiry_idx on public.municipal_parameter_cache(expires_at);

create table public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null,
  reason text not null check (length(reason) between 10 and 500),
  status text not null default 'REQUESTED' check (status in ('REQUESTED','UNDER_REVIEW','APPROVED','DENIED','COMPLETED')),
  created_at timestamptz not null default now()
);

create or replace function private.is_member(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m where m.user_id = (select auth.uid()) and m.organization_id = target_org and m.active);
$$;
create or replace function private.has_org_role(target_org uuid, allowed public.membership_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m where m.user_id = (select auth.uid()) and m.organization_id = target_org and m.active and m.role = any(allowed));
$$;
revoke all on function private.is_member(uuid) from public;
revoke all on function private.has_org_role(uuid, public.membership_role[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, public.membership_role[]) to authenticated;

create or replace function private.reserve_dps_number(target_org uuid, target_env public.nfse_environment, target_series text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare reserved bigint;
begin
  if not private.has_org_role(target_org, array['SUPER_ADMIN','OFFICE_STAFF','CLIENT_USER']::public.membership_role[]) then raise exception 'forbidden'; end if;
  insert into public.dps_sequences(organization_id,environment,series,next_number) values(target_org,target_env,target_series,2)
  on conflict (organization_id,environment,series) do update set next_number=public.dps_sequences.next_number+1
  returning next_number-1 into reserved;
  return reserved;
end; $$;
revoke all on function private.reserve_dps_number(uuid, public.nfse_environment, text) from public;
grant execute on function private.reserve_dps_number(uuid, public.nfse_environment, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.tax_profiles enable row level security;
alter table public.service_templates enable row level security;
alter table public.customers enable row level security;
alter table public.digital_certificates enable row level security;
alter table public.dps_sequences enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_attempts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.municipal_parameter_cache enable row level security;
alter table public.cancellation_requests enable row level security;

grant select,update on public.profiles to authenticated;
grant select on public.organizations, public.memberships, public.tax_profiles, public.service_templates, public.invoices, public.invoice_attempts, public.audit_logs to authenticated;
grant select,insert,update,delete on public.customers to authenticated;
grant select on public.digital_certificates to authenticated;
grant insert on public.cancellation_requests to authenticated;
revoke all on public.dps_sequences, public.municipal_parameter_cache from anon, authenticated;

create policy profiles_self_select on public.profiles for select to authenticated using ((select auth.uid())=user_id);
create policy profiles_self_update on public.profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy organizations_member_select on public.organizations for select to authenticated using (private.is_member(id));
create policy memberships_self_select on public.memberships for select to authenticated using (user_id=(select auth.uid()));
create policy tax_profiles_office_select on public.tax_profiles for select to authenticated using (private.has_org_role(organization_id,array['SUPER_ADMIN','OFFICE_STAFF']::public.membership_role[]));
create policy services_member_select on public.service_templates for select to authenticated using (private.is_member(organization_id));
create policy customers_member_select on public.customers for select to authenticated using (private.is_member(organization_id));
create policy customers_member_insert on public.customers for insert to authenticated with check (private.is_member(organization_id));
create policy customers_member_update on public.customers for update to authenticated using (private.is_member(organization_id)) with check (private.is_member(organization_id));
create policy customers_member_delete on public.customers for delete to authenticated using (private.is_member(organization_id));
create policy certificates_metadata_office_select on public.digital_certificates for select to authenticated using (private.has_org_role(organization_id,array['SUPER_ADMIN','OFFICE_STAFF']::public.membership_role[]));
create policy invoices_member_select on public.invoices for select to authenticated using (private.is_member(organization_id));
create policy attempts_office_select on public.invoice_attempts for select to authenticated using (private.has_org_role(organization_id,array['SUPER_ADMIN','OFFICE_STAFF']::public.membership_role[]));
create policy audit_office_select on public.audit_logs for select to authenticated using (private.has_org_role(organization_id,array['SUPER_ADMIN','OFFICE_STAFF']::public.membership_role[]));
create policy cancellation_member_insert on public.cancellation_requests for insert to authenticated with check (requested_by=(select auth.uid()) and private.is_member(organization_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('nfse-documents','nfse-documents',false,10485760,array['application/xml','text/xml','application/pdf']),
('a1-certificates','a1-certificates',false,5242880,array['application/x-pkcs12','application/octet-stream'])
on conflict (id) do nothing;

create policy nfse_documents_member_read on storage.objects for select to authenticated using (bucket_id='nfse-documents' and private.is_member(((storage.foldername(name))[1])::uuid));
-- Certificados não têm política de leitura para usuários: somente backend com secret key.

commit;
