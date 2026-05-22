import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { DiaryEntry, Milestone, Project, Task } from '../types';
import type { FocusSession } from '../stores/useStatsStore';

export type RiskLevel = 'low' | 'medium' | 'high';
export type RiskKind =
  | 'urgent_due'
  | 'milestone_stalled'
  | 'deadline_pressure'
  | 'low_focus'
  | 'mood_drop';

export interface RiskAlert {
  id: string;
  kind: RiskKind;
  level: RiskLevel;
  title: string;
  description: string;
  projectId: number;
}

export function formatRiskToast(alert: RiskAlert) {
  return `${alert.title}: ${alert.description}`;
}

const levelWeight: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function toDateOnly(value?: string | null) {
  return value ? parseISO(value) : null;
}

function isRecent(dateString: string, days: number) {
  const date = parseISO(dateString);
  return differenceInCalendarDays(new Date(), date) <= days;
}

function getProjectSessions(sessions: FocusSession[], projectId: number) {
  return sessions.filter(session => session.projectId === projectId);
}

export function analyzeProjectRisk(input: {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  diaryEntries: DiaryEntry[];
  sessions: FocusSession[];
}): RiskAlert[] {
  const { project, tasks, milestones, diaryEntries, sessions } = input;
  const alerts: RiskAlert[] = [];
  const now = new Date();

  const urgentSoon = tasks.filter(task => {
    if (task.status === 'done' || task.priority !== 'urgent' || !task.dueDate) return false;
    const dueDate = toDateOnly(task.dueDate);
    return dueDate ? differenceInCalendarDays(dueDate, now) <= 2 : false;
  });

  if (urgentSoon.length > 0) {
    alerts.push({
      id: `urgent:${project.id}`,
      kind: 'urgent_due',
      level: urgentSoon.length >= 3 ? 'high' : 'medium',
      title: '紧急任务临期',
      description: `${urgentSoon.length} 个紧急任务即将到期，建议优先处理。`,
      projectId: project.id!,
    });
  }

  const deadline = toDateOnly(project.deadline);
  const remainingTasks = tasks.filter(task => task.status !== 'done').length;
  if (deadline && remainingTasks > 0) {
    const daysLeft = differenceInCalendarDays(deadline, now);
    if (daysLeft <= 7) {
      alerts.push({
        id: `deadline:${project.id}`,
        kind: 'deadline_pressure',
        level: daysLeft <= 3 ? 'high' : 'medium',
        title: '项目截止压力',
        description:
          daysLeft < 0
            ? `项目已逾期，当前仍有 ${remainingTasks} 个任务未完成。`
            : `距离截止仅剩 ${daysLeft} 天，当前仍有 ${remainingTasks} 个任务未完成。`,
        projectId: project.id!,
      });
    }
  }

  const stalledMilestones = milestones.filter(milestone => {
    if (milestone.status === 'completed') return false;
    const relatedTasks = tasks.filter(task => task.milestoneId === milestone.id);
    if (relatedTasks.length === 0) return false;
    return relatedTasks.every(task => !isRecent(task.updatedAt, 3));
  });

  if (stalledMilestones.length > 0) {
    alerts.push({
      id: `milestone:${project.id}`,
      kind: 'milestone_stalled',
      level: stalledMilestones.length >= 2 ? 'high' : 'medium',
      title: '里程碑推进停滞',
      description: `${stalledMilestones.length} 个里程碑关联任务近 3 天没有明显推进。`,
      projectId: project.id!,
    });
  }

  const recentSessions = getProjectSessions(sessions, project.id!).filter(session => isRecent(session.date, 3));
  const totalRecentMinutes = recentSessions.reduce((sum, session) => sum + session.minutes, 0);
  const activeTasks = tasks.filter(task => task.status === 'in_progress').length;
  if (activeTasks >= 3 && totalRecentMinutes < 60) {
    alerts.push({
      id: `focus:${project.id}`,
      kind: 'low_focus',
      level: 'medium',
      title: '专注投入偏低',
      description: `当前有 ${activeTasks} 个进行中任务，但最近 3 天仅记录 ${totalRecentMinutes} 分钟专注时长。`,
      projectId: project.id!,
    });
  }

  const recentMoodEntries = diaryEntries
    .filter(entry => isRecent(entry.date, 3))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  if (
    recentMoodEntries.length >= 2 &&
    recentMoodEntries.every(entry => entry.mood === 'bad' || entry.mood === 'terrible')
  ) {
    alerts.push({
      id: `mood:${project.id}`,
      kind: 'mood_drop',
      level: 'medium',
      title: '状态波动明显',
      description: '最近几条开发日志情绪偏低，建议重新评估任务压力和节奏安排。',
      projectId: project.id!,
    });
  }

  return alerts.sort((a, b) => levelWeight[b.level] - levelWeight[a.level]);
}

export function getProjectHealthScore(alerts: RiskAlert[], tasks: Task[], milestones: Milestone[]) {
  const doneTasks = tasks.filter(task => task.status === 'done').length;
  const totalTasks = tasks.length;
  const progressScore = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;
  const completedMilestones = milestones.filter(milestone => milestone.status === 'completed').length;
  const milestoneScore = milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 100;
  const riskPenalty = alerts.reduce((sum, alert) => sum + levelWeight[alert.level] * 8, 0);
  return Math.max(0, Math.min(100, Math.round(progressScore * 0.55 + milestoneScore * 0.45 - riskPenalty)));
}

export function summarizeRiskLevel(alerts: RiskAlert[]): RiskLevel {
  if (alerts.some(alert => alert.level === 'high')) return 'high';
  if (alerts.some(alert => alert.level === 'medium')) return 'medium';
  return 'low';
}
