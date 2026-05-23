# Changelog

## v0.9.1 - 2026-05-23

### Added

- Added `单人纯净流` in Settings. This mode disables Supabase login, cloud sync,
  member invites, and presence heartbeats while keeping local IndexedDB workflows
  available.
- Added `云协作模式` as an explicit switch for teams that want Supabase-backed
  sharing and synchronization.
- Added account deletion beta documentation:
  - `docs/supabase-edge-function-account-deletion.md`
  - `docs/manual-account-deletion.md`
- Added `scripts/deploy-supabase-edge-function.ps1` for deploying the account
  deletion Edge Function without committing secrets.

### Changed

- Bumped version to `0.9.1`.
- Rewrote README with a local-first explanation, mode guidance, Supabase setup,
  and account deletion beta warning.
- Moved SQL files into `supabase/sql/` and removed obsolete presence/reset SQL
  scripts.
- Cloud store actions now respect local-only mode and no-op instead of touching
  Supabase.

### Security

- The frontend still never stores or bundles a Supabase service-role key.
- Account deletion uses `DEVTRACK_SUPABASE_*` Edge Function secrets because
  Supabase CLI rejects custom secrets starting with `SUPABASE_`.
- Account deletion remains beta and should be tested with disposable accounts
  before use on real team data.

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
