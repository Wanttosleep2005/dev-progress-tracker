-- DevTrack presence heartbeat migration.
-- Paste this file into Supabase SQL Editor and run it once on an existing database.
-- It is non-destructive: it only replaces the member presence RPC used by the frontend.

begin;

drop function if exists public.devtrack_touch_member_presence(text, text, text) cascade;

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

grant execute on function public.devtrack_touch_member_presence(text, text, text) to authenticated;

commit;

select 'DevTrack presence heartbeat migration completed' as status;
