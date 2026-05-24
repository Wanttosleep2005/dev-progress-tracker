-- Allow editors to sync all non-project entity records.
-- Milestone create/delete remains Owner-only in the app UI, while derived
-- milestone progress updates from task operations can now sync successfully.

drop policy if exists "devtrack_sync_insert" on public.devtrack_sync_records;
drop policy if exists "devtrack_sync_update" on public.devtrack_sync_records;
drop policy if exists "devtrack_sync_delete" on public.devtrack_sync_records;

create policy "devtrack_sync_insert"
on public.devtrack_sync_records
for insert
to authenticated
with check (
  user_id = auth.uid()::text
  and (
    (entity_type = 'projects' and public.devtrack_is_project_owner(remote_project_id))
    or
    (entity_type <> 'projects' and public.devtrack_can_edit_project(remote_project_id))
  )
);

create policy "devtrack_sync_update"
on public.devtrack_sync_records
for update
to authenticated
using (
  (entity_type = 'projects' and public.devtrack_is_project_owner(remote_project_id))
  or
  (entity_type <> 'projects' and public.devtrack_can_edit_project(remote_project_id))
)
with check (
  (entity_type = 'projects' and public.devtrack_is_project_owner(remote_project_id))
  or
  (entity_type <> 'projects' and public.devtrack_can_edit_project(remote_project_id))
);

create policy "devtrack_sync_delete"
on public.devtrack_sync_records
for delete
to authenticated
using (
  (entity_type = 'projects' and public.devtrack_is_project_owner(remote_project_id))
  or
  (entity_type <> 'projects' and public.devtrack_can_edit_project(remote_project_id))
);
