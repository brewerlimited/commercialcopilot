-- First-party Commercial Co-Pilot analytics.
-- This is intentionally service-route driven: clients do not read these tables directly.
-- Raw IP addresses are never stored; the app creates a rotating daily visitor hash server-side.

create table if not exists public.analytics_visitors (
  id uuid primary key default gen_random_uuid(),
  visitor_hash text not null unique,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_source text,
  first_campaign text,
  country_code text,
  device_type text
);

create table if not exists public.analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  external_session_id text not null unique,
  visitor_id uuid references public.analytics_visitors(id) on delete cascade,
  user_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  landing_page text,
  exit_page text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  device text,
  browser text,
  operating_system text,
  country text
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.analytics_sessions(id) on delete set null,
  visitor_id uuid references public.analytics_visitors(id) on delete set null,
  user_id uuid,
  event_name text not null,
  page_path text,
  event_id text,
  project_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_pageviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.analytics_sessions(id) on delete set null,
  visitor_id uuid references public.analytics_visitors(id) on delete set null,
  user_id uuid,
  page_path text not null,
  page_title text,
  referrer text,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_conversions (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid references public.analytics_visitors(id) on delete set null,
  session_id uuid references public.analytics_sessions(id) on delete set null,
  user_id uuid,
  conversion_name text not null,
  source_event_id uuid references public.analytics_events(id) on delete set null,
  value numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_daily_rollups (
  rollup_date date primary key,
  visitors integer not null default 0,
  sessions integer not null default 0,
  pageviews integer not null default 0,
  demo_clicks integer not null default 0,
  trial_starts integer not null default 0,
  signup_completed integer not null default 0,
  ce_created integer not null default 0,
  ewn_created integer not null default 0,
  pack_generations integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  route text,
  event_name text,
  error_type text,
  sanitized_message text,
  retry_count integer not null default 0,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_generation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event_id uuid,
  pack_id uuid,
  generation_type text not null,
  generation_mode text,
  status text not null,
  duration_ms integer,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_gbp numeric,
  error_type text,
  sanitized_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_created_at on public.analytics_events (created_at desc);
create index if not exists idx_analytics_events_event_name_created_at on public.analytics_events (event_name, created_at desc);
create index if not exists idx_analytics_events_user_id_created_at on public.analytics_events (user_id, created_at desc);
create index if not exists idx_analytics_pageviews_created_at on public.analytics_pageviews (created_at desc);
create index if not exists idx_analytics_pageviews_page_path_created_at on public.analytics_pageviews (page_path, created_at desc);
create index if not exists idx_analytics_sessions_started_at on public.analytics_sessions (started_at desc);
create index if not exists idx_analytics_sessions_user_id_started_at on public.analytics_sessions (user_id, started_at desc);
create index if not exists idx_admin_error_events_created_at on public.admin_error_events (created_at desc);
create index if not exists idx_ai_generation_runs_created_at on public.ai_generation_runs (created_at desc);
create index if not exists idx_ai_generation_runs_event_id_created_at on public.ai_generation_runs (event_id, created_at desc);

alter table public.analytics_visitors enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_pageviews enable row level security;
alter table public.analytics_conversions enable row level security;
alter table public.analytics_daily_rollups enable row level security;
alter table public.admin_error_events enable row level security;
alter table public.ai_generation_runs enable row level security;

-- Keep direct client access closed. The service-role API routes bypass RLS.
drop policy if exists analytics_visitors_no_client_access on public.analytics_visitors;
drop policy if exists analytics_sessions_no_client_access on public.analytics_sessions;
drop policy if exists analytics_events_no_client_access on public.analytics_events;
drop policy if exists analytics_pageviews_no_client_access on public.analytics_pageviews;
drop policy if exists analytics_conversions_no_client_access on public.analytics_conversions;
drop policy if exists analytics_daily_rollups_no_client_access on public.analytics_daily_rollups;
drop policy if exists admin_error_events_no_client_access on public.admin_error_events;
drop policy if exists ai_generation_runs_no_client_access on public.ai_generation_runs;

create policy analytics_visitors_no_client_access on public.analytics_visitors for all using (false) with check (false);
create policy analytics_sessions_no_client_access on public.analytics_sessions for all using (false) with check (false);
create policy analytics_events_no_client_access on public.analytics_events for all using (false) with check (false);
create policy analytics_pageviews_no_client_access on public.analytics_pageviews for all using (false) with check (false);
create policy analytics_conversions_no_client_access on public.analytics_conversions for all using (false) with check (false);
create policy analytics_daily_rollups_no_client_access on public.analytics_daily_rollups for all using (false) with check (false);
create policy admin_error_events_no_client_access on public.admin_error_events for all using (false) with check (false);
create policy ai_generation_runs_no_client_access on public.ai_generation_runs for all using (false) with check (false);

create or replace function public.delete_old_analytics_events(retention_interval interval default interval '12 months')
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from public.analytics_events where created_at < now() - retention_interval;
  get diagnostics deleted_count = row_count;
  delete from public.analytics_pageviews where created_at < now() - retention_interval;
  delete from public.analytics_sessions where started_at < now() - retention_interval;
  delete from public.analytics_visitors where last_seen_at < now() - retention_interval;
  delete from public.admin_error_events where created_at < now() - retention_interval;
  delete from public.ai_generation_runs where created_at < now() - retention_interval;
  return deleted_count;
end;
$$;
