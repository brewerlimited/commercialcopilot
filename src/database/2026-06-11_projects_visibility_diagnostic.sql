-- Commercial Co-Pilot — projects visibility diagnostic
-- Run this in Supabase if projects exist but the app still shows an empty Projects page.
-- The Projects page can only read rows where projects.user_id matches the logged-in app user.

select
  p.user_id,
  u.email,
  count(*) as projects_total,
  count(*) filter (where p.status = 'live') as live_projects,
  min(p.created_at) as first_project_created,
  max(p.updated_at) as last_project_updated
from public.projects p
left join auth.users u on u.id = p.user_id
group by p.user_id, u.email
order by projects_total desc, last_project_updated desc;

select
  e.user_id,
  u.email,
  count(*) as ces_total,
  count(*) filter (where e.project_name is not null and trim(e.project_name) <> '') as ces_with_project_names,
  count(*) filter (where e.project_id is not null) as ces_linked_to_projects
from public.events e
left join auth.users u on u.id = e.user_id
group by e.user_id, u.email
order by ces_total desc;
