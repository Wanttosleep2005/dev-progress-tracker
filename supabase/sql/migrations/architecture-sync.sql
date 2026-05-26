-- Adds DevTrack architecture diagram sync support.
-- Run this once on existing Supabase projects before using the Architecture page.

begin;

alter table public.devtrack_sync_records
  drop constraint if exists devtrack_sync_records_entity_type_check;

alter table public.devtrack_sync_records
  alter column entity_id type text using entity_id::text;

alter table public.devtrack_sync_records
  add constraint devtrack_sync_records_entity_type_check
  check (entity_type in ('projects', 'tasks', 'milestones', 'timelineEvents', 'diaryEntries', 'sprints', 'comments', 'archNodes'));

drop index if exists idx_devtrack_sync_entity;
create index idx_devtrack_sync_entity on public.devtrack_sync_records(remote_project_id, entity_type, entity_id);

alter table public.devtrack_sync_records replica identity full;

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
end $$;

commit;
