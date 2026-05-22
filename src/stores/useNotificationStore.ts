import { create } from 'zustand';
import type { NotificationSettings, Task } from '../types';
import {
  defaultNotificationSettings,
  getNotificationPermission,
  requestNotificationPermission,
  sendSystemNotification,
} from '../lib/notifications';

const STORAGE_KEY = 'devtrack-notification-settings';

function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return { ...defaultNotificationSettings, ...stored, permission: getNotificationPermission() };
  } catch {
    return { ...defaultNotificationSettings, permission: getNotificationPermission() };
  }
}

function saveSettings(settings: NotificationSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface NotificationStore {
  settings: NotificationSettings;
  firedKeys: Set<string>;
  init: () => void;
  requestPermission: () => Promise<void>;
  updateSettings: (changes: Partial<NotificationSettings>) => void;
  notify: (title: string, body: string, targetPath?: string) => void;
  checkTaskNotifications: (tasks: Task[]) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  settings: loadSettings(),
  firedKeys: new Set(),

  init: () => set({ settings: loadSettings() }),

  requestPermission: async () => {
    const permission = await requestNotificationPermission();
    const settings = { ...get().settings, permission, enabled: permission === 'granted' };
    saveSettings(settings);
    set({ settings });
  },

  updateSettings: (changes) => {
    const settings = { ...get().settings, ...changes, permission: getNotificationPermission() };
    saveSettings(settings);
    set({ settings });
  },

  notify: (title, body, targetPath = '/') => {
    sendSystemNotification(title, body, get().settings, targetPath);
  },

  checkTaskNotifications: (tasks) => {
    const settings = get().settings;
    if (!settings.enabled || settings.permission !== 'granted') return;
    const fired = new Set(get().firedKeys);
    const now = Date.now();
    const leadMs = settings.leadMinutes * 60 * 1000;
    const todayKey = new Date().toISOString().split('T')[0];
    const currentHm = new Date().toTimeString().slice(0, 5);

    if (settings.todayTasks && currentHm === settings.dailyReminderTime) {
      const pendingToday = tasks.filter(task => task.isTodayTask && task.status !== 'done').length;
      const key = `today:${todayKey}`;
      if (pendingToday > 0 && !fired.has(key)) {
        sendSystemNotification('今日任务提醒', `今日有 ${pendingToday} 个任务待完成`, settings, '/today-tasks');
        fired.add(key);
      }
    }

    tasks.forEach(task => {
      if (task.status === 'done' || !task.dueDate || !task.id) return;
      const due = new Date(task.dueDate).getTime();
      if (Number.isNaN(due)) return;

      const beforeKey = `before:${task.id}:${task.dueDate}`;
      if (settings.taskBeforeDue && due - now <= leadMs && due > now && !fired.has(beforeKey)) {
        sendSystemNotification('任务即将到期', `任务 [${task.title}] 即将到期`, settings, '/tasks');
        fired.add(beforeKey);
      }

      const dueKey = `due:${task.id}:${task.dueDate}`;
      if (settings.taskDue && due <= now && !fired.has(dueKey)) {
        sendSystemNotification('任务已到期', `任务 [${task.title}] 已到期`, settings, '/tasks');
        fired.add(dueKey);
      }
    });

    set({ firedKeys: fired });
  },
}));
