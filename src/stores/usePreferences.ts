import { create } from 'zustand';
import { useEffect } from 'react';

interface PreferencesState {
  animationsEnabled: boolean;
  setAnimationsEnabled: (enabled: boolean) => void;
}

function getInitialAnimationsEnabled() {
  const stored = localStorage.getItem('devtrack-animations');
  if (stored === 'false') return false;
  return true;
}

export const usePreferences = create<PreferencesState>(set => ({
  animationsEnabled: getInitialAnimationsEnabled(),
  setAnimationsEnabled: enabled =>
    set(() => {
      localStorage.setItem('devtrack-animations', String(enabled));
      document.documentElement.setAttribute('data-animations', enabled ? 'on' : 'off');
      return { animationsEnabled: enabled };
    }),
}));

export function useInitPreferences() {
  const { animationsEnabled } = usePreferences();

  useEffect(() => {
    document.documentElement.setAttribute('data-animations', animationsEnabled ? 'on' : 'off');
  }, [animationsEnabled]);
}
