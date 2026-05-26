import { getClientId, type CloudSession } from './cloudSync';

export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'disconnected'
  | 'error';

interface RealtimeSubscriptionOptions {
  session: CloudSession;
  remoteProjectId: string;
  onChanged: () => void | Promise<void>;
  onStatus?: (status: RealtimeStatus) => void;
  onError?: (message: string) => void;
}

interface RealtimeMessage {
  topic: string;
  event: string;
  payload: unknown;
  ref: string | null;
}

const HEARTBEAT_INTERVAL_MS = 25_000;
const SYNC_DEBOUNCE_MS = 500;

let socket: WebSocket | null = null;
let heartbeatTimer: number | null = null;
let syncTimer: number | null = null;
let messageRef = 1;
let failureCount = 0;
let connectingSince = 0;

function getSupabaseRealtimeUrl() {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/$/, '');
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!url || !anonKey) {
    throw new Error('请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。');
  }

  const realtimeUrl = new URL(url);
  realtimeUrl.protocol = realtimeUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  realtimeUrl.pathname = '/realtime/v1/websocket';
  realtimeUrl.searchParams.set('apikey', anonKey);
  realtimeUrl.searchParams.set('vsn', '1.0.0');
  return realtimeUrl.toString();
}

function nextRef() {
  messageRef += 1;
  return String(messageRef);
}

function send(topic: string, event: string, payload: unknown = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const message: RealtimeMessage = {
    topic,
    event,
    payload,
    ref: nextRef(),
  };
  socket.send(JSON.stringify(message));
}

function clearTimers() {
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  if (syncTimer) window.clearTimeout(syncTimer);
  heartbeatTimer = null;
  syncTimer = null;
}

function scheduleSync(onChanged: () => void | Promise<void>, onStatus?: (status: RealtimeStatus) => void) {
  if (syncTimer) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    // Only show realtime syncing once the debounced remote batch is actually processed.
    onStatus?.('syncing');
    Promise.resolve(onChanged())
      .then(() => onStatus?.('connected'))
      .catch(() => onStatus?.('error'));
  }, SYNC_DEBOUNCE_MS);
}

function getRealtimeRecord(payload: unknown): Record<string, unknown> | null {
  const data = payload as { data?: { record?: unknown; old_record?: unknown }; record?: unknown; old_record?: unknown } | null;
  const record = data?.data?.record ?? data?.record ?? data?.data?.old_record ?? data?.old_record;
  return record && typeof record === 'object' ? record as Record<string, unknown> : null;
}

function isOwnRealtimeEcho(record: Record<string, unknown> | null, session: CloudSession) {
  // The browser client id is shared across logins, so also require the Supabase user id before ignoring an echo.
  return record?.client_id === getClientId() && record.user_id === session.user.id;
}

function buildJoinPayload(session: CloudSession, remoteProjectId: string) {
  return {
    access_token: session.accessToken,
    config: {
      broadcast: { self: false },
      presence: { key: session.user.id },
      postgres_changes: [
        {
          event: '*',
          schema: 'public',
          table: 'devtrack_sync_records',
          filter: `remote_project_id=eq.${remoteProjectId}`,
        },
        {
          event: '*',
          schema: 'public',
          table: 'devtrack_project_members',
          filter: `project_id=eq.${remoteProjectId}`,
        },
        {
          event: '*',
          schema: 'public',
          table: 'devtrack_projects',
          filter: `id=eq.${remoteProjectId}`,
        },
      ],
    },
  };
}

export function subscribeProjectRealtime(options: RealtimeSubscriptionOptions) {
  unsubscribeProjectRealtime();

  const topic = `realtime:devtrack:${options.remoteProjectId}`;
  connectingSince = Date.now();
  failureCount = 0;
  options.onStatus?.('connecting');

  try {
    socket = new WebSocket(getSupabaseRealtimeUrl());
  } catch (error) {
    options.onStatus?.('error');
    options.onError?.(error instanceof Error ? error.message : 'Realtime 初始化失败');
    return;
  }

  socket.addEventListener('open', () => {
    failureCount = 0;
    send(topic, 'phx_join', buildJoinPayload(options.session, options.remoteProjectId));
    heartbeatTimer = window.setInterval(() => {
      send('phoenix', 'heartbeat');
    }, HEARTBEAT_INTERVAL_MS);
  });

  socket.addEventListener('message', event => {
    let message: RealtimeMessage | null = null;
    try {
      message = JSON.parse(String(event.data)) as RealtimeMessage;
    } catch {
      return;
    }

    if (message.topic !== topic) return;

    if (message.event === 'phx_reply') {
      const status = (message.payload as { status?: string } | null)?.status;
      if (status === 'ok') {
        failureCount = 0;
        options.onStatus?.('connected');
      } else if (status === 'error') {
        // A rejected realtime join should not block collaboration; REST sync remains the source of truth.
        options.onStatus?.('disconnected');
        if (Date.now() - connectingSince > 30_000) {
          options.onError?.('Realtime 订阅未建立，已保留自动同步兜底。请确认已执行 Supabase 迁移 architecture-sync.sql 与 arch-nodes-realtime.sql。');
        }
      }
      return;
    }

    if (message.event === 'postgres_changes') {
      const record = getRealtimeRecord(message.payload);
      // Ignore only the current user's own sync_records echo; another account may share this browser client id during testing.
      if (isOwnRealtimeEcho(record, options.session)) return;
      scheduleSync(options.onChanged, options.onStatus);
    }
  });

  socket.addEventListener('error', () => {
    // WebSocket errors can be transient during TLS/proxy handshakes; only surface sustained failure.
    failureCount += 1;
    options.onStatus?.('connecting');
    if (failureCount >= 3 && Date.now() - connectingSince > 30_000) {
      options.onStatus?.('error');
      options.onError?.('Realtime 连接暂时无法建立，已保留 60 秒自动同步兜底。');
    }
  });

  socket.addEventListener('close', () => {
    clearTimers();
    options.onStatus?.('disconnected');
  });
}

export function unsubscribeProjectRealtime() {
  clearTimers();
  if (!socket) return;
  const current = socket;
  socket = null;
  if (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING) {
    current.close();
  }
}
