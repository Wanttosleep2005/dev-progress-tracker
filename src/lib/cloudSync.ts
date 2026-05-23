import { db, withoutSyncTracking } from '../db/database';
import type { CollaborationEvent, Project, SyncChange, SyncEntityType, SyncState, TeamMember, User } from '../types';

const AUTH_STORAGE_KEY = 'devtrack-cloud-session';
const DELETED_REMOTE_PROJECTS_KEY = 'devtrack-deleted-remote-projects';

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
  remote_project_id: string | null;
  entity_type: SyncEntityType;
  entity_id: number;
  project_id: number | null;
  payload: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
  client_id: string;
}

interface RemoteProjectRow {
  id: string;
  owner_id: string;
  name: string;
  payload: Project;
  created_at: string;
  updated_at: string;
}

interface RemoteMemberRow {
  project_id: string;
  user_id: string;
  role: TeamMember['role'];
  email?: string;
  display_name?: string;
  joined_at: string;
  last_seen_at?: string | null;
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
    url: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/$/, ''),
    anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim(),
    syncTable: (import.meta.env.VITE_SUPABASE_SYNC_TABLE as string | undefined) || 'devtrack_sync_records',
    projectTable: (import.meta.env.VITE_SUPABASE_PROJECT_TABLE as string | undefined) || 'devtrack_projects',
    memberTable: (import.meta.env.VITE_SUPABASE_MEMBER_TABLE as string | undefined) || 'devtrack_project_members',
  };
}

function assertConfigured(): { url: string; anonKey: string; syncTable: string; projectTable: string; memberTable: string } {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || config.url.includes('your-project') || config.anonKey.includes('your-anon-key')) {
    throw new Error('请先配置真实的 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY，然后重新启动或重新部署项目。');
  }
  return {
    url: config.url,
    anonKey: config.anonKey,
    syncTable: config.syncTable,
    projectTable: config.projectTable,
    memberTable: config.memberTable,
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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getSessionAuthUserId(session: CloudSession): string {
  const jwtSub = decodeJwtPayload(session.accessToken)?.sub;
  if (typeof jwtSub === 'string' && jwtSub) return jwtSub;
  if (session.user.id) return session.user.id;
  throw new Error('登录状态缺少 Supabase 用户 ID，请退出后重新登录。');
}

function getDeletedRemoteProjectIds() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(DELETED_REMOTE_PROJECTS_KEY) || '[]'));
  } catch {
    return new Set<string>();
  }
}

function markRemoteProjectDeleted(remoteProjectId: string) {
  const ids = getDeletedRemoteProjectIds();
  ids.add(remoteProjectId);
  localStorage.setItem(DELETED_REMOTE_PROJECTS_KEY, JSON.stringify([...ids]));
}

function unmarkRemoteProjectDeleted(remoteProjectId: string) {
  const ids = getDeletedRemoteProjectIds();
  if (!ids.delete(remoteProjectId)) return;
  localStorage.setItem(DELETED_REMOTE_PROJECTS_KEY, JSON.stringify([...ids]));
}

async function refreshAccessToken(refreshToken: string): Promise<CloudSession | null> {
  const config = assertConfigured();
  try {
    const resp = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!resp.ok) return null;
    const payload = await resp.json() as SupabaseAuthResponse;
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || refreshToken,
      user: normalizeUser(payload),
    };
  } catch {
    return null;
  }
}

async function supabaseFetch(path: string, init: RequestInit = {}, token?: string): Promise<unknown> {
  const config = assertConfigured();
  const requiresUserToken = token !== undefined;
  if (requiresUserToken && !token) {
    throw new Error('登录凭证已失效，请退出后重新登录。');
  }
  let currentToken = token;
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${config.url}${path}`, {
        ...init,
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${requiresUserToken ? currentToken : config.anonKey}`,
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });
    } catch {
      throw new Error('无法连接 Supabase。请检查 VITE_SUPABASE_URL 是否正确、当前网络是否可访问 Supabase，以及部署环境是否已经配置环境变量。');
    }

    if (response.ok) {
      if (response.status === 204) return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }

    // JWT 过期时尝试刷新 token 并重试一次
    const body = await response.text().catch(() => '');
    const isJwtExpired = body.includes('JWT expired') || body.includes('JWTExpired') || response.status === 401;
    if (isJwtExpired && attempt === 0 && requiresUserToken) {
      const session = loadCloudSession();
      if (session?.refreshToken) {
        const newSession = await refreshAccessToken(session.refreshToken);
        if (newSession) {
          saveCloudSession(newSession);
          currentToken = newSession.accessToken;
          continue;
        }
      }
      // 刷新失败，清除登录状态
      saveCloudSession(null);
      throw new Error('登录凭证已过期，请重新登录。');
    }

    throw new Error(body || response.statusText);
  }

  throw new Error('请求失败');
}

function normalizeUser(payload: SupabaseAuthResponse): User {
  const meta = payload.user?.user_metadata || {};
  const email = payload.user?.email || '';
  return {
    id: payload.user?.id || '',
    email,
    displayName: meta.display_name || meta.full_name || email.split('@')[0] || 'DevTrack 用户',
    avatarUrl: meta.avatar_url,
    createdAt: payload.user?.created_at || new Date().toISOString(),
  };
}

function rowToMember(row: RemoteMemberRow, projectId: number): Omit<TeamMember, 'id'> {
  return {
    projectId,
    userId: row.user_id,
    role: row.role,
    email: row.email,
    displayName: row.display_name,
    joinedAt: row.joined_at,
    online: false,
    lastSeenAt: row.last_seen_at ?? null,
  };
}

function getRemoteRecordId(remoteProjectId: string, entityType: SyncEntityType, entityId: number) {
  return `${remoteProjectId}:${entityType}:${entityId}`;
}

async function resolveChangeRemoteProjectId(change: SyncChange): Promise<string | null> {
  if (change.remoteProjectId) return change.remoteProjectId;
  if (typeof change.payload.remoteProjectId === 'string') return change.payload.remoteProjectId;

  const projectId = change.entityType === 'projects' ? change.entityId : change.projectId;
  if (!projectId) return null;
  const project = await db.projects.get(projectId);
  return project?.remoteProjectId ?? null;
}

async function getSyncablePendingChanges(): Promise<SyncChange[]> {
  const changes = await db.syncChanges.toArray();
  const syncable: SyncChange[] = [];

  for (const change of changes) {
    const remoteProjectId = await resolveChangeRemoteProjectId(change);
    if (remoteProjectId || change.conflict) {
      syncable.push(remoteProjectId && !change.remoteProjectId ? { ...change, remoteProjectId } : change);
    } else if (change.id) {
      await db.syncChanges.delete(change.id);
    }
  }

  return syncable;
}

export async function getCloudPendingChangeCount() {
  return (await getSyncablePendingChanges()).length;
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

  if (!payload.access_token) {
    throw new Error('注册成功，请前往邮箱点击验证链接后再登录。');
  }

  const normalized = normalizeUser(payload);
  const session = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    user: { ...normalized, displayName: displayName || normalized.displayName },
  };
  saveCloudSession(session);
  if (session.user.id) await db.users.put(session.user);
  return session;
}

async function fetchSharedProjectRows(session: CloudSession): Promise<{ projects: RemoteProjectRow[]; members: RemoteMemberRow[] }> {
  const config = assertConfigured();
  const email = encodeURIComponent(session.user.email);
  const userId = encodeURIComponent(getSessionAuthUserId(session));
  const memberQuery = `/rest/v1/${config.memberTable}?select=*&or=(user_id.eq.${userId},email.eq.${email})`;
  const members = await supabaseFetch(memberQuery, { method: 'GET' }, session.accessToken) as RemoteMemberRow[];
  const projectIds = [...new Set(members.map(member => member.project_id).filter(Boolean))];
  if (projectIds.length === 0) return { projects: [], members };

  const ids = projectIds.map(id => `"${id}"`).join(',');
  const projects = await supabaseFetch(`/rest/v1/${config.projectTable}?select=*&id=in.(${encodeURIComponent(ids)})`, { method: 'GET' }, session.accessToken) as RemoteProjectRow[];
  return { projects, members };
}

export async function importSharedProjects(session: CloudSession): Promise<number[]> {
  const { projects, members } = await fetchSharedProjectRows(session);
  const deletedRemoteProjectIds = getDeletedRemoteProjectIds();
  const localProjectIds: number[] = [];

  for (const remoteProject of projects) {
    if (deletedRemoteProjectIds.has(remoteProject.id)) continue;
    const existing = await db.projects.where('remoteProjectId').equals(remoteProject.id).first();
    let localId = existing?.id;
    const payload = {
      ...remoteProject.payload,
      id: existing?.id,
      remoteProjectId: remoteProject.id,
      name: remoteProject.payload?.name || remoteProject.name,
      updatedAt: remoteProject.updated_at,
    };

    await withoutSyncTracking(async () => {
      if (localId) {
        await db.projects.update(localId, payload);
      } else {
        localId = await db.projects.add({ ...payload, id: undefined });
      }
    });

    if (!localId) continue;
    localProjectIds.push(localId);
    const projectMembers = members.filter(member => member.project_id === remoteProject.id);
    await db.teamMembers.where('projectId').equals(localId).delete();
    if (projectMembers.length > 0) {
      await db.teamMembers.bulkAdd(projectMembers.map(member => rowToMember(member, localId!)));
    }
  }

  // 清理孤儿项目：远端已删除但本地仍有数据
  const remoteProjectIdSet = new Set(projects.map(p => p.id));
  const localSharedProjects = await db.projects.filter(p => p.remoteProjectId != null).toArray();
  for (const local of localSharedProjects) {
    if (!local.remoteProjectId || remoteProjectIdSet.has(local.remoteProjectId)) continue;
    if (deletedRemoteProjectIds.has(local.remoteProjectId)) continue;
    // 远端已删除 → 清理本地所有关联数据
    await withoutSyncTracking(async () => {
      await db.tasks.where('projectId').equals(local.id!).delete();
      await db.milestones.where('projectId').equals(local.id!).delete();
      await db.timelineEvents.where('projectId').equals(local.id!).delete();
      await db.diaryEntries.where('projectId').equals(local.id!).delete();
      await db.teamMembers.where('projectId').equals(local.id!).delete();
      await db.syncChanges.where('projectId').equals(local.id!).delete();
      await db.projects.delete(local.id!);
    });
  }

  return localProjectIds;
}

async function getRemoteRecords(session: CloudSession, remoteProjectIds: string[]): Promise<RemoteRecord[]> {
  const config = assertConfigured();
  if (remoteProjectIds.length === 0) return [];
  const ids = remoteProjectIds.map(id => `"${id}"`).join(',');
  return supabaseFetch(`/rest/v1/${config.syncTable}?select=*&remote_project_id=in.(${encodeURIComponent(ids)})`, { method: 'GET' }, session.accessToken) as Promise<RemoteRecord[]>;
}

async function pushEntitySnapshot(
  session: CloudSession,
  remoteProjectId: string,
  entityType: SyncEntityType,
  entityId: number,
  projectId: number | null,
  payload: Record<string, unknown>,
  updatedAt: string
) {
  const config = assertConfigured();
  const authUserId = getSessionAuthUserId(session);
  const record = {
    id: getRemoteRecordId(remoteProjectId, entityType, entityId),
    user_id: authUserId,
    remote_project_id: remoteProjectId,
    entity_type: entityType,
    entity_id: entityId,
    project_id: projectId,
    payload,
    updated_at: updatedAt,
    deleted_at: null,
    client_id: getClientId(),
  };
  await supabaseFetch(`/rest/v1/${config.syncTable}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(record),
  }, session.accessToken);
}

export async function deleteRemoteProjectFromCloud(session: CloudSession, remoteProjectId: string) {
  const config = assertConfigured();
  markRemoteProjectDeleted(remoteProjectId);
  await supabaseFetch(`/rest/v1/${config.syncTable}?remote_project_id=eq.${encodeURIComponent(remoteProjectId)}`, { method: 'DELETE' }, session.accessToken);
  await supabaseFetch(`/rest/v1/${config.memberTable}?project_id=eq.${encodeURIComponent(remoteProjectId)}`, { method: 'DELETE' }, session.accessToken);
  await supabaseFetch(`/rest/v1/${config.projectTable}?id=eq.${encodeURIComponent(remoteProjectId)}`, { method: 'DELETE' }, session.accessToken);
}

async function pushChange(change: SyncChange, session: CloudSession): Promise<boolean> {
  const remoteProjectId = await resolveChangeRemoteProjectId(change);
  if (!remoteProjectId) return false;

  if (change.entityType === 'projects' && change.operation === 'delete') {
    await deleteRemoteProjectFromCloud(session, remoteProjectId);
    return true;
  }

  await pushEntitySnapshot(
    session,
    remoteProjectId,
    change.entityType,
    change.entityId,
    change.projectId,
    change.payload,
    change.localUpdatedAt
  );

  if (change.operation === 'delete') {
    const config = assertConfigured();
    await supabaseFetch(`/rest/v1/${config.syncTable}?id=eq.${encodeURIComponent(getRemoteRecordId(remoteProjectId, change.entityType, change.entityId))}`, {
      method: 'PATCH',
      body: JSON.stringify({ deleted_at: change.localUpdatedAt, updated_at: change.localUpdatedAt, user_id: getSessionAuthUserId(session), client_id: getClientId() }),
    }, session.accessToken);
  }
  return true;
}

async function recordRemoteActivity(record: RemoteRecord, payload: Record<string, unknown>) {
  if (record.client_id === getClientId() || record.deleted_at || record.entity_type !== 'tasks') return;
  const status = payload.status;
  const title = typeof payload.title === 'string' ? payload.title : `任务 ${record.entity_id}`;
  if (status !== 'done') return;
  const exists = await db.collaborationEvents
    .where('projectId')
    .equals(record.project_id ?? 0)
    .filter(event => event.type === 'task_completed' && event.targetId === record.entity_id && event.createdAt >= record.updated_at)
    .first();
  if (exists) return;
  await recordCollaborationEvent({
    projectId: record.project_id ?? 0,
    remoteProjectId: record.remote_project_id,
    userId: record.user_id,
    userName: '远程成员',
    type: 'task_completed',
    targetType: 'tasks',
    targetId: record.entity_id,
    title: `完成了任务「${title}」`,
    description: `远程成员完成了任务「${title}」`,
  });
}

async function applyRemoteRecord(record: RemoteRecord, pending: SyncChange[]) {
  const table = tableMap[record.entity_type];
  if (!table) return;

  const localPending = pending.find(change => change.entityType === record.entity_type && change.entityId === record.entity_id);
  if (localPending && record.client_id !== getClientId()) {
    await db.syncChanges.update(localPending.id!, { conflict: true });
    await recordCollaborationEvent({
      projectId: record.project_id ?? 0,
      remoteProjectId: record.remote_project_id,
      userId: record.user_id,
      userName: '远程成员',
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
    const localProject = record.remote_project_id
      ? await db.projects.where('remoteProjectId').equals(record.remote_project_id).first()
      : null;
    const payload = {
      ...record.payload,
      id: record.entity_id,
      projectId: record.entity_type === 'projects' ? record.entity_id : localProject?.id ?? record.project_id,
      remoteProjectId: record.entity_type === 'projects' ? record.remote_project_id : (record.payload as { remoteProjectId?: string | null }).remoteProjectId,
      remoteId: record.id,
      syncUpdatedAt: record.updated_at,
    };
    await table.put(payload as never);
    await recordRemoteActivity(record, payload);
  });
}

export async function runCloudSync(session: CloudSession): Promise<SyncState> {
  if (!navigator.onLine) {
    const pendingChanges = await getCloudPendingChangeCount();
    return { lastSyncedAt: localStorage.getItem('devtrack-last-synced-at'), pendingChanges, syncStatus: 'offline' };
  }

  const pendingBeforeImport = await getSyncablePendingChanges();
  for (const change of pendingBeforeImport.filter(change => change.entityType === 'projects' && change.operation === 'delete')) {
    const pushed = await pushChange(change, session);
    if (pushed && change.id) await db.syncChanges.delete(change.id);
  }

  await importSharedProjects(session);

  const remoteProjectIds = [...new Set((await db.projects.toArray()).map(project => project.remoteProjectId).filter(Boolean) as string[])];
  const pending = await getSyncablePendingChanges();
  for (const change of pending) {
    const pushed = await pushChange(change, session);
    if (pushed && change.id) await db.syncChanges.delete(change.id);
  }

  const remoteRecords = await getRemoteRecords(session, remoteProjectIds);
  const remainingPending = await getSyncablePendingChanges();
  for (const record of remoteRecords) {
    await applyRemoteRecord(record, remainingPending);
  }

  const finalPending = await getSyncablePendingChanges();
  const pendingChanges = finalPending.length;
  const conflicts = finalPending.filter(change => change.conflict).length;
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

function getAppBaseUrl() {
  const base = import.meta.env.BASE_URL || '/';
  return new URL(base, window.location.origin).toString().replace(/\/$/, '');
}

export function buildInviteUrl(projectId: number, role: TeamMember['role']) {
  const token = btoa(JSON.stringify({ projectId, role, createdAt: Date.now() }));
  return `${getAppBaseUrl()}/invite/${token}`;
}

export async function publishProjectToCloud(session: CloudSession, project: Project): Promise<string> {
  const config = assertConfigured();
  const remoteId = project.remoteProjectId || crypto.randomUUID();
  const now = new Date().toISOString();
  const authUserId = getSessionAuthUserId(session);
  if (!authUserId) {
    throw new Error('登录状态缺少 Supabase 用户 ID，请重新登录后再发布共享项目。');
  }
  const remoteProject = {
    p_project_id: remoteId,
    p_name: project.name,
    p_payload: { ...project, remoteProjectId: remoteId },
    p_created_at: project.createdAt || now,
    p_email: session.user.email,
    p_display_name: session.user.displayName,
  };
  await supabaseFetch('/rest/v1/rpc/devtrack_publish_project', {
    method: 'POST',
    body: JSON.stringify(remoteProject),
  }, session.accessToken);
  unmarkRemoteProjectDeleted(remoteId);

  await db.projects.update(project.id!, { remoteProjectId: remoteId, updatedAt: now });
  const updatedProject = await db.projects.get(project.id!);
  if (updatedProject?.id) {
    await pushEntitySnapshot(session, remoteId, 'projects', updatedProject.id, updatedProject.id, updatedProject as unknown as Record<string, unknown>, updatedProject.updatedAt);
  }

  const [tasks, milestones, timelineEvents, diaryEntries] = await Promise.all([
    db.tasks.where('projectId').equals(project.id!).toArray(),
    db.milestones.where('projectId').equals(project.id!).toArray(),
    db.timelineEvents.where('projectId').equals(project.id!).toArray(),
    db.diaryEntries.where('projectId').equals(project.id!).toArray(),
  ]);
  for (const task of tasks) {
    if (task.id) await pushEntitySnapshot(session, remoteId, 'tasks', task.id, task.projectId, task as unknown as Record<string, unknown>, task.updatedAt);
  }
  for (const milestone of milestones) {
    if (milestone.id) await pushEntitySnapshot(session, remoteId, 'milestones', milestone.id, milestone.projectId, milestone as unknown as Record<string, unknown>, milestone.updatedAt);
  }
  for (const event of timelineEvents) {
    if (event.id) await pushEntitySnapshot(session, remoteId, 'timelineEvents', event.id, event.projectId, event as unknown as Record<string, unknown>, event.createdAt);
  }
  for (const entry of diaryEntries) {
    if (entry.id) await pushEntitySnapshot(session, remoteId, 'diaryEntries', entry.id, entry.projectId, entry as unknown as Record<string, unknown>, entry.updatedAt);
  }

  const existing = await db.teamMembers.where({ projectId: project.id!, userId: authUserId }).first();
  if (!existing) {
    await db.teamMembers.add({
      projectId: project.id!,
      userId: authUserId,
      role: 'owner',
      email: session.user.email,
      displayName: session.user.displayName,
      online: true,
      lastSeenAt: now,
      joinedAt: now,
    });
  }
  await recordCollaborationEvent({
    projectId: project.id!,
    remoteProjectId: remoteId,
    userId: authUserId,
    userName: session.user.displayName,
    type: 'project_shared',
    targetType: 'project',
    targetId: project.id!,
    title: '项目已发布为共享项目',
    description: `${session.user.displayName} 发布了共享项目「${project.name}」`,
  });
  return remoteId;
}

export async function upsertRemoteMember(session: CloudSession, remoteProjectId: string, member: Omit<TeamMember, 'id' | 'joinedAt' | 'projectId'>) {
  const config = assertConfigured();
  await supabaseFetch(`/rest/v1/${config.memberTable}?on_conflict=project_id,user_id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      project_id: remoteProjectId,
      user_id: member.userId,
      role: member.role,
      email: member.email,
      display_name: member.displayName,
      joined_at: new Date().toISOString(),
      last_seen_at: member.lastSeenAt,
    }),
  }, session.accessToken);
}

export async function fetchRemoteMembers(session: CloudSession, remoteProjectId: string) {
  const config = assertConfigured();
  return supabaseFetch(`/rest/v1/${config.memberTable}?select=*&project_id=eq.${remoteProjectId}`, { method: 'GET' }, session.accessToken) as Promise<RemoteMemberRow[]>;
}

export async function updateRemoteMemberRole(session: CloudSession, remoteProjectId: string, userId: string, role: TeamMember['role']) {
  const config = assertConfigured();
  await supabaseFetch(`/rest/v1/${config.memberTable}?project_id=eq.${remoteProjectId}&user_id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  }, session.accessToken);
}

export async function deleteRemoteMember(session: CloudSession, remoteProjectId: string, userId: string) {
  const config = assertConfigured();
  await supabaseFetch(`/rest/v1/${config.memberTable}?project_id=eq.${remoteProjectId}&user_id=eq.${userId}`, {
    method: 'DELETE',
  }, session.accessToken);
}

export function buildRemoteInviteUrl(remoteProjectId: string, role: TeamMember['role']) {
  const token = btoa(JSON.stringify({ remoteProjectId, role, createdAt: Date.now() }));
  return `${getAppBaseUrl()}/invite/${token}`;
}

export async function joinRemoteProject(session: CloudSession, remoteProjectId: string, role: TeamMember['role']) {
  const authUserId = getSessionAuthUserId(session);
  await upsertRemoteMember(session, remoteProjectId, {
    userId: authUserId,
    role,
    email: session.user.email,
    displayName: session.user.displayName,
    online: true,
    lastSeenAt: new Date().toISOString(),
  });
  await importSharedProjects(session);
}
