begin;

-- A profile may exist as an explicit draft before the office confirms the
-- administrative regime. Null means unknown, never an implied regime.
alter table public.tax_profiles
  alter column tax_regime drop not null;

commit;
