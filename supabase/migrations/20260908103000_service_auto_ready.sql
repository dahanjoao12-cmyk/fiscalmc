alter type public.service_workflow_status add value if not exists 'AUTO_READY';
alter type public.service_created_via add value if not exists 'CATALOG';

begin;

alter table public.service_templates
  add column if not exists auto_ready_at timestamptz,
  add column if not exists auto_ready_source text;

alter table public.service_templates
  drop constraint if exists service_templates_reviewed_workflow_check,
  drop constraint if exists service_templates_non_reviewed_inactive_check;

alter table public.service_templates
  add constraint service_templates_ready_workflow_check
    check (
      workflow_status <> 'REVIEWED'
      or (active and reviewed_at is not null and reviewed_by is not null)
    ),
  add constraint service_templates_auto_ready_check
    check (
      workflow_status <> 'AUTO_READY'
      or (active and auto_ready_at is not null and nullif(btrim(auto_ready_source), '') is not null)
    ),
  add constraint service_templates_non_ready_inactive_check
    check (workflow_status in ('REVIEWED', 'AUTO_READY') or not active);

drop index if exists public.service_templates_review_queue_idx;
create index service_templates_review_queue_idx
  on public.service_templates(workflow_status, submitted_at desc)
  where workflow_status in ('PENDING_REVIEW', 'NEEDS_INFO');

comment on column public.service_templates.auto_ready_at is
  'Timestamp of deterministic readiness completion from official catalog and existing fiscal parameters.';
comment on column public.service_templates.auto_ready_source is
  'Safe provenance for an AUTO_READY service. It never substitutes an unresolved municipal parameter.';

commit;
