import { create } from 'zustand';
import type { PomodoroConfig, PomodoroPhase, PomodoroSession } from '../types';
import { useAppStore } from './useAppStore';
import { useNotificationStore } from './useNotificationStore';
import { useStatsStore } from './useStatsStore';

const CONFIG_KEY = 'devtrack-pomodoro-config';
const SESSIONS_KEY = 'devtrack-pomodoro-sessions';

const defaultConfig: PomodoroConfig = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  dailyGoal: 8,
  showMinutesOnly: false,
  soundEnabled: true,
  doNotDisturb: false,
  workDoneMessage: '工作时段结束，该休息了！',
  breakDoneMessage: '休息结束，准备开始新番茄！',
};

function loadConfig(): PomodoroConfig {
  try {
    return { ...defaultConfig, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') };
  } catch {
    return defaultConfig;
  }
}

function saveConfig(config: PomodoroConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function loadSessions(): PomodoroSession[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: PomodoroSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function phaseMinutes(phase: PomodoroPhase, config: PomodoroConfig) {
  if (phase === 'work') return config.workMinutes;
  if (phase === 'short_break') return config.shortBreakMinutes;
  return config.longBreakMinutes;
}

interface PomodoroStore {
  config: PomodoroConfig;
  sessions: PomodoroSession[];
  phase: PomodoroPhase;
  state: 'idle' | 'running' | 'paused';
  remainingSeconds: number;
  cycleCount: number;
  taskId: number | null;
  taskTitle: string;
  updateConfig: (changes: Partial<PomodoroConfig>) => void;
  start: (taskTitle?: string, taskId?: number | null) => void;
  pause: () => void;
  resume: () => void;
  stop: (completed?: boolean) => void;
  skipToNext: () => void;
  tick: () => void;
}

export const usePomodoroStore = create<PomodoroStore>((set, get) => ({
  config: loadConfig(),
  sessions: loadSessions(),
  phase: 'work',
  state: 'idle',
  remainingSeconds: loadConfig().workMinutes * 60,
  cycleCount: 0,
  taskId: null,
  taskTitle: '',

  updateConfig: (changes) => {
    const config = { ...get().config, ...changes };
    saveConfig(config);
    set({
      config,
      remainingSeconds: get().state === 'idle' ? phaseMinutes(get().phase, config) * 60 : get().remainingSeconds,
    });
  },

  start: (taskTitle, taskId) => {
    const { config, phase } = get();
    set({
      state: 'running',
      remainingSeconds: phaseMinutes(phase, config) * 60,
      taskId: taskId ?? null,
      taskTitle: taskTitle?.trim() || '',
    });
  },

  pause: () => set({ state: 'paused' }),
  resume: () => set({ state: 'running' }),

  stop: (completed = false) => {
    const { config, phase, remainingSeconds, sessions, taskTitle, taskId } = get();
    const totalSeconds = phaseMinutes(phase, config) * 60;
    const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
    if (elapsedSeconds > 0 || completed) {
      const session: PomodoroSession = {
        id: Math.random().toString(36).slice(2),
        date: new Date().toISOString().split('T')[0],
        phase,
        completed,
        seconds: completed ? totalSeconds : elapsedSeconds,
        taskTitle,
        taskId,
        createdAt: new Date().toISOString(),
      };
      const next = [...sessions, session];
      saveSessions(next);
      set({ sessions: next });
      if (phase === 'work' && (completed || elapsedSeconds > 0)) {
        useStatsStore.getState().addSession(completed ? totalSeconds : elapsedSeconds, taskTitle, useAppStore.getState().currentProjectId ?? undefined, taskId);
      }
    }
    set({ state: 'idle', remainingSeconds: phaseMinutes('work', config) * 60, phase: 'work', taskId: null, taskTitle: '' });
  },

  skipToNext: () => {
    const { config, phase, cycleCount } = get();
    const nextCycleCount = phase === 'work' ? cycleCount + 1 : cycleCount;
    const nextPhase: PomodoroPhase =
      phase === 'work'
        ? nextCycleCount % config.longBreakInterval === 0
          ? 'long_break'
          : 'short_break'
        : 'work';
    set({
      phase: nextPhase,
      cycleCount: nextCycleCount,
      remainingSeconds: phaseMinutes(nextPhase, config) * 60,
      state: 'idle',
    });
  },

  tick: () => {
    const { state, remainingSeconds, phase, config, cycleCount } = get();
    if (state !== 'running') return;
    if (remainingSeconds > 1) {
      set({ remainingSeconds: remainingSeconds - 1 });
      return;
    }

    if (!config.doNotDisturb) {
      const notificationStore = useNotificationStore.getState();
      if (phase === 'work') {
        notificationStore.notify('番茄完成', config.workDoneMessage, '/pomodoro');
      } else {
        notificationStore.notify('休息结束', config.breakDoneMessage, '/pomodoro');
      }
    }
    get().stop(true);
    const nextCycleCount = phase === 'work' ? cycleCount + 1 : cycleCount;
    const nextPhase: PomodoroPhase =
      phase === 'work'
        ? nextCycleCount % config.longBreakInterval === 0
          ? 'long_break'
          : 'short_break'
        : 'work';
    set({
      phase: nextPhase,
      cycleCount: nextCycleCount,
      remainingSeconds: phaseMinutes(nextPhase, config) * 60,
      state: 'idle',
    });
  },
}));
