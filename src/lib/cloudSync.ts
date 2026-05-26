import { db, normalizeArchRootNodes, withoutSyncTracking } from '../db/database';
import type { CollaborationEvent, Project, SyncChange, SyncEntityType, SyncState, TeamMember, User } from '../types';
import { createClientId } from './id';

const AUTH_STORAGE_KEY = 'devtrack-cloud-session';
const DELETED_REMOTE_PROJECTS_KEY = 'devtrack-deleted-remote-projects';

export interface CloudSession {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface CloudIdentityDeletionResult {
  remoteCleanup: {
    deletedOwnedProjects?: number;
    removedMemberships?: number;
    anonymizedRecords?: number;
  } | null;
  authDeletion: 'deleted' | 'not_configured' | 'failed';
  authDeletionMessage?: string;
}

export interface RemoteInvitePayload {
  remoteProjectId: string;
  role: TeamMember['role'];
  createdAt?: number;
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

export interface RemoteSyncLogRecord {
  id: string;
  user_id: string;
  remote_project_id: string | null;
  entity_type: SyncEntityType;
  entity_id: number | string;
  project_id: number | null;
  payload: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
  client_id: string;
}

interface RemoteRecord extends RemoteSyncLogRecord {}

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

interface RemoteJoinProjectResult {
  project_id: string;
  role: TeamMember['role'];
  already_member: boolean;
}

const tableMap = {
  projects: db.projects,
  tasks: db.tasks,
  milestones: db.milestones,
  timelineEvents: db.timelineEvents,
  diaryEntries: db.diaryEntries,
  sprints: db.sprints,
  comments: db.comments,
  archNodes: db.archNodes,
};

const DEPRECATED_SYNC_ENTITY_TYPES = new Set<SyncEntityType>(['sprints']);
const MEMBER_ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isMemberOnline(lastSeenAt?: string | null, now = Date.now()) {
  if (!lastSeenAt) return false;
  const value = new Date(lastSeenAt).getTime();
  if (Number.isNaN(value)) return false;
  return now - value <= MEMBER_ONLINE_WINDOW_MS;
}

function getSupabaseConfig() {
  return {
    url: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/$/, ''),
    anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim(),
    deleteAccountFunctionUrl: (import.meta.env.VITE_SUPABASE_DELETE_ACCOUNT_FUNCTION_URL as string | undefined)?.trim(),
    syncTable: (import.meta.env.VITE_SUPABASE_SYNC_TABLE as string | undefined) || 'devtrack_sync_records',
    projectTable: (import.meta.env.VITE_SUPABASE_PROJECT_TABLE as string | undefined) || 'devtrack_projects',
    memberTable: (import.meta.env.VITE_SUPABASE_MEMBER_TABLE as string | undefined) || 'devtrack_project_members',
  };
}

function assertConfigured(): { url: string; anonKey: string; deleteAccountFunctionUrl?: string; syncTable: string; projectTable: string; memberTable: string } {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || config.url.includes('your-project') || config.anonKey.includes('your-anon-key')) {
    throw new Error('请先配置真实的 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY，然后重新启动或重新部署项目。');
  }
  return {
    url: config.url,
    anonKey: config.anonKey,
    deleteAccountFunctionUrl: config.deleteAccountFunctionUrl,
    syncTable: config.syncTable,
    projectTable: config.projectTable,
    memberTable: config.memberTable,
  };
}

export function getClientId() {
  const key = 'devtrack-client-id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = createClientId();
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
    online: isMemberOnline(row.last_seen_at),
    lastSeenAt: row.last_seen_at ?? null,
  };
}

function getRemoteRecordId(remoteProjectId: string, entityType: SyncEntityType, remoteEntityId: number | string) {
  const key = String(remoteEntityId);
  return key.startsWith(`${remoteProjectId}:${entityType}:`) ? key : `${remoteProjectId}:${entityType}:${key}`;
}

async function mergeDuplicateSharedProjects(remoteProjectId: string, preferredId?: number | null) {
  const projects = await db.projects.where('remoteProjectId').equals(remoteProjectId).toArray();
  if (projects.length <= 1) return preferredId ?? projects[0]?.id ?? null;

  const keep = projects.find(project => project.id === preferredId) ?? projects[0];
  if (!keep.id) return null;
  const duplicates = projects.filter(project => project.id && project.id !== keep.id);

  for (const duplicate of duplicates) {
    if (!duplicate.id) continue;
    await db.tasks.where('projectId').equals(duplicate.id).modify({ projectId: keep.id });
    await db.milestones.where('projectId').equals(duplicate.id).modify({ projectId: keep.id });
    await db.timelineEvents.where('projectId').equals(duplicate.id).modify({ projectId: keep.id });
    await db.diaryEntries.where('projectId').equals(duplicate.id).modify({ projectId: keep.id });
    await db.archNodes.where('projectId').equals(duplicate.id).modify({ projectId: keep.id });
    await db.teamMembers.where('projectId').equals(duplicate.id).modify({ projectId: keep.id });
    await db.syncChanges.where('projectId').equals(duplicate.id).modify({ projectId: keep.id });
    await db.collaborationEvents.where('projectId').equals(duplicate.id).modify({ projectId: keep.id });
    await db.notifications.where('projectId').equals(duplicate.id).modify({ projectId: keep.id });
    await db.inviteLinks.where('projectId').equals(duplicate.id).modify({ projectId: keep.id });
    await db.sprints.where('projectId').equals(duplicate.id).modify({ projectId: keep.id });
    await db.projects.delete(duplicate.id);
  }

  return keep.id;
}

async function ensureSnapshotRemoteId(
  remoteProjectId: string,
  entityType: SyncEntityType,
  entityId: number | string,
  payload: Record<string, unknown>
) {
  if (entityType === 'projects') {
    return {
      recordId: getRemoteRecordId(remoteProjectId, entityType, remoteProjectId),
      payload,
    };
  }

  if (entityType === 'archNodes') {
    const recordId = getRemoteRecordId(remoteProjectId, entityType, entityId);
    return {
      recordId,
      payload: { ...payload, id: entityId, remoteId: recordId },
    };
  }

  const existingRemoteId = typeof payload.remoteId === 'string' && payload.remoteId
    ? payload.remoteId
    : null;
  const recordId = existingRemoteId
    ? getRemoteRecordId(remoteProjectId, entityType, existingRemoteId)
    : getRemoteRecordId(remoteProjectId, entityType, createClientId());
  const nextPayload = { ...payload, remoteId: recordId };

  if (!existingRemoteId && typeof entityId === 'number') {
    const table = tableMap[entityType];
    if (table) {
      await withoutSyncTracking(async () => {
        await table.update(entityId, { remoteId: recordId } as never);
      });
    }
  }

  return { recordId, payload: nextPayload };
}

async function ensureRelatedRemoteId(remoteProjectId: string, entityType: SyncEntityType, entityId: unknown) {
  if (typeof entityId !== 'number') return null;
  if (entityType !== 'milestones') return null;
  const table = db.milestones;
  if (!table) return null;
  const row = await table.get(entityId) as { remoteId?: string | null } | undefined;
  if (row?.remoteId) return row.remoteId;
  const remoteId = getRemoteRecordId(remoteProjectId, entityType, createClientId());
  await withoutSyncTracking(async () => {
    await table.update(entityId, { remoteId } as never);
  });
  return remoteId;
}

async function serializeRemotePayload(remoteProjectId: string, entityType: SyncEntityType, payload: Record<string, unknown>) {
  if (entityType !== 'tasks') return payload;
  // Sprint planning has been removed from the product surface, so old sprint links are not synced forward.
  return {
    ...payload,
    sprintId: null,
    sprintRemoteId: null,
    milestoneRemoteId: await ensureRelatedRemoteId(remoteProjectId, 'milestones', payload.milestoneId),
  };
}

async function resolveLocalReferenceId(
  remoteProjectId: string | null,
  localProjectId: number | null | undefined,
  entityType: SyncEntityType,
  remoteId: unknown,
  legacyId: unknown
) {
  if (entityType !== 'milestones' || !localProjectId) return null;
  const table = db.milestones;
  const candidates = [
    typeof remoteId === 'string' ? remoteId : null,
    typeof legacyId === 'number' && remoteProjectId ? getRemoteRecordId(remoteProjectId, entityType, legacyId) : null,
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const row = await table
      .filter(item => {
        const value = item as { remoteId?: string | null; projectId?: number };
        return value.projectId === localProjectId && value.remoteId === candidate;
      })
      .first() as { id?: number } | undefined;
    if (typeof row?.id === 'number') return row.id;
  }
  if (typeof legacyId === 'number') {
    const row = await table.get(legacyId) as { id?: number; projectId?: number } | undefined;
    if (row?.projectId === localProjectId) return legacyId;
  }
  return null;
}

async function deserializeRemotePayload(record: RemoteRecord, localProjectId: number | null | undefined, payload: Record<string, unknown>) {
  if (record.entity_type === 'archNodes') {
    const id = String(payload.id ?? record.entity_id);
    const type = payload.type === 'folder' || payload.type === 'file' ? payload.type : 'file';
    const parentId = typeof payload.parentId === 'string' && payload.parentId !== id ? payload.parentId : null;
    const normalizeIds = (value: unknown) => Array.isArray(value)
      ? [...new Set(value.map(item => Number(item)).filter(item => Number.isFinite(item)))]
      : [];
    return {
      ...payload,
      id,
      projectId: localProjectId ?? record.project_id,
      name: typeof payload.name === 'string' && payload.name.trim() ? payload.name : type === 'folder' ? '未命名文件夹' : 'untitled',
      type,
      parentId,
      extension: type === 'file' && typeof payload.extension === 'string' ? payload.extension : null,
      relatedTaskIds: normalizeIds(payload.relatedTaskIds),
      relatedMilestoneIds: normalizeIds(payload.relatedMilestoneIds),
      description: typeof payload.description === 'string' ? payload.description : '',
    };
  }
  if (record.entity_type !== 'tasks') return payload;
  // Keep deprecated sprint links out of local task state while preserving milestone portability.
  return {
    ...payload,
    sprintId: null,
    sprintRemoteId: null,
    milestoneId: await resolveLocalReferenceId(record.remote_project_id, localProjectId, 'milestones', payload.milestoneRemoteId, payload.milestoneId),
  };
}

async function resolveChangeRemoteProjectId(change: SyncChange): Promise<string | null> {
  if (change.remoteProjectId) return change.remoteProjectId;
  if (typeof change.payload.remoteProjectId === 'string') return change.payload.remoteProjectId;

  const projectId = change.entityType === 'projects' ? change.entityId : change.projectId;
  if (typeof projectId !== 'number') return null;
  const project = await db.projects.get(projectId);
  return project?.remoteProjectId ?? null;
}

async function getCurrentRemoteRole(session: CloudSession, remoteProjectId: string): Promise<TeamMember['role'] | null> {
  const authUserId = getSessionAuthUserId(session);
  const email = session.user.email.toLowerCase();
  const localProject = await db.projects.where('remoteProjectId').equals(remoteProjectId).first();
  if (localProject?.id) {
    const localMember = await db.teamMembers
      .where('projectId')
      .equals(localProject.id)
      .filter(member => member.userId === authUserId || member.email?.toLowerCase() === email || member.userId === `email:${email}`)
      .first();
    if (localMember?.role) return localMember.role;
  }

  const remoteMember = await fetchCurrentRemoteMembers(session, remoteProjectId).catch(() => []);
  return remoteMember.find(member => member.user_id === authUserId || member.email?.toLowerCase() === email)?.role ?? null;
}

async function canPushChange(session: CloudSession, remoteProjectId: string, change: SyncChange) {
  const role = await getCurrentRemoteRole(session, remoteProjectId);
  if (role === 'owner') return { allowed: true, role };
  if (role === 'editor') return { allowed: change.entityType !== 'projects', role };
  return { allowed: false, role };
}

async function getSyncablePendingChanges(): Promise<SyncChange[]> {
  const changes = await db.syncChanges.toArray();
  const syncable: SyncChange[] = [];

  for (const change of changes) {
    if (DEPRECATED_SYNC_ENTITY_TYPES.has(change.entityType)) {
      if (change.id) await db.syncChanges.delete(change.id);
      continue;
    }
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

async function cleanupLocalCloudIdentity(session: CloudSession) {
  const now = new Date().toISOString();
  await withoutSyncTracking(async () => {
    await db.users.delete(session.user.id);
    await db.projects.filter(project => Boolean(project.remoteProjectId)).modify({
      remoteProjectId: null,
      updatedAt: now,
    });
    await db.teamMembers.clear();
    await db.inviteLinks.clear();
    await db.syncChanges.clear();
    await db.collaborationEvents
      .where('userId')
      .equals(session.user.id)
      .modify({ userId: null, userName: '已注销用户' });
  });
  localStorage.removeItem('devtrack-last-synced-at');
  localStorage.removeItem(DELETED_REMOTE_PROJECTS_KEY);
}

async function deleteAuthUserWithEdgeFunction(session: CloudSession): Promise<{ status: CloudIdentityDeletionResult['authDeletion']; message?: string; cleanup?: CloudIdentityDeletionResult['remoteCleanup'] }> {
  const config = assertConfigured();
  const endpoint = config.deleteAccountFunctionUrl || `${config.url}/functions/v1/devtrack-delete-account`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (response.status === 404) {
      return { status: 'not_configured', message: 'Supabase Edge Function 尚未部署' };
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { status: 'failed', message: body || response.statusText };
    }
    const body = await response.json().catch(() => null) as { cleanup?: CloudIdentityDeletionResult['remoteCleanup'] } | null;
    return { status: 'deleted', cleanup: body?.cleanup ?? null };
  } catch (error) {
    return {
      status: 'not_configured',
      message: error instanceof Error ? error.message : '无法访问账号删除函数',
    };
  }
}

export async function forgetCloudIdentity(session: CloudSession): Promise<CloudIdentityDeletionResult> {
  const authDeletion = await deleteAuthUserWithEdgeFunction(session);
  let remoteCleanup = authDeletion.cleanup ?? null;
  if (!remoteCleanup) {
    remoteCleanup = await supabaseFetch('/rest/v1/rpc/devtrack_forget_current_user', {
      method: 'POST',
      body: JSON.stringify({}),
    }, session.accessToken) as CloudIdentityDeletionResult['remoteCleanup'];
  }
  await cleanupLocalCloudIdentity(session);
  saveCloudSession(null);

  return {
    remoteCleanup,
    authDeletion: authDeletion.status,
    authDeletionMessage: authDeletion.message,
  };
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

export async function signUpWithEmail(email: string, password: string, displayName: string, redirectTo?: string): Promise<CloudSession> {
  const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
  const payload = await supabaseFetch(`/auth/v1/signup${query}`, {
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
    localId = await mergeDuplicateSharedProjects(remoteProject.id, localId) ?? localId;
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
      const tasks = await db.tasks.where('projectId').equals(local.id!).toArray();
      const taskIds = tasks.map(task => task.id).filter((id): id is number => typeof id === 'number');
      await db.tasks.where('projectId').equals(local.id!).delete();
      await db.milestones.where('projectId').equals(local.id!).delete();
      await db.timelineEvents.where('projectId').equals(local.id!).delete();
      await db.diaryEntries.where('projectId').equals(local.id!).delete();
      await db.archNodes.where('projectId').equals(local.id!).delete();
      await db.teamMembers.where('projectId').equals(local.id!).delete();
      await db.syncChanges.where('projectId').equals(local.id!).delete();
      await db.collaborationEvents.where('projectId').equals(local.id!).delete();
      await db.notifications.where('projectId').equals(local.id!).delete();
      await db.inviteLinks.where('projectId').equals(local.id!).delete();
      await db.sprints.where('projectId').equals(local.id!).delete();
      if (taskIds.length > 0) await db.comments.where('taskId').anyOf(taskIds).delete();
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

export async function fetchRecentRemoteSyncRecords(
  session: CloudSession,
  remoteProjectId: string,
  limit = 80
): Promise<RemoteSyncLogRecord[]> {
  const config = assertConfigured();
  const cappedLimit = Math.max(1, Math.min(limit, 200));
  return supabaseFetch(
    `/rest/v1/${config.syncTable}?select=*&remote_project_id=eq.${encodeURIComponent(remoteProjectId)}&order=updated_at.desc&limit=${cappedLimit}`,
    { method: 'GET' },
    session.accessToken
  ) as Promise<RemoteSyncLogRecord[]>;
}

async function pushEntitySnapshot(
  session: CloudSession,
  remoteProjectId: string,
  entityType: SyncEntityType,
  entityId: number | string,
  projectId: number | null,
  payload: Record<string, unknown>,
  updatedAt: string
) {
  const config = assertConfigured();
  const authUserId = getSessionAuthUserId(session);
  const portablePayload = await serializeRemotePayload(remoteProjectId, entityType, payload);
  const snapshot = await ensureSnapshotRemoteId(remoteProjectId, entityType, entityId, portablePayload);
  const record = {
    id: snapshot.recordId,
    user_id: authUserId,
    remote_project_id: remoteProjectId,
    entity_type: entityType,
    entity_id: String(entityId),
    project_id: projectId,
    payload: snapshot.payload,
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

  const pushPermission = await canPushChange(session, remoteProjectId, change);
  if (!pushPermission.allowed) {
    if (change.entityType === 'projects') {
      return true;
    }
    if (change.id && (pushPermission.role === 'viewer' || pushPermission.role == null)) {
      await db.syncChanges.update(change.id, { conflict: true });
    }
    return false;
  }

  if (change.operation === 'delete') {
    const config = assertConfigured();
    const remoteRecordId = typeof change.payload.remoteId === 'string'
      ? change.payload.remoteId
      : getRemoteRecordId(remoteProjectId, change.entityType, change.entityId);
    const tombstone = {
      id: remoteRecordId,
      user_id: getSessionAuthUserId(session),
      remote_project_id: remoteProjectId,
      entity_type: change.entityType,
      entity_id: String(change.entityId),
      project_id: change.projectId,
      payload: change.payload,
      updated_at: change.localUpdatedAt,
      deleted_at: change.localUpdatedAt,
      client_id: getClientId(),
    };
    await supabaseFetch(`/rest/v1/${config.syncTable}?on_conflict=id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(tombstone),
    }, session.accessToken);
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

  return true;
}

async function recordRemoteActivityLegacy(record: RemoteRecord, payload: Record<string, unknown>) {
  if (record.client_id === getClientId() || record.deleted_at) return;
  const projectId = typeof payload.projectId === 'number' ? payload.projectId : record.project_id ?? 0;
  if (record.entity_type === 'comments') {
    await recordCollaborationEvent({
      projectId,
      remoteProjectId: record.remote_project_id,
      userId: record.user_id,
      userName: '远程成员',
      type: 'comment_added',
      targetType: 'comments',
      targetId: record.entity_id,
      title: '新增了任务评论',
      description: '远程成员新增了一条任务评论。',
    });
    return;
  }
  if (record.entity_type !== 'tasks') return;
  const status = payload.status;
  const title = typeof payload.title === 'string' ? payload.title : `任务 ${record.entity_id}`;
  if (status !== 'done') return;
  const exists = await db.collaborationEvents
    .where('projectId')
    .equals(projectId)
    .filter(event => event.type === 'task_completed' && event.targetId === record.entity_id && event.createdAt >= record.updated_at)
    .first();
  if (exists) return;
  await recordCollaborationEvent({
    projectId,
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

function getTaskStatusLabel(status: unknown) {
  if (status === 'todo') return '待办';
  if (status === 'in_progress') return '进行中';
  if (status === 'review') return '待审查';
  if (status === 'done') return '已完成';
  return typeof status === 'string' ? status : '未知状态';
}

async function hasRemoteActivity(projectId: number, type: CollaborationEvent['type'], targetId: number | string | null, updatedAt: string) {
  return db.collaborationEvents
    .where('projectId')
    .equals(projectId)
    .filter(event => event.type === type && event.targetId === targetId && event.createdAt >= updatedAt)
    .first();
}

async function recordRemoteActivity(record: RemoteRecord, payload: Record<string, unknown>, previous?: Record<string, unknown> | null) {
  if (record.client_id === getClientId() || record.deleted_at) return;
  const projectId = typeof payload.projectId === 'number' ? payload.projectId : record.project_id ?? 0;

  if (record.entity_type === 'comments') {
    const exists = await hasRemoteActivity(projectId, 'comment_added', record.entity_id, record.updated_at);
    if (exists) return;
    await recordCollaborationEvent({
      projectId,
      remoteProjectId: record.remote_project_id,
      userId: record.user_id,
      userName: '远程成员',
      type: 'comment_added',
      targetType: 'comments',
      targetId: record.entity_id,
      title: '新增了任务评论',
      description: '远程成员新增了一条任务评论。',
    });
    return;
  }

  if (record.entity_type === 'diaryEntries') {
    const exists = await hasRemoteActivity(projectId, 'diary_created', record.entity_id, record.updated_at);
    if (exists) return;
    await recordCollaborationEvent({
      projectId,
      remoteProjectId: record.remote_project_id,
      userId: record.user_id,
      userName: '远程成员',
      type: 'diary_created',
      targetType: 'diaryEntries',
      targetId: record.entity_id,
      title: previous ? '更新了开发日志' : '创建了开发日志',
      description: `远程成员${previous ? '更新' : '创建'}了 ${String(payload.date || '')} 的开发日志。`,
    });
    return;
  }

  if (record.entity_type === 'milestones' && previous?.status !== payload.status && payload.status === 'completed') {
    const title = typeof payload.title === 'string' ? payload.title : `里程碑 ${record.entity_id}`;
    const exists = await hasRemoteActivity(projectId, 'milestone_completed', record.entity_id, record.updated_at);
    if (exists) return;
    await recordCollaborationEvent({
      projectId,
      remoteProjectId: record.remote_project_id,
      userId: record.user_id,
      userName: '远程成员',
      type: 'milestone_completed',
      targetType: 'milestones',
      targetId: record.entity_id,
      title: `完成了里程碑「${title}」`,
      description: `远程成员完成了里程碑「${title}」。`,
    });
    return;
  }

  if (record.entity_type === 'sprints') {
    const title = typeof payload.name === 'string' ? payload.name : `Sprint ${record.entity_id}`;
    const exists = await hasRemoteActivity(projectId, 'sprint_updated', record.entity_id, record.updated_at);
    if (exists) return;
    await recordCollaborationEvent({
      projectId,
      remoteProjectId: record.remote_project_id,
      userId: record.user_id,
      userName: '远程成员',
      type: 'sprint_updated',
      targetType: 'sprints',
      targetId: record.entity_id,
      title: previous ? `更新了冲刺「${title}」` : `创建了冲刺「${title}」`,
      description: `远程成员${previous ? '更新' : '创建'}了冲刺「${title}」。`,
    });
    return;
  }

  if (record.entity_type === 'archNodes') {
    const title = typeof payload.name === 'string' ? payload.name : `架构节点 ${record.entity_id}`;
    const eventType: CollaborationEvent['type'] = previous ? 'arch_updated' : 'arch_created';
    const exists = await hasRemoteActivity(projectId, eventType, record.entity_id, record.updated_at);
    if (exists) return;
    await recordCollaborationEvent({
      projectId,
      remoteProjectId: record.remote_project_id,
      userId: record.user_id,
      userName: '远程成员',
      type: eventType,
      targetType: 'archNodes',
      targetId: record.entity_id,
      title: previous ? `编辑了架构节点「${title}」` : `创建了架构节点「${title}」`,
      description: `远程成员在架构图中${previous ? '编辑' : '创建'}了「${title}」。`,
    });
    return;
  }

  if (record.entity_type !== 'tasks') return;

  const status = payload.status;
  const title = typeof payload.title === 'string' ? payload.title : `任务 ${record.entity_id}`;

  if (!previous) {
    const exists = await hasRemoteActivity(projectId, 'task_created', record.entity_id, record.updated_at);
    if (exists) return;
    await recordCollaborationEvent({
      projectId,
      remoteProjectId: record.remote_project_id,
      userId: record.user_id,
      userName: '远程成员',
      type: 'task_created',
      targetType: 'tasks',
      targetId: record.entity_id,
      title: `创建了任务「${title}」`,
      description: `远程成员创建了任务「${title}」。`,
    });
    return;
  }

  if (previous.status !== status) {
    const eventType: CollaborationEvent['type'] = status === 'done' ? 'task_completed' : 'task_status_changed';
    const exists = await hasRemoteActivity(projectId, eventType, record.entity_id, record.updated_at);
    if (exists) return;
    await recordCollaborationEvent({
      projectId,
      remoteProjectId: record.remote_project_id,
      userId: record.user_id,
      userName: '远程成员',
      type: eventType,
      targetType: 'tasks',
      targetId: record.entity_id,
      title: status === 'done' ? `完成了任务「${title}」` : `调整了任务状态「${title}」`,
      description: status === 'done'
        ? `远程成员完成了任务「${title}」。`
        : `远程成员将任务「${title}」从 ${getTaskStatusLabel(previous.status)} 调整为 ${getTaskStatusLabel(status)}。`,
    });
    return;
  }

  const exists = await hasRemoteActivity(projectId, 'task_updated', record.entity_id, record.updated_at);
  if (exists) return;
  await recordCollaborationEvent({
    projectId,
    remoteProjectId: record.remote_project_id,
    userId: record.user_id,
    userName: '远程成员',
    type: 'task_updated',
    targetType: 'tasks',
    targetId: record.entity_id,
    title: `更新了任务「${title}」`,
    description: `远程成员更新了任务「${title}」。`,
  });
}

async function recordRemoteDeletionActivity(record: RemoteRecord, existing: unknown, localProjectId: number | null | undefined) {
  if (record.client_id === getClientId()) return;
  const projectId = localProjectId ?? record.project_id ?? 0;
  if (record.entity_type === 'archNodes') {
    const previousNode = existing as Record<string, unknown> | undefined;
    const title = typeof previousNode?.name === 'string' ? previousNode.name : `架构节点 ${record.entity_id}`;
    const exists = await hasRemoteActivity(projectId, 'arch_deleted', record.entity_id, record.updated_at);
    if (exists) return;
    await recordCollaborationEvent({
      projectId,
      remoteProjectId: record.remote_project_id,
      userId: record.user_id,
      userName: '远程成员',
      type: 'arch_deleted',
      targetType: 'archNodes',
      targetId: record.entity_id,
      title: `删除了架构节点「${title}」`,
      description: `远程成员在架构图中删除了「${title}」。`,
    });
    return;
  }
  if (record.entity_type !== 'tasks') return;
  const previousTask = existing as Record<string, unknown> | undefined;
  const title = typeof previousTask?.title === 'string' ? previousTask.title : `任务 ${record.entity_id}`;
  const exists = await hasRemoteActivity(projectId, 'task_deleted', record.entity_id, record.updated_at);
  if (exists) return;
  await recordCollaborationEvent({
    projectId,
    remoteProjectId: record.remote_project_id,
    userId: record.user_id,
    userName: '远程成员',
    type: 'task_deleted',
    targetType: 'tasks',
    targetId: record.entity_id,
    title: `删除了任务「${title}」`,
    description: `远程成员删除了任务「${title}」。`,
  });
}

async function applyRemoteRecord(record: RemoteRecord, pending: SyncChange[]) {
  if (DEPRECATED_SYNC_ENTITY_TYPES.has(record.entity_type)) return;
  const table = tableMap[record.entity_type];
  if (!table) return;

  const remoteIdentity = record.id;
  const localPending = pending.find(change => (
    change.entityType === record.entity_type &&
    (String(change.entityId) === String(record.entity_id) || change.payload.remoteId === remoteIdentity)
  ));
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
    if (record.entity_type === 'projects') {
      if (!record.remote_project_id) return;
      const existingProject = record.remote_project_id
        ? await db.projects.where('remoteProjectId').equals(record.remote_project_id).first()
        : null;
      if (record.deleted_at) {
        if (existingProject?.id) await db.projects.delete(existingProject.id);
        return;
      }
      const payload = {
        ...record.payload,
        id: existingProject?.id,
        remoteProjectId: record.remote_project_id,
        updatedAt: record.updated_at,
      };
      if (existingProject?.id) {
        await db.projects.update(existingProject.id, payload);
        await mergeDuplicateSharedProjects(record.remote_project_id, existingProject.id);
      } else {
        const addedId = await db.projects.add({ ...payload, id: undefined } as never);
        await mergeDuplicateSharedProjects(record.remote_project_id, addedId);
      }
      return;
    }

    const localProject = record.remote_project_id
      ? await db.projects.where('remoteProjectId').equals(record.remote_project_id).first()
      : null;
    const existing = await table
      .filter(item => {
        const value = item as { remoteId?: string | null; projectId?: number };
        return value.remoteId === remoteIdentity || value.remoteId === (record.payload as { remoteId?: string | null }).remoteId;
      })
      .first();

    if (record.deleted_at) {
      const targetId = (existing as { id?: number | string } | undefined)?.id;
      if (typeof targetId === 'number' || typeof targetId === 'string') await table.delete(targetId as never);
      await recordRemoteDeletionActivity(record, existing, localProject?.id);
      return;
    }

    const previous = existing ? { ...(existing as unknown as Record<string, unknown>) } : null;
    const payload = await deserializeRemotePayload(record, localProject?.id, {
      ...record.payload,
      id: (existing as { id?: number | string } | undefined)?.id ?? (record.payload as { id?: number | string }).id ?? record.entity_id,
      projectId: localProject?.id ?? record.project_id,
      remoteProjectId: (record.payload as { remoteProjectId?: string | null }).remoteProjectId,
      remoteId: remoteIdentity,
      syncUpdatedAt: record.updated_at,
    });
    await table.put(payload as never);
    await recordRemoteActivity(record, payload, previous);
  });
}

async function repairArchNodeParents(projectIds: number[]) {
  for (const projectId of [...new Set(projectIds)]) {
    await normalizeArchRootNodes(projectId);
  }
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
  await touchMemberPresence(session).catch(() => undefined);

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
  const localArchProjectIds = (await db.projects.toArray())
    .filter(project => project.remoteProjectId && remoteProjectIds.includes(project.remoteProjectId))
    .map(project => project.id)
    .filter((id): id is number => typeof id === 'number');
  await repairArchNodeParents(localArchProjectIds);

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

const APP_BASE_URL_KEY = 'devtrack-app-base-url';

export function getAppBaseUrl() {
  const custom = getCustomBaseUrl();
  if (custom) return custom.replace(/\/$/, '');
  const base = import.meta.env.BASE_URL || '/';
  return new URL(base, window.location.origin).toString().replace(/\/$/, '');
}

export function getCustomBaseUrl(): string {
  try {
    return localStorage.getItem(APP_BASE_URL_KEY) || '';
  } catch {
    return '';
  }
}

export function setCustomBaseUrl(url: string) {
  try {
    if (url) {
      localStorage.setItem(APP_BASE_URL_KEY, url);
    } else {
      localStorage.removeItem(APP_BASE_URL_KEY);
    }
  } catch { /* localStorage unavailable */ }
}

export function buildInviteUrl(projectId: number, role: TeamMember['role']) {
  const token = btoa(JSON.stringify({ projectId, role, createdAt: Date.now() }));
  return `${getAppBaseUrl()}/invite/${token}`;
}

export async function publishProjectToCloud(session: CloudSession, project: Project): Promise<string> {
  assertConfigured();
  const remoteId = project.remoteProjectId || createClientId();
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

  const [tasks, milestones, timelineEvents, diaryEntries, archNodes] = await Promise.all([
    db.tasks.where('projectId').equals(project.id!).toArray(),
    db.milestones.where('projectId').equals(project.id!).toArray(),
    db.timelineEvents.where('projectId').equals(project.id!).toArray(),
    db.diaryEntries.where('projectId').equals(project.id!).toArray(),
    db.archNodes.where('projectId').equals(project.id!).toArray(),
  ]);
  const taskIds = tasks.map(task => task.id).filter((id): id is number => typeof id === 'number');
  const comments = taskIds.length > 0 ? await db.comments.where('taskId').anyOf(taskIds).toArray() : [];
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
  for (const node of archNodes) {
    await pushEntitySnapshot(session, remoteId, 'archNodes', node.id, node.projectId, node as unknown as Record<string, unknown>, node.updatedAt);
  }
  for (const comment of comments) {
    if (comment.id) await pushEntitySnapshot(session, remoteId, 'comments', comment.id, project.id!, comment as unknown as Record<string, unknown>, comment.createdAt);
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

async function fetchCurrentRemoteMembers(session: CloudSession, remoteProjectId: string): Promise<RemoteMemberRow[]> {
  const config = assertConfigured();
  const authUserId = encodeURIComponent(getSessionAuthUserId(session));
  const email = encodeURIComponent(session.user.email);
  return supabaseFetch(
    `/rest/v1/${config.memberTable}?select=*&project_id=eq.${encodeURIComponent(remoteProjectId)}&or=(user_id.eq.${authUserId},email.eq.${email})`,
    { method: 'GET' },
    session.accessToken
  ) as Promise<RemoteMemberRow[]>;
}

export async function touchMemberPresence(session: CloudSession, projectId?: number | null): Promise<number> {
  if (!navigator.onLine) return 0;
  const authUserId = getSessionAuthUserId(session);
  const now = new Date().toISOString();
  const projects = projectId
    ? (await Promise.all([db.projects.get(projectId)])).filter(Boolean) as Project[]
    : await db.projects.filter(project => Boolean(project.remoteProjectId)).toArray();

  let touched = 0;
  for (const project of projects) {
    if (!project.id || !project.remoteProjectId) continue;
    const existing = await db.teamMembers.where({ projectId: project.id, userId: authUserId }).first();
    if (existing?.id) {
      await db.teamMembers.update(existing.id, {
        email: session.user.email,
        displayName: session.user.displayName,
        online: true,
        lastSeenAt: now,
      });
    }
    try {
      await supabaseFetch('/rest/v1/rpc/devtrack_touch_member_presence', {
        method: 'POST',
        body: JSON.stringify({
          p_project_id: project.remoteProjectId,
          p_email: session.user.email,
          p_display_name: session.user.displayName,
        }),
      }, session.accessToken);
      touched += 1;
    } catch {
      // Presence is best-effort and should never block normal project syncing.
    }
  }
  return touched;
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

export function parseRemoteInvite(input: string): RemoteInvitePayload | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const token = (() => {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split('/').filter(Boolean);
      const inviteIndex = parts.findIndex(part => part === 'invite');
      return inviteIndex >= 0 ? parts[inviteIndex + 1] : '';
    } catch {
      const parts = trimmed.split('/').filter(Boolean);
      const inviteIndex = parts.findIndex(part => part === 'invite');
      return inviteIndex >= 0 ? parts[inviteIndex + 1] : trimmed;
    }
  })();

  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token)) as Partial<RemoteInvitePayload>;
    if (!payload.remoteProjectId || !payload.role || !['owner', 'editor', 'viewer'].includes(payload.role)) return null;
    return {
      remoteProjectId: payload.remoteProjectId,
      role: payload.role,
      createdAt: payload.createdAt,
    };
  } catch {
    return null;
  }
}

export async function joinRemoteProject(session: CloudSession, remoteProjectId: string, role: TeamMember['role']) {
  const authUserId = getSessionAuthUserId(session);
  if (role === 'owner') {
    throw new Error('邀请链接不能授予所有者权限。请由当前 Owner 在团队协作中执行“转让所有权”。');
  }

  const existingMembers = await fetchCurrentRemoteMembers(session, remoteProjectId).catch(() => []);
  const existingMember = existingMembers.find(member => member.user_id === authUserId)
    ?? existingMembers.find(member => member.email?.toLowerCase() === session.user.email.toLowerCase());

  if (existingMember?.role === 'owner') {
    await touchMemberPresence(session);
    return importSharedProjects(session);
  }

  try {
    await supabaseFetch('/rest/v1/rpc/devtrack_join_project', {
      method: 'POST',
      body: JSON.stringify({
        p_project_id: remoteProjectId,
        p_role: role,
        p_email: session.user.email,
        p_display_name: session.user.displayName,
      }),
    }, session.accessToken) as RemoteJoinProjectResult[];
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('devtrack_join_project') && !message.includes('schema cache')) {
      throw error;
    }
    if (existingMember) {
      throw new Error('Supabase 数据库缺少 devtrack_join_project 迁移，无法把邮箱邀请绑定到真实账号。请先执行 supabase/sql/migrations/join-project-safety.sql。', { cause: error });
    }
    await upsertRemoteMember(session, remoteProjectId, {
      userId: authUserId,
      role,
      email: session.user.email,
      displayName: session.user.displayName,
      online: true,
      lastSeenAt: new Date().toISOString(),
    });
  }

  return importSharedProjects(session);
}
