export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type EventType = 'release' | 'bugfix' | 'milestone' | 'decision' | 'other';
export type MoodType = 'great' | 'good' | 'meh' | 'bad' | 'terrible';
export type ProjectStatus = 'active' | 'archived';
export type ViewMode = 'kanban' | 'list';
export type TaskSource = 'board' | 'daily';
export type TeamRole = 'owner' | 'editor' | 'viewer';
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'conflict';
export type SyncEntityType = 'projects' | 'tasks' | 'milestones' | 'timelineEvents' | 'diaryEntries';
export type SyncOperation = 'upsert' | 'delete';
export type CollaborationEventType =
  | 'project_shared'
  | 'member_invited'
  | 'member_role_changed'
  | 'task_created'
  | 'task_completed'
  | 'milestone_created'
  | 'diary_created'
  | 'comment_added';
export type PomodoroPhase = 'work' | 'short_break' | 'long_break';
export type AIActionType = 'create_task' | 'create_today_task' | 'create_milestone' | 'create_diary' | 'create_event' | 'update_task' | 'update_milestone' | 'configure_pomodoro';
export type AIProvider = 'deepseek_chat' | 'custom_chat';

export interface Project {
  id?: number;
  remoteProjectId?: string | null;
  name: string;
  description: string;
  color: string;
  icon: string;
  status: ProjectStatus;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id?: number;
  projectId: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  dueDate: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  milestoneId: number | null;
  estimatedMinutes: number | null;
  url: string;
  recurrence: RecurrenceRule;
  source: TaskSource;
  remindAt: string | null;
  isTodayTask: boolean;
  publishedAt: string | null;
  assigneeId?: string | null;
  dependencyIds?: number[];
  dependsOn?: number[];
  subtasks?: Subtask[];
  trackedMinutes?: number;
  pomodoroGoal?: number | null;
  sprintId?: number | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  remoteId?: string | null;
  syncUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const TASK_TEMPLATES = [
  { title: '修复缺陷', priority: 'high' as TaskPriority, tags: ['bug'], description: '' },
  { title: '开发新功能', priority: 'medium' as TaskPriority, tags: ['feature'], description: '' },
  { title: '代码评审', priority: 'medium' as TaskPriority, tags: ['review'], description: '' },
  { title: '补充文档', priority: 'low' as TaskPriority, tags: ['docs'], description: '' },
  { title: '性能优化', priority: 'medium' as TaskPriority, tags: ['optimization'], description: '' },
  { title: '重构模块', priority: 'medium' as TaskPriority, tags: ['refactor'], description: '' },
  { title: '补充测试', priority: 'medium' as TaskPriority, tags: ['test'], description: '' },
  { title: '发布上线', priority: 'high' as TaskPriority, tags: ['deploy'], description: '' },
];

export type MilestoneStatus = 'upcoming' | 'active' | 'completed';
export type MilestoneType = 'progress' | 'completion';

export interface Milestone {
  id?: number;
  projectId: number;
  title: string;
  description: string;
  dueDate: string | null;
  type: MilestoneType;
  progress: number;
  status: MilestoneStatus;
  taskIds: number[];
  createdBy?: string | null;
  updatedBy?: string | null;
  remoteId?: string | null;
  syncUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id?: number;
  projectId: number;
  title: string;
  description: string;
  type: EventType;
  date: string;
  relatedTaskId: number | null;
  createdAt: string;
  source?: 'manual' | 'system';
  sourceKey?: string | null;
}

export interface DiaryEntry {
  id?: number;
  projectId: number;
  date: string;
  content: string;
  mood: MoodType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type AchievementLevel = 'bronze' | 'silver' | 'gold';

export interface Achievement {
  id?: number;
  key: string;
  title: string;
  description: string;
  icon: string;
  level: AchievementLevel;
  unlockedAt: string | null;
}

export interface Sprint {
  id?: number;
  projectId: number;
  name: string;
  goal: string;
  status: 'planning' | 'active' | 'completed';
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id?: number;
  taskId: number;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface TeamMember {
  id?: number;
  userId: string;
  projectId: number;
  role: TeamRole;
  joinedAt: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  online?: boolean;
  lastSeenAt?: string | null;
}

export interface SyncState {
  lastSyncedAt: string | null;
  pendingChanges: number;
  syncStatus: SyncStatus;
}

export interface SyncChange {
  id?: number;
  entityType: SyncEntityType;
  entityId: number;
  projectId: number | null;
  remoteProjectId?: string | null;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  baseUpdatedAt: string | null;
  localUpdatedAt: string;
  conflict: boolean;
}

export interface CollaborationEvent {
  id?: number;
  projectId: number;
  remoteProjectId?: string | null;
  userId: string | null;
  userName: string;
  type: CollaborationEventType;
  targetType: SyncEntityType | 'members' | 'project';
  targetId: number | string | null;
  title: string;
  description: string;
  createdAt: string;
}

export interface InviteLink {
  id?: number;
  projectId: number;
  remoteProjectId: string;
  token: string;
  role: TeamRole;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface PomodoroConfig {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  dailyGoal: number;
  showMinutesOnly: boolean;
  soundEnabled: boolean;
  doNotDisturb: boolean;
  workDoneMessage: string;
  breakDoneMessage: string;
}

export interface PomodoroSession {
  id: string;
  date: string;
  phase: PomodoroPhase;
  completed: boolean;
  seconds: number;
  taskId?: number | null;
  taskTitle?: string;
  createdAt: string;
}

export interface NotificationSettings {
  enabled: boolean;
  permission: NotificationPermission | 'unsupported';
  taskBeforeDue: boolean;
  taskDue: boolean;
  todayTasks: boolean;
  pomodoroWorkDone: boolean;
  pomodoroBreakDone: boolean;
  leadMinutes: 15 | 30 | 60;
  dailyReminderTime: string;
  soundEnabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
}

export interface AICommandSettings {
  provider: AIProvider;
  apiKey: string;
  endpoint: string;
  model: string;
  reasoningEffort: 'off' | 'high' | 'max';
  autoSyncAfterExecute: boolean;
}

export interface AICommandAction {
  type: AIActionType;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  remindAt: string;
  estimatedMinutes: number;
  tags: string[];
  date: string;
  mood: MoodType;
  eventType: EventType;
  milestoneType: MilestoneType;
  targetStatus: TaskStatus;
  milestoneStatus: MilestoneStatus;
  url: string;
  plannedStartAt: string;
  plannedEndAt: string;
  relatedTaskId: string;
  /** v0.6.0: 子任务清单 */
  subtasks?: { id: string; title: string; done: boolean }[];
  /** v0.6.0: 实际追踪耗时（分钟） */
  trackedMinutes?: number;
  /** v0.6.0: 关联冲刺ID */
  sprintId?: string;
  /** 要更新的任务ID（用于 update_task） */
  taskId?: number | string;
  /** 番茄钟目标轮数 */
  pomodoroGoal?: number | null;
  /** 任务依赖ID列表 */
  dependencyIds?: number[];
}

export interface AICommandPlan {
  summary: string;
  confidence: number;
  actions: AICommandAction[];
}

export type NotificationType = 'task_due' | 'task_overdue' | 'member_joined' | 'member_role' | 'milestone_done' | 'project_shared' | 'comment';

export interface Notification {
  id?: number;
  title: string;
  description: string;
  type: NotificationType;
  read: boolean;
  targetUrl: string;
  projectId: number | null;
  createdAt: string;
}

export const ACHIEVEMENTS: Omit<Achievement, 'id' | 'unlockedAt'>[] = [
  { key: 'first_project', title: '启航', description: '创建第一个项目', icon: '🚀', level: 'bronze' },
  { key: 'first_task', title: '开始行动', description: '创建第一个任务', icon: '✅', level: 'bronze' },
  { key: 'first_done', title: '首次完成', description: '完成第一个任务', icon: '🏁', level: 'bronze' },
  { key: 'first_log', title: '记录者', description: '写下第一篇开发日志', icon: '📝', level: 'bronze' },
  { key: 'first_milestone', title: '里程碑达成', description: '完成第一个里程碑', icon: '🎯', level: 'bronze' },
  { key: 'ten_tasks', title: '高效执行', description: '累计完成 10 个任务', icon: '💯', level: 'bronze' },
  { key: 'all_priority', title: '全能选手', description: '处理过所有优先级的任务', icon: '🧠', level: 'bronze' },
  { key: 'streak_7', title: '稳定输出', description: '连续 7 天留下工作记录', icon: '🔥', level: 'bronze' },
  // Silver tier
  { key: 'streak_30', title: '连击大师', description: '连续 30 天打卡日记', icon: '🔥', level: 'silver' },
  { key: 'fifty_tasks', title: '批量交付', description: '累计完成 50 个任务', icon: '📦', level: 'silver' },
  { key: 'focus_50h', title: '深度修行', description: '累计专注 50 小时', icon: '🧘', level: 'silver' },
  { key: 'three_projects', title: '多面手', description: '同时管理 3 个活跃项目', icon: '🎯', level: 'silver' },
  { key: 'five_milestones', title: '里程碑收割机', description: '完成 5 个里程碑', icon: '🏆', level: 'silver' },
  { key: 'all_tags', title: '标签大师', description: '使用过 10 种不同的标签', icon: '🏷️', level: 'silver' },
  { key: 'est_accurate', title: '预估精准', description: '10 个任务实际工时在预估的 ±20% 内', icon: '🎯', level: 'silver' },
  { key: 'sprint_master', title: '冲刺达人', description: '完成第一个 Sprint', icon: '⚡', level: 'silver' },
  // Gold tier
  { key: 'streak_60', title: '连击王者', description: '连续 60 天打卡日记', icon: '👑', level: 'gold' },
  { key: 'hundred_tasks', title: '百战老将', description: '累计完成 100 个任务', icon: '💎', level: 'gold' },
  { key: 'focus_200h', title: '专注大师', description: '累计专注 200 小时', icon: '🧠', level: 'gold' },
  { key: 'five_projects', title: '项目将军', description: '同时管理 5 个活跃项目', icon: '🎖️', level: 'gold' },
  { key: 'twenty_milestones', title: '里程碑征服者', description: '完成 20 个里程碑', icon: '👑', level: 'gold' },
  { key: 'midnight_coder', title: '凌晨战神', description: '凌晨 0-5 点完成 20 个任务', icon: '🌙', level: 'gold' },
  { key: 'no_overdue_30', title: '零 Bug 传说', description: '连续 30 天无逾期任务', icon: '🛡️', level: 'gold' },
  { key: 'super_planner', title: '规划大师', description: '20 个任务都关联了里程碑', icon: '📋', level: 'gold' },
  { key: 'diary_100', title: '百篇日志', description: '累计写满 100 篇开发日志', icon: '📚', level: 'gold' },
  { key: 'collab_team', title: '团队核心', description: '邀请 3 位成员加入协作', icon: '🤝', level: 'gold' },
  { key: 'task_deps', title: '依赖管理者', description: '创建 10 条任务依赖关系', icon: '🔗', level: 'gold' },
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  review: '待评审',
  done: '已完成',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#64748b',
  in_progress: '#3b82f6',
  review: '#f59e0b',
  done: '#22c55e',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#64748b',
  medium: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  release: '发布',
  bugfix: '修复',
  milestone: '里程碑',
  decision: '决策',
  other: '其他',
};

export const MOOD_LABELS: Record<MoodType, string> = {
  great: '😄',
  good: '🙂',
  meh: '😐',
  bad: '😕',
  terrible: '😫',
};

export const MOOD_COLORS: Record<MoodType, string> = {
  great: '#22c55e',
  good: '#3b82f6',
  meh: '#94a3b8',
  bad: '#f59e0b',
  terrible: '#ef4444',
};

export const PROJECT_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
];

export const PROJECT_ICONS = ['📌', '🎯', '🛠️', '📦', '🧪', '🎨', '📈', '🗂️', '✍️', '📣'];

export const RECURRENCE_LABELS: Record<RecurrenceRule, string> = {
  none: '不循环',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
};

export const ACHIEVEMENT_LEVEL_LABELS: Record<AchievementLevel, string> = {
  bronze: '🥉 铜',
  silver: '🥈 银',
  gold: '🥇 金',
};

export const ACHIEVEMENT_LEVEL_COLORS: Record<AchievementLevel, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
};

export const SPRINT_STATUS_LABELS: Record<Sprint['status'], string> = {
  planning: '规划中',
  active: '进行中',
  completed: '已完成',
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  upcoming: '未开始',
  active: '进行中',
  completed: '已完成',
};
