import { db, getUserSetting, setUserSetting, withoutSyncTracking } from '../db/database';
import { useCloudStore } from '../stores/useCloudStore';
import type { Project } from '../types';

export interface DevTrackBackup {
  version: 1;
  exportedAt: string;
  app: 'devtrack';
  data: {
    projects: unknown[];
    tasks: unknown[];
    milestones: unknown[];
    timelineEvents: unknown[];
    diaryEntries: unknown[];
    achievements: unknown[];
    users: unknown[];
    teamMembers: unknown[];
    syncChanges: unknown[];
    collaborationEvents: unknown[];
    notifications: unknown[];
    inviteLinks: unknown[];
    sprints: unknown[];
    comments: unknown[];
    archNodes?: unknown[];
    userSettings?: unknown[];
    localStorage: Record<string, string>;
  };
}

const LOCAL_STORAGE_KEYS = [
  'devtrack-focus-sessions',
  'devtrack-pomodoro-config',
  'devtrack-weekly-focus-goal',
  'devtrack-sidebar-visibility',
  'devtrack-custom-base-url',
  'devtrack-animations',
  'devtrack-theme',
  'devtrack-backup-directory',
  'devtrack-backup-directory-label',
];

export const BACKUP_DIRECTORY_KEY = 'devtrack-backup-directory';
export const BACKUP_DIRECTORY_LABEL_KEY = 'devtrack-backup-directory-label';
const BACKUP_HANDLE_DB = 'DevTrackBackupHandles';
const BACKUP_HANDLE_STORE = 'handles';
const BACKUP_DIRECTORY_HANDLE_KEY = 'backup-directory';

type DirectoryHandleLike = {
  name?: string;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<{
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
};

function openBackupHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_HANDLE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BACKUP_HANDLE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getBackupUserId() {
  return useCloudStore.getState().user?.id ?? null;
}

function getBackupHandleKey() {
  return `${BACKUP_DIRECTORY_HANDLE_KEY}:${getBackupUserId() || 'local'}`;
}

async function getStoredBackupDirectoryHandle(): Promise<DirectoryHandleLike | null> {
  const database = await openBackupHandleDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BACKUP_HANDLE_STORE, 'readonly');
    const request = transaction.objectStore(BACKUP_HANDLE_STORE).get(getBackupHandleKey());
    request.onsuccess = () => resolve((request.result as DirectoryHandleLike | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function saveBackupDirectoryHandle(handle: DirectoryHandleLike) {
  const database = await openBackupHandleDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(BACKUP_HANDLE_STORE, 'readwrite');
    transaction.objectStore(BACKUP_HANDLE_STORE).put(handle, getBackupHandleKey());
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function ensureDirectoryPermission(handle: DirectoryHandleLike) {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  const descriptor = { mode: 'readwrite' as const };
  if (await handle.queryPermission(descriptor) === 'granted') return true;
  return await handle.requestPermission(descriptor) === 'granted';
}

export async function getBackupDirectory() {
  const userId = getBackupUserId();
  if (!userId) return localStorage.getItem(BACKUP_DIRECTORY_KEY) || '';
  return getUserSetting(userId, BACKUP_DIRECTORY_KEY);
}

export async function getBackupDirectoryLabel() {
  const userId = getBackupUserId();
  if (!userId) return localStorage.getItem(BACKUP_DIRECTORY_LABEL_KEY) || localStorage.getItem(BACKUP_DIRECTORY_KEY) || '';
  return (await getUserSetting(userId, BACKUP_DIRECTORY_LABEL_KEY)) || await getBackupDirectory();
}

export async function setBackupDirectory(directory: string) {
  const value = directory.trim();
  const userId = getBackupUserId();
  if (userId) {
    await setUserSetting(userId, BACKUP_DIRECTORY_KEY, value);
    await setUserSetting(userId, BACKUP_DIRECTORY_LABEL_KEY, value);
    return;
  }
  if (value) {
    localStorage.setItem(BACKUP_DIRECTORY_KEY, value);
    localStorage.setItem(BACKUP_DIRECTORY_LABEL_KEY, value);
  } else {
    localStorage.removeItem(BACKUP_DIRECTORY_KEY);
    localStorage.removeItem(BACKUP_DIRECTORY_LABEL_KEY);
  }
}

export function createBackupFileName(prefix = 'devtrack-data-backup') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}-${stamp}.json`;
}

export async function selectBackupDirectory() {
  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (!picker) {
    throw new Error('当前浏览器不支持直接选择文件夹，请暂时手动填写备份目录');
  }
  const handle = await picker();
  await saveBackupDirectoryHandle(handle);
  const label = handle.name ? `已选择文件夹：${handle.name}` : '已选择浏览器授权文件夹';
  const userId = getBackupUserId();
  if (userId) {
    await setUserSetting(userId, BACKUP_DIRECTORY_LABEL_KEY, label);
  } else {
    localStorage.setItem(BACKUP_DIRECTORY_LABEL_KEY, label);
  }
  return label;
}

async function writeBackupToPickedDirectory(backup: DevTrackBackup) {
  const handle = await getStoredBackupDirectoryHandle();
  if (!handle) return null;
  if (!await ensureDirectoryPermission(handle)) {
    throw new Error('没有备份文件夹写入权限，请在设置里重新选择文件夹');
  }
  const filename = createBackupFileName();
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(backup, null, 2));
  await writable.close();
  return handle.name ? `${handle.name}\\${filename}` : filename;
}

export async function writeBackupToConfiguredDirectory(backup: DevTrackBackup) {
  const pickedPath = await writeBackupToPickedDirectory(backup);
  if (pickedPath) return pickedPath;

  const directory = await getBackupDirectory();
  if (!directory) {
    throw new Error('请先在设置里填写备份文件存放目录');
  }

  const response = await fetch('/__devtrack/write-backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directory,
      filename: createBackupFileName(),
      content: JSON.stringify(backup, null, 2),
    }),
  });

  const result = await response.json().catch(() => ({})) as { path?: string; error?: string };
  if (!response.ok) {
    throw new Error(result.error || '写入备份目录失败');
  }
  return result.path || directory;
}

export async function createBackup(): Promise<DevTrackBackup> {
  const localStorageData: Record<string, string> = {};
  for (const key of LOCAL_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) localStorageData[key] = value;
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'devtrack',
    data: {
      projects: await db.projects.toArray(),
      tasks: await db.tasks.toArray(),
      milestones: await db.milestones.toArray(),
      timelineEvents: await db.timelineEvents.toArray(),
      diaryEntries: await db.diaryEntries.toArray(),
      achievements: await db.achievements.toArray(),
      users: await db.users.toArray(),
      teamMembers: await db.teamMembers.toArray(),
      syncChanges: await db.syncChanges.toArray(),
      collaborationEvents: await db.collaborationEvents.toArray(),
      notifications: await db.notifications.toArray(),
      inviteLinks: await db.inviteLinks.toArray(),
      sprints: await db.sprints.toArray(),
      comments: await db.comments.toArray(),
      archNodes: await db.archNodes.toArray(),
      userSettings: await db.userSettings.toArray(),
      localStorage: localStorageData,
    },
  };
}

export function validateBackup(input: unknown): DevTrackBackup {
  const backup = input as Partial<DevTrackBackup>;
  if (backup.app !== 'devtrack' || backup.version !== 1 || !backup.data) {
    throw new Error('这不是有效的 DevTrack 备份文件');
  }
  return backup as DevTrackBackup;
}

function collectReferencedProjectIds(backup: DevTrackBackup) {
  const ids = new Set<number>();
  const addProjectId = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) ids.add(value);
  };

  for (const table of [
    backup.data.tasks,
    backup.data.milestones,
    backup.data.timelineEvents,
    backup.data.diaryEntries,
    backup.data.teamMembers,
    backup.data.collaborationEvents,
    backup.data.notifications,
    backup.data.inviteLinks,
    backup.data.sprints,
    backup.data.syncChanges,
    backup.data.archNodes || [],
  ]) {
    for (const row of table) {
      addProjectId((row as { projectId?: unknown }).projectId);
    }
  }

  for (const change of backup.data.syncChanges) {
    const row = change as { entityType?: unknown; entityId?: unknown };
    if (row.entityType === 'projects') addProjectId(row.entityId);
  }

  return ids;
}

function createRecoveredProject(id: number, exportedAt: string): Project {
  return {
    id,
    remoteProjectId: null,
    name: `从还原点恢复的项目 ${id}`,
    description: '该项目由还原点中的任务、里程碑或日志引用自动补建。原项目记录未包含在该还原点中，请按需重命名。',
    color: '#6366f1',
    icon: 'restore',
    status: 'active',
    deadline: null,
    createdAt: exportedAt,
    updatedAt: exportedAt,
  };
}

function normalizeBackupForRestore(backup: DevTrackBackup): DevTrackBackup {
  const projects = [...(backup.data.projects || [])] as Project[];
  const existingProjectIds = new Set(projects.map(project => project.id).filter((id): id is number => typeof id === 'number'));
  const referencedProjectIds = collectReferencedProjectIds(backup);
  const recoveredProjects = [...referencedProjectIds]
    .filter(id => !existingProjectIds.has(id))
    .map(id => createRecoveredProject(id, backup.exportedAt));

  if (recoveredProjects.length === 0) return backup;
  return {
    ...backup,
    data: {
      ...backup.data,
      projects: [...projects, ...recoveredProjects],
    },
  };
}

export async function restoreBackup(backup: DevTrackBackup) {
  const normalizedBackup = normalizeBackupForRestore(backup);
  await withoutSyncTracking(async () => {
    await db.transaction('rw', [
      db.projects,
      db.tasks,
      db.milestones,
      db.timelineEvents,
      db.diaryEntries,
      db.achievements,
      db.users,
      db.teamMembers,
      db.syncChanges,
      db.collaborationEvents,
      db.notifications,
      db.inviteLinks,
      db.sprints,
      db.comments,
      db.archNodes,
      db.userSettings,
    ], async () => {
      await Promise.all([
        db.projects.clear(),
        db.tasks.clear(),
        db.milestones.clear(),
        db.timelineEvents.clear(),
        db.diaryEntries.clear(),
        db.achievements.clear(),
        db.users.clear(),
        db.teamMembers.clear(),
        db.syncChanges.clear(),
        db.collaborationEvents.clear(),
        db.notifications.clear(),
        db.inviteLinks.clear(),
        db.sprints.clear(),
        db.comments.clear(),
        db.archNodes.clear(),
        db.userSettings.clear(),
      ]);

      await Promise.all([
        db.projects.bulkPut(normalizedBackup.data.projects as never[]),
        db.tasks.bulkPut(normalizedBackup.data.tasks as never[]),
        db.milestones.bulkPut(normalizedBackup.data.milestones as never[]),
        db.timelineEvents.bulkPut(normalizedBackup.data.timelineEvents as never[]),
        db.diaryEntries.bulkPut(normalizedBackup.data.diaryEntries as never[]),
        db.achievements.bulkPut(normalizedBackup.data.achievements as never[]),
        db.users.bulkPut(normalizedBackup.data.users as never[]),
        db.teamMembers.bulkPut(normalizedBackup.data.teamMembers as never[]),
        db.syncChanges.bulkPut(normalizedBackup.data.syncChanges as never[]),
        db.collaborationEvents.bulkPut(normalizedBackup.data.collaborationEvents as never[]),
        db.notifications.bulkPut(normalizedBackup.data.notifications as never[]),
        db.inviteLinks.bulkPut(normalizedBackup.data.inviteLinks as never[]),
        db.sprints.bulkPut(normalizedBackup.data.sprints as never[]),
        db.comments.bulkPut(normalizedBackup.data.comments as never[]),
        db.archNodes.bulkPut((normalizedBackup.data.archNodes || []) as never[]),
        db.userSettings.bulkPut((normalizedBackup.data.userSettings || []) as never[]),
      ]);
    });
  });

  Object.entries(normalizedBackup.data.localStorage || {}).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
}

export function backupSummary(backup: DevTrackBackup) {
  const referencedProjectIds = collectReferencedProjectIds(backup);
  const projectIds = new Set((backup.data.projects || []).map(project => (project as Project).id).filter((id): id is number => typeof id === 'number'));
  return {
    projects: backup.data.projects.length,
    recoveredProjects: [...referencedProjectIds].filter(id => !projectIds.has(id)).length,
    tasks: backup.data.tasks.length,
    milestones: backup.data.milestones.length,
    diaryEntries: backup.data.diaryEntries.length,
    exportedAt: backup.exportedAt,
  };
}
