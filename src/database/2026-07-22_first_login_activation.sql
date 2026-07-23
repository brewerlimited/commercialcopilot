-- Commercial Co-Pilot — first-login activation state
-- Run in Supabase before relying on cross-device onboarding persistence.

alter table public.projects
  add column if not exists trade_package text,
  add column if not exists project_reference text,
  add column if not exists is_demo boolean not null default false;

alter table public.events
  add column if not exists first_issue_captured_at timestamptz,
  add column if not exists onboarding_captured_at timestamptz,
  add column if not exists is_demo boolean not null default false;

create table if not exists public.user_onboarding_state (
  user_id uuid primary key,
  onboarding_completed_at timestamptz,
  welcome_dismissed_at timestamptz,
  guide_hidden_at timestamptz,
  last_ui_state text,
  flow_version text not null default 'v1',
  project_draft jsonb,
  issue_draft jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding_state enable row level security;

drop policy if exists user_onboarding_state_select_own on public.user_onboarding_state;
drop policy if exists user_onboarding_state_insert_own on public.user_onboarding_state;
drop policy if exists user_onboarding_state_update_own on public.user_onboarding_state;

create policy user_onboarding_state_select_own
  on public.user_onboarding_state for select
  using (auth.uid() = user_id);

create policy user_onboarding_state_insert_own
  on public.user_onboarding_state for insert
  with check (auth.uid() = user_id);

create policy user_onboarding_state_update_own
  on public.user_onboarding_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_projects_user_demo_status
  on public.projects (user_id, is_demo, status, updated_at desc);

create index if not exists idx_events_user_demo_captured
  on public.events (user_id, is_demo, first_issue_captured_at, created_at desc);

update public.user_onboarding_state state
set onboarding_completed_at = coalesce(state.onboarding_completed_at, now()),
    updated_at = now()
where exists (
  select 1
  from public.projects p
  where p.user_id = state.user_id
    and coalesce(p.is_demo, false) = false
    and coalesce(p.status, 'live') not in ('deleted', 'archived')
)
and exists (
  select 1
  from public.events e
  where e.user_id = state.user_id
    and coalesce(e.is_demo, false) = false
    and coalesce(e.status, 'draft') not in ('deleted', 'archived', 'void')
);
