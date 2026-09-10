begin;

alter table public.organizations
  add column if not exists cnae_fiscal_code text check (cnae_fiscal_code ~ '^[0-9]{7}$'),
  add column if not exists cnae_fiscal_description text,
  add column if not exists cnaes_secundarios jsonb not null default '[]'::jsonb;

comment on column public.organizations.cnae_fiscal_code is
  'Primary CNAE code from the CNPJ card, informational only. Not a fiscal classification by itself.';
comment on column public.organizations.cnae_fiscal_description is
  'Human-readable description of the primary CNAE, as returned by the CNPJ lookup.';
comment on column public.organizations.cnaes_secundarios is
  'Secondary CNAEs from the CNPJ card as [{"code":"...","description":"..."}]. Informational only.';

commit;
