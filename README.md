# DevTrack / Dev Progress Tracker

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-purple?logo=vite)](https://vite.dev)
[![Version](https://img.shields.io/badge/version-1.0-green)](CHANGELOG.md)

DevTrack is a local-first project development monitoring system for individual
developers and small teams. It combines task execution, daily planning,
focus/Pomodoro records, milestones, diary notes, analytics, backup/restore,
DeepSeek-powered AI commands, and optional Supabase collaboration.

DevTrack 是一个面向个人开发者和小团队的本地优先项目开发监控系统。它把任务执行、今日安排、专注/番茄记录、里程碑、开发日志、数据分析、备份还原、DeepSeek AI 指令和可选的 Supabase 团队协作整合在一个工作台里。

## Language / 语言

- 中文说明见下方「中文」部分。
- English documentation is available in the "English" section below.
- User guides:
  - [中文操作指南](docs/USER_GUIDE.zh-CN.md)
  - [English User Guide](docs/USER_GUIDE.en.md)
- Contribution guide:
  - [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 中文

### 1.0 定位

v1.0 是 DevTrack 的第一个稳定收口版本，重点是：

- 单人纯净流：不依赖 Supabase，数据保存在当前浏览器 IndexedDB。
- 云协作流：基于 Supabase 的账号、共享项目、成员权限、实时同步和活动流。
- 今日指挥台：聚合今日任务、风险、阻塞和节奏。
- 任务看板：支持优先级、截止时间、提醒、依赖、子任务、评论、任务计时和批量操作。
- 任务依赖图：使用 React Flow 展示任务依赖和阻塞关系。
- 里程碑、时间线、日历、甘特图、燃尽图、CFD 和数据分析。
- 番茄钟与专注记录。
- Markdown 开发日志，支持导入和导出。
- 备份与恢复中心，可创建项目数据还原点。
- DeepSeek AI 指令中心，API Key 仅前端临时输入，不要求后端。
- Supabase 同步诊断、Owner 控制、权限审计、邀请加入流程。

冲刺管理模块已在 v1.0 下架。旧数据库中的 `sprints` 表和旧备份字段保留兼容，但前台入口、路由、store 和云同步处理已移除。

### 本地运行

```bash
npm install
npm run dev -- --host
```

打开：

```text
http://localhost:5173
```

构建：

```bash
npm run build
```

### 两种使用模式

**单人纯净流**

适合只想本地使用、不想配置 Supabase 的用户。DevTrack 不会初始化云同步、邀请、在线状态或 Realtime。数据保存在当前浏览器 IndexedDB。

注意：本地数据不是永久保险箱。清理浏览器站点数据、使用无痕模式、换浏览器/设备/域名，或执行覆盖式恢复，都可能让本地数据不可见。重要项目请定期使用「备份恢复」创建还原点。

**云协作流**

适合团队共享项目。Owner 发布共享项目并生成邀请链接，成员注册/登录后加入项目。权限分为：

- Owner：项目发布、邀请成员、移除成员、调整角色、转让所有权、删除共享项目。
- Editor：创建和编辑任务、日记、时间线、评论等可协作内容。
- Viewer：只读查看。

### Supabase 配置

云协作是可选能力。单人纯净流不需要配置 Supabase。

1. 创建 Supabase 项目。
2. 复制 `.env.example` 为 `.env`。
3. 填入公开配置：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_SUPABASE_SYNC_TABLE=devtrack_sync_records
VITE_SUPABASE_PROJECT_TABLE=devtrack_projects
VITE_SUPABASE_MEMBER_TABLE=devtrack_project_members
VITE_SUPABASE_DELETE_ACCOUNT_FUNCTION_URL=https://your-project.supabase.co/functions/v1/devtrack-delete-account
```

4. 在 Supabase SQL Editor 执行：

```text
supabase/sql/setup.sql
```

如果是从旧版本升级，可以按需执行 `supabase/sql/migrations/` 中的迁移脚本。

### 账号注销 Beta

账号注销仍然是 Beta 功能，不建议在真实团队数据上随意测试。前端永远不应保存或打包 Supabase `service_role` key。自动注销需要 Supabase Edge Function，手动注销可以在 Supabase Dashboard 完成。

- [Edge Function 注销指南](docs/supabase-edge-function-account-deletion.md)
- [手动注销指南](docs/manual-account-deletion.md)

### 发布和分发

- `.env` 被 `.gitignore` 忽略，不应提交。
- `.env.example` 只放占位示例。
- 不使用 Supabase 的成员直接使用单人纯净流即可。
- 需要团队协作的成员应配置自己的 Supabase 项目，或加入 Owner 发布的共享项目。

---

## English

### Version 1.0 Scope

v1.0 is the first stable DevTrack release. It focuses on:

- Local-only mode: no Supabase dependency, data stored in browser IndexedDB.
- Cloud collaboration mode: Supabase auth, shared projects, member roles,
  realtime sync, and activity streams.
- Today Command: daily tasks, risks, blockers, and rhythm in one view.
- Task Board: priorities, due dates, reminders, dependencies, subtasks,
  comments, task timers, and batch operations.
- Task dependency graph powered by React Flow.
- Milestones, timeline, calendar, Gantt, burndown, CFD, and analytics.
- Pomodoro and focus-session tracking.
- Markdown diary with import and export.
- Backup and recovery center with restore points.
- DeepSeek AI command center. API keys are entered temporarily in the frontend.
- Supabase sync diagnostics, Owner controls, permission audit, and invite flow.

The Sprint module has been removed in v1.0. Legacy `sprints` table/backup fields
remain for compatibility, but the UI route, store, and cloud-sync handling are
deprecated.

### Run Locally

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

### Modes

**Local-only mode**

Use this when you do not want Supabase. DevTrack will not initialize cloud sync,
invites, presence, or Realtime. Data remains in the current browser's IndexedDB.

Local data can still disappear if browser site data is cleared, private browsing
is used, the browser evicts storage, or you switch browser/device/domain. Use
Backup Recovery regularly for important work.

**Cloud collaboration mode**

Use this for shared team projects. The Owner publishes a project and sends an
invite link. Members sign up or sign in, then join the shared project.

Roles:

- Owner: publish projects, invite/remove members, change roles, transfer
  ownership, and delete shared projects.
- Editor: create and edit collaborative content such as tasks, diaries,
  timeline events, and comments.
- Viewer: read-only access.

### Supabase Setup

Cloud collaboration is optional.

1. Create a Supabase project.
2. Copy `.env.example` to `.env`.
3. Fill in public frontend values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_SUPABASE_SYNC_TABLE=devtrack_sync_records
VITE_SUPABASE_PROJECT_TABLE=devtrack_projects
VITE_SUPABASE_MEMBER_TABLE=devtrack_project_members
VITE_SUPABASE_DELETE_ACCOUNT_FUNCTION_URL=https://your-project.supabase.co/functions/v1/devtrack-delete-account
```

4. Run the setup script in Supabase SQL Editor:

```text
supabase/sql/setup.sql
```

For upgrades from older versions, apply scripts under `supabase/sql/migrations/`
as needed.

### Account Deletion Beta

Account deletion is still beta. Do not test it casually on production team data.
The frontend must never store or bundle a Supabase `service_role` key. Automated
deletion requires the included Supabase Edge Function; manual deletion can be
performed in the Supabase Dashboard.

- [Edge Function guide](docs/supabase-edge-function-account-deletion.md)
- [Manual deletion guide](docs/manual-account-deletion.md)

### Distribution Notes

- `.env` is ignored by Git and should not be committed.
- `.env.example` contains placeholders only.
- Users who do not need Supabase can stay in local-only mode.
- Teams can either configure their own Supabase project or join a project
  published by the Owner.

## Project Structure

```text
src/
  components/
  db/
  lib/
  pages/
  stores/
  types/
docs/
scripts/
supabase/
  functions/
  sql/
```
