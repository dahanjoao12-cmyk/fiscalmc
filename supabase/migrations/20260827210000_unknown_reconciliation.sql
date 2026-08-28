begin;

alter table public.invoices
  add column rejection_code text,
  add column safe_status_message text,
  add column last_reconciled_at timestamptz,
  add column reconciliation_count integer not null default 0
    check (reconciliation_count >= 0);

alter table public.invoice_attempts
  add column bytes_may_have_been_sent boolean not null default false,
  add column confirmed_no_emission boolean not null default false,
  add column response_metadata jsonb not null default '{}'::jsonb,
  add constraint invoice_attempts_safe_response_metadata_check
    check (not (response_metadata ?| array[
      'password', 'secret', 'certificate', 'pfx', 'private_key',
      'xml', 'signed_xml', 'dpsXmlGZipB64', 'encrypted_password'
    ]));

create index invoices_unknown_reconciliation_idx
  on public.invoices (organization_id, last_reconciled_at nulls first, created_at)
  where status = 'UNKNOWN';

create or replace function public.claim_invoice_submission(
  p_invoice_id uuid,
  p_organization_id uuid,
  p_request_id uuid,
  p_environment public.nfse_environment
)
returns table(claimed boolean, current_status public.invoice_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_invoice public.invoices%rowtype;
begin
  select * into locked_invoice
  from public.invoices
  where id = p_invoice_id
    and organization_id = p_organization_id
    and environment = p_environment
  for update;

  if not found then
    raise exception 'invoice_not_found';
  end if;

  if locked_invoice.status <> 'READY' then
    return query select false, locked_invoice.status;
    return;
  end if;

  insert into public.invoice_attempts(
    invoice_id, organization_id, request_id, status, environment
  ) values (
    p_invoice_id, p_organization_id, p_request_id, 'STARTED', p_environment
  );

  update public.invoices
  set status = 'SUBMITTING', updated_at = now()
  where id = p_invoice_id;

  return query select true, 'SUBMITTING'::public.invoice_status;
end;
$$;

create or replace function public.finalize_invoice_submission(
  p_invoice_id uuid,
  p_organization_id uuid,
  p_request_id uuid,
  p_outcome text,
  p_attempt_status text,
  p_bytes_may_have_been_sent boolean default false,
  p_confirmed_no_emission boolean default false,
  p_access_key text default null,
  p_nfse_number text default null,
  p_issued_at timestamptz default null,
  p_rejection_code text default null,
  p_safe_message text default null,
  p_response_metadata jsonb default '{}'::jsonb
)
returns public.invoice_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_invoice public.invoices%rowtype;
  next_status public.invoice_status;
begin
  select * into locked_invoice
  from public.invoices
  where id = p_invoice_id and organization_id = p_organization_id
  for update;

  if not found then raise exception 'invoice_not_found'; end if;
  if locked_invoice.status <> 'SUBMITTING' then raise exception 'invoice_not_submitting'; end if;

  case p_outcome
    when 'ISSUED' then
      if p_access_key is null or p_nfse_number is null or p_attempt_status <> 'COMPLETED' then
        raise exception 'invalid_issued_result';
      end if;
      next_status := 'ISSUED';
    when 'REJECTED' then
      if p_rejection_code is null or p_safe_message is null or p_attempt_status <> 'COMPLETED' then
        raise exception 'invalid_rejected_result';
      end if;
      next_status := 'REJECTED';
    when 'UNKNOWN' then
      if not p_bytes_may_have_been_sent or p_confirmed_no_emission or p_attempt_status <> 'UNKNOWN_AFTER_TRANSMISSION' then
        raise exception 'invalid_unknown_result';
      end if;
      next_status := 'UNKNOWN';
    when 'READY' then
      if (p_bytes_may_have_been_sent and not p_confirmed_no_emission) or p_attempt_status not in ('TRANSMISSION_FAILED','TRANSMISSION_BLOCKED','BUILD_FAILED','SIGNATURE_FAILED') then
        raise exception 'invalid_ready_result';
      end if;
      next_status := 'READY';
    else
      raise exception 'invalid_submission_outcome';
  end case;

  update public.invoices
  set status = next_status,
      access_key = case when next_status = 'ISSUED' then p_access_key else access_key end,
      nfse_number = case when next_status = 'ISSUED' then p_nfse_number else nfse_number end,
      issued_at = case when next_status = 'ISSUED' then coalesce(p_issued_at, now()) else issued_at end,
      rejection_code = case when next_status = 'REJECTED' then p_rejection_code else rejection_code end,
      safe_status_message = p_safe_message,
      updated_at = now()
  where id = p_invoice_id;

  update public.invoice_attempts
  set status = p_attempt_status,
      bytes_may_have_been_sent = p_bytes_may_have_been_sent,
      confirmed_no_emission = p_confirmed_no_emission,
      error_code = case when next_status in ('READY','UNKNOWN') then p_attempt_status else null end,
      safe_error_message = p_safe_message,
      response_metadata = coalesce(p_response_metadata, '{}'::jsonb),
      finished_at = now()
  where request_id = p_request_id
    and invoice_id = p_invoice_id
    and organization_id = p_organization_id;

  if not found then raise exception 'invoice_attempt_not_found'; end if;
  return next_status;
end;
$$;

create or replace function public.record_invoice_reconciliation(
  p_invoice_id uuid,
  p_organization_id uuid,
  p_outcome text,
  p_access_key text default null,
  p_nfse_number text default null,
  p_issued_at timestamptz default null,
  p_rejection_code text default null,
  p_safe_message text default null
)
returns public.invoice_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_invoice public.invoices%rowtype;
  next_status public.invoice_status;
begin
  select * into locked_invoice
  from public.invoices
  where id = p_invoice_id and organization_id = p_organization_id
  for update;

  if not found then raise exception 'invoice_not_found'; end if;
  if locked_invoice.status <> 'UNKNOWN' then return locked_invoice.status; end if;

  case p_outcome
    when 'ISSUED' then
      if p_access_key is null or p_nfse_number is null then raise exception 'invalid_issued_result'; end if;
      next_status := 'ISSUED';
    when 'REJECTED' then
      if p_rejection_code is null or p_safe_message is null then raise exception 'invalid_rejected_result'; end if;
      next_status := 'REJECTED';
    when 'UNKNOWN' then next_status := 'UNKNOWN';
    else raise exception 'invalid_reconciliation_outcome';
  end case;

  update public.invoices
  set status = next_status,
      access_key = case when next_status = 'ISSUED' then p_access_key else access_key end,
      nfse_number = case when next_status = 'ISSUED' then p_nfse_number else nfse_number end,
      issued_at = case when next_status = 'ISSUED' then coalesce(p_issued_at, now()) else issued_at end,
      rejection_code = case when next_status = 'REJECTED' then p_rejection_code else rejection_code end,
      safe_status_message = coalesce(p_safe_message, safe_status_message),
      last_reconciled_at = now(),
      reconciliation_count = reconciliation_count + 1,
      updated_at = now()
  where id = p_invoice_id;

  return next_status;
end;
$$;

revoke all on function public.claim_invoice_submission(uuid, uuid, uuid, public.nfse_environment) from public, anon, authenticated;
revoke all on function public.finalize_invoice_submission(uuid, uuid, uuid, text, text, boolean, boolean, text, text, timestamptz, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_invoice_reconciliation(uuid, uuid, text, text, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.claim_invoice_submission(uuid, uuid, uuid, public.nfse_environment) to service_role;
grant execute on function public.finalize_invoice_submission(uuid, uuid, uuid, text, text, boolean, boolean, text, text, timestamptz, text, text, jsonb) to service_role;
grant execute on function public.record_invoice_reconciliation(uuid, uuid, text, text, text, timestamptz, text, text) to service_role;

commit;
