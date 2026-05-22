import { create } from 'zustand';
import { useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('devtrack-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
};

export const useTheme = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  toggle: () => set(s => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('devtrack-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.className = next;
    return { theme: next };
  }),
  setTheme: (t) => set(() => {
    localStorage.setItem('devtrack-theme', t);
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.className = t;
    return { theme: t };
  }),
}));

export function useInitTheme() {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.className = theme;
  }, [theme]);
  return { theme, setTheme };
}
