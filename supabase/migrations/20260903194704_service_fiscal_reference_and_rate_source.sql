begin;

-- Keep a reviewed, accepted DPS as bounded evidence for a service. It is not a
-- substitute for a future official municipal-catalog mapping.
alter table public.tax_profiles
  add column fiscal_reference jsonb not null default '{}'::jsonb
    check (jsonb_typeof(fiscal_reference) = 'object');

alter table public.service_templates
  add column nbs_code text check (nbs_code ~ '^[0-9]{9}$'),
  add column iss_taxation text check (iss_taxation in ('1','2','3','4')),
  add column iss_rate_source text check (iss_rate_source in ('PARAMETRIZED_BY_NATIONAL','EMITTER_PROVIDED')),
  add column fiscal_reference jsonb not null default '{}'::jsonb
    check (jsonb_typeof(fiscal_reference) = 'object');

comment on column public.tax_profiles.fiscal_reference is
  'Evidence for a reviewed fiscal profile, such as an accepted production DPS. It is not an immutable taxpayer classification.';
comment on column public.service_templates.fiscal_reference is
  'Bounded fiscal evidence for this service. It does not replace an official municipal-service mapping.';
comment on column public.service_templates.iss_rate_source is
  'PARAMETRIZED_BY_NATIONAL omits pAliq; EMITTER_PROVIDED requires pAliq.';

commit;
