begin;

alter table public.organizations
  add column street text,
  add column address_number text,
  add column address_complement text,
  add column neighborhood text,
  add column state text,
  add column postal_code text,
  add column email text,
  add column phone text;

alter table public.tax_profiles
  add column dps_configuration jsonb not null default '{}'::jsonb;

-- This is intentionally distinct from municipal_service_code, which is the
-- complete code used by the ADN municipal-parameter endpoint (00.00.00.000).
alter table public.service_templates
  add column dps_municipal_tax_code text check (dps_municipal_tax_code ~ '^[0-9]{3}$'),
  add column service_location_municipality_code text check (service_location_municipality_code ~ '^[0-9]{7}$'),
  add column dps_configuration jsonb not null default '{}'::jsonb;

alter table public.invoice_attempts
  alter column status type text using status::text;
alter table public.invoice_attempts
  add constraint invoice_attempts_status_check check (status in ('DRAFT','READY','SUBMITTING','ISSUED','REJECTED','UNKNOWN','CANCELLED','STARTED','BUILD_FAILED','SIGNATURE_FAILED','TRANSMISSION_FAILED','UNKNOWN_AFTER_TRANSMISSION','TRANSMISSION_BLOCKED','COMPLETED'));

commit;
