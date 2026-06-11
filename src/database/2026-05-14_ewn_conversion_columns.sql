-- Commercial Co-Pilot — EWN conversion column alignment
-- Run this in Supabase if the seed or EWN register reports that converted_event_id is missing.

alter table public.ewns
  add column if not exists converted_event_id uuid references public.events(id) on delete set null,
  add column if not exists converted_at timestamptz;

create index if not exists idx_ewns_converted_event_id on public.ewns(converted_event_id);

notify pgrst, 'reload schema';
