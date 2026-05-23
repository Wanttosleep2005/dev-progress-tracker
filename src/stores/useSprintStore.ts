import { create } from 'zustand';
import type { Sprint } from '../types';
import { addSprint, db, deleteSprint, getSprintsByProject, updateSprint } from '../db/database';
import { useCloudStore } from './useCloudStore';
import { useToast } from './useToast';

interface SprintStore {
  sprints: Sprint[];
  loading: boolean;
  load: (projectId: number) => Promise<void>;
  add: (sprint: Omit<Sprint, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  update: (id: number, changes: Partial<Sprint>) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useSprintStore = create<SprintStore>((set) => ({
  sprints: [],
  loading: false,

  load: async (projectId) => {
    set({ loading: true });
    const sprints = await getSprintsByProject(projectId);
    set({ sprints, loading: false });
  },

  add: async (sprint) => {
    if (!useCloudStore.getState().canEdit(sprint.projectId)) {
      useToast.getState().add('你没有编辑该共享项目冲刺的权限。', 'warning');
      return;
    }
    await addSprint(sprint);
    const sprints = await getSprintsByProject(sprint.projectId);
    set({ sprints });
  },

  update: async (id, changes) => {
    const sprint = await db.sprints.get(id);
    if (!useCloudStore.getState().canEdit(sprint?.projectId ?? null)) {
      useToast.getState().add('你没有编辑该共享项目冲刺的权限。', 'warning');
      return;
    }
    await updateSprint(id, changes);
    set(state => ({
      sprints: state.sprints.map(s => (s.id === id ? { ...s, ...changes } : s)),
    }));
  },

  remove: async (id) => {
    const sprint = await db.sprints.get(id);
    if (!useCloudStore.getState().canEdit(sprint?.projectId ?? null)) {
      useToast.getState().add('你没有删除该共享项目冲刺的权限。', 'warning');
      return;
    }
    await deleteSprint(id);
    if (sprint) {
      const sprints = await getSprintsByProject(sprint.projectId);
      set({ sprints });
    }
  },
}));
