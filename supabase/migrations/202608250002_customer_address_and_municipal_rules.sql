begin;

alter table public.customers
  add column postal_code text,
  add column street text,
  add column address_number text,
  add column address_complement text,
  add column neighborhood text,
  add column municipal_registration text;

create table public.municipal_tax_rules (
  id uuid primary key default gen_random_uuid(),
  municipality_code text not null check (municipality_code ~ '^[0-9]{7}$'),
  service_code text not null,
  incidence text not null,
  iss_rate_percent numeric(6,3),
  valid_from timestamptz not null,
  valid_until timestamptz,
  source text not null,
  source_version text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (iss_rate_percent is null or (iss_rate_percent >= 0 and iss_rate_percent <= 100)),
  check (valid_until is null or valid_until >= valid_from),
  unique (municipality_code, service_code, incidence, valid_from, source)
);
create index municipal_tax_rules_lookup_idx on public.municipal_tax_rules(municipality_code, service_code, valid_from desc);
alter table public.municipal_tax_rules enable row level security;
-- Raw and normalized fiscal parameters are server-only until a reviewed DTO is exposed.
revoke all on public.municipal_tax_rules from anon, authenticated;

commit;
