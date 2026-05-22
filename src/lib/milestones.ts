import { db, getMilestonesByProject, getTasksByProject, updateMilestone } from '../db/database';
import type { MilestoneStatus } from '../types';

function getProgressStatus(progress: number, hasTasks: boolean): MilestoneStatus {
  if (!hasTasks) return 'upcoming';
  if (progress >= 100) return 'completed';
  return 'active';
}

export async function refreshMilestoneProgress(projectId: number, milestoneId: number) {
  const tasks = await getTasksByProject(projectId);
  const linkedTasks = tasks.filter(task => task.milestoneId === milestoneId);
  const doneCount = linkedTasks.filter(task => task.status === 'done').length;
  const progress = linkedTasks.length > 0 ? Math.round((doneCount / linkedTasks.length) * 100) : 0;
  await updateMilestone(milestoneId, {
    progress,
    status: getProgressStatus(progress, linkedTasks.length > 0),
  });
}

export async function refreshMilestonesForTaskChange(
  projectId: number,
  previousMilestoneId?: number | null,
  nextMilestoneId?: number | null
) {
  const ids = new Set<number>();
  if (typeof previousMilestoneId === 'number') ids.add(previousMilestoneId);
  if (typeof nextMilestoneId === 'number') ids.add(nextMilestoneId);
  await Promise.all([...ids].map(id => refreshMilestoneProgress(projectId, id)));
}

export async function refreshAllMilestonesByProject(projectId: number) {
  const milestones = await getMilestonesByProject(projectId);
  await Promise.all(
    milestones
      .filter(milestone => milestone.type === 'progress' && milestone.id)
      .map(milestone => refreshMilestoneProgress(projectId, milestone.id!))
  );
}

export async function refreshAllMilestonesInDatabase() {
  const milestones = await db.milestones.toArray();
  const progressMilestones = milestones.filter(milestone => milestone.type === 'progress' && milestone.id);
  await Promise.all(
    progressMilestones.map(milestone => refreshMilestoneProgress(milestone.projectId, milestone.id!))
  );
}
