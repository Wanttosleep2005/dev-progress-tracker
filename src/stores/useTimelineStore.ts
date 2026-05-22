import { create } from 'zustand';
import type { TimelineEvent } from '../types';
import * as db from '../db/database';

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
    const id = await db.addEvent(e);
    await get().load(e.projectId);
    return id;
  },

  remove: async (id) => {
    const events = get().events;
    const ev = events.find(x => x.id === id);
    await db.deleteEvent(id);
    if (ev) await get().load(ev.projectId);
  },
}));
