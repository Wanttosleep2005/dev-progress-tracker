import { create } from 'zustand';
import type { AICommandPlan, AICommandSettings } from '../types';
import { defaultAICommandSettings, generateAICommandPlan } from '../lib/aiCommand';
import { useAppStore } from './useAppStore';
import { useTaskStore } from './useTaskStore';
import { useMilestoneStore } from './useMilestoneStore';
import { useDiaryStore } from './useDiaryStore';
import { useTimelineStore } from './useTimelineStore';
import { usePomodoroStore } from './usePomodoroStore';
import { useCloudStore } from './useCloudStore';

const STORAGE_KEY = 'devtrack-ai-command-settings';

function loadSettings(): AICommandSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    // 开发环境强制使用 Vite 代理路径，忽略 localStorage 中的旧端点
    if (import.meta.env.DEV) {
      return { ...defaultAICommandSettings, ...stored, endpoint: defaultAICommandSettings.endpoint, apiKey: '' };
    }
    return { ...defaultAICommandSettings, ...stored, apiKey: '' };
  } catch {
    return defaultAICommandSettings;
  }
}

function saveSettings(settings: AICommandSettings) {
  const { apiKey: _apiKey, ...safe } = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
}

interface AICommandStore {
  settings: AICommandSettings;
  prompt: string;
  plan: AICommandPlan | null;
  loading: boolean;
  executing: boolean;
  error: string;
  history: AICommandPlan[];
  updateSettings: (changes: Partial<AICommandSettings>) => void;
  setPrompt: (prompt: string) => void;
  generate: () => Promise<void>;
  execute: () => Promise<void>;
  clear: () => void;
}

export const useAICommandStore = create<AICommandStore>((set, get) => ({
  settings: loadSettings(),
  prompt: '',
  plan: null,
  loading: false,
  executing: false,
  error: '',
  history: [],

  updateSettings: (changes) => {
    const settings = { ...get().settings, ...changes };
    saveSettings(settings);
    set({ settings });
  },

  setPrompt: (prompt) => set({ prompt }),

  generate: async () => {
    const prompt = get().prompt.trim();
    if (!prompt) return;
    const { currentProjectId, projects } = useAppStore.getState();
    const project = projects.find(item => item.id === currentProjectId) || null;
    const tasks = useTaskStore.getState().tasks;
    set({ loading: true, error: '', plan: null });
    try {
      const plan = await generateAICommandPlan(prompt, get().settings, { project, tasks });
      set({ plan, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '指令生成失败', loading: false });
    }
  },

  execute: async () => {
    const plan = get().plan;
    const { currentProjectId } = useAppStore.getState();
    if (!plan || !currentProjectId) {
      set({ error: '请先选择项目并生成计划。' });
      return;
    }

    set({ executing: true, error: '' });
    try {
      for (const action of plan.actions) {
        if (action.type === 'create_task' || action.type === 'create_today_task') {
          const depIds = (action.dependencyIds || []).map(Number).filter(Boolean);
          await useTaskStore.getState().add({
            projectId: currentProjectId,
            title: action.title,
            description: action.description,
            status: action.targetStatus === 'done' ? 'todo' : action.targetStatus,
            priority: action.priority,
            tags: action.tags,
            dueDate: action.dueDate || null,
            plannedStartAt: action.plannedStartAt || null,
            plannedEndAt: action.plannedEndAt || action.dueDate || null,
            milestoneId: action.milestoneId ? Number(action.milestoneId) || null : action.relatedTaskId ? Number(action.relatedTaskId) || null : null,
            estimatedMinutes: action.estimatedMinutes || null,
            pomodoroGoal: action.pomodoroGoal ?? null,
            url: action.url || '',
            source: action.type === 'create_today_task' ? 'daily' : 'board',
            remindAt: action.type === 'create_today_task' ? action.remindAt || null : null,
            isTodayTask: action.type === 'create_today_task',
            publishedAt: action.type === 'create_today_task' ? new Date().toISOString() : null,
            assigneeId: null,
            dependsOn: depIds,
            subtasks: action.subtasks,
            createdBy: null,
            updatedBy: null,
            remoteId: null,
            syncUpdatedAt: null,
            recurrence: 'none',
          });
        }

        if (action.type === 'update_task') {
          const taskId = Number(action.taskId);
          if (taskId) {
            const changes: Record<string, unknown> = {};
            if (action.title) changes.title = action.title;
            if (action.description) changes.description = action.description;
            if (action.targetStatus) changes.status = action.targetStatus;
            if (action.priority) changes.priority = action.priority;
            if (action.dueDate) changes.dueDate = action.dueDate;
            if (action.estimatedMinutes !== undefined && action.estimatedMinutes !== 0) changes.estimatedMinutes = action.estimatedMinutes;
            if (action.pomodoroGoal !== undefined) changes.pomodoroGoal = action.pomodoroGoal;
            if (action.tags?.length) changes.tags = action.tags;
            if (action.subtasks) changes.subtasks = action.subtasks;
            if (action.dependencyIds !== undefined) {
              const ids = action.dependencyIds.map(Number).filter(Boolean);
              changes.dependsOn = ids;
            }
            if (action.milestoneId !== undefined) changes.milestoneId = Number(action.milestoneId) || null;
            else if (action.relatedTaskId) changes.milestoneId = Number(action.relatedTaskId) || null;
            await useTaskStore.getState().update(taskId, changes as Partial<import('../types').Task>);
          }
        }

        if (action.type === 'create_milestone') {
          await useMilestoneStore.getState().add({
            projectId: currentProjectId,
            title: action.title,
            description: action.description,
            dueDate: action.dueDate || null,
            type: action.milestoneType || 'progress',
            progress: 0,
            status: action.milestoneStatus || 'upcoming',
            taskIds: [],
            createdBy: null,
            updatedBy: null,
            remoteId: null,
            syncUpdatedAt: null,
          });
        }

        if (action.type === 'update_milestone') {
          const milestoneId = Number(action.milestoneId ?? action.taskId);
          if (milestoneId) {
            const changes: Record<string, unknown> = {};
            if (action.milestoneStatus) changes.status = action.milestoneStatus;
            if (action.title) changes.title = action.title;
            if (action.description) changes.description = action.description;
            if (action.dueDate) changes.dueDate = action.dueDate;
            await useMilestoneStore.getState().update(milestoneId, changes);
          }
        }

        if (action.type === 'create_diary') {
          await useDiaryStore.getState().upsert({
            projectId: currentProjectId,
            date: action.date || new Date().toISOString().split('T')[0],
            content: `# ${action.title}\n\n${action.description}`,
            mood: action.mood,
            tags: action.tags,
          });
        }

        if (action.type === 'create_event') {
          await useTimelineStore.getState().add({
            projectId: currentProjectId,
            title: action.title,
            description: action.description,
            type: action.eventType,
            date: action.date || new Date().toISOString().split('T')[0],
            endDate: action.endDate || null,
            relatedTaskId: Number(action.relatedTaskId) || null,
          });
        }

        if (action.type === 'configure_pomodoro') {
          const configPatch: Partial<{ workMinutes: number; shortBreakMinutes: number; longBreakMinutes: number; longBreakInterval: number; dailyGoal: number }> = {};
          if (action.estimatedMinutes > 0) configPatch.workMinutes = action.estimatedMinutes;
          for (const tag of action.tags) {
            if (tag.startsWith('goal:')) configPatch.dailyGoal = Math.max(1, Number(tag.replace('goal:', '')) || 1);
            if (tag.startsWith('work:')) configPatch.workMinutes = Number(tag.replace('work:', '')) || configPatch.workMinutes || 25;
            if (tag.startsWith('break_short:')) configPatch.shortBreakMinutes = Number(tag.replace('break_short:', '')) || 5;
            if (tag.startsWith('break_long:')) configPatch.longBreakMinutes = Number(tag.replace('break_long:', '')) || 15;
            if (tag.startsWith('interval:')) configPatch.longBreakInterval = Math.max(2, Number(tag.replace('interval:', '')) || 4);
          }
          if (Object.keys(configPatch).length > 0) {
            usePomodoroStore.getState().updateConfig(configPatch);
          }
        }
      }

      if (get().settings.autoSyncAfterExecute) {
        await useCloudStore.getState().syncNow();
      }

      set({ executing: false, history: [plan, ...get().history].slice(0, 10), plan: null, prompt: '' });
    } catch (error) {
      set({ executing: false, error: error instanceof Error ? error.message : '执行失败' });
    }
  },

  clear: () => set({ plan: null, error: '', prompt: '' }),
}));
