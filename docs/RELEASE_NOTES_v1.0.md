# DevTrack v1.0

DevTrack v1.0 is the first stable local-first release for personal and
small-team project development monitoring.

## Highlights

- Local-only mode for users who do not want Supabase.
- Optional Supabase collaboration with shared projects, roles, invites,
  Realtime sync, presence, activity stream, Owner controls, and diagnostics.
- Today Command dashboard for daily tasks, risks, blockers, and rhythm.
- Task board with priorities, reminders, dependencies, subtasks, comments,
  timer support, and batch updates.
- React Flow task dependency graph.
- Milestones, timeline, calendar, Gantt, burndown, CFD, and analytics.
- Pomodoro and focus-session tracking.
- Markdown diary with multi-user entries, import, and export.
- Backup and recovery center with restore points and user-scoped backup
  directory settings.
- DeepSeek AI command center with temporary frontend API key entry.
- Bilingual documentation:
  - `README.md`
  - `docs/USER_GUIDE.zh-CN.md`
  - `docs/USER_GUIDE.en.md`
  - `CONTRIBUTING.md`

## Removed

- Sprint management has been removed from the product surface.
- Legacy `sprints` IndexedDB and backup fields are retained for compatibility,
  but route, sidebar entry, page, store, achievement, and cloud-sync handling are
  no longer active.

## Verification

- `npx tsc --noEmit --pretty false`
- `npm run build`

`npm run lint` still reports existing ESLint/React Compiler rule violations that
are not blocking the v1.0 build. They are tracked as future cleanup work.
