begin;

-- A chave de acesso só existe após a autorização. Estados anteriores e
-- rejeitados podem coexistir legitimamente sem uma chave de acesso.
alter table public.invoices
  drop constraint if exists invoices_environment_access_key_key;

drop index if exists public.invoices_environment_access_key_key;

create unique index invoices_environment_access_key_unique_present_idx
  on public.invoices (environment, access_key)
  where access_key is not null;

commit;
