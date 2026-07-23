-- Commercial Co-Pilot - trade profiles and safer unknown contract handling.
-- Additive migration. Existing rows default to the general trade profile.

alter table public.company_profiles
  add column if not exists trade_profile text not null default 'general';

alter table public.projects
  add column if not exists trade_profile text not null default 'general';

alter table public.events
  add column if not exists trade_profile text not null default 'general';

update public.company_profiles
set trade_profile = 'general'
where trade_profile is null or trim(trade_profile) = '';

update public.projects
set trade_profile = 'general'
where trade_profile is null or trim(trade_profile) = '';

update public.events
set trade_profile = 'general'
where trade_profile is null or trim(trade_profile) = '';

do $$
begin
  alter table public.company_profiles
    add constraint company_profiles_trade_profile_allowed
    check (trade_profile in ('general', 'groundworks', 'drylining', 'passive_fire', 'fit_out', 'frc'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.projects
    add constraint projects_trade_profile_allowed
    check (trade_profile in ('general', 'groundworks', 'drylining', 'passive_fire', 'fit_out', 'frc'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.events
    add constraint events_trade_profile_allowed
    check (trade_profile in ('general', 'groundworks', 'drylining', 'passive_fire', 'fit_out', 'frc'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_company_profiles_trade_profile
  on public.company_profiles (trade_profile);

create index if not exists idx_projects_user_trade_profile
  on public.projects (user_id, trade_profile);

create index if not exists idx_events_user_trade_profile
  on public.events (user_id, trade_profile);

notify pgrst, 'reload schema';
