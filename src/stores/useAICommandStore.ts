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
          await useTaskStore.getState().add({
            projectId: currentProjectId,
            title: action.title,
            description: action.description,
            status: action.targetStatus === 'done' ? 'todo' : action.targetStatus,
            priority: action.priority,
            tags: action.tags,
            dueDate: action.dueDate || null,
            plannedStartAt: null,
            plannedEndAt: action.dueDate || null,
            milestoneId: null,
            estimatedMinutes: action.estimatedMinutes || null,
            url: '',
            source: action.type === 'create_today_task' ? 'daily' : 'board',
            remindAt: action.type === 'create_today_task' ? action.remindAt || null : null,
            isTodayTask: action.type === 'create_today_task',
            publishedAt: action.type === 'create_today_task' ? new Date().toISOString() : null,
            assigneeId: null,
            dependencyIds: [],
            dependsOn: [],
            createdBy: null,
            updatedBy: null,
            remoteId: null,
            syncUpdatedAt: null,
          });
        }

        if (action.type === 'create_milestone') {
          await useMilestoneStore.getState().add({
            projectId: currentProjectId,
            title: action.title,
            description: action.description,
            dueDate: action.dueDate || null,
            type: action.milestoneType,
            progress: 0,
            status: 'upcoming',
            taskIds: [],
            createdBy: null,
            updatedBy: null,
            remoteId: null,
            syncUpdatedAt: null,
          });
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
            relatedTaskId: null,
          });
        }

        if (action.type === 'configure_pomodoro') {
          usePomodoroStore.getState().updateConfig({
            workMinutes: action.estimatedMinutes > 0 ? action.estimatedMinutes : usePomodoroStore.getState().config.workMinutes,
            dailyGoal: Math.max(1, action.tags.find(tag => tag.startsWith('goal:')) ? Number(action.tags.find(tag => tag.startsWith('goal:'))?.replace('goal:', '')) || 1 : usePomodoroStore.getState().config.dailyGoal),
          });
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
