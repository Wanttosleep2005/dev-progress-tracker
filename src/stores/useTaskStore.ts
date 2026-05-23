import { create } from 'zustand';
import type { RecurrenceRule, Task, TaskStatus } from '../types';
import * as db from '../db/database';
import { useAppStore } from './useAppStore';
import { useMilestoneStore } from './useMilestoneStore';
import { useCloudStore } from './useCloudStore';
import { useToast } from './useToast';
import { recordTaskCreated, recordTaskStatusChanged } from '../lib/systemEvents';
import { refreshMilestonesForTaskChange } from '../lib/milestones';
import { getBlockingTasks } from '../lib/taskDependencies';
import { recordCollaborationEvent } from '../lib/cloudSync';
import { useNotificationCenterStore } from './useNotificationCenterStore';

function nextDueDate(recurrence: RecurrenceRule, currentDueDate: string | null): string | null {
  if (recurrence === 'none' || !currentDueDate) return null;
  const base = new Date(currentDueDate);
  if (isNaN(base.getTime())) return null;
  switch (recurrence) {
    case 'daily': base.setDate(base.getDate() + 1); break;
    case 'weekly': base.setDate(base.getDate() + 7); break;
    case 'monthly': base.setMonth(base.getMonth() + 1); break;
  }
  return base.toISOString().slice(0, 16);
}

async function generateNextRecurringTask(task: Task) {
  if (!task.recurrence || task.recurrence === 'none') return;
  const nextDue = nextDueDate(task.recurrence, task.dueDate);
  const now = new Date().toISOString();
  const nextTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: 'todo',
    priority: task.priority,
    tags: task.tags,
    dueDate: nextDue,
    plannedStartAt: null,
    plannedEndAt: null,
    milestoneId: task.milestoneId,
    estimatedMinutes: task.estimatedMinutes,
    url: task.url,
    recurrence: task.recurrence,
    source: 'board',
    remindAt: null,
    isTodayTask: false,
    publishedAt: null,
    dependencyIds: task.dependencyIds ?? [],
    dependsOn: task.dependsOn ?? [],
    assigneeId: task.assigneeId,
    createdBy: task.createdBy,
    updatedBy: task.updatedBy,
    remoteId: null,
    syncUpdatedAt: now,
  };
  await db.addTask(nextTask);
}

interface TaskStore {
  tasks: Task[];
  loading: boolean;
  load: (projectId: number) => Promise<void>;
  add: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>;
  update: (id: number, changes: Partial<Task>) => Promise<void>;
  remove: (id: number) => Promise<void>;
  moveStatus: (id: number, status: TaskStatus) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,

  load: async (projectId) => {
    set({ loading: true });
    const tasks = await db.getTasksByProject(projectId);
    set({ tasks, loading: false });
  },

  add: async (task) => {
    if (!useCloudStore.getState().canEdit(task.projectId)) {
      useToast.getState().add('你没有编辑该共享项目的权限。', 'warning');
      return 0;
    }
    const now = new Date().toISOString();
    const normalizedTask = { ...task, dependsOn: task.dependsOn ?? task.dependencyIds ?? [], dependencyIds: task.dependencyIds ?? task.dependsOn ?? [] };
    const id = await db.addTask(normalizedTask);
    await recordTaskCreated({ ...normalizedTask, id, createdAt: now, updatedAt: now });
    const user = useCloudStore.getState().user;
    await recordCollaborationEvent({
      projectId: task.projectId,
      remoteProjectId: useAppStore.getState().projects.find(project => project.id === task.projectId)?.remoteProjectId ?? null,
      userId: user?.id ?? null,
      userName: user?.displayName ?? '本地用户',
      type: 'task_created',
      targetType: 'tasks',
      targetId: id,
      title: `创建了任务「${task.title}」`,
      description: `${user?.displayName ?? '本地用户'} 创建了任务「${task.title}」`,
    });
    if (task.milestoneId) {
      await refreshMilestonesForTaskChange(task.projectId, null, task.milestoneId);
      await useMilestoneStore.getState().load(task.projectId);
    }
    await get().load(task.projectId);
    await useAppStore.getState().checkAchievements();
    return id;
  },

  update: async (id, changes) => {
    const task = get().tasks.find(item => item.id === id);
    const projectId = task?.projectId ?? changes.projectId ?? null;
    if (!useCloudStore.getState().canEdit(projectId)) {
      useToast.getState().add('你没有编辑该共享项目的权限。', 'warning');
      return;
    }
    if (!task) {
      await db.updateTask(id, changes);
      return;
    }
    if (changes.status === 'in_progress') {
      const blockingTasks = getBlockingTasks({ ...task, ...changes }, get().tasks);
      if (blockingTasks.length > 0) {
        useToast.getState().add(`依赖任务未完成：${blockingTasks.map(item => item.title).join('、')}`, 'warning');
        return;
      }
    }

    const normalizedChanges = changes.dependsOn
      ? { ...changes, dependencyIds: changes.dependsOn }
      : changes.dependencyIds
        ? { ...changes, dependsOn: changes.dependencyIds }
        : changes;
    const prevTask = { ...task };
    set(state => ({ tasks: state.tasks.map(t => t.id === id ? { ...t, ...normalizedChanges } : t) }));

    try {
      await db.updateTask(id, normalizedChanges);
    } catch {
      set(state => ({ tasks: state.tasks.map(t => t.id === id ? prevTask : t) }));
      return;
    }

    if (changes.status && changes.status !== prevTask.status) {
      recordTaskStatusChanged({ ...task, ...changes }, prevTask.status, changes.status).catch(() => {});
      if (changes.status === 'done') {
        const user = useCloudStore.getState().user;
        recordCollaborationEvent({
          projectId: task.projectId,
          remoteProjectId: useAppStore.getState().projects.find(project => project.id === task.projectId)?.remoteProjectId ?? null,
          userId: user?.id ?? null,
          userName: user?.displayName ?? '本地用户',
          type: 'task_completed',
          targetType: 'tasks',
          targetId: id,
          title: `完成了任务「${task.title}」`,
          description: `${user?.displayName ?? '本地用户'} 完成了任务「${task.title}」`,
        }).catch(() => {});
        generateNextRecurringTask({ ...task, ...changes }).catch(() => {});
        useNotificationCenterStore.getState().add('milestone_done', '任务已完成', `「${task.title}」已标记为完成`, '/tasks', task.projectId);
      }
    }

    const nextMilestoneId = changes.milestoneId ?? task.milestoneId;
    const milestoneChanged = Object.prototype.hasOwnProperty.call(changes, 'milestoneId') && changes.milestoneId !== task.milestoneId;
    const statusChanged = changes.status && changes.status !== prevTask.status;

    if (milestoneChanged || statusChanged) {
      refreshMilestonesForTaskChange(task.projectId, task.milestoneId, nextMilestoneId)
        .then(() => useMilestoneStore.getState().load(task.projectId))
        .catch(() => {});
    }
    useAppStore.getState().checkAchievements().catch(() => {});
  },

  remove: async (id) => {
    const task = get().tasks.find(item => item.id === id);
    if (!useCloudStore.getState().canEdit(task?.projectId ?? null)) {
      useToast.getState().add('你没有删除该共享项目任务的权限。', 'warning');
      return;
    }
    await db.deleteTask(id);
    if (task) {
      await refreshMilestonesForTaskChange(task.projectId, task.milestoneId, null);
      await useMilestoneStore.getState().load(task.projectId);
      await get().load(task.projectId);
    }
  },

  moveStatus: async (id, status) => {
    const task = get().tasks.find(item => item.id === id);
    if (!task || task.status === status) return;
    if (!useCloudStore.getState().canEdit(task.projectId)) {
      useToast.getState().add('你没有编辑该共享项目的权限。', 'warning');
      return;
    }
    if (status === 'in_progress') {
      const blockingTasks = getBlockingTasks(task, get().tasks);
      if (blockingTasks.length > 0) {
        useToast.getState().add(`依赖任务未完成：${blockingTasks.map(item => item.title).join('、')}`, 'warning');
        return;
      }
    }

    set(state => ({ tasks: state.tasks.map(t => t.id === id ? { ...t, status } : t) }));
    try {
      await db.updateTask(id, { status });
    } catch {
      set(state => ({ tasks: state.tasks.map(t => t.id === id ? { ...t, status: task.status } : t) }));
      return;
    }
    recordTaskStatusChanged({ ...task, status }, task.status, status).catch(() => {});
    if (status === 'done') {
      const user = useCloudStore.getState().user;
      recordCollaborationEvent({
        projectId: task.projectId,
        remoteProjectId: useAppStore.getState().projects.find(project => project.id === task.projectId)?.remoteProjectId ?? null,
        userId: user?.id ?? null,
        userName: user?.displayName ?? '本地用户',
        type: 'task_completed',
        targetType: 'tasks',
        targetId: id,
        title: `完成了任务「${task.title}」`,
        description: `${user?.displayName ?? '本地用户'} 完成了任务「${task.title}」`,
      }).catch(() => {});
      generateNextRecurringTask({ ...task, status }).catch(() => {});
      useNotificationCenterStore.getState().add('milestone_done', '任务已完成', `「${task.title}」已标记为完成`, '/tasks', task.projectId);
    }
    refreshMilestonesForTaskChange(task.projectId, task.milestoneId, task.milestoneId)
      .then(() => useMilestoneStore.getState().load(task.projectId))
      .catch(() => {});
    useAppStore.getState().checkAchievements().catch(() => {});
  },
}));
