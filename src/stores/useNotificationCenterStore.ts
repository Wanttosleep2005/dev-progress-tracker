import { create } from 'zustand';
import type { Notification, NotificationType } from '../types';
import * as db from '../db/database';

interface NotificationCenterStore {
  notifications: Notification[];
  unreadCount: number;
  open: boolean;
  load: () => Promise<void>;
  toggle: () => void;
  close: () => void;
  add: (type: NotificationType, title: string, description: string, targetUrl: string, projectId?: number | null) => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useNotificationCenterStore = create<NotificationCenterStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  open: false,

  load: async () => {
    const [notifications, unreadCount] = await Promise.all([
      db.getNotifications(50),
      db.getUnreadNotificationCount(),
    ]);
    set({ notifications, unreadCount });
  },

  toggle: () => set(state => ({ open: !state.open })),

  close: () => set({ open: false }),

  add: async (type, title, description, targetUrl, projectId = null) => {
    await db.addNotification({ type, title, description, targetUrl, projectId });
    await get().load();
  },

  markRead: async (id) => {
    await db.markNotificationRead(id);
    await get().load();
  },

  markAllRead: async () => {
    await db.markAllNotificationsRead();
    await get().load();
  },

  clearAll: async () => {
    await db.clearNotifications();
    set({ notifications: [], unreadCount: 0 });
  },
}));
