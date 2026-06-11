-- Commercial Co-Pilot — hidden EWN generation credits
-- Baseline: 20 EWN generations per user.
-- These are intentionally hidden from the UI and consumed only after a successful EWN generation/save.

alter table profiles
  add column if not exists ewn_credits_remaining integer not null default 20,
  add column if not exists ewn_credits_limit integer not null default 20,
  add column if not exists ewn_credits_reset_at timestamptz;

update profiles
set
  ewn_credits_remaining = coalesce(ewn_credits_remaining, 20),
  ewn_credits_limit = coalesce(ewn_credits_limit, 20)
where ewn_credits_remaining is null
   or ewn_credits_limit is null;
