-- Dev Progress Tracker cloud reset script.
-- Paste this whole file into Supabase SQL Editor and run it once.
-- Warning: this drops the existing cloud collaboration/sync tables and all cloud data in them.

begin;

drop table if exists public.devtrack_sync_records cascade;
drop table if exists public.devtrack_project_members cascade;
drop table if exists public.devtrack_projects cascade;

drop function if exists public.devtrack_touch_updated_at() cascade;
drop function if exists public.devtrack_set_project_owner() cascade;
drop function if exists public.devtrack_debug_auth() cascade;
drop function if exists public.devtrack_publish_project(text, text, jsonb, timestamptz, text, text) cascade;
drop function if exists public.devtrack_is_project_member(text, text[]) cascade;
drop function if exists public.devtrack_can_edit_project(text) cascade;
drop function if exists public.devtrack_is_project_owner(text) cascade;

create table public.devtrack_projects (
  id text primary key,
  owner_id text not null,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table public.devtrack_sync_records (
  id text primary key,
  user_id text not null,
  remote_project_id text not null references public.devtrack_projects(id) on delete cascade,
  entity_type text not null check (entity_type in ('projects', 'tasks', 'milestones', 'timelineEvents', 'diaryEntries')),
  entity_id integer not null,
  project_id integer,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id text not null
);

create index idx_devtrack_projects_owner on public.devtrack_projects(owner_id);
create index idx_devtrack_projects_updated on public.devtrack_projects(updated_at desc);

create index idx_devtrack_members_project on public.devtrack_project_members(project_id);
create index idx_devtrack_members_user on public.devtrack_project_members(user_id);
create index idx_devtrack_members_email on public.devtrack_project_members(lower(email));

create index idx_devtrack_sync_remote_project on public.devtrack_sync_records(remote_project_id);
create index idx_devtrack_sync_entity on public.devtrack_sync_records(remote_project_id, entity_type, entity_id);
create index idx_devtrack_sync_updated on public.devtrack_sync_records(updated_at desc);
create index idx_devtrack_sync_user on public.devtrack_sync_records(user_id);

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

create function public.devtrack_set_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'DevTrack publish requires an authenticated Supabase user';
  end if;

  new.owner_id = auth.uid()::text;
  return new;
end;
$$;

create trigger devtrack_projects_set_owner
before insert on public.devtrack_projects
for each row
execute function public.devtrack_set_project_owner();

create function public.devtrack_debug_auth()
returns table(uid text, role text, email text)
language sql
stable
set search_path = public
as $$
  select auth.uid()::text, auth.role()::text, auth.jwt() ->> 'email';
$$;

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

create function public.devtrack_can_edit_project(project_id_arg text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.devtrack_is_project_member(project_id_arg, array['owner', 'editor']);
$$;

alter table public.devtrack_projects enable row level security;
alter table public.devtrack_project_members enable row level security;
alter table public.devtrack_sync_records enable row level security;

create policy "devtrack_projects_select"
on public.devtrack_projects
for select
to authenticated
using (public.devtrack_is_project_member(id, null));

create policy "devtrack_projects_insert"
on public.devtrack_projects
for insert
to authenticated
with check (owner_id = auth.uid()::text);

create policy "devtrack_projects_update"
on public.devtrack_projects
for update
to authenticated
using (owner_id = auth.uid()::text)
with check (owner_id = auth.uid()::text);

create policy "devtrack_projects_delete"
on public.devtrack_projects
for delete
to authenticated
using (public.devtrack_is_project_owner(id));

create policy "devtrack_members_select"
on public.devtrack_project_members
for select
to authenticated
using (public.devtrack_is_project_member(project_id, null));

create policy "devtrack_members_insert"
on public.devtrack_project_members
for insert
to authenticated
with check (
  public.devtrack_is_project_owner(project_id)
  or (
    role in ('editor', 'viewer')
    and (
      user_id = auth.uid()::text
      or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
);

create policy "devtrack_members_update"
on public.devtrack_project_members
for update
to authenticated
using (public.devtrack_is_project_owner(project_id))
with check (public.devtrack_is_project_owner(project_id));

create policy "devtrack_members_delete"
on public.devtrack_project_members
for delete
to authenticated
using (
  public.devtrack_is_project_owner(project_id)
  or user_id = auth.uid()::text
  or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy "devtrack_sync_select"
on public.devtrack_sync_records
for select
to authenticated
using (public.devtrack_is_project_member(remote_project_id, null));

create policy "devtrack_sync_insert"
on public.devtrack_sync_records
for insert
to authenticated
with check (
  user_id = auth.uid()::text
  and (
    (entity_type in ('projects', 'milestones') and public.devtrack_is_project_owner(remote_project_id))
    or (entity_type not in ('projects', 'milestones') and public.devtrack_can_edit_project(remote_project_id))
  )
);

create policy "devtrack_sync_update"
on public.devtrack_sync_records
for update
to authenticated
using (
  (entity_type in ('projects', 'milestones') and public.devtrack_is_project_owner(remote_project_id))
  or (entity_type not in ('projects', 'milestones') and public.devtrack_can_edit_project(remote_project_id))
)
with check (
  (entity_type in ('projects', 'milestones') and public.devtrack_is_project_owner(remote_project_id))
  or (entity_type not in ('projects', 'milestones') and public.devtrack_can_edit_project(remote_project_id))
);

create policy "devtrack_sync_delete"
on public.devtrack_sync_records
for delete
to authenticated
using (
  (entity_type in ('projects', 'milestones') and public.devtrack_is_project_owner(remote_project_id))
  or (entity_type not in ('projects', 'milestones') and public.devtrack_can_edit_project(remote_project_id))
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.devtrack_projects to authenticated;
grant select, insert, update, delete on public.devtrack_project_members to authenticated;
grant select, insert, update, delete on public.devtrack_sync_records to authenticated;
grant execute on function public.devtrack_debug_auth() to authenticated;
grant execute on function public.devtrack_publish_project(text, text, jsonb, timestamptz, text, text) to authenticated;

commit;

select 'DevTrack cloud tables reset successfully' as status;
