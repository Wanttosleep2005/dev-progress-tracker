# Dev Progress Tracker

> 开发者进度追踪 Web 应用 - 任务管理、里程碑跟踪、专注计时、数据分析一体化工具

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-purple?logo=vite)](https://vite.dev)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## 功能特性

### 核心功能
- **多项目管理** - 创建、克隆、归档项目，设置截止日期和倒计时
- **任务看板** - 待办/进行中/审核/完成 四列看板视图，支持优先级和标签
- **今日任务** - 聚焦当天重点任务，支持提醒时间设置
- **里程碑管理** - 追踪项目进度百分比，目标日期倒计时
- **项目日记** - 每日开发日志记录，支持 markdown
- **甘特图视图** - 时间线展示任务排期和进度
- **任务依赖** - 任务间依赖关系可视化

### 专注工作
- **番茄计时器** - 自定义工作/休息时长，短长休息轮换
- **专注会话统计** - 记录每日专注时长，分析工作效率

### AI 智能助手
- **AI 指令中心** - 自然语言创建任务、里程碑、日记、时间线事件
- **模型切换** - DeepSeek V4 Flash（快速）/ V4 Pro（强力）自由选择
- **推理力度控制** - off / high / max 三档，按需平衡质量与 token 消耗
- **一键执行** - 生成计划后确认即可批量落地，支持自动同步

### 数据分析
- **活动热力图** - 可视化每日工作活跃度
- **统计面板** - 任务完成率、进行中任务、紧急待处理
- **风险预警** - 智能分析项目风险并提醒
- **趋势图表** - 任务完成数量和事件趋势

### 团队协作 (Beta)
- **项目共享** - 邀请团队成员协作
- **角色权限** - 所有者/编辑者/查看者 三级权限
- **协作活动流** - 实时同步团队成员操作
- **数据同步** - 云端同步支持多设备访问

### UI/UX
- **命令面板** - Cmd+K 快速导航和操作
- **快捷键支持** - 高效键盘操作
- **暗色主题** - 护眼深色界面
- **响应式设计** - 适配桌面端使用

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 8 |
| 样式方案 | Tailwind CSS 4 |
| 状态管理 | Zustand |
| 本地数据库 | Dexie (IndexedDB) |
| 动画库 | Framer Motion |
| 路由 | React Router DOM 7 |
| 命令面板 | cmdk |
| 图表 | Chart.js + react-chartjs-2 |
| 日期处理 | date-fns |
| Markdown | react-markdown + remark-gfm |

## 页面概览

| 页面 | 路径 | 说明 |
|------|------|------|
| 概览 | `/` | 项目仪表盘，聚合任务、风险、里程碑、今日安排 |
| 项目组合 | `/portfolio` | 所有项目列表和快速切换 |
| 项目管理 | `/projects` | 项目创建、编辑、删除、克隆 |
| 今日任务 | `/today-tasks` | 当天发布的重点任务 |
| 任务看板 | `/tasks` | 看板视图管理所有任务 |
| 任务依赖 | `/task-dependencies` | 任务依赖关系可视化 |
| 番茄钟 | `/pomodoro` | 专注计时器 |
| 专注记录 | `/focus-sessions` | 专注历史和统计 |
| 里程碑 | `/milestones` | 项目里程碑进度管理 |
| 日记 | `/diary` | 每日开发日志 |
| 甘特图 | `/gantt` | 任务时间线视图 |
| 分析 | `/analytics` | 数据统计和成就系统 |
| 团队协作 | `/collaboration` | 团队管理 (Beta) |
| AI 指令 | `/ai-command` | AI 智能创建任务/里程碑/日记 |
| 设置 | `/settings` | 应用配置和偏好 |

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

打开 http://localhost:5173 查看应用。

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist` 目录。

## 云同步配置（可选）

本应用支持云端同步和团队协作功能。

### 步骤 1：创建 Supabase 项目

1. 访问 [supabase.com](https://supabase.com) 注册/登录（推荐使用 QQ 邮箱）
2. 点击 "New Project"，创建免费项目
3. 记住生成的 **Project URL** 和 **anon public** 密钥

### 步骤 2：配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env`，填入你的 Supabase 配置：

```env
VITE_SUPABASE_URL=你的Project URL
VITE_SUPABASE_ANON_KEY=你的anon密钥

# DeepSeek API Key（AI 指令功能需要，可选）
# 在 https://platform.deepseek.com/api_keys 创建
VITE_DEEPSEEK_API_KEY=sk-your-deepseek-api-key
```

### 步骤 3：创建数据库表

在 Supabase 后台进入 **SQL Editor**，复制 `supabase-setup.sql` 文件的全部内容，运行即可。

### 步骤 4：运行应用

```bash
npm run dev
```

打开 http://localhost:5173，注册账号即可使用云同步和团队协作功能。

## 团队协作使用方法

1. **发布共享项目**：在团队协作页面，选择项目点击"发布共享"
2. **生成邀请链接**：点击"邀请成员"，选择角色（编辑者/查看者），复制链接
3. **成员加入**：被邀请人打开链接，选择"加入项目"即可

## 项目结构

```
src/
├── App.tsx                 # 应用入口和路由
├── main.tsx               # React 挂载点
├── index.css              # 全局样式
├── components/            # 可复用组件
│   ├── layout/           # 布局组件 (Sidebar, Layout, CommandPalette)
│   ├── ui/               # 基础 UI 组件
│   └── charts/           # 图表组件
├── pages/                 # 页面组件
├── stores/                # Zustand 状态管理
├── lib/                   # 工具函数
│   ├── cloudSync.ts      # 云端同步
│   └── ...
├── db/                    # 数据库层
│   └── database.ts       # Dexie 配置
└── types/                 # TypeScript 类型定义
    └── index.ts
```

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + K` | 打开命令面板 |
| `Cmd/Ctrl + N` | 新建任务 |
| `Cmd/Ctrl + /` | 显示快捷键帮助 |

## 后续计划

- [ ] 浏览器通知推送
- [ ] 移动端适配
- [ ] AI 多轮对话优化
- [ ] 循环任务

## 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件