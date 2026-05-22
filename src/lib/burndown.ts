import type { Milestone, Task } from '../types';

export type BurndownRange = '7d' | '30d' | 'project';
export type BurndownMetric = 'tasks' | 'estimate';

function toDateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function buildBurndownData(
  tasks: Task[],
  milestones: Milestone[],
  options: {
    range: BurndownRange;
    metric: BurndownMetric;
    milestoneId?: number | null;
  }
) {
  const filteredTasks = options.milestoneId ? tasks.filter(task => task.milestoneId === options.milestoneId) : tasks;
  const dates = filteredTasks.flatMap(task => [task.createdAt, task.updatedAt, task.dueDate || '']).filter(Boolean);
  const projectStart = dates.length > 0 ? startOfDay(new Date(Math.min(...dates.map(date => new Date(date).getTime())))) : startOfDay(new Date());
  const end = startOfDay(new Date());
  const start = new Date(end);
  if (options.range === '7d') start.setDate(end.getDate() - 6);
  if (options.range === '30d') start.setDate(end.getDate() - 29);
  if (options.range === 'project') start.setTime(projectStart.getTime());

  const days: Date[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }

  const valueOf = (taskList: Task[]) =>
    options.metric === 'tasks'
      ? taskList.length
      : taskList.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);

  const total = valueOf(filteredTasks);
  const actual = days.map(day => {
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const remaining = filteredTasks.filter(task => {
      const created = new Date(task.createdAt).getTime();
      const updated = new Date(task.updatedAt).getTime();
      if (created > dayEnd.getTime()) return false;
      if (task.status === 'done' && updated <= dayEnd.getTime()) return false;
      return true;
    });
    return valueOf(remaining);
  });

  const ideal = days.map((_, index) => {
    if (days.length <= 1) return total;
    return Math.max(0, Math.round(total - (total * index) / (days.length - 1)));
  });

  const optimistic = ideal.map(value => Math.max(0, Math.round(value * 0.85)));
  const pessimistic = ideal.map(value => Math.round(value * 1.15));

  return {
    labels: days.map(day => `${day.getMonth() + 1}/${day.getDate()}`),
    datasets: [
      {
        label: '悲观预估',
        data: pessimistic,
        borderColor: 'rgba(148,163,184,0.25)',
        backgroundColor: 'rgba(148,163,184,0.10)',
        pointRadius: 0,
        fill: '+1',
        tension: 0.25,
      },
      {
        label: '乐观预估',
        data: optimistic,
        borderColor: 'rgba(148,163,184,0.20)',
        backgroundColor: 'rgba(34,211,238,0.08)',
        pointRadius: 0,
        fill: false,
        tension: 0.25,
      },
      {
        label: '理想线',
        data: ideal,
        borderColor: '#64748b',
        borderDash: [6, 6],
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: '实际剩余',
        data: actual,
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34,211,238,0.16)',
        pointRadius: 3,
        fill: false,
        tension: 0.3,
      },
    ],
    meta: {
      total,
      remaining: actual[actual.length - 1] ?? 0,
      completed: Math.max(0, total - (actual[actual.length - 1] ?? 0)),
      milestoneTitle: options.milestoneId ? milestones.find(milestone => milestone.id === options.milestoneId)?.title : '全部任务',
      unit: options.metric === 'tasks' ? '个任务' : '分钟预估',
      exportedAt: toDateKey(new Date()),
    },
  };
}
