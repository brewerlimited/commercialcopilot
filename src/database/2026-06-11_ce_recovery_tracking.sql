alter table public.events
  add column if not exists submitted_amount numeric,
  add column if not exists assessed_amount numeric,
  add column if not exists paid_amount numeric,
  add column if not exists disallowed_amount numeric,
  add column if not exists balance_outstanding numeric,
  add column if not exists last_chased_date date,
  add column if not exists next_chase_date date,
  add column if not exists client_response text,
  add column if not exists dispute_reason text,
  add column if not exists agreed_payment_date date;

alter table public.events
  drop constraint if exists events_payment_status_allowed;

alter table public.events
  add constraint events_payment_status_allowed
  check (
    payment_status is null
    or payment_status in (
      'not_applied',
      'submitted_for_payment',
      'assessed',
      'part_paid',
      'paid',
      'disputed_short_paid',
      'applied',
      'overdue'
    )
  );

update public.events
set payment_status = 'submitted_for_payment'
where payment_status in ('applied', 'overdue');

alter table public.events
  drop constraint if exists events_payment_status_allowed;

alter table public.events
  add constraint events_payment_status_allowed
  check (
    payment_status is null
    or payment_status in (
      'not_applied',
      'submitted_for_payment',
      'assessed',
      'part_paid',
      'paid',
      'disputed_short_paid'
    )
  );

create table if not exists public.event_actions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null,
  action_type text not null,
  action_date date not null default current_date,
  notes text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.event_actions enable row level security;

drop policy if exists event_actions_select_own on public.event_actions;
drop policy if exists event_actions_insert_own on public.event_actions;
drop policy if exists event_actions_delete_own on public.event_actions;

create policy event_actions_select_own
  on public.event_actions for select
  using (auth.uid() = user_id);

create policy event_actions_insert_own
  on public.event_actions for insert
  with check (auth.uid() = user_id);

create policy event_actions_delete_own
  on public.event_actions for delete
  using (auth.uid() = user_id);

create index if not exists idx_event_actions_event_id_created_at
  on public.event_actions (event_id, created_at desc);

create index if not exists idx_events_recovery_tracking
  on public.events (user_id, status, payment_status, expected_payment_date, next_chase_date);
