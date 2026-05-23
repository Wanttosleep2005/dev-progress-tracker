import type { Task } from '../types';

export function getTaskDependencyIds(task: Task): number[] {
  const legacyIds = (task as Task & { dependencyIds?: number[] }).dependencyIds ?? [];
  return [...new Set([...(task.dependsOn ?? []), ...legacyIds])].filter(id => Number.isFinite(id));
}

export function getTaskDependencies(task: Task, tasks: Task[]): Task[] {
  const ids = new Set(getTaskDependencyIds(task));
  return tasks.filter(item => item.id && ids.has(item.id));
}

export function getDependentTasks(task: Task, tasks: Task[]): Task[] {
  if (!task.id) return [];
  return tasks.filter(item => getTaskDependencyIds(item).includes(task.id!));
}

export function isTaskBlocked(task: Task, tasks: Task[]): boolean {
  return getTaskDependencies(task, tasks).some(item => item.status !== 'done');
}

export function getBlockingTasks(task: Task, tasks: Task[]): Task[] {
  return getTaskDependencies(task, tasks).filter(item => item.status !== 'done');
}

export function normalizeDependencyIds(ids: number[], taskId?: number): number[] {
  return [...new Set(ids)].filter(id => id > 0 && id !== taskId);
}
