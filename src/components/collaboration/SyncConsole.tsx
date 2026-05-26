import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, RefreshCw, Trash2, X } from 'lucide-react';
import { db } from '../../db/database';
import { fetchRecentRemoteSyncRecords } from '../../lib/cloudSync';
import { buildSyncDiagnostics, downloadDiagnosticsReport } from '../../lib/syncDiagnostics';
import { useAppStore } from '../../stores/useAppStore';
import { useCloudStore } from '../../stores/useCloudStore';
import { useToast } from '../../stores/useToast';
import type { CollaborationEvent, SyncChange, SyncEntityType, SyncOperation } from '../../types';
import type { RemoteSyncLogRecord } from '../../lib/cloudSync';

interface SyncConsoleProps {
  onClose: () => void;
}

interface LogEntry {
  id: number;
  time: string;
  level: 'info' | 'success' | 'warn' | 'error';
  entity?: SyncEntityType | 'members' | 'realtime' | 'system' | 'error';
  operation?: SyncOperation | 'presence' | 'status' | 'event';
  detail: string;
  result?: string;
}

const MAX_LOGS = 200;

function formatClock(value: string | null | undefined) {
  if (!value) return '未同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatShortClock(value: string | null | undefined) {
  if (!value) return '未同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

function relativeOffline(value: string | null | undefined) {
  if (!value) return '未同步';
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta) || delta < 0) return '刚刚';
  if (delta < 60_000) return '刚刚';
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `离线 ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  return `离线 ${hours}h`;
}

function realtimeLabel(status: string) {
  if (status === 'connected') return '已连接';
  if (status === 'syncing') return '同步中';
  if (status === 'connecting') return '连接中';
  if (status === 'disconnected') return '已断开';
  if (status === 'error') return '异常';
  return '待命';
}

function statusLevel(status: string): LogEntry['level'] {
  if (status === 'error') return 'error';
  if (status === 'disconnected' || status === 'offline' || status === 'conflict') return 'warn';
  if (status === 'connected' || status === 'synced') return 'success';
  return 'info';
}

function entityTitle(payload: Record<string, unknown>) {
  const candidates = [payload.title, payload.name, payload.date, payload.content];
  const value = candidates.find(item => typeof item === 'string' && item.trim());
  if (typeof value !== 'string') return '';
  return value.length > 22 ? `${value.slice(0, 22)}...` : value;
}

function syncChangeToLog(change: SyncChange): Omit<LogEntry, 'id' | 'time'> {
  return {
    level: change.conflict ? 'warn' : 'info',
    entity: change.entityType,
    operation: change.operation,
    detail: entityTitle(change.payload) || String(change.entityId),
    result: change.conflict ? '冲突待处理' : '待推送',
  };
}

function collaborationEventToLog(event: CollaborationEvent): Omit<LogEntry, 'id' | 'time'> {
  return {
    level: event.type.includes('deleted') ? 'warn' : 'success',
    entity: event.targetType === 'project' ? 'system' : event.targetType,
    operation: 'event',
    detail: event.title,
    result: event.userName,
  };
}

function remoteRecordTitle(record: RemoteSyncLogRecord) {
  return entityTitle(record.payload || {}) || String(record.entity_id);
}

function remoteRecordOperation(record: RemoteSyncLogRecord): SyncOperation {
  return record.deleted_at ? 'delete' : 'upsert';
}

function levelIcon(level: LogEntry['level']) {
  if (level === 'success') return '✓';
  if (level === 'warn') return '!';
  if (level === 'error') return '✗';
  return '→';
}

function levelClass(level: LogEntry['level']) {
  if (level === 'success') return 'text-emerald-300';
  if (level === 'warn') return 'text-amber-300';
  if (level === 'error') return 'text-rose-300';
  return 'text-cyan-200';
}

export default function SyncConsole({ onClose }: SyncConsoleProps) {
  const projects = useAppStore(state => state.projects);
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const session = useCloudStore(state => state.session);
  const user = useCloudStore(state => state.user);
  const syncState = useCloudStore(state => state.syncState);
  const realtimeStatus = useCloudStore(state => state.realtimeStatus);
  const members = useCloudStore(state => state.members);
  const error = useCloudStore(state => state.error);
  const getRole = useCloudStore(state => state.getRole);
  const syncNow = useCloudStore(state => state.syncNow);
  const addToast = useToast(state => state.add);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [syncChanges, setSyncChanges] = useState<SyncChange[]>([]);
  const [remoteRecords, setRemoteRecords] = useState<RemoteSyncLogRecord[]>([]);
  const [remoteError, setRemoteError] = useState('');
  const [remoteRefreshing, setRemoteRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const nextId = useRef(1);
  const lastEventId = useRef<number | null>(null);
  const lastRemoteRecordId = useRef<string | null>(null);

  const currentProject = useMemo(
    () => projects.find(project => project.id === currentProjectId),
    [currentProjectId, projects]
  );
  const remoteProjectId = currentProject?.remoteProjectId || null;
  const role = useMemo(() => getRole(currentProjectId), [currentProjectId, getRole, members]);

  const appendLog = useCallback((entry: Omit<LogEntry, 'id' | 'time'>) => {
    const next: LogEntry = {
      id: nextId.current++,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      ...entry,
    };
    setLogs(current => [next, ...current].slice(0, MAX_LOGS));
  }, []);

  const refreshRemoteRecords = useCallback(async () => {
    if (!session || !remoteProjectId) {
      setRemoteRecords([]);
      setRemoteError(remoteProjectId ? '未登录，无法读取云端同步流水。' : '当前项目还没有绑定云端项目。');
      return;
    }

    setRemoteRefreshing(true);
    try {
      const records = await fetchRecentRemoteSyncRecords(session, remoteProjectId, 80);
      setRemoteRecords(records);
      setRemoteError('');

      const newest = records[0];
      if (newest && newest.id !== lastRemoteRecordId.current) {
        lastRemoteRecordId.current = newest.id;
        // 云端流水来自 Supabase sync_records，因此 Owner 可以看到队友已成功推送的记录。
        appendLog({
          level: newest.deleted_at ? 'warn' : 'success',
          entity: newest.entity_type,
          operation: remoteRecordOperation(newest),
          detail: remoteRecordTitle(newest),
          result: '云端已记录',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '读取云端同步流水失败';
      setRemoteError(message);
      appendLog({ level: 'error', entity: 'error', operation: 'status', detail: message, result: '云端读取失败' });
    } finally {
      setRemoteRefreshing(false);
    }
  }, [appendLog, remoteProjectId, session]);

  const refreshLocalStreams = useCallback(async () => {
    const [changes, events] = await Promise.all([
      db.syncChanges.orderBy('localUpdatedAt').reverse().limit(8).toArray(),
      currentProjectId
        ? db.collaborationEvents.where('projectId').equals(currentProjectId).reverse().sortBy('createdAt')
        : Promise.resolve([]),
    ]);
    setSyncChanges(changes);

    const newest = events[0];
    if (newest?.id && newest.id !== lastEventId.current) {
      lastEventId.current = newest.id;
      appendLog(collaborationEventToLog(newest));
    }
  }, [appendLog, currentProjectId]);

  useEffect(() => {
    appendLog({
      level: statusLevel(realtimeStatus),
      entity: 'realtime',
      operation: 'status',
      detail: `Realtime ${realtimeLabel(realtimeStatus)}`,
      result: `待同步 ${syncState.pendingChanges}`,
    });
  }, [appendLog, realtimeStatus, syncState.pendingChanges]);

  useEffect(() => {
    appendLog({
      level: statusLevel(syncState.syncStatus),
      entity: 'system',
      operation: 'status',
      detail: `同步状态 ${syncState.syncStatus}`,
      result: `待同步 ${syncState.pendingChanges}`,
    });
    refreshLocalStreams().catch(() => undefined);
    refreshRemoteRecords().catch(() => undefined);
  }, [appendLog, refreshLocalStreams, refreshRemoteRecords, syncState.syncStatus, syncState.pendingChanges, syncState.lastSyncedAt]);

  useEffect(() => {
    if (!error) return;
    appendLog({
      level: 'error',
      entity: 'error',
      operation: 'status',
      detail: error,
      result: '需要检查',
    });
  }, [appendLog, error]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshLocalStreams().catch(() => undefined);
      refreshRemoteRecords().catch(() => undefined);
    }, 5000);
    refreshLocalStreams().catch(() => undefined);
    refreshRemoteRecords().catch(() => undefined);
    return () => window.clearInterval(timer);
  }, [refreshLocalStreams, refreshRemoteRecords]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const report = await buildSyncDiagnostics({
        session,
        user,
        currentProjectId,
        syncState,
        lastError: error || remoteError,
        role,
      });
      downloadDiagnosticsReport(report);
      appendLog({ level: 'success', entity: 'system', operation: 'status', detail: '导出同步诊断', result: '已下载' });
    } finally {
      setExporting(false);
    }
  };

  const handleForceSync = async () => {
    appendLog({ level: 'info', entity: 'system', operation: 'status', detail: '手动触发同步', result: '执行中' });
    await syncNow();
    await Promise.all([refreshLocalStreams(), refreshRemoteRecords()]);
    addToast('已触发同步', 'success');
  };

  const memberByUserId = useMemo(() => {
    const map = new Map<string, { displayName?: string; email?: string }>();
    members.forEach(member => map.set(member.userId, member));
    if (user) map.set(user.id, { displayName: user.displayName, email: user.email });
    return map;
  }, [members, user]);

  const latestRemoteByUser = useMemo(() => {
    const map = new Map<string, RemoteSyncLogRecord>();
    remoteRecords.forEach(record => {
      const existing = map.get(record.user_id);
      if (!existing || new Date(record.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
        map.set(record.user_id, record);
      }
    });
    return map;
  }, [remoteRecords]);

  const actorName = useCallback((record: RemoteSyncLogRecord) => {
    const member = memberByUserId.get(record.user_id);
    return member?.displayName || member?.email || record.user_id.slice(0, 8);
  }, [memberByUserId]);

  const queueByEntity = useMemo(() => {
    const counts = new Map<string, number>();
    syncChanges.forEach(change => counts.set(change.entityType, (counts.get(change.entityType) ?? 0) + 1));
    return [...counts.entries()].map(([entity, count]) => `${entity}:${count}`).join('  ');
  }, [syncChanges]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ x: -24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -24, opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="fixed left-[292px] top-0 z-[9999] flex h-screen w-[440px] flex-col overflow-hidden border-r border-emerald-500/20 bg-[#0a0e14] font-mono text-[11px] text-slate-200 shadow-2xl shadow-black/60"
      >
        <div className="border-b border-emerald-500/15 bg-emerald-500/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-emerald-200">DevTrack 同步控制台</p>
              <p className="mt-1 text-[10px] text-slate-500">owner-only cloud sync observer</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white">
              <X size={15} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2">
              <p className="text-slate-500">实时</p>
              <p className={levelClass(statusLevel(realtimeStatus))}>● {realtimeLabel(realtimeStatus)}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2">
              <p className="text-slate-500">本机待推</p>
              <p className={syncState.pendingChanges > 0 ? 'text-amber-300' : 'text-emerald-300'}>{syncState.pendingChanges}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2">
              <p className="text-slate-500">上次</p>
              <p className="text-slate-200">{formatShortClock(syncState.lastSyncedAt)}</p>
            </div>
          </div>
          {queueByEntity && <p className="mt-2 truncate text-[10px] text-slate-500">local queue {queueByEntity}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <section>
            <div className="mb-2 flex items-center justify-between border-b border-white/[0.06] pb-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">cloud sync records</p>
              <button
                onClick={() => refreshRemoteRecords().catch(() => undefined)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-white/[0.05] hover:text-white"
              >
                <RefreshCw size={11} className={remoteRefreshing ? 'animate-spin' : ''} />
                刷新
              </button>
            </div>
            <div className="space-y-1.5">
              {remoteRecords.slice(0, 12).map(record => {
                const operation = remoteRecordOperation(record);
                return (
                  <div key={record.id} className="rounded-lg bg-white/[0.025] px-2 py-1.5">
                    <span className="text-slate-500">[{formatClock(record.updated_at)}]</span>{' '}
                    <span className={record.deleted_at ? 'text-amber-300' : 'text-emerald-300'}>{record.deleted_at ? '!' : '✓'}</span>{' '}
                    <span className="text-slate-400">{actorName(record)}</span>{' '}
                    <span className="text-cyan-200">{record.entity_type}:{operation}</span>{' '}
                    <span className="text-slate-300">"{remoteRecordTitle(record)}"</span>{' '}
                    <span className="text-slate-500">→ 已到云端</span>
                  </div>
                );
              })}
              {remoteError && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-2 text-rose-200">{remoteError}</div>
              )}
              {!remoteError && remoteRecords.length === 0 && (
                <div className="rounded-lg bg-white/[0.025] px-2 py-2 text-slate-500">暂未读取到队员云端同步流水。</div>
              )}
            </div>
          </section>

          <section className="mt-5">
            <p className="mb-2 border-b border-white/[0.06] pb-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">local pending queue</p>
            <div className="space-y-1.5">
              {syncChanges.slice(0, 5).map(change => {
                const preview = syncChangeToLog(change);
                return (
                  <div key={change.id ?? `${change.entityType}-${change.entityId}`} className="rounded-lg bg-white/[0.025] px-2 py-1.5">
                    <span className="text-slate-500">[{formatClock(change.localUpdatedAt)}]</span>{' '}
                    <span className={levelClass(preview.level)}>{levelIcon(preview.level)}</span>{' '}
                    <span className="text-cyan-200">{change.entityType}:{change.operation}</span>{' '}
                    <span className="text-slate-300">"{preview.detail}"</span>{' '}
                    <span className="text-slate-500">→ {preview.result}</span>
                  </div>
                );
              })}
              {syncChanges.length === 0 && (
                <div className="rounded-lg bg-white/[0.025] px-2 py-2 text-slate-500">本机没有待推送变更。</div>
              )}
            </div>
          </section>

          <section className="mt-5">
            <p className="mb-2 border-b border-white/[0.06] pb-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">live log</p>
            <div className="space-y-1.5">
              {logs.map(log => (
                <div key={log.id} className="rounded-lg bg-black/20 px-2 py-1.5">
                  <span className="text-slate-500">[{log.time}]</span>{' '}
                  <span className={levelClass(log.level)}>{levelIcon(log.level)}</span>{' '}
                  <span className="text-cyan-200">{log.entity ?? 'system'}:{log.operation ?? 'status'}</span>{' '}
                  <span className={log.level === 'error' ? 'text-rose-200' : 'text-slate-300'}>"{log.detail}"</span>{' '}
                  {log.result && <span className="text-slate-500">→ {log.result}</span>}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <p className="mb-2 border-b border-white/[0.06] pb-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">team members</p>
            <div className="space-y-2">
              {members.length === 0 && <div className="rounded-lg bg-white/[0.025] px-2 py-2 text-slate-500">当前项目暂无成员缓存。</div>}
              {members.map(member => {
                const latestRemote = latestRemoteByUser.get(member.userId);
                const isSelf = member.userId === user?.id || member.email === user?.email;
                return (
                  <div key={member.id ?? member.userId} className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-slate-200">
                        <span className={member.online ? 'text-emerald-300' : 'text-slate-600'}>●</span>{' '}
                        {member.displayName || member.email || member.userId}
                      </p>
                      <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-slate-400">{member.role}</span>
                    </div>
                    <p className="mt-1 text-slate-500">
                      最后在线 {formatShortClock(member.lastSeenAt)} · {member.online ? '在线' : relativeOffline(member.lastSeenAt)}
                    </p>
                    <p className="mt-1 text-slate-500">
                      云端最近同步 {latestRemote ? formatShortClock(latestRemote.updated_at) : '未看到同步记录'}
                    </p>
                    <p className="mt-1 text-slate-500">
                      本机待推 {isSelf ? syncState.pendingChanges : '不可直接读取'}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-emerald-500/15 bg-black/20 p-3">
          <button onClick={() => setLogs([])} className="flex items-center justify-center gap-1 rounded-xl border border-white/[0.06] px-2 py-2 text-slate-300 hover:bg-white/[0.05]">
            <Trash2 size={13} />
            清空日志
          </button>
          <button disabled={exporting} onClick={handleExport} className="flex items-center justify-center gap-1 rounded-xl border border-white/[0.06] px-2 py-2 text-slate-300 hover:bg-white/[0.05] disabled:opacity-50">
            <Download size={13} />
            导出诊断
          </button>
          <button onClick={handleForceSync} className="flex items-center justify-center gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2 py-2 text-emerald-200 hover:bg-emerald-500/20">
            <RefreshCw size={13} />
            全量同步
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
