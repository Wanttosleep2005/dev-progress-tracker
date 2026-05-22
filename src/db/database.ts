import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Achievement, DiaryEntry, Milestone, Project, Task, TimelineEvent } from '../types';

class DevTrackDatabase extends Dexie {
  projects!: Table<Project, number>;
  tasks!: Table<Task, number>;
  milestones!: Table<Milestone, number>;
  timelineEvents!: Table<TimelineEvent, number>;
  diaryEntries!: Table<DiaryEntry, number>;
  achievements!: Table<Achievement, number>;

  constructor() {
    super('DevTrackDB');
    this.version(7)
      .stores({
        projects: '++id, status, createdAt',
        tasks: '++id, projectId, status, priority, milestoneId, dueDate, isTodayTask, remindAt, createdAt',
        milestones: '++id, projectId, status, dueDate, createdAt',
        timelineEvents: '++id, projectId, type, date, relatedTaskId',
        diaryEntries: '++id, projectId, date',
        achievements: '++id, &key',
      })
      .upgrade(async tx => {
        const projects = await tx.table('projects').toArray();
        for (const project of projects) {
          if (!('deadline' in project)) {
            await tx.table('projects').update(project.id, { deadline: null });
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
          if (Object.keys(patch).length > 0) {
            await tx.table('tasks').update(task.id, patch);
          }
        }

        const milestones = await tx.table('milestones').toArray();
        for (const milestone of milestones) {
          if (!('type' in milestone)) {
            await tx.table('milestones').update(milestone.id, { type: 'progress' });
          }
        }
      });
  }
}

export const db = new DevTrackDatabase();

export async function getAllProjects(): Promise<Project[]> {
  return db.projects.orderBy('createdAt').reverse().toArray();
}

export async function getProject(id: number): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = new Date().toISOString();
  return db.projects.add({ ...project, createdAt: now, updatedAt: now });
}

export async function updateProject(id: number, changes: Partial<Project>): Promise<number> {
  return db.projects.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function deleteProject(id: number): Promise<void> {
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
  return db.tasks.add({ ...task, createdAt: now, updatedAt: now });
}

export async function updateTask(id: number, changes: Partial<Task>): Promise<number> {
  return db.tasks.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function deleteTask(id: number): Promise<void> {
  await db.tasks.delete(id);
}

export async function getMilestonesByProject(projectId: number): Promise<Milestone[]> {
  return db.milestones.where('projectId').equals(projectId).toArray();
}

export async function addMilestone(milestone: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = new Date().toISOString();
  return db.milestones.add({ ...milestone, createdAt: now, updatedAt: now });
}

export async function updateMilestone(id: number, changes: Partial<Milestone>): Promise<number> {
  return db.milestones.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function deleteMilestone(id: number): Promise<void> {
  await db.milestones.delete(id);
}

export async function getEventsByProject(projectId: number): Promise<TimelineEvent[]> {
  return db.timelineEvents.where('projectId').equals(projectId).reverse().sortBy('date');
}

export async function addEvent(event: Omit<TimelineEvent, 'id' | 'createdAt'>): Promise<number> {
  return db.timelineEvents.add({ ...event, createdAt: new Date().toISOString() });
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
  await db.timelineEvents.delete(id);
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
    return existing.id;
  }

  return db.diaryEntries.add({ ...entry, createdAt: now, updatedAt: now });
}

export async function deleteDiaryEntry(id: number): Promise<void> {
  await db.diaryEntries.delete(id);
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
