begin;

alter table public.digital_certificates
  add column owner_tax_id text check (owner_tax_id ~ '^[0-9]{14}$'),
  add column fingerprint_sha256 text check (fingerprint_sha256 ~ '^[A-F0-9]{64}$');

create unique index digital_certificates_org_fingerprint_idx
  on public.digital_certificates(organization_id,fingerprint_sha256)
  where fingerprint_sha256 is not null;

-- Existing private bucket is reused. Only the backend service role accesses it.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('a1-certificates','a1-certificates',false,5242880,array['application/x-pkcs12','application/octet-stream'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- The atomic swap happens only after the application has validated and uploaded
-- the replacement. The function is not callable by anon/authenticated users.
create or replace function public.register_organization_certificate(
  p_organization_id uuid,
  p_storage_path text,
  p_encrypted_password jsonb,
  p_serial text,
  p_subject text,
  p_issuer text,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_status public.certificate_status,
  p_owner_tax_id text,
  p_fingerprint_sha256 text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_certificate_id uuid := gen_random_uuid();
begin
  if p_status not in ('VALID','EXPIRING') then
    raise exception 'certificate status must be valid or expiring';
  end if;

  update public.digital_certificates
  set replaced_at=now()
  where organization_id=p_organization_id and replaced_at is null;

  insert into public.digital_certificates(
    id,organization_id,private_storage_path,encrypted_password,serial,subject,issuer,
    valid_from,valid_until,status,owner_tax_id,fingerprint_sha256
  ) values (
    new_certificate_id,p_organization_id,p_storage_path,p_encrypted_password,p_serial,p_subject,p_issuer,
    p_valid_from,p_valid_until,p_status,p_owner_tax_id,p_fingerprint_sha256
  );
  return new_certificate_id;
end;
$$;

revoke all on function public.register_organization_certificate(uuid,text,jsonb,text,text,text,timestamptz,timestamptz,public.certificate_status,text,text) from public, anon, authenticated;
grant execute on function public.register_organization_certificate(uuid,text,jsonb,text,text,text,timestamptz,timestamptz,public.certificate_status,text,text) to service_role;

commit;
