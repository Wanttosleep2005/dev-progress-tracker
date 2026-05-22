import { create } from 'zustand';
import type { Milestone } from '../types';
import * as db from '../db/database';
import { useAppStore } from './useAppStore';
import { useCloudStore } from './useCloudStore';
import { useToast } from './useToast';
import { recordMilestoneCompleted, recordMilestoneCreated } from '../lib/systemEvents';
import { refreshAllMilestonesByProject, refreshMilestoneProgress } from '../lib/milestones';

interface MilestoneStore {
  milestones: Milestone[];
  loading: boolean;
  load: (projectId: number) => Promise<void>;
  add: (milestone: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>;
  update: (id: number, changes: Partial<Milestone>) => Promise<void>;
  remove: (id: number) => Promise<void>;
  refresh: (projectId: number, milestoneId?: number) => Promise<void>;
}

export const useMilestoneStore = create<MilestoneStore>((set, get) => ({
  milestones: [],
  loading: false,

  load: async (projectId) => {
    set({ loading: true });
    const milestones = await db.getMilestonesByProject(projectId);
    set({ milestones, loading: false });
  },

  add: async (milestone) => {
    if (!useCloudStore.getState().canOwn(milestone.projectId)) {
      useToast.getState().add('只有项目所有者可以创建里程碑。', 'warning');
      return 0;
    }
    const now = new Date().toISOString();
    const id = await db.addMilestone(milestone);
    await recordMilestoneCreated({ ...milestone, id, createdAt: now, updatedAt: now });
    if (milestone.type === 'progress') {
      await refreshMilestoneProgress(milestone.projectId, id);
    }
    await get().load(milestone.projectId);
    await useAppStore.getState().checkAchievements();
    return id;
  },

  update: async (id, changes) => {
    const milestone = get().milestones.find(item => item.id === id);
    if (!useCloudStore.getState().canOwn(milestone?.projectId ?? null)) {
      useToast.getState().add('只有项目所有者可以修改里程碑。', 'warning');
      return;
    }
    await db.updateMilestone(id, changes);
    if (milestone) {
      if ((changes.type ?? milestone.type) === 'progress') {
        await refreshMilestoneProgress(milestone.projectId, id);
      }
      await get().load(milestone.projectId);
    }
    if (changes.status === 'completed' && milestone) {
      await recordMilestoneCompleted({ ...milestone, ...changes });
      await useAppStore.getState().checkAchievements();
    }
  },

  remove: async (id) => {
    const milestone = get().milestones.find(item => item.id === id);
    if (!useCloudStore.getState().canOwn(milestone?.projectId ?? null)) {
      useToast.getState().add('只有项目所有者可以删除里程碑。', 'warning');
      return;
    }
    await db.deleteMilestone(id);
    if (milestone) {
      await get().load(milestone.projectId);
    }
  },

  refresh: async (projectId, milestoneId) => {
    if (milestoneId) {
      await refreshMilestoneProgress(projectId, milestoneId);
    } else {
      await refreshAllMilestonesByProject(projectId);
    }
    await get().load(projectId);
  },
}));
