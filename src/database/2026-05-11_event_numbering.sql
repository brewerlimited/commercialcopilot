-- Commercial Co-Pilot — CE / VO numbering
-- Run in Supabase SQL editor before deploying the source update.

alter table public.events
add column if not exists event_number integer,
add column if not exists event_reference text;

create index if not exists idx_events_user_project_event_number
on public.events (user_id, project_name, event_number);

create index if not exists idx_events_user_project_event_reference
on public.events (user_id, project_name, event_reference);

-- Prevent duplicate references within the same user/project once references are set.
create unique index if not exists uq_events_user_project_event_reference
on public.events (user_id, coalesce(project_name, ''), event_reference)
where event_reference is not null;

notify pgrst, 'reload schema';
