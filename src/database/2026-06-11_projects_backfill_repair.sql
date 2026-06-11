-- Commercial Co-Pilot — projects backfill repair
-- Run this if the Projects page opens but shows no projects after the Phase 2 projects migration.
-- It creates project records from existing CE/EWN project names, then links those CEs/EWNs to the new project rows.

insert into public.projects (user_id, project_name, main_contractor, contract_type, status, created_at, updated_at)
select
  seed.user_id,
  seed.project_name,
  seed.main_contractor,
  max(seed.contract_type) filter (where seed.contract_type is not null and seed.contract_type <> '') as contract_type,
  'live',
  min(seed.created_at),
  now()
from (
  select
    user_id,
    trim(project_name) as project_name,
    coalesce(trim(main_contractor), '') as main_contractor,
    contract_type,
    coalesce(created_at, now()) as created_at
  from public.events
  where project_name is not null and trim(project_name) <> ''

  union all

  select
    user_id,
    trim(project_name) as project_name,
    coalesce(trim(main_contractor), '') as main_contractor,
    null::text as contract_type,
    coalesce(created_at, now()) as created_at
  from public.ewns
  where project_name is not null and trim(project_name) <> ''
) seed
group by seed.user_id, seed.project_name, seed.main_contractor
on conflict (user_id, project_name, main_contractor) do update
set
  contract_type = coalesce(public.projects.contract_type, excluded.contract_type),
  status = coalesce(public.projects.status, 'live'),
  updated_at = now();

update public.events e
set project_id = p.id
from public.projects p
where e.project_id is null
  and e.user_id = p.user_id
  and trim(coalesce(e.project_name, '')) = p.project_name
  and trim(coalesce(e.main_contractor, '')) = p.main_contractor;

update public.ewns e
set project_id = p.id
from public.projects p
where e.project_id is null
  and e.user_id = p.user_id
  and trim(coalesce(e.project_name, '')) = p.project_name
  and trim(coalesce(e.main_contractor, '')) = p.main_contractor;

select
  (select count(*) from public.projects) as projects_total,
  (select count(*) from public.events where project_name is not null and trim(project_name) <> '') as ces_with_project_names,
  (select count(*) from public.events where project_id is not null) as ces_linked_to_projects,
  (select count(*) from public.ewns where project_name is not null and trim(project_name) <> '') as ewns_with_project_names,
  (select count(*) from public.ewns where project_id is not null) as ewns_linked_to_projects;
