import { create } from 'zustand';

interface CommandPaletteState {
  open: boolean;
  query: string;
  openPalette: (query?: string) => void;
  closePalette: () => void;
  setQuery: (query: string) => void;
  clear: () => void;
}

export const useCommandPalette = create<CommandPaletteState>((set) => ({
  open: false,
  query: '',
  openPalette: (query = '') => set({ open: true, query }),
  closePalette: () => set({ open: false }),
  setQuery: (query) => set({ query, open: true }),
  clear: () => set({ query: '', open: false }),
}));
