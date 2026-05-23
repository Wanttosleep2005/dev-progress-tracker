import type { NotificationSettings } from '../types';

export const defaultNotificationSettings: NotificationSettings = {
  enabled: false,
  permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  taskBeforeDue: true,
  taskDue: true,
  todayTasks: true,
  pomodoroWorkDone: true,
  pomodoroBreakDone: true,
  leadMinutes: 15,
  dailyReminderTime: '09:30',
  soundEnabled: true,
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '08:00',
};

export function getNotificationPermission(): NotificationSettings['permission'] {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported' as const;
  return Notification.requestPermission();
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function isQuietTime(settings: NotificationSettings, now = new Date()) {
  if (!settings.quietHoursEnabled) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(settings.quietStart);
  const end = toMinutes(settings.quietEnd);
  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end;
}

function playNotificationTone(enabled: boolean) {
  if (!enabled) return;
  try {
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
  } catch {
    // Audio prompts are best-effort only.
  }
}

export function sendSystemNotification(
  title: string,
  body: string,
  settings: NotificationSettings,
  targetPath = '/'
) {
  if (!settings.enabled || settings.permission !== 'granted' || isQuietTime(settings)) return;
  const notification = new Notification(title, {
    body,
    tag: `devtrack-${targetPath}-${title}`,
    icon: '/favicon.svg',
  });
  notification.onclick = () => {
    window.focus();
    window.history.pushState(null, '', targetPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
    notification.close();
  };
  playNotificationTone(settings.soundEnabled);
}
