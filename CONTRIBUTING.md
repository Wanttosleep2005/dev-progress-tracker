# Contributing / 贡献指南

Thank you for improving DevTrack. This guide is bilingual so both English and
Chinese contributors can follow the same workflow.

感谢你改进 DevTrack。本指南同时包含英文和中文说明，方便不同成员按同一流程协作。

---

## English

### Project Principles

- DevTrack is local-first. Do not break local-only mode when adding cloud
  features.
- Supabase collaboration is optional. Cloud features must fail gracefully when
  configuration is missing.
- Never commit secrets. `.env` is ignored. Use `.env.example` for placeholders.
- Prefer small, focused changes that match existing Zustand, Dexie, React, and
  Tailwind patterns.
- Keep UI dense, practical, and suitable for repeated daily use.

### Setup

```bash
npm install
npm run dev -- --host
```

### Before Submitting Changes

Run:

```bash
npx tsc --noEmit --pretty false
npm run build
```

If you touch Supabase SQL, also document which scripts must be run in the
Supabase SQL Editor.

### Branch and Commit Style

Use short branch names:

```text
feat/task-export
fix/sync-rls
docs/user-guide
```

Use clear commit messages:

```text
feat: add diary markdown export
fix: ignore deprecated sprint sync records
docs: update v1.0 setup guide
```

### Pull Request Checklist

- The change is scoped to one problem or feature.
- TypeScript passes.
- Production build passes.
- No `.env`, service-role key, token, database password, or personal backup file
  is included.
- README/docs are updated when behavior changes.
- Existing local IndexedDB data remains compatible, or the migration is
  documented.

### Security Notes

- Frontend `VITE_` variables are public after build.
- Never put Supabase `service_role` keys in frontend code.
- Account deletion is beta and should be tested with spare accounts.
- If a secret is exposed in logs, chat, screenshots, or commits, rotate it.

---

## 中文

### 项目原则

- DevTrack 是本地优先应用。新增云功能时不能破坏单人纯净流。
- Supabase 协作是可选能力。缺少配置时，云功能要优雅降级。
- 不要提交密钥。`.env` 已被忽略，`.env.example` 只放占位示例。
- 修改尽量小而聚焦，沿用现有 Zustand、Dexie、React、Tailwind 写法。
- UI 应保持实用、克制、适合高频日常使用。

### 本地开发

```bash
npm install
npm run dev -- --host
```

### 提交前检查

运行：

```bash
npx tsc --noEmit --pretty false
npm run build
```

如果修改了 Supabase SQL，请说明需要在 Supabase SQL Editor 执行哪些脚本。

### 分支和提交信息

建议使用简短分支名：

```text
feat/task-export
fix/sync-rls
docs/user-guide
```

提交信息建议清晰说明目的：

```text
feat: add diary markdown export
fix: ignore deprecated sprint sync records
docs: update v1.0 setup guide
```

### PR 检查清单

- 本次改动只解决一个明确问题或功能。
- TypeScript 检查通过。
- 生产构建通过。
- 没有提交 `.env`、service-role key、token、数据库密码或个人备份文件。
- 行为变化已同步更新 README 或 docs。
- 旧 IndexedDB 数据保持兼容；如果不兼容，必须写清迁移说明。

### 安全提醒

- 前端 `VITE_` 环境变量会被打包进浏览器代码，视为公开信息。
- Supabase `service_role` key 绝不能放进前端代码。
- 账号注销仍是 Beta，请用测试账号验证。
- 密钥如果出现在日志、聊天、截图或提交记录中，请立即轮换。
