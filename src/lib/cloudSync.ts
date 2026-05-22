import { db, withoutSyncTracking } from '../db/database';
import type { CollaborationEvent, Project, SyncChange, SyncEntityType, SyncState, TeamMember, User } from '../types';

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
    url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
    syncTable: (import.meta.env.VITE_SUPABASE_SYNC_TABLE as string | undefined) || 'devtrack_sync_records',
    projectTable: (import.meta.env.VITE_SUPABASE_PROJECT_TABLE as string | undefined) || 'devtrack_projects',
    memberTable: (import.meta.env.VITE_SUPABASE_MEMBER_TABLE as string | undefined) || 'devtrack_project_members',
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

function assertConfigured(): { url: string; anonKey: string; syncTable: string; projectTable: string; memberTable: string } {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    throw new Error('请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。');
  }
  return { url: config.url, anonKey: config.anonKey, syncTable: config.syncTable, projectTable: config.projectTable, memberTable: config.memberTable };
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
  const userId = encodeURIComponent(session.user.id);
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
  const localProjectIds: number[] = [];

  for (const remoteProject of projects) {
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

  return localProjectIds;
}

async function getRemoteRecords(session: CloudSession, remoteProjectIds: string[]): Promise<RemoteRecord[]> {
  const config = assertConfigured();
  if (remoteProjectIds.length === 0) return [];
  const ids = remoteProjectIds.map(id => `"${id}"`).join(',');
  const query = `/rest/v1/${config.syncTable}?select=*&remote_project_id=in.(${encodeURIComponent(ids)})`;
  return supabaseFetch(query, { method: 'GET' }, session.accessToken) as Promise<RemoteRecord[]>;
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
  const record = {
    id: getRemoteRecordId(remoteProjectId, entityType, entityId),
    user_id: session.user.id,
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

async function pushChange(change: SyncChange, session: CloudSession): Promise<boolean> {
  const remoteProjectId = change.remoteProjectId || (change.projectId ? (await db.projects.get(change.projectId))?.remoteProjectId : null);
  if (!remoteProjectId) return false;
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
      body: JSON.stringify({ deleted_at: change.localUpdatedAt, updated_at: change.localUpdatedAt, user_id: session.user.id, client_id: getClientId() }),
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
    const pendingChanges = await db.syncChanges.count();
    return { lastSyncedAt: localStorage.getItem('devtrack-last-synced-at'), pendingChanges, syncStatus: 'offline' };
  }

  await importSharedProjects(session);

  const remoteProjectIds = [...new Set((await db.projects.toArray()).map(project => project.remoteProjectId).filter(Boolean) as string[])];
  const pending = await db.syncChanges.toArray();
  for (const change of pending) {
    const pushed = await pushChange(change, session);
    if (pushed && change.id) await db.syncChanges.delete(change.id);
  }

  const remoteRecords = await getRemoteRecords(session, remoteProjectIds);
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
  const remoteProject = {
    id: remoteId,
    owner_id: session.user.id,
    name: project.name,
    payload: { ...project, remoteProjectId: remoteId },
    created_at: project.createdAt || now,
    updated_at: now,
  };
  await supabaseFetch(`/rest/v1/${config.projectTable}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(remoteProject),
  }, session.accessToken);
  await supabaseFetch(`/rest/v1/${config.memberTable}?on_conflict=project_id,user_id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      project_id: remoteId,
      user_id: session.user.id,
      role: 'owner',
      email: session.user.email,
      display_name: session.user.displayName,
      joined_at: now,
      last_seen_at: now,
    }),
  }, session.accessToken);

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

  const existing = await db.teamMembers.where({ projectId: project.id!, userId: session.user.id }).first();
  if (!existing) {
    await db.teamMembers.add({
      projectId: project.id!,
      userId: session.user.id,
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
    userId: session.user.id,
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
  await upsertRemoteMember(session, remoteProjectId, {
    userId: session.user.id,
    role,
    email: session.user.email,
    displayName: session.user.displayName,
    online: true,
    lastSeenAt: new Date().toISOString(),
  });
  await importSharedProjects(session);
}
