import { create } from 'zustand';
import type { DiaryEntry } from '../types';
import * as db from '../db/database';
import { useAppStore } from './useAppStore';
import { useCloudStore } from './useCloudStore';
import { useToast } from './useToast';

interface DiaryStore {
  entries: DiaryEntry[];
  loading: boolean;
  load: (projectId: number) => Promise<void>;
  upsert: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>;
  remove: (id: number) => Promise<void>;
  getByDate: (date: string) => DiaryEntry | undefined;
}

function diaryListSignature(entries: DiaryEntry[]) {
  return entries.map(entry => [
    entry.id,
    entry.updatedAt,
    entry.date,
    entry.createdBy ?? '',
  ].join(':')).join('|');
}

export const useDiaryStore = create<DiaryStore>((set, get) => ({
  entries: [],
  loading: false,

  load: async (projectId) => {
    set({ loading: true });
    const entries = await db.getDiaryByProject(projectId);
    // Realtime refreshes can be frequent; keep the same array when diary rows are unchanged.
    set(state => diaryListSignature(state.entries) === diaryListSignature(entries)
      ? { loading: false }
      : { entries, loading: false });
  },

  upsert: async (entry) => {
    if (!useCloudStore.getState().canEdit(entry.projectId)) {
      useToast.getState().add('你没有编辑该共享项目日记的权限。', 'warning');
      return 0;
    }
    const userId = useCloudStore.getState().user?.id ?? null;
    const id = await db.upsertDiaryEntry({ ...entry, createdBy: entry.createdBy ?? userId });
    await get().load(entry.projectId);
    await useAppStore.getState().checkAchievements();
    return id;
  },

  remove: async (id) => {
    const entries = get().entries;
    const entry = entries.find(e => e.id === id);
    if (!useCloudStore.getState().canEdit(entry?.projectId ?? null)) {
      useToast.getState().add('你没有删除该共享项目日记的权限。', 'warning');
      return;
    }
    await db.deleteDiaryEntry(id);
    if (entry) await get().load(entry.projectId);
  },

  getByDate: (date: string) => {
    return get().entries.find(e => e.date === date);
  },
}));
