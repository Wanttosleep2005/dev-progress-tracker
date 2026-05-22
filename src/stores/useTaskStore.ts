import { create } from 'zustand';
import type { Task, TaskStatus } from '../types';
import * as db from '../db/database';
import { useAppStore } from './useAppStore';
import { useMilestoneStore } from './useMilestoneStore';
import { recordTaskCreated, recordTaskStatusChanged } from '../lib/systemEvents';
import { refreshMilestonesForTaskChange } from '../lib/milestones';

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
    const now = new Date().toISOString();
    const id = await db.addTask(task);
    await recordTaskCreated({ ...task, id, createdAt: now, updatedAt: now });
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
    if (!task) {
      await db.updateTask(id, changes);
      return;
    }

    await db.updateTask(id, changes);

    if (changes.status && changes.status !== task.status) {
      await recordTaskStatusChanged({ ...task, ...changes }, task.status, changes.status);
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

    await db.updateTask(id, { status });
    await recordTaskStatusChanged({ ...task, status }, task.status, status);
    await refreshMilestonesForTaskChange(task.projectId, task.milestoneId, task.milestoneId);
    await useMilestoneStore.getState().load(task.projectId);
    await get().load(task.projectId);
    await useAppStore.getState().checkAchievements();
  },
}));
