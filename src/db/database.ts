import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  Achievement,
  CollaborationEvent,
  DiaryEntry,
  InviteLink,
  Milestone,
  Notification,
  Project,
  SyncChange,
  Task,
  TeamMember,
  TimelineEvent,
  User,
} from '../types';

class DevTrackDatabase extends Dexie {
  projects!: Table<Project, number>;
  tasks!: Table<Task, number>;
  milestones!: Table<Milestone, number>;
  timelineEvents!: Table<TimelineEvent, number>;
  diaryEntries!: Table<DiaryEntry, number>;
  achievements!: Table<Achievement, number>;
  users!: Table<User, string>;
  teamMembers!: Table<TeamMember, number>;
  syncChanges!: Table<SyncChange, number>;
  collaborationEvents!: Table<CollaborationEvent, number>;
  notifications!: Table<Notification, number>;
  inviteLinks!: Table<InviteLink, number>;

  constructor() {
    super('DevTrackDB');
    this.version(10)
      .stores({
        projects: '++id, remoteProjectId, status, createdAt',
        tasks: '++id, projectId, status, priority, milestoneId, dueDate, isTodayTask, remindAt, assigneeId, recurrence, createdAt',
        milestones: '++id, projectId, status, dueDate, createdAt',
        timelineEvents: '++id, projectId, type, date, relatedTaskId',
        diaryEntries: '++id, projectId, date',
        achievements: '++id, &key',
        users: '&id, email, createdAt',
        teamMembers: '++id, projectId, userId, role, joinedAt',
        syncChanges: '++id, [entityType+entityId], projectId, localUpdatedAt, conflict',
        collaborationEvents: '++id, projectId, userId, type, createdAt',
        notifications: '++id, type, read, projectId, createdAt',
        inviteLinks: '++id, projectId, token, createdBy, createdAt',
      })
      .upgrade(async tx => {
        const tasks = await tx.table('tasks').toArray();
        for (const task of tasks) {
          const patch: Partial<Task> = {};
          if (!('recurrence' in task)) patch.recurrence = 'none';
          if (Object.keys(patch).length > 0) {
            await tx.table('tasks').update(task.id, patch);
          }
        }
      })
      .upgrade(async tx => {
        const projects = await tx.table('projects').toArray();
        for (const project of projects) {
          const patch: Partial<Project> = {};
          if (!('deadline' in project)) patch.deadline = null;
          if (!('remoteProjectId' in project)) patch.remoteProjectId = null;
          if (Object.keys(patch).length > 0) {
            await tx.table('projects').update(project.id, patch);
          }
        }

        const tasks = await tx.table('tasks').toArray();
        for (const task of tasks) {
          const patch: Partial<Task> = {};
          if (!('url' in task)) patch.url = '';
          if (!('estimatedMinutes' in task)) patch.estimatedMinutes = null;
          if (!('source' in task)) patch.source = 'board';
          if (!('remindAt' in task)) patch.remindAt = null;
          if (!('isTodayTask' in task)) patch.isTodayTask = false;
          if (!('publishedAt' in task)) patch.publishedAt = null;
          if (!('plannedStartAt' in task)) patch.plannedStartAt = null;
          if (!('plannedEndAt' in task)) patch.plannedEndAt = null;
          if (!('assigneeId' in task)) patch.assigneeId = null;
          if (!('dependencyIds' in task)) patch.dependencyIds = [];
          if (!('dependsOn' in task)) patch.dependsOn = task.dependencyIds ?? [];
          if (!('createdBy' in task)) patch.createdBy = null;
          if (!('updatedBy' in task)) patch.updatedBy = null;
          if (!('remoteId' in task)) patch.remoteId = null;
          if (!('syncUpdatedAt' in task)) patch.syncUpdatedAt = task.updatedAt ?? null;
          if (Object.keys(patch).length > 0) {
            await tx.table('tasks').update(task.id, patch);
          }
        }

        const milestones = await tx.table('milestones').toArray();
        for (const milestone of milestones) {
          const patch: Partial<Milestone> = {};
          if (!('type' in milestone)) patch.type = 'progress';
          if (!('createdBy' in milestone)) patch.createdBy = null;
          if (!('updatedBy' in milestone)) patch.updatedBy = null;
          if (!('remoteId' in milestone)) patch.remoteId = null;
          if (!('syncUpdatedAt' in milestone)) patch.syncUpdatedAt = milestone.updatedAt ?? null;
          if (Object.keys(patch).length > 0) {
            await tx.table('milestones').update(milestone.id, patch);
          }
        }
      });
  }
}

export const db = new DevTrackDatabase();

let suppressSyncTracking = false;

export async function withoutSyncTracking<T>(operation: () => Promise<T>): Promise<T> {
  suppressSyncTracking = true;
  try {
    return await operation();
  } finally {
    suppressSyncTracking = false;
  }
}

async function queueSyncChange(
  entityType: SyncChange['entityType'],
  entityId: number,
  projectId: number | null,
  operation: SyncChange['operation'],
  payload: Record<string, unknown>,
  baseUpdatedAt: string | null,
  remoteProjectIdOverride?: string | null
) {
  if (suppressSyncTracking) return;
  const localUpdatedAt = new Date().toISOString();
  const existing = await db.syncChanges.where('[entityType+entityId]').equals([entityType, entityId]).first();
  const next: Omit<SyncChange, 'id'> = {
    entityType,
    entityId,
    projectId,
    remoteProjectId: remoteProjectIdOverride ?? (projectId ? (await db.projects.get(projectId))?.remoteProjectId ?? null : null),
    operation,
    payload,
    baseUpdatedAt,
    localUpdatedAt,
    conflict: false,
  };
  if (existing?.id) {
    await db.syncChanges.update(existing.id, next);
  } else {
    await db.syncChanges.add(next);
  }
}

export async function getAllProjects(): Promise<Project[]> {
  return db.projects.orderBy('createdAt').reverse().toArray();
}

export async function getProject(id: number): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = new Date().toISOString();
  const record = { ...project, createdAt: now, updatedAt: now };
  const id = await db.projects.add(record);
  await queueSyncChange('projects', id, id, 'upsert', { ...record, id }, null);
  return id;
}

export async function updateProject(id: number, changes: Partial<Project>): Promise<number> {
  const before = await db.projects.get(id);
  const patch = { ...changes, updatedAt: new Date().toISOString() };
  const result = await db.projects.update(id, patch);
  const after = await db.projects.get(id);
  if (after) await queueSyncChange('projects', id, id, 'upsert', after as unknown as Record<string, unknown>, before?.updatedAt ?? null);
  return result;
}

export async function deleteProject(id: number): Promise<void> {
  const before = await db.projects.get(id);
  await queueSyncChange('projects', id, id, 'delete', { id, remoteProjectId: before?.remoteProjectId ?? null }, before?.updatedAt ?? null, before?.remoteProjectId ?? null);
  await db.projects.delete(id);
  await db.tasks.where('projectId').equals(id).delete();
  await db.milestones.where('projectId').equals(id).delete();
  await db.timelineEvents.where('projectId').equals(id).delete();
  await db.diaryEntries.where('projectId').equals(id).delete();
}

export async function cloneProject(id: number, newName: string): Promise<number> {
  const source = await db.projects.get(id);
  if (!source) {
    throw new Error('Project not found');
  }

  const { id: _sourceId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
  const now = new Date().toISOString();
  const newProjectId = await db.projects.add({
    ...rest,
    name: newName,
    createdAt: now,
    updatedAt: now,
  });

  const tasks = await db.tasks.where('projectId').equals(id).toArray();
  for (const task of tasks) {
    const { id: _taskId, createdAt: _taskCreatedAt, updatedAt: _taskUpdatedAt, ...taskRest } = task;
    await db.tasks.add({ ...taskRest, projectId: newProjectId, createdAt: now, updatedAt: now });
  }

  const milestones = await db.milestones.where('projectId').equals(id).toArray();
  for (const milestone of milestones) {
    const { id: _milestoneId, createdAt: _milestoneCreatedAt, updatedAt: _milestoneUpdatedAt, ...milestoneRest } = milestone;
    await db.milestones.add({
      ...milestoneRest,
      projectId: newProjectId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return newProjectId;
}

export async function getTasksByProject(projectId: number): Promise<Task[]> {
  return db.tasks.where('projectId').equals(projectId).toArray();
}

export async function addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = new Date().toISOString();
  const record = { ...task, createdAt: now, updatedAt: now, syncUpdatedAt: now };
  const id = await db.tasks.add(record);
  await queueSyncChange('tasks', id, task.projectId, 'upsert', { ...record, id }, null);
  return id;
}

export async function updateTask(id: number, changes: Partial<Task>): Promise<number> {
  const before = await db.tasks.get(id);
  const patch = { ...changes, updatedAt: new Date().toISOString(), syncUpdatedAt: new Date().toISOString() };
  const result = await db.tasks.update(id, patch);
  const after = await db.tasks.get(id);
  if (after) await queueSyncChange('tasks', id, after.projectId, 'upsert', after as unknown as Record<string, unknown>, before?.updatedAt ?? null);
  return result;
}

export async function deleteTask(id: number): Promise<void> {
  const before = await db.tasks.get(id);
  await db.tasks.delete(id);
  await queueSyncChange('tasks', id, before?.projectId ?? null, 'delete', { id }, before?.updatedAt ?? null);
}

export async function getMilestonesByProject(projectId: number): Promise<Milestone[]> {
  return db.milestones.where('projectId').equals(projectId).toArray();
}

export async function addMilestone(milestone: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = new Date().toISOString();
  const record = { ...milestone, createdAt: now, updatedAt: now, syncUpdatedAt: now };
  const id = await db.milestones.add(record);
  await queueSyncChange('milestones', id, milestone.projectId, 'upsert', { ...record, id }, null);
  return id;
}

export async function updateMilestone(id: number, changes: Partial<Milestone>): Promise<number> {
  const before = await db.milestones.get(id);
  const patch = { ...changes, updatedAt: new Date().toISOString(), syncUpdatedAt: new Date().toISOString() };
  const result = await db.milestones.update(id, patch);
  const after = await db.milestones.get(id);
  if (after) await queueSyncChange('milestones', id, after.projectId, 'upsert', after as unknown as Record<string, unknown>, before?.updatedAt ?? null);
  return result;
}

export async function deleteMilestone(id: number): Promise<void> {
  const before = await db.milestones.get(id);
  await db.milestones.delete(id);
  await queueSyncChange('milestones', id, before?.projectId ?? null, 'delete', { id }, before?.updatedAt ?? null);
}

export async function getEventsByProject(projectId: number): Promise<TimelineEvent[]> {
  return db.timelineEvents.where('projectId').equals(projectId).reverse().sortBy('date');
}

export async function addEvent(event: Omit<TimelineEvent, 'id' | 'createdAt'>): Promise<number> {
  const record = { ...event, createdAt: new Date().toISOString() };
  const id = await db.timelineEvents.add(record);
  await queueSyncChange('timelineEvents', id, event.projectId, 'upsert', { ...record, id }, null);
  return id;
}

export async function findEventBySource(projectId: number, sourceKey: string): Promise<TimelineEvent | undefined> {
  const events = await db.timelineEvents.where('projectId').equals(projectId).toArray();
  return events.find(event => event.sourceKey === sourceKey);
}

export async function ensureSystemEvent(event: Omit<TimelineEvent, 'id' | 'createdAt'>): Promise<number> {
  if (!event.sourceKey) {
    return addEvent({ ...event, source: 'system' });
  }

  const existing = await findEventBySource(event.projectId, event.sourceKey);
  if (existing?.id) {
    return existing.id;
  }

  return addEvent({ ...event, source: 'system' });
}

export async function deleteEvent(id: number): Promise<void> {
  const before = await db.timelineEvents.get(id);
  await db.timelineEvents.delete(id);
  await queueSyncChange('timelineEvents', id, before?.projectId ?? null, 'delete', { id }, null);
}

export async function getDiaryByProject(projectId: number): Promise<DiaryEntry[]> {
  return db.diaryEntries.where('projectId').equals(projectId).toArray();
}

export async function getDiaryEntry(projectId: number, date: string): Promise<DiaryEntry | undefined> {
  return db.diaryEntries.where({ projectId, date }).first();
}

export async function upsertDiaryEntry(entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const existing = await db.diaryEntries.where({ projectId: entry.projectId, date: entry.date }).first();
  const now = new Date().toISOString();

  if (existing?.id) {
    await db.diaryEntries.update(existing.id, { ...entry, updatedAt: now });
    const after = await db.diaryEntries.get(existing.id);
    if (after) await queueSyncChange('diaryEntries', existing.id, entry.projectId, 'upsert', after as unknown as Record<string, unknown>, existing.updatedAt);
    return existing.id;
  }

  const record = { ...entry, createdAt: now, updatedAt: now };
  const id = await db.diaryEntries.add(record);
  await queueSyncChange('diaryEntries', id, entry.projectId, 'upsert', { ...record, id }, null);
  return id;
}

export async function deleteDiaryEntry(id: number): Promise<void> {
  const before = await db.diaryEntries.get(id);
  await db.diaryEntries.delete(id);
  await queueSyncChange('diaryEntries', id, before?.projectId ?? null, 'delete', { id }, before?.updatedAt ?? null);
}

export async function getAllAchievements(): Promise<Achievement[]> {
  return db.achievements.toArray();
}

export async function unlockAchievement(key: string): Promise<void> {
  const existing = await db.achievements.where('key').equals(key).first();
  if (existing && !existing.unlockedAt) {
    await db.achievements.update(existing.id!, { unlockedAt: new Date().toISOString() });
  }
}

export async function seedAchievements(achievements: Omit<Achievement, 'id' | 'unlockedAt'>[]): Promise<void> {
  const count = await db.achievements.count();
  if (count === 0) {
    for (const achievement of achievements) {
      await db.achievements.add({ ...achievement, unlockedAt: null });
    }
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  return db.notifications.where('read').equals(false).count();
}

export async function getNotifications(limit = 50): Promise<Notification[]> {
  return db.notifications.orderBy('createdAt').reverse().limit(limit).toArray();
}

export async function addNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<number> {
  const record = { ...notification, read: false, createdAt: new Date().toISOString() };
  return db.notifications.add(record);
}

export async function markNotificationRead(id: number): Promise<void> {
  await db.notifications.update(id, { read: true });
}

export async function markAllNotificationsRead(): Promise<void> {
  await db.notifications.where('read').equals(false).modify({ read: true });
}

export async function clearNotifications(): Promise<void> {
  await db.notifications.clear();
}
