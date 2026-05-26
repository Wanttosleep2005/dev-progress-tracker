-- Realtime support for architecture diagrams.
-- Architecture nodes are synchronized through devtrack_sync_records; there is no separate arch_nodes table.

begin;

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

commit;
