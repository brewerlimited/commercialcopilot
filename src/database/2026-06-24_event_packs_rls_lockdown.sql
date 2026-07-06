alter table public.event_packs enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_packs'
  loop
    execute format('drop policy if exists %I on public.event_packs', existing_policy.policyname);
  end loop;
end
$$;

create policy event_packs_select_own
  on public.event_packs for select
  using (auth.uid() = user_id);

create policy event_packs_insert_own
  on public.event_packs for insert
  with check (auth.uid() = user_id);

create policy event_packs_update_own
  on public.event_packs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy event_packs_delete_own
  on public.event_packs for delete
  using (auth.uid() = user_id);
