-- Commercial Co-Pilot — Projects as first-class records
-- Run this in Supabase before using the Projects page / project-linked CE + EWN flows.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_name text not null,
  main_contractor text not null default '',
  contract_type text,
  status text not null default 'live',
  job_number text,
  start_date date,
  completion_date date,
  project_manager text,
  quantity_surveyor text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_status_check check (status in ('live', 'dormant', 'defects', 'closed')),
  constraint projects_user_name_contractor_unique unique (user_id, project_name, main_contractor)
);

alter table public.projects enable row level security;

drop policy if exists "Users can view their own projects" on public.projects;
create policy "Users can view their own projects"
on public.projects for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own projects" on public.projects;
create policy "Users can insert their own projects"
on public.projects for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own projects" on public.projects;
create policy "Users can update their own projects"
on public.projects for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own projects" on public.projects;
create policy "Users can delete their own projects"
on public.projects for delete
using (auth.uid() = user_id);

create index if not exists idx_projects_user_status on public.projects(user_id, status, updated_at desc);
create index if not exists idx_projects_user_name on public.projects(user_id, project_name);

alter table public.events
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.ewns
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.rate_cards
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.project_rate_settings
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_events_project_id on public.events(project_id);
create index if not exists idx_ewns_project_id on public.ewns(project_id);
create index if not exists idx_rate_cards_project_id on public.rate_cards(project_id);
create index if not exists idx_project_rate_settings_project_id on public.project_rate_settings(project_id);

insert into public.projects (user_id, project_name, main_contractor, contract_type, status, created_at, updated_at)
select
  seed.user_id,
  seed.project_name,
  seed.main_contractor,
  max(seed.contract_type) filter (where seed.contract_type is not null and seed.contract_type <> '') as contract_type,
  'live',
  min(seed.created_at),
  max(seed.created_at)
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
    contract_type,
    coalesce(created_at, now()) as created_at
  from public.ewns
  where project_name is not null and trim(project_name) <> ''
) seed
group by seed.user_id, seed.project_name, seed.main_contractor
on conflict (user_id, project_name, main_contractor) do update
set
  contract_type = coalesce(public.projects.contract_type, excluded.contract_type),
  updated_at = greatest(public.projects.updated_at, excluded.updated_at);

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

update public.rate_cards r
set project_id = p.id
from public.projects p
where r.project_id is null
  and r.user_id = p.user_id
  and trim(coalesce(r.project_name, '')) = p.project_name
  and trim(coalesce(r.main_contractor, '')) = p.main_contractor;

update public.project_rate_settings s
set project_id = p.id
from public.projects p
where s.project_id is null
  and s.user_id = p.user_id
  and trim(coalesce(s.project_name, '')) = p.project_name
  and trim(coalesce(s.main_contractor, '')) = p.main_contractor;
