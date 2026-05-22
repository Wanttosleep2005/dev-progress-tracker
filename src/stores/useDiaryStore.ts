import { create } from 'zustand';
import type { DiaryEntry } from '../types';
import * as db from '../db/database';
import { useAppStore } from './useAppStore';

interface DiaryStore {
  entries: DiaryEntry[];
  loading: boolean;
  load: (projectId: number) => Promise<void>;
  upsert: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>;
  remove: (id: number) => Promise<void>;
  getByDate: (date: string) => DiaryEntry | undefined;
}

export const useDiaryStore = create<DiaryStore>((set, get) => ({
  entries: [],
  loading: false,

  load: async (projectId) => {
    set({ loading: true });
    const entries = await db.getDiaryByProject(projectId);
    set({ entries, loading: false });
  },

  upsert: async (entry) => {
    const id = await db.upsertDiaryEntry(entry);
    await get().load(entry.projectId);
    await useAppStore.getState().checkAchievements();
    return id;
  },

  remove: async (id) => {
    const entries = get().entries;
    const entry = entries.find(e => e.id === id);
    await db.deleteDiaryEntry(id);
    if (entry) await get().load(entry.projectId);
  },

  getByDate: (date: string) => {
    return get().entries.find(e => e.date === date);
  },
}));
