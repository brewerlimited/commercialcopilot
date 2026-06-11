-- Align live Supabase resource units with the Commercial Co-Pilot Resources page.
-- Run this once in Supabase SQL Editor if demo seeding or manual resource entry fails with:
-- "event_resource_lines_unit_check".

alter table public.event_resource_lines
  drop constraint if exists event_resource_lines_unit_check;

alter table public.event_resource_lines
  add constraint event_resource_lines_unit_check
  check (unit in ('hour', 'day', 'week', 'each', 'm', 'm2', 'm3', 't', 'kg', 'l', 'sheet', 'bag'));
