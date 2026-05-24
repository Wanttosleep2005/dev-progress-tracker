begin;

create or replace function public.devtrack_join_project(
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

grant execute on function public.devtrack_join_project(text, text, text, text) to authenticated;

commit;
