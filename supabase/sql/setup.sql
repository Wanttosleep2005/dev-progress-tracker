-- Dev Progress Tracker cloud sync setup script.
-- Paste this whole file into Supabase SQL Editor and run it once.
-- Warning: this drops existing cloud collaboration/sync tables and all cloud data.

begin;

-- Drop existing tables and functions
drop table if exists public.devtrack_sync_records cascade;
drop table if exists public.devtrack_project_members cascade;
drop table if exists public.devtrack_projects cascade;

drop function if exists public.devtrack_touch_updated_at() cascade;
drop function if exists public.devtrack_is_project_member(text, text[]) cascade;
drop function if exists public.devtrack_can_edit_project(text) cascade;
drop function if exists public.devtrack_is_project_owner(text) cascade;
drop function if exists public.devtrack_publish_project(text, text, jsonb, timestamptz, text, text) cascade;
drop function if exists public.devtrack_touch_member_presence(text, text, text) cascade;
drop function if exists public.devtrack_forget_current_user() cascade;

-- Create projects table
create table public.devtrack_projects (
  id text primary key,
  owner_id text not null,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create project members table
create table public.devtrack_project_members (
  project_id text not null references public.devtrack_projects(id) on delete cascade,
  user_id text not null,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  email text,
  display_name text,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (project_id, user_id)
);

-- Create sync records table
create table public.devtrack_sync_records (
  id text primary key,
  user_id text not null,
  remote_project_id text not null references public.devtrack_projects(id) on delete cascade,
  entity_type text not null check (entity_type in ('projects', 'tasks', 'milestones', 'timelineEvents', 'diaryEntries', 'sprints', 'comments', 'archNodes')),
  entity_id text not null,
  project_id integer,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id text not null
);

-- Create indexes
create index idx_devtrack_projects_owner on public.devtrack_projects(owner_id);
create index idx_devtrack_projects_updated on public.devtrack_projects(updated_at desc);
create index idx_devtrack_members_project on public.devtrack_project_members(project_id);
create index idx_devtrack_members_user on public.devtrack_project_members(user_id);
create index idx_devtrack_members_email on public.devtrack_project_members(lower(email));
create index idx_devtrack_sync_remote_project on public.devtrack_sync_records(remote_project_id);
create index idx_devtrack_sync_entity on public.devtrack_sync_records(remote_project_id, entity_type, entity_id);
create index idx_devtrack_sync_updated on public.devtrack_sync_records(updated_at desc);
create index idx_devtrack_sync_user on public.devtrack_sync_records(user_id);

-- Trigger for auto-updating updated_at
create function public.devtrack_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger devtrack_projects_touch_updated_at
before update on public.devtrack_projects
for each row
execute function public.devtrack_touch_updated_at();

-- Helper functions
create function public.devtrack_publish_project(
  p_project_id text,
  p_name text,
  p_payload jsonb,
  p_created_at timestamptz default now(),
  p_email text default null,
  p_display_name text default null
)
returns table(remote_project_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := auth.uid()::text;
begin
  if v_user_id is null then
    raise exception 'DevTrack publish requires an authenticated Supabase user';
  end if;

  insert into public.devtrack_projects (
    id,
    owner_id,
    name,
    payload,
    created_at,
    updated_at
  )
  values (
    p_project_id,
    v_user_id,
    p_name,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_created_at, now()),
    now()
  )
  on conflict (id) do update
  set
    owner_id = excluded.owner_id,
    name = excluded.name,
    payload = excluded.payload,
    updated_at = now();

  insert into public.devtrack_project_members (
    project_id,
    user_id,
    role,
    email,
    display_name,
    joined_at,
    last_seen_at
  )
  values (
    p_project_id,
    v_user_id,
    'owner',
    p_email,
    p_display_name,
    now(),
    now()
  )
  on conflict (project_id, user_id) do update
  set
    role = 'owner',
    email = excluded.email,
    display_name = excluded.display_name,
    last_seen_at = now();

  remote_project_id := p_project_id;
  return next;
end;
$$;

create function public.devtrack_is_project_member(project_id_arg text, allowed_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.devtrack_projects p
    where p.id = project_id_arg
      and p.owner_id = auth.uid()::text
  )
  or exists (
    select 1
    from public.devtrack_project_members m
    where m.project_id = project_id_arg
      and (
        m.user_id = auth.uid()::text
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

create function public.devtrack_is_project_owner(project_id_arg text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.devtrack_projects p
    where p.id = project_id_arg
      and p.owner_id = auth.uid()::text
  )
  or exists (
    select 1
    from public.devtrack_project_members m
    where m.project_id = project_id_arg
      and m.role = 'owner'
      and (
        m.user_id = auth.uid()::text
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

create function public.devtrack_join_project(
  p_project_id text,
  p_role text default 'viewer',
  p_email text default null,
  p_display_name text default null
)
returns table (
  project_id text,
  role text,
  already_member boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := auth.uid()::text;
  v_email text := lower(coalesce(p_email, auth.jwt() ->> 'email', ''));
  v_owner_id text;
  v_existing public.devtrack_project_members%rowtype;
  v_join_role text := case when p_role in ('editor', 'viewer') then p_role else 'viewer' end;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select p.owner_id
    into v_owner_id
    from public.devtrack_projects as p
    where p.id = p_project_id;

  if v_owner_id is null then
    raise exception 'Project not found';
  end if;

  if v_owner_id = v_user_id then
    insert into public.devtrack_project_members (
      project_id,
      user_id,
      role,
      email,
      display_name,
      joined_at,
      last_seen_at
    )
    values (
      p_project_id,
      v_user_id,
      'owner',
      p_email,
      p_display_name,
      now(),
      now()
    )
    on conflict (project_id, user_id) do update
    set
      role = 'owner',
      email = coalesce(excluded.email, public.devtrack_project_members.email),
      display_name = coalesce(excluded.display_name, public.devtrack_project_members.display_name),
      last_seen_at = now();

    return query select p_project_id, 'owner'::text, true;
    return;
  end if;

  -- Qualify member columns so RETURNS TABLE(project_id, role) never shadows table columns.
  select m.*
    into v_existing
    from public.devtrack_project_members as m
    where m.project_id = p_project_id
      and (
        m.user_id = v_user_id
        or lower(coalesce(m.email, '')) = v_email
      )
    order by case when m.user_id = v_user_id then 0 else 1 end
    limit 1;

  if found then
    if v_existing.user_id <> v_user_id then
      delete from public.devtrack_project_members as m
        where m.project_id = p_project_id
          and m.user_id = v_user_id
          and m.role <> 'owner';
    end if;

    update public.devtrack_project_members as m
      set
        user_id = v_user_id,
        role = case when v_existing.role = 'owner' then 'owner' else v_existing.role end,
        email = coalesce(p_email, m.email),
        display_name = coalesce(p_display_name, m.display_name),
        last_seen_at = now()
      where m.project_id = v_existing.project_id
        and m.user_id = v_existing.user_id;

    return query select p_project_id, (case when v_existing.role = 'owner' then 'owner' else v_existing.role end)::text, true;
    return;
  end if;

  insert into public.devtrack_project_members (
    project_id,
    user_id,
    role,
    email,
    display_name,
    joined_at,
    last_seen_at
  )
  values (
    p_project_id,
    v_user_id,
    v_join_role,
    p_email,
    p_display_name,
    now(),
    now()
  )
  on conflict (project_id, user_id) do update
  set
    role = case when public.devtrack_project_members.role = 'owner' then 'owner' else public.devtrack_project_members.role end,
    email = coalesce(excluded.email, public.devtrack_project_members.email),
    display_name = coalesce(excluded.display_name, public.devtrack_project_members.display_name),
    last_seen_at = now();

  return query select p_project_id, v_join_role, false;
end;
$$;

create function public.devtrack_can_edit_project(project_id_arg text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.devtrack_is_project_member(project_id_arg, array['owner', 'editor']);
$$;

create function public.devtrack_touch_member_presence(
  p_project_id text,
  p_email text default null,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := auth.uid()::text;
  v_email text := auth.jwt() ->> 'email';
begin
  if v_user_id is null then
    raise exception 'missing authenticated user';
  end if;

  update public.devtrack_project_members
  set
    email = coalesce(v_email, p_email, email),
    display_name = coalesce(nullif(p_display_name, ''), display_name),
    last_seen_at = now()
  where project_id = p_project_id
    and (
      user_id = v_user_id
      or lower(coalesce(email, '')) = lower(coalesce(v_email, ''))
    );
end;
$$;

create function public.devtrack_forget_current_user()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := auth.uid()::text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_deleted_owned_projects integer := 0;
  v_removed_memberships integer := 0;
  v_anonymized_records integer := 0;
begin
  if v_user_id is null then
    raise exception 'DevTrack account deletion requires an authenticated Supabase user';
  end if;

  delete from public.devtrack_projects
  where owner_id = v_user_id;
  get diagnostics v_deleted_owned_projects = row_count;

  delete from public.devtrack_project_members
  where user_id = v_user_id
     or (
       v_email <> ''
       and (
         user_id = ('email:' || v_email)
         or lower(coalesce(email, '')) = v_email
       )
     );
  get diagnostics v_removed_memberships = row_count;

  update public.devtrack_sync_records
  set user_id = 'deleted:' || left(v_user_id, 8)
  where user_id = v_user_id;
  get diagnostics v_anonymized_records = row_count;

  return jsonb_build_object(
    'deletedOwnedProjects', v_deleted_owned_projects,
    'removedMemberships', v_removed_memberships,
    'anonymizedRecords', v_anonymized_records
  );
end;
$$;

-- Enable RLS
alter table public.devtrack_projects enable row level security;
alter table public.devtrack_project_members enable row level security;
alter table public.devtrack_sync_records enable row level security;

alter table public.devtrack_sync_records replica identity full;
alter table public.devtrack_project_members replica identity full;
alter table public.devtrack_projects replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'devtrack_sync_records'
  ) then
    alter publication supabase_realtime add table public.devtrack_sync_records;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'devtrack_project_members'
  ) then
    alter publication supabase_realtime add table public.devtrack_project_members;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'devtrack_projects'
  ) then
    alter publication supabase_realtime add table public.devtrack_projects;
  end if;
end $$;

-- RLS policies for devtrack_projects
create policy "devtrack_projects_select" on public.devtrack_projects for select to authenticated using (public.devtrack_is_project_member(id, null));
create policy "devtrack_projects_insert" on public.devtrack_projects for insert to authenticated with check (owner_id = auth.uid()::text);
create policy "devtrack_projects_update" on public.devtrack_projects for update to authenticated using (owner_id = auth.uid()::text) with check (owner_id = auth.uid()::text);
create policy "devtrack_projects_delete" on public.devtrack_projects for delete to authenticated using (public.devtrack_is_project_owner(id));

-- RLS policies for devtrack_project_members
create policy "devtrack_members_select" on public.devtrack_project_members for select to authenticated using (public.devtrack_is_project_member(project_id, null));
create policy "devtrack_members_insert" on public.devtrack_project_members for insert to authenticated with check (public.devtrack_is_project_owner(project_id) or (role in ('editor', 'viewer') and (user_id = auth.uid()::text or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')))));
create policy "devtrack_members_update" on public.devtrack_project_members for update to authenticated using (public.devtrack_is_project_owner(project_id)) with check (public.devtrack_is_project_owner(project_id));
create policy "devtrack_members_delete" on public.devtrack_project_members for delete to authenticated using (public.devtrack_is_project_owner(project_id) or user_id = auth.uid()::text or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- RLS policies for devtrack_sync_records
create policy "devtrack_sync_select" on public.devtrack_sync_records for select to authenticated using (public.devtrack_is_project_member(remote_project_id, null));
create policy "devtrack_sync_insert" on public.devtrack_sync_records for insert to authenticated with check (user_id = auth.uid()::text and ((entity_type = 'projects' and public.devtrack_is_project_owner(remote_project_id)) or (entity_type <> 'projects' and public.devtrack_can_edit_project(remote_project_id))));
create policy "devtrack_sync_update" on public.devtrack_sync_records for update to authenticated using ((entity_type = 'projects' and public.devtrack_is_project_owner(remote_project_id)) or (entity_type <> 'projects' and public.devtrack_can_edit_project(remote_project_id))) with check ((entity_type = 'projects' and public.devtrack_is_project_owner(remote_project_id)) or (entity_type <> 'projects' and public.devtrack_can_edit_project(remote_project_id)));
create policy "devtrack_sync_delete" on public.devtrack_sync_records for delete to authenticated using ((entity_type = 'projects' and public.devtrack_is_project_owner(remote_project_id)) or (entity_type <> 'projects' and public.devtrack_can_edit_project(remote_project_id)));

-- Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.devtrack_projects to authenticated;
grant select, insert, update, delete on public.devtrack_project_members to authenticated;
grant select, insert, update, delete on public.devtrack_sync_records to authenticated;
grant execute on function public.devtrack_publish_project(text, text, jsonb, timestamptz, text, text) to authenticated;
grant execute on function public.devtrack_join_project(text, text, text, text) to authenticated;
grant execute on function public.devtrack_touch_member_presence(text, text, text) to authenticated;
grant execute on function public.devtrack_forget_current_user() to authenticated;

commit;

select 'DevTrack cloud tables setup completed successfully!' as status;
