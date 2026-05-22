import { create } from 'zustand';
import type { TimelineEvent } from '../types';
import * as db from '../db/database';
import { useCloudStore } from './useCloudStore';
import { useToast } from './useToast';

interface TimelineStore {
  events: TimelineEvent[];
  loading: boolean;
  load: (projectId: number) => Promise<void>;
  add: (e: Omit<TimelineEvent, 'id' | 'createdAt'>) => Promise<number>;
  remove: (id: number) => Promise<void>;
}

export const useTimelineStore = create<TimelineStore>((set, get) => ({
  events: [],
  loading: false,

  load: async (projectId) => {
    set({ loading: true });
    const events = await db.getEventsByProject(projectId);
    set({ events, loading: false });
  },

  add: async (e) => {
    if (!useCloudStore.getState().canEdit(e.projectId)) {
      useToast.getState().add('你没有编辑该共享项目时间线的权限。', 'warning');
      return 0;
    }
    const id = await db.addEvent(e);
    await get().load(e.projectId);
    return id;
  },

  remove: async (id) => {
    const events = get().events;
    const ev = events.find(x => x.id === id);
    if (!useCloudStore.getState().canEdit(ev?.projectId ?? null)) {
      useToast.getState().add('你没有删除该共享项目时间线的权限。', 'warning');
      return;
    }
    await db.deleteEvent(id);
    if (ev) await get().load(ev.projectId);
  },
}));
