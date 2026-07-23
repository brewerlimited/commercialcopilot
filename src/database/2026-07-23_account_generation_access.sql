-- Commercial Co-Pilot - account activation gate for protected generation.
-- New accounts may sign in and complete onboarding, but prompt-backed generation
-- stays locked until trial/subscription/admin access is active.

alter table public.profiles
  add column if not exists account_status text not null default 'pending_activation',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_account_status_allowed'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_status_allowed
      check (account_status in ('pending_activation', 'trial_active', 'active', 'suspended'));
  end if;
end $$;

update public.profiles
set
  account_status = 'active',
  approved_at = coalesce(approved_at, now())
where coalesce(is_admin_unlimited, false) = true
  and account_status = 'pending_activation';

update public.profiles
set
  account_status = 'active',
  approved_at = coalesce(approved_at, now())
where subscription_status in ('active', 'trialing')
  and account_status = 'pending_activation';

create index if not exists idx_profiles_account_status
  on public.profiles (account_status);

-- Manual activation examples:
-- update public.profiles
-- set account_status = 'trial_active', approved_at = now(), credits_remaining = greatest(coalesce(credits_remaining, 0), 3)
-- where id = '<user-id>';
--
-- update public.user_credits
-- set credits_remaining = greatest(coalesce(credits_remaining, 0), 3), updated_at = now()
-- where user_id = '<user-id>';
