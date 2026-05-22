-- Dev Progress Tracker cloud sync table.
-- Required environment variables:
-- VITE_SUPABASE_URL=https://your-project.supabase.co
-- VITE_SUPABASE_ANON_KEY=your-anon-key
-- VITE_SUPABASE_SYNC_TABLE=devtrack_sync_records

create table if not exists public.devtrack_sync_records (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('projects', 'tasks', 'milestones', 'timelineEvents', 'diaryEntries')),
  entity_id integer not null,
  project_id integer,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id text not null
);

create index if not exists devtrack_sync_records_user_idx
  on public.devtrack_sync_records (user_id, updated_at desc);

alter table public.devtrack_sync_records enable row level security;

drop policy if exists "DevTrack users can read own sync records" on public.devtrack_sync_records;
create policy "DevTrack users can read own sync records"
  on public.devtrack_sync_records
  for select
  using (auth.uid() = user_id);

drop policy if exists "DevTrack users can insert own sync records" on public.devtrack_sync_records;
create policy "DevTrack users can insert own sync records"
  on public.devtrack_sync_records
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "DevTrack users can update own sync records" on public.devtrack_sync_records;
create policy "DevTrack users can update own sync records"
  on public.devtrack_sync_records
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "DevTrack users can delete own sync records" on public.devtrack_sync_records;
create policy "DevTrack users can delete own sync records"
  on public.devtrack_sync_records
  for delete
  using (auth.uid() = user_id);
