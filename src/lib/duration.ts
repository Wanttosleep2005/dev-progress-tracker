export function minutesToSeconds(minutes: number): number {
  return Math.round(minutes * 60);
}

export function secondsToMinutes(seconds: number): number {
  return seconds / 60;
}

export function formatDurationFromSeconds(
  seconds: number | null | undefined,
  options?: {
    emptyText?: string;
    compact?: boolean;
    allowZero?: boolean;
  }
) {
  const emptyText = options?.emptyText ?? '--';
  const allowZero = options?.allowZero ?? false;
  if (seconds == null || Number.isNaN(seconds)) return emptyText;

  const sign = seconds < 0 ? '-' : '';
  const totalSeconds = Math.abs(Math.round(seconds));

  if (totalSeconds === 0) {
    return allowZero ? '0 秒' : emptyText;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainSeconds = totalSeconds % 60;

  if (options?.compact) {
    if (hours > 0) {
      return `${sign}${hours}h${minutes > 0 ? ` ${minutes}m` : ''}${remainSeconds > 0 ? ` ${remainSeconds}s` : ''}`;
    }
    if (minutes > 0) {
      return `${sign}${minutes}m${remainSeconds > 0 ? ` ${remainSeconds}s` : ''}`;
    }
    return `${sign}${remainSeconds}s`;
  }

  if (hours > 0) {
    return `${sign}${hours} 小时${minutes > 0 ? ` ${minutes} 分钟` : ''}${remainSeconds > 0 ? ` ${remainSeconds} 秒` : ''}`;
  }
  if (minutes > 0) {
    return `${sign}${minutes} 分钟${remainSeconds > 0 ? ` ${remainSeconds} 秒` : ''}`;
  }
  return `${sign}${remainSeconds} 秒`;
}

export function formatDurationFromMinutes(
  minutes: number | null | undefined,
  options?: {
    emptyText?: string;
    compact?: boolean;
    allowZero?: boolean;
  }
) {
  if (minutes == null || Number.isNaN(minutes)) return options?.emptyText ?? '--';
  return formatDurationFromSeconds(minutesToSeconds(minutes), options);
}

export function formatDurationDeltaFromMinutes(minutes: number | null | undefined) {
  if (minutes == null || Number.isNaN(minutes)) return '--';
  if (minutes === 0) return '0 秒';

  const sign = minutes > 0 ? '+' : '-';
  return `${sign}${formatDurationFromMinutes(Math.abs(minutes), { allowZero: true })}`;
}

export function formatDurationDeltaText(minutes: number) {
  if (minutes === 0) return '与预估一致';
  if (minutes > 0) return `超出 ${formatDurationFromMinutes(minutes, { allowZero: true })}`;
  return `节省 ${formatDurationFromMinutes(Math.abs(minutes), { allowZero: true })}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '未设置';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未设置';
  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
}
