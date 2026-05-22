import { create } from 'zustand';

export interface FocusSession {
  id: string;
  date: string;
  minutes: number;
  seconds: number;
  taskTitle?: string;
  projectId?: number | null;
  taskId?: number | null;
  createdAt: string;
}

function normalizeSession(session: Partial<FocusSession> & Record<string, unknown>): FocusSession {
  const seconds =
    typeof session.seconds === 'number'
      ? session.seconds
      : Math.round((typeof session.minutes === 'number' ? session.minutes : 0) * 60);
  const minutes = seconds / 60;

  return {
    id: typeof session.id === 'string' ? session.id : Math.random().toString(36).slice(2),
    date: typeof session.date === 'string' ? session.date : new Date().toISOString().split('T')[0],
    minutes,
    seconds,
    taskTitle: typeof session.taskTitle === 'string' ? session.taskTitle : undefined,
    projectId: typeof session.projectId === 'number' ? session.projectId : null,
    taskId: typeof session.taskId === 'number' ? session.taskId : null,
    createdAt: typeof session.createdAt === 'string' ? session.createdAt : new Date().toISOString(),
  };
}

function loadStoredSessions(): FocusSession[] {
  try {
    const raw = JSON.parse(localStorage.getItem('devtrack-focus-sessions') || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(item => normalizeSession(item));
  } catch {
    return [];
  }
}

function saveSessions(sessions: FocusSession[]) {
  localStorage.setItem('devtrack-focus-sessions', JSON.stringify(sessions));
}

interface StatsStore {
  sessions: FocusSession[];
  addSession: (seconds: number, taskTitle?: string, projectId?: number | null, taskId?: number | null) => void;
  removeSession: (id: string) => void;
  loadSessions: () => void;
}

export const useStatsStore = create<StatsStore>((set, get) => ({
  sessions: [],
  addSession: (seconds, taskTitle, projectId, taskId) => {
    if (!seconds || seconds <= 0) return;
    const date = new Date().toISOString().split('T')[0];
    const session: FocusSession = {
      id: Math.random().toString(36).slice(2),
      date,
      seconds,
      minutes: seconds / 60,
      taskTitle,
      projectId: projectId ?? null,
      taskId: taskId ?? null,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().sessions, session];
    saveSessions(updated);
    set({ sessions: updated });
  },
  removeSession: id => {
    const updated = get().sessions.filter(session => session.id !== id);
    saveSessions(updated);
    set({ sessions: updated });
  },
  loadSessions: () => set({ sessions: loadStoredSessions() }),
}));

export function getTodayMinutes(sessions: FocusSession[]): number {
  const today = new Date().toISOString().split('T')[0];
  const totalSeconds = sessions
    .filter(session => session.date === today)
    .reduce((sum, session) => sum + session.seconds, 0);
  return totalSeconds / 60;
}

export function getWeekMinutes(sessions: FocusSession[]): { day: string; label: string; minutes: number }[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  const days = ['一', '二', '三', '四', '五', '六', '日'];
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateStr = date.toISOString().split('T')[0];
    const seconds = sessions
      .filter(session => session.date === dateStr)
      .reduce((sum, session) => sum + session.seconds, 0);
    return { day: dateStr, label: days[index], minutes: seconds / 60 };
  });
}

export function getTotalMinutes(sessions: FocusSession[]): number {
  return sessions.reduce((sum, session) => sum + session.seconds, 0) / 60;
}

export function getActiveDays(sessions: FocusSession[]): number {
  return new Set(sessions.map(session => session.date)).size;
}

export function getStreak(
  sessions: FocusSession[],
  diaryDates: string[],
  eventDates: string[],
  taskDoneDates: string[]
): { current: number; longest: number } {
  const allDates = new Set([...sessions.map(session => session.date), ...diaryDates, ...eventDates, ...taskDoneDates]);

  let current = 0;
  const today = new Date();
  for (let index = 0; index < 365; index += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const dateStr = date.toISOString().split('T')[0];
    if (allDates.has(dateStr)) current += 1;
    else break;
  }

  let longest = 0;
  let temp = 0;
  const sorted = Array.from(allDates).sort();
  for (let index = 0; index < sorted.length; index += 1) {
    if (index === 0) {
      temp = 1;
      continue;
    }
    const prev = new Date(sorted[index - 1]);
    const curr = new Date(sorted[index]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
    if (Math.abs(diffDays - 1) < 0.1) temp += 1;
    else {
      longest = Math.max(longest, temp);
      temp = 1;
    }
  }
  longest = Math.max(longest, temp);

  return { current, longest };
}
