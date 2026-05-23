# Dev Progress Tracker

Dev Progress Tracker is a local-first project development monitoring system for
small teams and individual developers. It combines project tracking, task boards,
today planning, focus timers, milestones, diary notes, analytics, backups, AI
commands, and optional Supabase collaboration.

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-purple?logo=vite)](https://vite.dev)
[![Version](https://img.shields.io/badge/version-0.9.1-green)](CHANGELOG.md)

## v0.9.1 Focus

- **Local-only mode**: Settings now includes `单人纯净流`, which disables
  Supabase login, sync, invites, and presence heartbeats. Local project data
  continues to live in browser IndexedDB.
- **Cloud collaboration mode**: Users can switch back to `云协作模式` later to
  sign in with Supabase, publish shared projects, invite members, and sync team
  progress.
- **Account deletion beta**: Settings includes a Supabase account deletion
  entry, but this flow is beta and should be tested with a spare account before
  using it on real team projects.
- **Deployment docs**: Two account-deletion guides are provided: one using the
  included Edge Function, and one fully manual flow.

## Local Data Safety

The app is local-first. If you do not sign in to Supabase, core data is stored in
the current browser's IndexedDB and is not automatically deleted by DevTrack.

Local data can still disappear if:

- You clear browser site data.
- You use private/incognito mode.
- The browser removes storage under storage pressure.
- You switch browser, device, hostname, or deployed domain.
- You use DevTrack's clear-data or restore-overwrite tools.

For important work, use `备份与恢复中心` to create restore points. Supabase is
optional, not required for single-user local use.

## Core Features

- Project portfolio, project creation, cloning, archiving, and folder-style
  project icons.
- Task board with priorities, due dates, reminders, subtasks, dependencies,
  comments, sprints, and task timers.
- Today command center and today task publishing.
- Pomodoro timer, focus sessions, and daily focus statistics.
- Milestones, timeline, calendar, Gantt chart, burndown chart, CFD, and analytics.
- Project diary with Markdown support.
- Backup and recovery center with restore-point export/import.
- AI command center with DeepSeek support.
- Optional Supabase cloud sync, project sharing, roles, members, presence, and
  collaboration activity flow.

## Run Locally

```bash
npm install
npm run dev -- --host
```

Open:

```text
http://localhost:5173
```

Build:

```bash
npm run build
```

## Modes

### 单人纯净流

Use this when you want no Supabase dependency. DevTrack will not initialize cloud
sync, touch online presence, publish invites, or send sync requests. All project
work remains local to the browser.

### 云协作模式

Use this when you want Supabase-backed collaboration. You can sign in, publish a
project, invite members, sync progress, and manage roles.

## Supabase Setup

Cloud collaboration is optional.

1. Create a Supabase project.
2. Copy `.env.example` to `.env`.
3. Fill in:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_SUPABASE_SYNC_TABLE=devtrack_sync_records
VITE_SUPABASE_PROJECT_TABLE=devtrack_projects
VITE_SUPABASE_MEMBER_TABLE=devtrack_project_members
VITE_SUPABASE_DELETE_ACCOUNT_FUNCTION_URL=https://your-project.supabase.co/functions/v1/devtrack-delete-account
```

4. Run this file in Supabase SQL Editor:

```text
supabase/sql/setup.sql
```

## Account Deletion Beta

Account deletion is currently beta and not recommended for casual use on
production team data.

There are two supported paths:

- Edge Function flow:
  [docs/supabase-edge-function-account-deletion.md](docs/supabase-edge-function-account-deletion.md)
- Manual flow:
  [docs/manual-account-deletion.md](docs/manual-account-deletion.md)

The Edge Function code is included so teams can audit it before deployment:

```text
supabase/functions/devtrack-delete-account/index.ts
```

The frontend never stores a Supabase service-role key. The service-role key must
only be stored as a Supabase Edge Function secret.

## Project Structure

```text
src/
  components/
  db/
  lib/
  pages/
  stores/
  types/
supabase/
  functions/
    devtrack-delete-account/
  sql/
    setup.sql
    migrations/
docs/
scripts/
```

## Notes For GitHub Distribution

- `.env` is ignored and should not be committed.
- `.env.example` contains only placeholder values.
- Users who do not want Supabase can use `单人纯净流`.
- Users who want collaboration must configure their own Supabase project.
