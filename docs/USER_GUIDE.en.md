# DevTrack User Guide

Applies to: v1.0.0

DevTrack is a local-first project development monitoring system. You can use it
as a personal developer workspace or share projects with a small team through
Supabase.

## 1. Start the App

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Run for LAN/Radmin access:

```bash
npm run dev -- --host
```

Default URL:

```text
http://localhost:5173
```

Production build:

```bash
npm run build
```

## 2. Choose a Working Mode

### Local-only Mode

Use this when you do not want Supabase.

Behavior:

- No registration or login required.
- No Supabase requests.
- Data is stored in the current browser's IndexedDB.
- Core project, task, Today Command, focus, Pomodoro, diary, analytics, and
  backup workflows remain available.

Important notes:

- Clearing browser site data removes local data.
- Private/incognito data may disappear when the session closes.
- IndexedDB is not shared across browsers, devices, hostnames, or deployed
  domains.
- Create restore points in Backup Recovery for important work.

### Cloud Collaboration Mode

Use this for shared team projects.

Behavior:

- Supabase email sign-up/sign-in.
- Owners publish shared projects.
- Members join through invite links or the Project Sharing panel.
- Supabase handles data sync, member roles, presence, and collaboration events.
- Realtime is the primary sync path; REST sync is a slower fallback when
  Realtime is healthy.

## 3. Create and Manage Projects

1. Click the project selector at the top of the sidebar.
2. Click "Create Project".
3. Enter a project name, color, and optional deadline.
4. Optionally choose a template to create initial tasks and milestones.

Project icons use a folder style and show initials from the project name.

## 4. Use the Task Board

The task board is the main execution surface.

Common actions:

- Create tasks with title, description, tags, due date, and estimate.
- Move tasks through todo, in progress, review, and done.
- Bind tasks to milestones by dragging them into milestone areas.
- Set task dependencies in the task edit dialog.
- Add comments and track time in task details.
- Use batch mode for bulk status updates.

Tasks blocked by unfinished dependencies cannot be moved into progress.

## 5. Today Command and Today Tasks

Today Command gives a daily overview of:

- Today's tasks
- Risk alerts
- Blocked work
- Current rhythm
- Focus summary

Today Tasks is used to publish daily work with due times, reminder times, and
recurrence rules.

## 6. Task Dependency Graph

Open "Task Dependencies" to see and edit dependency relationships:

- Each node is a task.
- Arrows show dependency direction.
- Nodes are draggable.
- Drag from a node handle to create dependencies.
- Select an edge and press Delete to remove it.
- Red nodes are blocked tasks.

## 7. Milestones, Timeline, Calendar, and Gantt

- Milestones: manage phase goals and completion.
- Timeline: record key project events with optional start/end dates.
- Calendar: inspect tasks, diary entries, and events by date.
- Gantt: view tasks and milestones on a timeline.
- Analytics: review burndown, CFD, task status breakdowns, and trends.

## 8. Pomodoro and Focus Sessions

Pomodoro supports:

- Work, short break, and long break duration settings.
- Pause, resume, previous phase, finish early, and next phase.
- Automatic focus-session recording.
- Browser notification and sound toggles.

Focus Sessions displays historical focus records.

## 9. Project Diary

The diary supports Markdown.

Common actions:

- Write one diary entry per user per day.
- Multiple team members can write entries on the same date.
- Calendar cells show multiple mood markers.
- Import `.md` / `.json`.
- Export current-month or all diary entries to `.md`.

## 10. Backup and Recovery

Create restore points before:

- Major updates.
- Publishing a shared project.
- Bulk import or restore.
- Supabase configuration changes.

Backup directory preferences can be selected in Settings. Logged-in users get
user-scoped local settings; anonymous users fall back to browser local storage.

## 11. AI Command Center

DevTrack uses the DeepSeek API.

Rules:

- Enter the API key in the browser.
- No backend is required.
- The key is not saved by default and is lost on refresh.
- Users can generate tasks, plans, diary content, and analysis with their own
  key.

## 12. Supabase Team Collaboration

### Owner Publishes a Shared Project

1. Switch to cloud collaboration mode.
2. Sign in or register on the Account page.
3. Open Collaboration.
4. Publish the current project as shared.
5. Generate an invite link.
6. Send the link to members.

### Member Joins

Members can join in two ways:

1. Open the invite link, then sign up or sign in.
2. Paste the invite link into the Project Sharing panel after entering the app.

### Roles

- Owner: manages project and members with full permissions.
- Editor: edits most collaborative content.
- Viewer: read-only access.

## 13. Radmin / LAN Access

For Radmin virtual LAN:

1. Owner starts the dev server:

```bash
npm run dev -- --host
```

2. Open Settings and auto-detect LAN/Radmin IP.
3. Choose the `26.x.x.x` Radmin IPv4 address.
4. Generate the team connection URL.
5. Members open that URL while connected to the same Radmin network.

Radmin exposes the local dev server. Supabase handles auth, permissions, and
data sync.

## 14. Sync Diagnostics

When collaboration has problems, open Collaboration Diagnostics to inspect:

- Current user ID
- JWT `sub`
- Local user ID
- Current project `remoteProjectId`
- Pending sync queue count
- Conflict count
- Latest sync error
- Member presence

Owners can see more team-level diagnostic information.

## 15. Account Deletion Beta

Account deletion is still beta. Test it with a spare account first.

Options:

- Use the Supabase Edge Function flow.
- Delete the Auth user manually in the Supabase Dashboard.

See:

- `docs/supabase-edge-function-account-deletion.md`
- `docs/manual-account-deletion.md`
