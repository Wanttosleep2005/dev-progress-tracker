# Dev Progress Tracker

> 开发者进度追踪 Web 应用 - 任务管理、里程碑跟踪、专注计时、数据分析一体化工具

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-purple?logo=vite)](https://vite.dev)
[![Version](https://img.shields.io/badge/version-0.9.0-green)](CHANGELOG.md)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## 功能特性

### v0.9.0 协作闭环版
- **共享项目发布流程收口** - 发布项目通过 Supabase RPC 自动写入项目与 Owner 成员关系，规避前端直写触发的 RLS 首行插入问题
- **同步实体补全** - 任务、里程碑、时间线、日记、Sprint、评论统一进入同步队列，团队成员操作后可被其他成员拉取
- **删除闭环** - 删除项目时同步清理任务、里程碑、时间线、日记、成员、活动流、通知、邀请、Sprint、评论和同步队列，降低“删了又回来”的概率
- **任务依赖收敛** - 新数据统一使用 `dependsOn` 字段，旧 `dependencyIds` 仅作为兼容读取来源
- **AI 指令更稳** - DeepSeek 默认模型改为 `deepseek-chat`，增加本地 action 校验、里程碑 ID 语义字段和多日时间线事件 `endDate`
- **多日时间线事件** - Timeline 创建区支持开始/结束日期，Calendar 和 Timeline 对多日事件的含义保持一致

### 核心功能
- **项目模板** - 4 套预置模板（Web 全栈/移动端/开源/学习），一键创建任务和里程碑
- **多项目管理** - 创建、克隆、归档项目，设置截止日期和倒计时
- **循环任务** - 支持每天/每周/每月循环，完成自动生成下一期
- **子任务清单** - 任务内拆分子任务，逐项勾选追踪进度
- **任务看板** - 待办/进行中/审核/完成 四列看板视图，支持优先级和标签
- **今日任务** - 聚焦当天重点任务，支持提醒时间设置
- **里程碑管理** - 追踪项目进度百分比，目标日期倒计时
- **项目日记** - 每日开发日志，支持 Markdown、代码高亮、MD/JSON 导入、实时预览、标签云
- **甘特图视图** - 时间线展示任务排期和进度
- **任务依赖** - 可交互依赖关系图，拖拽连线管理
- **冲刺管理** - Sprint 创建/启动/完成，任务拖拽分配，进度追踪

### 专注工作
- **番茄计时器** - 自定义工作/休息时长，短长休息轮换
- **任务联动** - 番茄钟绑定任务后自动累加工时、推进状态，进度条实时展示
- **任务计时器** - 单任务独立计时，浮动面板实时追踪，与全局计时器互斥
- **专注会话统计** - 记录每日专注时长，分析工作效率

### AI 智能助手
- **AI 指令中心** - 自然语言创建/更新任务、里程碑、日记、时间线事件，配置番茄钟
- **智能更新** - 支持更新已有任务状态、优先级、截止日期等，标记完成无需手动操作
- **子任务拆解** - AI 可自动将复杂任务拆分为子步骤清单
- **模型切换** - DeepSeek V4 Flash（快速）/ V4 Pro（强力）自由选择
- **推理力度控制** - off / high / max 三档，按需平衡质量与 token 消耗
- **一键执行** - 生成计划后确认即可批量落地，支持自动同步

### 数据分析
- **活动热力图** - 可视化每日工作活跃度
- **统计面板** - 任务完成率、进行中任务、紧急待处理
- **风险预警** - 智能分析项目风险并提醒
- **累积流图** - CFD 面积图展示任务在各状态的分布变化和瓶颈识别
- **趋势图表** - 任务完成数量和事件趋势
- **燃尽图** - 乐观/悲观/理想/实际四条线，支持 PNG 导出

### 成就系统
- **27 个成就** - 覆盖任务、专注、日记、里程碑、协作等多维度
- **三级等级** - 铜牌 🥉 / 银牌 🥈 / 金牌 🥇，解锁动画弹窗

### 团队协作 (LAN + Cloud)
- **局域网协作**：通过 Radmin VPN 实现点对点实时协作，零配置即连即用
- **LAN IP 检测**：自动检测公网/局域网/Radmin 虚拟网卡地址
- **项目共享** - 邀请团队成员协作
- **角色权限** - 所有者/编辑者/查看者 三级权限，支持转让与移除
- **协作活动流** - 实时同步团队成员操作
- **团队仪表盘** - 成员统计、活跃概览、同步状态一目了然
- **孤儿数据清理** - 远端项目删除后自动清理本地残留数据
- **数据同步** - Supabase 云端同步支持多设备访问

### UI/UX
- **通知中心** - 铃铛图标+未读计数，任务/协作事件自动推送
- **命令面板** - Cmd+K 全局搜索（任务/项目/里程碑/日记/事件），一键跳转
- **自定义快捷键** - 命令面板/新建任务/计时器/帮助均可自定义绑定
- **暗色主题** - 护眼深色界面，玻璃态毛玻璃效果
- **响应式设计** - 适配桌面端使用
- **代码高亮** - 日记 Markdown 代码块支持 190+ 语言语法着色

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
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| 依赖图 | @xyflow/react |

## 页面概览

| 页面 | 路径 | 说明 |
|------|------|------|
| 概览 | `/` | 项目仪表盘，聚合任务、风险、里程碑、成就、今日安排 |
| 项目组合 | `/portfolio` | 所有项目列表和快速切换 |
| 项目管理 | `/projects` | 项目创建、编辑、删除、克隆 |
| 今日任务 | `/today-tasks` | 当天发布的重点任务 |
| 任务看板 | `/tasks` | 看板视图管理所有任务，子任务/计时/评论 |
| 任务依赖 | `/dependencies` | 任务依赖关系可视化交互图 |
| 冲刺管理 | `/sprints` | Sprint 创建、任务分配、进度追踪 |
| 番茄钟 | `/pomodoro` | 专注计时器 |
| 专注记录 | `/focus-sessions` | 专注历史和统计 |
| 里程碑 | `/milestones` | 项目里程碑进度管理 |
| 日记 | `/diary` | 每日开发日志，代码高亮 |
| 甘特图 | `/gantt` | 任务时间线视图 |
| 日历 | `/calendar` | 月/周/日视图，聚合任务+里程碑+事件 |
| 冲刺管理 | `/sprints` | Sprint 创建、任务拖拽分配、进度追踪 |
| 成就 | `/achievements` | 27 项成就，铜银金三级，进度条展示 |
| 分析 | `/analytics` | 数据统计、燃尽图、CFD、热力图 |
| 团队协作 | `/collaboration` | 团队管理和仪表盘 (Beta) |
| AI 指令 | `/ai-command` | AI 智能创建任务/里程碑/日记 |
| 设置 | `/settings` | 应用配置、快捷键、数据导入导出 |

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev -- --host
```
或直接双击 `start.bat` 启动（已内置 `--host` 监听所有网卡）。

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
| `Cmd/Ctrl + T` | 切换任务计时器 |
| `Cmd/Ctrl + /` | 显示快捷键帮助 |

快捷键可在「设置 → 自定义快捷键」中修改。

## 后续计划

- [x] 子任务/Checklist
- [x] 任务时间追踪
- [x] 成就系统扩展（27 成就 + 三级等级）
- [x] Sprint 冲刺管理
- [x] 日记代码语法高亮
- [x] 自定义快捷键
- [x] 数据导入多格式（CSV/JSON）
- [x] 团队仪表盘
- [x] 任务依赖图美化
- [ ] 移动端适配
- [ ] PWA 离线支持
- [ ] Git 集成（GitHub commit 关联）
- [ ] 日历视图
- [ ] 任务评论/讨论 UI

## 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件
