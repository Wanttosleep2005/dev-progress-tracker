export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
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

export interface Project {
  id?: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  status: ProjectStatus;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
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
  source: TaskSource;
  remindAt: string | null;
  isTodayTask: boolean;
  publishedAt: string | null;
  assigneeId?: string | null;
  dependencyIds?: number[];
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

export interface Achievement {
  id?: number;
  key: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
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
  operation: SyncOperation;
  payload: Record<string, unknown>;
  baseUpdatedAt: string | null;
  localUpdatedAt: string;
  conflict: boolean;
}

export interface CollaborationEvent {
  id?: number;
  projectId: number;
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

export const ACHIEVEMENTS: Omit<Achievement, 'id' | 'unlockedAt'>[] = [
  { key: 'first_project', title: '启航', description: '创建第一个项目', icon: '🚀' },
  { key: 'first_task', title: '开始行动', description: '创建第一个任务', icon: '✅' },
  { key: 'first_done', title: '首次完成', description: '完成第一个任务', icon: '🏁' },
  { key: 'first_log', title: '记录者', description: '写下第一篇开发日志', icon: '📝' },
  { key: 'first_milestone', title: '里程碑达成', description: '完成第一个里程碑', icon: '🎯' },
  { key: 'ten_tasks', title: '高效执行', description: '累计完成 10 个任务', icon: '💯' },
  { key: 'all_priority', title: '全能选手', description: '处理过所有优先级的任务', icon: '🧠' },
  { key: 'streak_7', title: '稳定输出', description: '连续 7 天留下工作记录', icon: '🔥' },
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

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  upcoming: '未开始',
  active: '进行中',
  completed: '已完成',
};
