create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  page_url text,

  feedback_type text not null,
  message text not null,
  status text not null default 'New',

  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "Users can insert feedback" on public.feedback;
create policy "Users can insert feedback"
on public.feedback
for insert
with check (auth.uid() = user_id);

-- Admin dashboard reads feedback via the service-role admin API route.
-- This policy is only for future direct authenticated reads if required.
drop policy if exists "Users can view their own feedback" on public.feedback;
create policy "Users can view their own feedback"
on public.feedback
for select
using (auth.uid() = user_id);

notify pgrst, 'reload schema';
