import * as db from '../db/database';
import type { Milestone, Project, Task, TimelineEvent } from '../types';

function todayString() {
  return new Date().toISOString().split('T')[0];
}

function truncate(text: string, max = 100) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

type EventInput = Omit<TimelineEvent, 'id' | 'createdAt'>;

async function ensureEvent(event: EventInput) {
  await db.ensureSystemEvent({
    ...event,
    source: 'system',
  });
}

export async function recordProjectCreated(projectId: number, projectName: string) {
  await ensureEvent({
    projectId,
    title: `项目已创建：${projectName}`,
    description: '系统已自动记录项目创建事件。',
    type: 'release',
    date: todayString(),
    relatedTaskId: null,
    sourceKey: `project:${projectId}:created`,
  });
}

export async function recordProjectDeadlineChanged(project: Project, previousDeadline: string | null | undefined, nextDeadline: string | null | undefined) {
  if (previousDeadline === nextDeadline) return;

  const description = nextDeadline
    ? `项目截止日期已调整为 ${nextDeadline}${previousDeadline ? `，原日期为 ${previousDeadline}` : ''}。`
    : `项目截止日期已被移除${previousDeadline ? `，原日期为 ${previousDeadline}` : ''}。`;

  await ensureEvent({
    projectId: project.id!,
    title: `项目计划更新：${project.name}`,
    description,
    type: 'decision',
    date: todayString(),
    relatedTaskId: null,
    sourceKey: `project:${project.id}:deadline:${nextDeadline ?? 'none'}`,
  });
}

export async function recordTaskCreated(task: Task) {
  await ensureEvent({
    projectId: task.projectId,
    title: `新任务加入：${task.title}`,
    description: task.description ? truncate(task.description) : '系统已自动记录任务创建事件。',
    type: task.priority === 'urgent' ? 'bugfix' : 'other',
    date: todayString(),
    relatedTaskId: task.id ?? null,
    sourceKey: `task:${task.id}:created`,
  });
}

export async function recordTaskStatusChanged(task: Task, previousStatus: Task['status'], nextStatus: Task['status']) {
  if (previousStatus === nextStatus || !task.id) return;

  let title = `任务状态更新：${task.title}`;
  let description = `状态从 ${previousStatus} 变更为 ${nextStatus}。`;
  let type: TimelineEvent['type'] = 'other';

  if (nextStatus === 'done') {
    title = `任务已完成：${task.title}`;
    description = task.description ? truncate(task.description) : '系统已自动记录任务完成事件。';
    type = 'release';
  } else if (nextStatus === 'review') {
    title = `任务进入评审：${task.title}`;
    type = 'decision';
  } else if (nextStatus === 'in_progress') {
    title = `任务开始推进：${task.title}`;
    type = 'other';
  }

  await ensureEvent({
    projectId: task.projectId,
    title,
    description,
    type,
    date: todayString(),
    relatedTaskId: task.id,
    sourceKey: `task:${task.id}:status:${nextStatus}:${todayString()}`,
  });
}

export async function recordMilestoneCreated(milestone: Milestone) {
  await ensureEvent({
    projectId: milestone.projectId,
    title: `新里程碑创建：${milestone.title}`,
    description: milestone.description ? truncate(milestone.description) : '系统已自动记录里程碑创建事件。',
    type: 'milestone',
    date: todayString(),
    relatedTaskId: null,
    sourceKey: `milestone:${milestone.id}:created`,
  });
}

export async function recordMilestoneCompleted(milestone: Milestone) {
  if (!milestone.id) return;

  await ensureEvent({
    projectId: milestone.projectId,
    title: `里程碑达成：${milestone.title}`,
    description: milestone.description ? truncate(milestone.description) : '系统已自动记录里程碑完成事件。',
    type: 'milestone',
    date: todayString(),
    relatedTaskId: null,
    sourceKey: `milestone:${milestone.id}:completed`,
  });
}
