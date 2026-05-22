import { formatDurationDeltaText, formatDurationFromMinutes } from './duration';
import { useStatsStore } from '../stores/useStatsStore';
import { analyzeProjectRisk } from './riskAnalysis';
import type { DiaryEntry, Milestone, Project, Task } from '../types';

export function getTaskActualMinutes(
  taskId: number | null | undefined,
  taskTitle: string | undefined,
  projectId: number | null | undefined
) {
  const sessions = useStatsStore.getState().sessions;
  return sessions
    .filter(session => {
      if (taskId && session.taskId === taskId) return true;
      if (projectId && session.projectId !== projectId) return false;
      return !!taskTitle && session.taskTitle === taskTitle;
    })
    .reduce((sum, session) => sum + session.minutes, 0);
}

export function buildWeeklyReport(input: {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  diaryEntries: DiaryEntry[];
}) {
  const { project, tasks, milestones, diaryEntries } = input;
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().split('T')[0];
  const nowStr = now.toISOString().split('T')[0];

  const completedTasks = tasks.filter(task => task.status === 'done' && task.updatedAt >= weekStr);
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress');
  const createdTasks = tasks.filter(task => task.createdAt >= weekStr);
  const activeMilestones = milestones.filter(milestone => milestone.status !== 'completed');
  const recentDiary = diaryEntries.filter(entry => entry.date >= weekStr);
  const riskAlerts = analyzeProjectRisk({
    project,
    tasks,
    milestones,
    diaryEntries,
    sessions: useStatsStore.getState().sessions,
  });

  const effortDeltaLines = tasks
    .filter(task => task.estimatedMinutes)
    .map(task => {
      const actual = getTaskActualMinutes(task.id, task.title, task.projectId);
      if (actual <= 0) return null;
      const estimate = task.estimatedMinutes ?? 0;
      const delta = actual - estimate;
      const deltaText = formatDurationDeltaText(delta);
      return `- **${task.title}**：预估 ${formatDurationFromMinutes(estimate, { allowZero: true })}，实际 ${formatDurationFromMinutes(actual, { allowZero: true })}，${deltaText}`;
    })
    .filter(Boolean)
    .slice(0, 8)
    .join('\n');

  return {
    fileName: `devtrack-weekly-${project.name}-${nowStr}.md`,
    content: `# 周报 (${weekAgo.toLocaleDateString('zh-CN')} - ${now.toLocaleDateString('zh-CN')})

## 项目概况
- 项目：${project.name}
- 完成任务：${completedTasks.length}
- 进行中任务：${inProgressTasks.length}
- 新增任务：${createdTasks.length}
- 活跃里程碑：${activeMilestones.length}
- 风险提醒：${riskAlerts.length}

## 本周完成
${completedTasks.map(task => `- [x] **${task.title}** ${task.url ? `[链接](${task.url})` : ''}`).join('\n') || '- 暂无'}

## 持续推进中
${inProgressTasks.map(task => `- [ ] **${task.title}**`).join('\n') || '- 暂无'}

## 风险预警
${riskAlerts.map(alert => `- **${alert.title}**：${alert.description}`).join('\n') || '- 当前没有明显风险'}

## 工时偏差
${effortDeltaLines || '- 本周暂无可计算的预估/实际工时数据'}

## 日志与复盘
${recentDiary.map(entry => `- ${entry.date}：${entry.content.replace(/\n+/g, ' ').slice(0, 80)}`).join('\n') || '- 本周暂无日志记录'}

---
*由 DevTrack 自动生成*
`,
  };
}
