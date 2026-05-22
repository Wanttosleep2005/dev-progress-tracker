-- Dev Progress Tracker cloud sync + shared project schema.
-- Required frontend environment variables:
-- VITE_SUPABASE_URL=https://your-project.supabase.co
-- VITE_SUPABASE_ANON_KEY=your-anon-key
-- VITE_SUPABASE_SYNC_TABLE=devtrack_sync_records
-- VITE_SUPABASE_PROJECT_TABLE=devtrack_projects
-- VITE_SUPABASE_MEMBER_TABLE=devtrack_project_members

create table if not exists public.devtrack_projects (
  id text primary key,
  owner_id text not null,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devtrack_project_members (
  project_id text not null references public.devtrack_projects(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  email text,
  display_name text,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (project_id, user_id)
);

create table if not exists public.devtrack_sync_records (
  id text primary key,
  user_id text not null,
  remote_project_id text references public.devtrack_projects(id) on delete cascade,
  entity_type text not null check (entity_type in ('projects', 'tasks', 'milestones', 'timelineEvents', 'diaryEntries')),
  entity_id integer not null,
  project_id integer,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id text not null
);

alter table public.devtrack_sync_records
  add column if not exists remote_project_id text references public.devtrack_projects(id) on delete cascade;

alter table public.devtrack_sync_records
  alter column user_id type text using user_id::text;

create index if not exists devtrack_project_members_project_idx
  on public.devtrack_project_members (project_id);

create index if not exists devtrack_project_members_user_idx
  on public.devtrack_project_members (user_id, email);

create index if not exists devtrack_sync_records_project_idx
  on public.devtrack_sync_records (remote_project_id, updated_at desc);

alter table public.devtrack_projects enable row level security;
alter table public.devtrack_project_members enable row level security;
alter table public.devtrack_sync_records enable row level security;

create or replace function public.devtrack_is_project_member(target_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.devtrack_project_members m
    where m.project_id = target_project_id
      and (
        m.user_id = auth.uid()::text
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

create or replace function public.devtrack_project_role(target_project_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.devtrack_project_members m
  where m.project_id = target_project_id
    and (
      m.user_id = auth.uid()::text
      or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  order by case m.role when 'owner' then 1 when 'editor' then 2 else 3 end
  limit 1;
$$;

drop policy if exists "DevTrack project members can read projects" on public.devtrack_projects;
create policy "DevTrack project members can read projects"
  on public.devtrack_projects
  for select
  using (public.devtrack_is_project_member(id));

drop policy if exists "DevTrack owners can create projects" on public.devtrack_projects;
create policy "DevTrack owners can create projects"
  on public.devtrack_projects
  for insert
  with check (owner_id = auth.uid()::text);

drop policy if exists "DevTrack owners can update projects" on public.devtrack_projects;
create policy "DevTrack owners can update projects"
  on public.devtrack_projects
  for update
  using (owner_id = auth.uid()::text or public.devtrack_project_role(id) = 'owner')
  with check (owner_id = auth.uid()::text or public.devtrack_project_role(id) = 'owner');

drop policy if exists "DevTrack members can read team rows" on public.devtrack_project_members;
create policy "DevTrack members can read team rows"
  on public.devtrack_project_members
  for select
  using (public.devtrack_is_project_member(project_id));

drop policy if exists "DevTrack owners can invite members" on public.devtrack_project_members;
create policy "DevTrack owners can invite members"
  on public.devtrack_project_members
  for insert
  with check (
    (role = 'owner' and user_id = auth.uid()::text)
    or public.devtrack_project_role(project_id) = 'owner'
  );

drop policy if exists "DevTrack owners can change member roles" on public.devtrack_project_members;
create policy "DevTrack owners can change member roles"
  on public.devtrack_project_members
  for update
  using (public.devtrack_project_role(project_id) = 'owner')
  with check (public.devtrack_project_role(project_id) = 'owner');

drop policy if exists "DevTrack owners can remove members" on public.devtrack_project_members;
create policy "DevTrack owners can remove members"
  on public.devtrack_project_members
  for delete
  using (public.devtrack_project_role(project_id) = 'owner');

drop policy if exists "DevTrack members can read sync records" on public.devtrack_sync_records;
create policy "DevTrack members can read sync records"
  on public.devtrack_sync_records
  for select
  using (remote_project_id is not null and public.devtrack_is_project_member(remote_project_id));

drop policy if exists "DevTrack editors can insert sync records" on public.devtrack_sync_records;
create policy "DevTrack editors can insert sync records"
  on public.devtrack_sync_records
  for insert
  with check (
    user_id = auth.uid()::text
    and remote_project_id is not null
    and (
      (entity_type = 'milestones' and public.devtrack_project_role(remote_project_id) = 'owner')
      or (entity_type <> 'milestones' and public.devtrack_project_role(remote_project_id) in ('owner', 'editor'))
    )
  );

drop policy if exists "DevTrack editors can update sync records" on public.devtrack_sync_records;
create policy "DevTrack editors can update sync records"
  on public.devtrack_sync_records
  for update
  using (
    remote_project_id is not null
    and (
      (entity_type = 'milestones' and public.devtrack_project_role(remote_project_id) = 'owner')
      or (entity_type <> 'milestones' and public.devtrack_project_role(remote_project_id) in ('owner', 'editor'))
    )
  )
  with check (
    user_id = auth.uid()::text
    and remote_project_id is not null
    and (
      (entity_type = 'milestones' and public.devtrack_project_role(remote_project_id) = 'owner')
      or (entity_type <> 'milestones' and public.devtrack_project_role(remote_project_id) in ('owner', 'editor'))
    )
  );

drop policy if exists "DevTrack editors can delete sync records" on public.devtrack_sync_records;
create policy "DevTrack editors can delete sync records"
  on public.devtrack_sync_records
  for delete
  using (
    remote_project_id is not null
    and (
      (entity_type = 'milestones' and public.devtrack_project_role(remote_project_id) = 'owner')
      or (entity_type <> 'milestones' and public.devtrack_project_role(remote_project_id) in ('owner', 'editor'))
    )
  );
