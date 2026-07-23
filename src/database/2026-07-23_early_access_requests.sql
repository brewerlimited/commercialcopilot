alter table public.profiles
  add column if not exists early_access_request_email text,
  add column if not exists early_access_requested_at timestamptz,
  add column if not exists early_access_request_note text,
  add column if not exists early_access_request_status text not null default 'not_requested';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_early_access_request_status_allowed'
  ) then
    alter table public.profiles
      add constraint profiles_early_access_request_status_allowed
      check (early_access_request_status in ('not_requested', 'requested', 'reviewing', 'approved', 'declined'));
  end if;
end $$;

create index if not exists idx_profiles_early_access_request_status
  on public.profiles (early_access_request_status, early_access_requested_at desc);
