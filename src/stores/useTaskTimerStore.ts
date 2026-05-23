import { create } from 'zustand';

interface TaskTimerState {
  taskId: number | null;
  taskTitle: string;
  isRunning: boolean;
  accumulatedSeconds: number;
  startedAt: string | null;
  start: (taskId: number, title?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => number;
  tick: () => void;
}

export const useTaskTimerStore = create<TaskTimerState>((set, get) => ({
  taskId: null,
  taskTitle: '',
  isRunning: false,
  accumulatedSeconds: 0,
  startedAt: null,

  start: (taskId: number, title?: string) => {
    const state = get();
    if (state.taskId === taskId && state.isRunning) return;
    // Stop global focus timer if running
    void import('../components/FocusTimer')
      .then(({ stopFocusTimer }) => stopFocusTimer())
      .catch(() => undefined);
    // Always reset: if a different task had a timer, it's effectively stopped
    set({
      taskId,
      taskTitle: title || '',
      isRunning: true,
      accumulatedSeconds: 0,
      startedAt: new Date().toISOString(),
    });
  },

  pause: () => set({ isRunning: false }),

  resume: () => set({ isRunning: true, startedAt: new Date().toISOString() }),

  stop: () => {
    const { accumulatedSeconds } = get();
    set({
      taskId: null,
      taskTitle: '',
      isRunning: false,
      accumulatedSeconds: 0,
      startedAt: null,
    });
    return accumulatedSeconds;
  },

  tick: () => {
    const { isRunning, accumulatedSeconds } = get();
    if (!isRunning) return;
    set({ accumulatedSeconds: accumulatedSeconds + 1 });
  },
}));
