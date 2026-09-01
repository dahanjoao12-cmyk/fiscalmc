begin;

-- A reimportação do mesmo A1 preserva o histórico: somente o certificado
-- corrente precisa ser único. As unicidades globais de serial e fingerprint
-- bloqueavam a inserção depois de o registro anterior ser substituído na RPC.
alter table public.digital_certificates
  drop constraint if exists digital_certificates_organization_id_serial_key;

create unique index if not exists digital_certificates_org_active_serial_idx
  on public.digital_certificates(organization_id,serial)
  where replaced_at is null;

drop index if exists public.digital_certificates_org_fingerprint_idx;

create unique index if not exists digital_certificates_org_active_fingerprint_idx
  on public.digital_certificates(organization_id,fingerprint_sha256)
  where replaced_at is null and fingerprint_sha256 is not null;

commit;
