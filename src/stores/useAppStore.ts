import { create } from 'zustand';
import type { Project, Achievement } from '../types';
import { ACHIEVEMENTS } from '../types';
import * as db from '../db/database';
import { recordProjectCreated, recordProjectDeadlineChanged } from '../lib/systemEvents';

interface AppStore {
  currentProjectId: number | null;
  projects: Project[];
  achievements: Achievement[];
  loading: boolean;

  loadProjects: () => Promise<void>;
  loadAchievements: () => Promise<void>;
  setCurrentProject: (id: number) => void;
  addProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>;
  updateProject: (id: number, changes: Partial<Project>) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
  checkAchievements: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentProjectId: null,
  projects: [],
  achievements: [],
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    const projects = await db.getAllProjects();
    const currentId = get().currentProjectId;
    set({
      projects,
      loading: false,
      currentProjectId: currentId ?? projects[0]?.id ?? null,
    });
  },

  loadAchievements: async () => {
    await db.seedAchievements(ACHIEVEMENTS);
    const achievements = await db.getAllAchievements();
    set({ achievements });
  },

  setCurrentProject: (id) => set({ currentProjectId: id }),

  addProject: async (p) => {
    const id = await db.addProject(p);
    await recordProjectCreated(id, p.name);
    await get().loadProjects();
    if (!get().currentProjectId) set({ currentProjectId: id });
    await get().checkAchievements();
    return id;
  },

  updateProject: async (id, changes) => {
    const existing = await db.getProject(id);
    await db.updateProject(id, changes);
    if (existing && 'deadline' in changes) {
      await recordProjectDeadlineChanged(existing, existing.deadline, changes.deadline ?? null);
    }
    await get().loadProjects();
  },

  deleteProject: async (id) => {
    await db.deleteProject(id);
    const projects = await db.getAllProjects();
    set({ projects, currentProjectId: projects[0]?.id ?? null });
  },

  checkAchievements: async () => {
    const { projects, achievements } = get();
    const tasks = get().currentProjectId
      ? await db.getTasksByProject(get().currentProjectId!)
      : [];
    const doneTasks = tasks.filter(t => t.status === 'done');

    const checks: Record<string, boolean> = {
      first_project: projects.length > 0,
      first_task: tasks.length > 0,
      first_done: doneTasks.length > 0,
      ten_tasks: doneTasks.length >= 10,
      all_priority: ['low', 'medium', 'high', 'urgent'].every(
        p => tasks.some(t => t.priority === p)
      ),
    };

    for (const [key, condition] of Object.entries(checks)) {
      if (condition) await db.unlockAchievement(key);
    }
    const updated = await db.getAllAchievements();
    set({ achievements: updated });
  },
}));
