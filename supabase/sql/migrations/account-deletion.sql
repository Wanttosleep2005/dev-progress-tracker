-- DevTrack account deletion migration.
-- Run this in Supabase SQL Editor for an existing database.
-- It does not drop tables or clear existing project data.

begin;

drop function if exists public.devtrack_forget_current_user() cascade;

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

grant execute on function public.devtrack_forget_current_user() to authenticated;

commit;
