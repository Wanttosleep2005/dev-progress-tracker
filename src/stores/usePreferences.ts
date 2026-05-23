import { create } from 'zustand';
import { useEffect } from 'react';

interface PreferencesState {
  animationsEnabled: boolean;
  collaborationMode: 'local' | 'cloud';
  setAnimationsEnabled: (enabled: boolean) => void;
  setCollaborationMode: (mode: 'local' | 'cloud') => void;
}

function getInitialAnimationsEnabled() {
  const stored = localStorage.getItem('devtrack-animations');
  if (stored === 'false') return false;
  return true;
}

function getInitialCollaborationMode(): 'local' | 'cloud' {
  const stored = localStorage.getItem('devtrack-collaboration-mode');
  if (stored === 'cloud' || stored === 'local') return stored;
  return localStorage.getItem('devtrack-cloud-session') ? 'cloud' : 'local';
}

export function isLocalOnlyMode() {
  const stored = localStorage.getItem('devtrack-collaboration-mode');
  if (stored === 'cloud') return false;
  if (stored === 'local') return true;
  return !localStorage.getItem('devtrack-cloud-session');
}

export const usePreferences = create<PreferencesState>(set => ({
  animationsEnabled: getInitialAnimationsEnabled(),
  collaborationMode: getInitialCollaborationMode(),
  setAnimationsEnabled: enabled =>
    set(() => {
      localStorage.setItem('devtrack-animations', String(enabled));
      document.documentElement.setAttribute('data-animations', enabled ? 'on' : 'off');
      return { animationsEnabled: enabled };
    }),
  setCollaborationMode: mode =>
    set(() => {
      localStorage.setItem('devtrack-collaboration-mode', mode);
      document.documentElement.setAttribute('data-collaboration-mode', mode);
      return { collaborationMode: mode };
    }),
}));

export function useInitPreferences() {
  const { animationsEnabled, collaborationMode } = usePreferences();

  useEffect(() => {
    document.documentElement.setAttribute('data-animations', animationsEnabled ? 'on' : 'off');
  }, [animationsEnabled]);

  useEffect(() => {
    document.documentElement.setAttribute('data-collaboration-mode', collaborationMode);
  }, [collaborationMode]);
}
