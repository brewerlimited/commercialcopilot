-- Commercial Co-Pilot — event reference hardening.
-- Ensures old rows get CE/VO references and future duplicates are blocked per project.

alter table public.events
  add column if not exists event_number integer,
  add column if not exists event_reference text;

with ordered as (
  select
    id,
    row_number() over (
      partition by
        user_id,
        coalesce(project_id::text, ''),
        coalesce(project_name, ''),
        coalesce(main_contractor, '')
      order by created_at asc, id asc
    ) as next_number
  from public.events
  where event_number is null
     or event_reference is null
     or trim(coalesce(event_reference, '')) = ''
)
update public.events e
set
  event_number = coalesce(e.event_number, ordered.next_number),
  event_reference = coalesce(
    nullif(trim(e.event_reference), ''),
    case
      when lower(coalesce(e.contract_type, '')) like '%jct%' then 'VO '
      else 'CE '
    end || lpad(coalesce(e.event_number, ordered.next_number)::text, 3, '0')
  )
from ordered
where e.id = ordered.id;

create unique index if not exists uq_events_user_project_id_event_reference
on public.events (user_id, project_id, event_reference)
where project_id is not null
  and event_reference is not null;

create unique index if not exists uq_events_user_project_name_contractor_event_reference
on public.events (user_id, coalesce(project_name, ''), coalesce(main_contractor, ''), event_reference)
where project_id is null
  and event_reference is not null;

create index if not exists idx_events_user_project_id_event_number
on public.events (user_id, project_id, event_number);

notify pgrst, 'reload schema';
