-- Commercial Co-Pilot — EWN schema alignment
-- Run this if the app reports a missing EWN column in the Supabase schema cache.

create table if not exists public.ewns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

alter table public.ewns
  add column if not exists project_name text,
  add column if not exists main_contractor text,
  add column if not exists contract_type text,
  add column if not exists contract_reference text,
  add column if not exists title text,
  add column if not exists status text default 'open',
  add column if not exists event_date date,
  add column if not exists location text,
  add column if not exists what_happened text,
  add column if not exists impact text,
  add column if not exists required_action text,
  add column if not exists evidence_summary text,
  add column if not exists generated_output jsonb,
  add column if not exists generated_ewn text,
  add column if not exists consequences text,
  add column if not exists mitigation text,
  add column if not exists ai_output jsonb,
  add column if not exists converted_event_id uuid,
  add column if not exists converted_ce_id uuid,
  add column if not exists converted_at timestamptz;

alter table public.ewns enable row level security;

drop policy if exists "Users can view their own EWNs" on public.ewns;
create policy "Users can view their own EWNs"
on public.ewns
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own EWNs" on public.ewns;
create policy "Users can insert their own EWNs"
on public.ewns
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own EWNs" on public.ewns;
create policy "Users can update their own EWNs"
on public.ewns
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own EWNs" on public.ewns;
create policy "Users can delete their own EWNs"
on public.ewns
for delete
using (auth.uid() = user_id);

create index if not exists idx_ewns_user_created on public.ewns(user_id, created_at desc);
create index if not exists idx_ewns_status on public.ewns(status);
create index if not exists idx_ewns_converted_event_id on public.ewns(converted_event_id);

notify pgrst, 'reload schema';
