import { create } from 'zustand';
import type { Project, Achievement } from '../types';
import { ACHIEVEMENTS } from '../types';
import * as db from '../db/database';
import { recordProjectCreated, recordProjectDeadlineChanged } from '../lib/systemEvents';
import { deleteRemoteProjectFromCloud, loadCloudSession } from '../lib/cloudSync';
import { useToast } from './useToast';

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
    const existing = await db.getProject(id);
    const session = loadCloudSession();
    if (existing?.remoteProjectId && session?.user) {
      const member = await db.db.teamMembers
        .where({ projectId: id, userId: session.user.id })
        .first();
      if (member?.role !== 'owner') {
        useToast.getState().add('只有项目所有者可以删除共享项目。', 'warning');
        return;
      }
    }
    if (session && existing?.remoteProjectId) {
      try {
        await deleteRemoteProjectFromCloud(session, existing.remoteProjectId);
      } catch {
        // Keep local deletion available; the queued sync delete will retry later.
      }
    }
    await db.deleteProject(id);
    const projects = await db.getAllProjects();
    set({ projects, currentProjectId: projects[0]?.id ?? null });
  },

  checkAchievements: async () => {
    const { projects, achievements } = get();
    const allTasks = await db.db.tasks.toArray();
    const doneTasks = allTasks.filter(t => t.status === 'done');
    const allMilestones = await db.db.milestones.toArray();
    const allDiaryEntries = await db.db.diaryEntries.toArray();
    const allSessionsStr = localStorage.getItem('devtrack-focus-sessions');
    const allSessions = allSessionsStr ? JSON.parse(allSessionsStr) : [];
    const totalFocusMinutes = allSessions.reduce((sum: number, s: any) => sum + (s.seconds || 0) / 60, 0);

    // Count diary streak
    const dates = new Set(allDiaryEntries.map(e => e.date));
    let streak = 0;
    const d = new Date();
    while (dates.has(d.toISOString().split('T')[0])) { streak++; d.setDate(d.getDate() - 1); }

    // Count unique tags
    const allTags = new Set<string>();
    allTasks.forEach(t => t.tags.forEach(tag => allTags.add(tag)));
    allDiaryEntries.forEach(e => e.tags.forEach(tag => allTags.add(tag)));

    // Priority coverage
    const priorityCoverage = ['low', 'medium', 'high', 'urgent'].every(p => allTasks.some(t => t.priority === p));

    // Midnight tasks (0-5 AM)
    const midnightTasks = doneTasks.filter(t => {
      const h = new Date(t.createdAt).getHours();
      return h >= 0 && h < 5;
    });

    // Est accuracy: actual within ±20% of estimate for 10 tasks
    const estAccurateTasks = doneTasks.filter(t => {
      if (!t.estimatedMinutes || !t.trackedMinutes) return false;
      const ratio = t.trackedMinutes / t.estimatedMinutes;
      return ratio >= 0.8 && ratio <= 1.2;
    });

    // Tasks with milestone
    const milestoneTasks = allTasks.filter(t => t.milestoneId);

    // Dependency edges count
    const depCount = allTasks.reduce((sum, t) => sum + (t.dependsOn?.length || 0), 0);

    // No overdue for 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const hasOverdueIn30Days = allTasks.some(t => {
      if (!t.dueDate || t.status === 'done') return false;
      return new Date(t.dueDate) < now && new Date(t.dueDate) > thirtyDaysAgo;
    });

    // Active projects count
    const activeProjects = projects.filter(p => p.status === 'active').length;

    // Members count (from collaboration)
    const members = await db.db.teamMembers.toArray();

    const checks: Record<string, boolean> = {
      first_project: projects.length > 0,
      first_task: allTasks.length > 0,
      first_done: doneTasks.length > 0,
      first_log: allDiaryEntries.length > 0,
      first_milestone: allMilestones.some(m => m.status === 'completed'),
      ten_tasks: doneTasks.length >= 10,
      all_priority: priorityCoverage,
      streak_7: streak >= 7,
      // Silver
      streak_30: streak >= 30,
      fifty_tasks: doneTasks.length >= 50,
      focus_50h: totalFocusMinutes >= 3000,
      three_projects: activeProjects >= 3,
      five_milestones: allMilestones.filter(m => m.status === 'completed').length >= 5,
      all_tags: allTags.size >= 10,
      est_accurate: estAccurateTasks.length >= 10,
      // Gold
      streak_60: streak >= 60,
      hundred_tasks: doneTasks.length >= 100,
      focus_200h: totalFocusMinutes >= 12000,
      five_projects: activeProjects >= 5,
      twenty_milestones: allMilestones.filter(m => m.status === 'completed').length >= 20,
      midnight_coder: midnightTasks.length >= 20,
      no_overdue_30: !hasOverdueIn30Days && allTasks.length > 0,
      super_planner: milestoneTasks.length >= 20,
      diary_100: allDiaryEntries.length >= 100,
      collab_team: members.length >= 3,
      task_deps: depCount >= 10,
    };

    for (const [key, condition] of Object.entries(checks)) {
      if (condition) await db.unlockAchievement(key);
    }
    const updated = await db.getAllAchievements();
    set({ achievements: updated });
  },
}));
