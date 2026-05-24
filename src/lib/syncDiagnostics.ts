import { db } from '../db/database';
import type { Project, SyncChange, SyncState, TeamMember, User } from '../types';
import type { CloudSession } from './cloudSync';

export interface SyncDiagnosticsReport {
  generatedAt: string;
  currentUserId: string | null;
  jwtSub: string | null;
  localUserId: string | null;
  currentProjectId: number | null;
  currentProjectName: string | null;
  remoteProjectId: string | null;
  pendingChanges: number;
  conflictChanges: number;
  orphanChanges: number;
  lastSyncStatus: SyncState['syncStatus'];
  lastSyncedAt: string | null;
  lastSyncError: string;
  role: TeamMember['role'] | null;
  checks: Array<{
    key: string;
    label: string;
    status: 'ok' | 'warn' | 'fail';
    detail: string;
  }>;
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

export function getJwtSub(session: CloudSession | null) {
  if (!session?.accessToken) return null;
  const sub = decodeJwtPayload(session.accessToken)?.sub;
  return typeof sub === 'string' ? sub : null;
}

function isOrphanChange(change: SyncChange, projects: Project[]) {
  if (change.conflict) return false;
  if (change.remoteProjectId || typeof change.payload.remoteProjectId === 'string') return false;
  const projectId = change.entityType === 'projects' ? change.entityId : change.projectId;
  if (!projectId) return true;
  const project = projects.find(item => item.id === projectId);
  return !project || !project.remoteProjectId;
}

export async function buildSyncDiagnostics(params: {
  session: CloudSession | null;
  user: User | null;
  currentProjectId: number | null;
  syncState: SyncState;
  lastError: string;
  role: TeamMember['role'] | null;
}): Promise<SyncDiagnosticsReport> {
  const [projects, changes] = await Promise.all([
    db.projects.toArray(),
    db.syncChanges.toArray(),
  ]);
  const project = projects.find(item => item.id === params.currentProjectId) ?? null;
  const jwtSub = getJwtSub(params.session);
  const conflictChanges = changes.filter(change => change.conflict).length;
  const orphanChanges = changes.filter(change => isOrphanChange(change, projects)).length;

  const checks: SyncDiagnosticsReport['checks'] = [
    {
      key: 'session',
      label: 'Supabase 登录状态',
      status: params.session ? 'ok' : 'fail',
      detail: params.session ? '已登录，可进行远程同步' : '未登录，无法发布或同步共享项目',
    },
    {
      key: 'jwt',
      label: 'JWT 用户标识',
      status: jwtSub && params.user?.id && jwtSub === params.user.id ? 'ok' : jwtSub ? 'warn' : 'fail',
      detail: jwtSub ? `JWT sub: ${jwtSub}` : '未读取到 JWT sub',
    },
    {
      key: 'project',
      label: '远程项目绑定',
      status: project?.remoteProjectId ? 'ok' : 'warn',
      detail: project?.remoteProjectId ? `remoteProjectId: ${project.remoteProjectId}` : '当前项目尚未发布到 Supabase',
    },
    {
      key: 'queue',
      label: '待同步队列',
      status: changes.length === 0 ? 'ok' : orphanChanges > 0 || conflictChanges > 0 ? 'warn' : 'ok',
      detail: `待同步 ${changes.length}，冲突 ${conflictChanges}，孤儿队列 ${orphanChanges}`,
    },
    {
      key: 'role',
      label: '当前权限',
      status: params.role === 'owner' || params.role === 'editor' || params.role === 'viewer' || (!project?.remoteProjectId && params.currentProjectId) ? 'ok' : 'fail',
      detail: params.role ? `当前角色：${params.role}` : project?.remoteProjectId ? '未找到当前用户成员角色' : '本地未共享项目视为所有者',
    },
    {
      key: 'last-error',
      label: '最近同步错误',
      status: params.lastError ? 'warn' : 'ok',
      detail: params.lastError || '暂无同步错误',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    currentUserId: params.user?.id ?? null,
    jwtSub,
    localUserId: params.user?.id ?? null,
    currentProjectId: params.currentProjectId,
    currentProjectName: project?.name ?? null,
    remoteProjectId: project?.remoteProjectId ?? null,
    pendingChanges: changes.length,
    conflictChanges,
    orphanChanges,
    lastSyncStatus: params.syncState.syncStatus,
    lastSyncedAt: params.syncState.lastSyncedAt,
    lastSyncError: params.lastError,
    role: params.role,
    checks,
  };
}

export async function clearOrphanSyncChanges() {
  const [projects, changes] = await Promise.all([
    db.projects.toArray(),
    db.syncChanges.toArray(),
  ]);
  const orphanIds = changes
    .filter(change => isOrphanChange(change, projects))
    .map(change => change.id)
    .filter((id): id is number => typeof id === 'number');
  await Promise.all(orphanIds.map(id => db.syncChanges.delete(id)));
  return orphanIds.length;
}

export function downloadDiagnosticsReport(report: SyncDiagnosticsReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `devtrack-sync-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
