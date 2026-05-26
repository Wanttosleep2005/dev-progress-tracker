# Changelog

## v1.1.0 - 2026-05-26

### Added

- Added Architecture Diagram page (`/architecture`) powered by React Flow. Supports
  folder/file tree visualization, drag-and-drop reparenting, task/milestone
  association, AI-generated architecture suggestions, and Supabase realtime sync.
- Added Sync Console for project Owners. Displays live sync logs, pending queue,
  realtime connection status, remote record inspection, and diagnostics export.
- Added `archNodes` IndexedDB table (schema v14) with full CRUD, graph cycle
  repair, duplicate root merging, and malformed placeholder cleanup.
- Added `archNodes` cloud sync support including realtime subscription, upsert,
  and delete propagation.
- Added barycenter-based layout algorithm to Task Dependencies graph for fewer
  edge crossings and more readable node placement.

### Changed

- Improved AI Command prompt engineering: richer context (milestones, dependencies,
  planned dates), stricter field validation, explicit unsupported-action guidance,
  quality requirements for descriptions, and better tag/priority inference rules.
- Removed `off` option from AI reasoning effort; minimum is now `high`.
- Expanded AI context window from 30 to 50 existing tasks and added milestone list.
- Updated `SyncEntityType` and `CollaborationEventType` to include architecture
  events (`arch_created`, `arch_updated`, `arch_deleted`).
- Adjusted Task Dependencies node spacing for denser but clearer layouts.

### Database

- Schema version bumped to 14.
- `archNodes` table indexed on `id`, `projectId`, `parentId`, and compound
  `[projectId+parentId]`.
- `SyncChange.entityId` widened from `number` to `number | string` to support
  string-keyed architecture nodes.

### Verification

- `npx tsc --noEmit --pretty false`
- `npm run build`

## v1.0.0 - 2026-05-24

DevTrack 1.0 is the first stable local-first release for individual developers
and small-team project development monitoring.

### Added

- Added a bilingual README with Chinese and English setup, mode, and
  distribution notes.
- Added Chinese and English user guides:
  - `docs/USER_GUIDE.zh-CN.md`
  - `docs/USER_GUIDE.en.md`
- Added a bilingual contribution guide in `CONTRIBUTING.md`.
- Added an account page separated from Settings.
- Added local-only and cloud-collaboration mode guidance.
- Added Supabase Realtime synchronization with a slower REST fallback when
  Realtime is healthy.
- Added shared-project invite flow, role-based collaboration, team activity
  pagination, Owner control center, permission audit, and sync diagnostics.
- Added diary export to Markdown for current-month or all entries.
- Added task dependency graph support using React Flow.
- Added backup/recovery improvements, user-scoped backup directory settings,
  and safer restore-point handling.

### Changed

- Bumped package version to `1.0.0`.
- Reduced idle Supabase traffic:
  - Realtime-connected fallback sync now runs every 5 minutes.
  - Disconnected/error fallback remains at 60 seconds.
  - Presence refresh is throttled.
- Moved account login/register/logout out of the collaboration page.
- Kept Settings focused on preferences, sync status, network access, backup, and
  system information.
- Updated Supabase SQL setup and migrations for project sharing, editor sync
  permissions, Realtime, join-project safety, and account deletion support.
- Improved local/cloud relationship mapping for tasks, milestones, diaries, and
  comments.

### Removed

- Removed the Sprint management product surface because it caused unnecessary
  duplication and sync complexity for the intended small-team workflow.
- Removed the Sprint route, sidebar item, page component, store, achievement,
  and cloud-sync handling.
- Kept the legacy `sprints` IndexedDB table and backup field for compatibility
  with older local data and restore files.

### Security

- `.env` remains ignored and must not be committed.
- `.env.example` contains only placeholder values.
- The frontend still never stores or bundles a Supabase `service_role` key.
- Account deletion remains beta; use a spare account or manual Supabase
  Dashboard flow before trusting it with real team data.

### Verification

- `npx tsc --noEmit --pretty false`
- `npm run build`

## v0.9.1 - 2026-05-23

### Added

- Added local-only mode in Settings. This mode disables Supabase login, cloud
  sync, member invites, and presence heartbeats while keeping local IndexedDB
  workflows available.
- Added cloud-collaboration mode as an explicit switch for teams that want
  Supabase-backed sharing and synchronization.
- Added account deletion beta documentation:
  - `docs/supabase-edge-function-account-deletion.md`
  - `docs/manual-account-deletion.md`
- Added `scripts/deploy-supabase-edge-function.ps1` for deploying the account
  deletion Edge Function without committing secrets.

### Changed

- Rewrote README with a local-first explanation, mode guidance, Supabase setup,
  and account deletion beta warning.
- Moved SQL files into `supabase/sql/` and removed obsolete presence/reset SQL
  scripts.
- Cloud store actions now respect local-only mode and no-op instead of touching
  Supabase.

### Security

- Account deletion uses `DEVTRACK_SUPABASE_*` Edge Function secrets because
  Supabase CLI rejects custom secrets starting with `SUPABASE_`.

## v0.9.0 - 2026-05-23

- Closed the shared project publishing flow through a Supabase RPC.
- Added project/member/sync SQL setup under `supabase/sql/setup.sql`.
- Expanded synced entity coverage to tasks, milestones, timeline events,
  diary entries, sprints, and comments.
- Improved project deletion cleanup to reduce remote/local resurrection issues.
- Normalized task dependency data around `dependsOn`.
- Improved DeepSeek AI command validation and default model handling.
- Added timeline `endDate` handling.

## v0.8.0 - 2026-05-23

- Split owner controls, first setup guidance, permission audit, and sync
  diagnostics into a collaboration control area.
- Added paginated collaboration activity panels.
- Added backup and recovery center improvements.
- Added today command center.
- Added sidebar visibility weighting and configuration.

## Earlier Versions

Earlier local development versions introduced task boards, focus timers,
Pomodoro support, project diary, analytics, Gantt/burndown views, achievements,
calendar, task dependencies, backup/restore, AI command execution, and LAN
collaboration experiments.
