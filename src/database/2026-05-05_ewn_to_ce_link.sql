-- Commercial Co-Pilot — EWN to CE link
-- Keeps EWNs lightweight while preserving traceability once they become CEs.

alter table ewns
  add column if not exists converted_event_id uuid references events(id) on delete set null,
  add column if not exists converted_at timestamptz;

create index if not exists idx_ewns_converted_event_id on ewns(converted_event_id);
