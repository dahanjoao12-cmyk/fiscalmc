begin;

create table public.fiscal_artifacts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('DPS_XML','NFSE_XML','DANFSE_PDF')),
  source text not null check (source in ('SEFIN','MOCK','MANUAL_IMPORT')),
  private_storage_path text not null check (private_storage_path ~ '^[0-9a-f-]+/[0-9a-f-]+/.+'),
  content_type text not null check (content_type in ('application/xml','text/xml','application/pdf')),
  checksum_sha256 text,
  created_at timestamptz not null default now(),
  unique (invoice_id, artifact_type)
);

create index fiscal_artifacts_organization_invoice_idx on public.fiscal_artifacts (organization_id, invoice_id, created_at desc);

alter table public.fiscal_artifacts enable row level security;
revoke all on public.fiscal_artifacts from anon, authenticated;

alter table public.cancellation_requests
  add column idempotency_key uuid,
  add column request_id uuid,
  add column reviewed_by uuid references public.profiles(user_id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text check (review_note is null or length(review_note) <= 1000),
  add column technical_reason_code text,
  add column attempted_at timestamptz,
  add column completed_at timestamptz,
  add column last_reconciled_at timestamptz,
  add column updated_at timestamptz not null default now();

alter table public.cancellation_requests drop constraint cancellation_requests_status_check;
alter table public.cancellation_requests add constraint cancellation_requests_status_check
  check (status in ('REQUESTED','UNDER_REVIEW','PROCESSING','UNKNOWN','CANCELLED','REJECTED','APPROVED','DENIED','COMPLETED'));

create unique index cancellation_requests_organization_idempotency_idx
  on public.cancellation_requests (organization_id, idempotency_key)
  where idempotency_key is not null;
create unique index cancellation_requests_active_invoice_idx
  on public.cancellation_requests (invoice_id)
  where status in ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','UNKNOWN');
create index cancellation_requests_operational_idx
  on public.cancellation_requests (status, updated_at desc);

alter table public.audit_logs
  add column actor_type text check (actor_type in ('CLIENT','OFFICE','SYSTEM'));

commit;
