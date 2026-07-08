-- Commercial Co-Pilot — soft void status for invalid CE / VO records.
-- Run this in Supabase before using the Void CE/VO button if your events table
-- has a status check constraint.

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.events'::regclass
      and c.contype = 'c'
      and a.attname = 'status'
  loop
    execute format('alter table public.events drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

alter table public.events
  add constraint events_status_allowed
  check (
    status is null
    or status in (
      'draft',
      'review',
      'ready',
      'submitted',
      'rejected',
      'accepted',
      'paid',
      'complete',
      'void'
    )
  );

notify pgrst, 'reload schema';
