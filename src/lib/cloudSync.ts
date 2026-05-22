import { db, withoutSyncTracking } from '../db/database';
import type { CollaborationEvent, SyncChange, SyncEntityType, SyncState, TeamMember, User } from '../types';

const AUTH_STORAGE_KEY = 'devtrack-cloud-session';

export interface CloudSession {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

interface SupabaseAuthResponse {
  access_token: string;
  refresh_token?: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      display_name?: string;
      full_name?: string;
      avatar_url?: string;
    };
    created_at?: string;
  };
}

interface RemoteRecord {
  id: string;
  user_id: string;
  entity_type: SyncEntityType;
  entity_id: number;
  project_id: number | null;
  payload: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
  client_id: string;
}

const tableMap = {
  projects: db.projects,
  tasks: db.tasks,
  milestones: db.milestones,
  timelineEvents: db.timelineEvents,
  diaryEntries: db.diaryEntries,
};

function getSupabaseConfig() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
    syncTable: (import.meta.env.VITE_SUPABASE_SYNC_TABLE as string | undefined) || 'devtrack_sync_records',
  };
}

function getClientId() {
  const key = 'devtrack-client-id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

function assertConfigured(): { url: string; anonKey: string; syncTable: string } {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    throw new Error('请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。');
  }
  return { url: config.url, anonKey: config.anonKey, syncTable: config.syncTable };
}

async function supabaseFetch(path: string, init: RequestInit = {}, token?: string) {
  const config = assertConfigured();
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token || config.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  if (response.status === 204) return null;
  return response.json();
}

function normalizeUser(payload: SupabaseAuthResponse): User {
  if (!payload.user) {
    return {
      id: '',
      email: '',
      displayName: 'DevTrack 用户',
      createdAt: new Date().toISOString(),
    };
  }
  const meta = payload.user.user_metadata || {};
  const email = payload.user.email || '';
  return {
    id: payload.user.id,
    email,
    displayName: meta.display_name || meta.full_name || email.split('@')[0] || 'DevTrack 用户',
    avatarUrl: meta.avatar_url,
    createdAt: payload.user.created_at || new Date().toISOString(),
  };
}

export function loadCloudSession(): CloudSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCloudSession(session: CloudSession | null) {
  if (!session) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export async function signInWithEmail(email: string, password: string): Promise<CloudSession> {
  const payload = await supabaseFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }) as SupabaseAuthResponse;

  const session = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    user: normalizeUser(payload),
  };
  saveCloudSession(session);
  await db.users.put(session.user);
  return session;
}

export async function signUpWithEmail(email: string, password: string, displayName: string): Promise<CloudSession> {
  const payload = await supabaseFetch('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { display_name: displayName } }),
  }) as SupabaseAuthResponse;

  // 注册后可能需要邮箱验证，access_token 可能为空
  if (!payload.access_token) {
    throw new Error('注册成功，请前往邮箱点击验证链接完成注册。');
  }

  const session = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    user: { ...normalizeUser(payload), displayName: displayName || normalizeUser(payload).displayName },
  };
  saveCloudSession(session);
  if (session.user.id) {
    await db.users.put(session.user);
  }
  return session;
}

async function getRemoteRecords(session: CloudSession): Promise<RemoteRecord[]> {
  const config = assertConfigured();
  const query = `/rest/v1/${config.syncTable}?select=*&user_id=eq.${encodeURIComponent(session.user.id)}`;
  return supabaseFetch(query, { method: 'GET' }, session.accessToken) as Promise<RemoteRecord[]>;
}

async function pushChange(change: SyncChange, session: CloudSession) {
  const config = assertConfigured();
  const record = {
    id: `${session.user.id}:${change.entityType}:${change.entityId}`,
    user_id: session.user.id,
    entity_type: change.entityType,
    entity_id: change.entityId,
    project_id: change.projectId,
    payload: change.payload,
    updated_at: change.localUpdatedAt,
    deleted_at: change.operation === 'delete' ? change.localUpdatedAt : null,
    client_id: getClientId(),
  };
  await supabaseFetch(`/rest/v1/${config.syncTable}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(record),
  }, session.accessToken);
}

async function applyRemoteRecord(record: RemoteRecord, pending: SyncChange[]) {
  const table = tableMap[record.entity_type];
  if (!table) return;
  const local = await table.get(record.entity_id);
  const localPending = pending.find(change => change.entityType === record.entity_type && change.entityId === record.entity_id);

  if (localPending && record.client_id !== getClientId()) {
    await db.syncChanges.update(localPending.id!, { conflict: true });
    await recordCollaborationEvent({
      projectId: record.project_id ?? 0,
      userId: record.user_id,
      userName: '远端成员',
      type: 'comment_added',
      targetType: record.entity_type,
      targetId: record.entity_id,
      title: '同步冲突已保留',
      description: '本地版本优先，远端版本已作为冲突记录保留。',
    });
    return;
  }

  await withoutSyncTracking(async () => {
    if (record.deleted_at) {
      await table.delete(record.entity_id);
      return;
    }
    const payload = { ...record.payload, id: record.entity_id, syncUpdatedAt: record.updated_at };
    await table.put(payload as never);
  });
}

export async function runCloudSync(session: CloudSession): Promise<SyncState> {
  if (!navigator.onLine) {
    const pendingChanges = await db.syncChanges.count();
    return { lastSyncedAt: localStorage.getItem('devtrack-last-synced-at'), pendingChanges, syncStatus: 'offline' };
  }

  const pending = await db.syncChanges.toArray();
  for (const change of pending) {
    await pushChange(change, session);
    if (change.id) await db.syncChanges.delete(change.id);
  }

  const remoteRecords = await getRemoteRecords(session);
  const remainingPending = await db.syncChanges.toArray();
  for (const record of remoteRecords) {
    await applyRemoteRecord(record, remainingPending);
  }

  const pendingChanges = await db.syncChanges.count();
  const conflicts = await db.syncChanges.where('conflict').equals(1).count();
  const lastSyncedAt = new Date().toISOString();
  localStorage.setItem('devtrack-last-synced-at', lastSyncedAt);
  return {
    lastSyncedAt,
    pendingChanges,
    syncStatus: conflicts > 0 ? 'conflict' : pendingChanges > 0 ? 'syncing' : 'synced',
  };
}

export async function recordCollaborationEvent(event: Omit<CollaborationEvent, 'id' | 'createdAt'>) {
  await db.collaborationEvents.add({ ...event, createdAt: new Date().toISOString() });
}

export async function addLocalTeamMember(member: Omit<TeamMember, 'id' | 'joinedAt'>) {
  return db.teamMembers.add({ ...member, joinedAt: new Date().toISOString() });
}

export function buildInviteUrl(projectId: number, role: TeamMember['role']) {
  const token = btoa(JSON.stringify({ projectId, role, createdAt: Date.now() }));
  return `${window.location.origin}${window.location.pathname}#/invite/${token}`;
}
