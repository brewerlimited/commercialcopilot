-- Contract file extraction metadata for Commercial Co-Pilot.
-- Enables the app to persist whether uploaded project contract documents were readable
-- and exactly how much extracted text reached the AI payload.

alter table public.event_contract_files
  add column if not exists extracted_text text,
  add column if not exists extraction_status text,
  add column if not exists extraction_error text,
  add column if not exists extracted_characters integer default 0,
  add column if not exists extracted_at timestamptz;

alter table public.event_contract_files
  drop constraint if exists event_contract_files_extraction_status_check;

alter table public.event_contract_files
  add constraint event_contract_files_extraction_status_check
  check (
    extraction_status is null
    or extraction_status in ('extracted', 'failed', 'no_readable_text')
  );

create index if not exists idx_event_contract_files_extraction_status
  on public.event_contract_files (event_id, extraction_status);
