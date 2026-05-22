import { create } from 'zustand';
import type { Task, TaskStatus } from '../types';
import * as db from '../db/database';
import { useAppStore } from './useAppStore';
import { useMilestoneStore } from './useMilestoneStore';
import { useCloudStore } from './useCloudStore';
import { useToast } from './useToast';
import { recordTaskCreated, recordTaskStatusChanged } from '../lib/systemEvents';
import { refreshMilestonesForTaskChange } from '../lib/milestones';
import { getBlockingTasks } from '../lib/taskDependencies';
import { recordCollaborationEvent } from '../lib/cloudSync';

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
    await db.updateTask(id, normalizedChanges);

    if (changes.status && changes.status !== task.status) {
      await recordTaskStatusChanged({ ...task, ...changes }, task.status, changes.status);
      if (changes.status === 'done') {
        const user = useCloudStore.getState().user;
        await recordCollaborationEvent({
          projectId: task.projectId,
          remoteProjectId: useAppStore.getState().projects.find(project => project.id === task.projectId)?.remoteProjectId ?? null,
          userId: user?.id ?? null,
          userName: user?.displayName ?? '本地用户',
          type: 'task_completed',
          targetType: 'tasks',
          targetId: id,
          title: `完成了任务「${task.title}」`,
          description: `${user?.displayName ?? '本地用户'} 完成了任务「${task.title}」`,
        });
      }
    }

    const nextMilestoneId = changes.milestoneId ?? task.milestoneId;
    const milestoneChanged = Object.prototype.hasOwnProperty.call(changes, 'milestoneId') && changes.milestoneId !== task.milestoneId;
    const statusChanged = changes.status && changes.status !== task.status;

    if (milestoneChanged || statusChanged) {
      await refreshMilestonesForTaskChange(task.projectId, task.milestoneId, nextMilestoneId);
      await useMilestoneStore.getState().load(task.projectId);
    }

    await get().load(task.projectId);
    await useAppStore.getState().checkAchievements();
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

    await db.updateTask(id, { status });
    await recordTaskStatusChanged({ ...task, status }, task.status, status);
    if (status === 'done') {
      const user = useCloudStore.getState().user;
      await recordCollaborationEvent({
        projectId: task.projectId,
        remoteProjectId: useAppStore.getState().projects.find(project => project.id === task.projectId)?.remoteProjectId ?? null,
        userId: user?.id ?? null,
        userName: user?.displayName ?? '本地用户',
        type: 'task_completed',
        targetType: 'tasks',
        targetId: id,
        title: `完成了任务「${task.title}」`,
        description: `${user?.displayName ?? '本地用户'} 完成了任务「${task.title}」`,
      });
    }
    await refreshMilestonesForTaskChange(task.projectId, task.milestoneId, task.milestoneId);
    await useMilestoneStore.getState().load(task.projectId);
    await get().load(task.projectId);
    await useAppStore.getState().checkAchievements();
  },
}));
