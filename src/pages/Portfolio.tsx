import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BriefcaseBusiness, Clock3, FolderKanban, Target, TrendingUp } from 'lucide-react';
import { db } from '../db/database';
import RiskPanel from '../components/RiskPanel';
import ProjectFolderIcon from '../components/ProjectFolderIcon';
import { useAppStore } from '../stores/useAppStore';
import { useStatsStore } from '../stores/useStatsStore';
import { analyzeProjectRisk, getProjectHealthScore, summarizeRiskLevel } from '../lib/riskAnalysis';
import type { DiaryEntry, Milestone, Task } from '../types';

export default function Portfolio() {
  const { projects, setCurrentProject } = useAppStore();
  const sessions = useStatsStore(state => state.sessions);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([]);
  const [allDiaryEntries, setAllDiaryEntries] = useState<DiaryEntry[]>([]);

  useEffect(() => {
    let active = true;
    async function loadAll() {
      const [tasks, milestones, diaryEntries] = await Promise.all([
        db.tasks.toArray(),
        db.milestones.toArray(),
        db.diaryEntries.toArray(),
      ]);

      if (!active) return;
      setAllTasks(tasks);
      setAllMilestones(milestones);
      setAllDiaryEntries(diaryEntries);
    }

    loadAll();
    return () => {
      active = false;
    };
  }, [projects.length]);

  const summaries = useMemo(() => {
    return projects.map(project => {
      const projectTasks = allTasks.filter(task => task.projectId === project.id);
      const projectMilestones = allMilestones.filter(milestone => milestone.projectId === project.id);
      const projectEntries = allDiaryEntries.filter(entry => entry.projectId === project.id);
      const alerts = analyzeProjectRisk({
        project,
        tasks: projectTasks,
        milestones: projectMilestones,
        diaryEntries: projectEntries,
        sessions,
      });

      return {
        project,
        projectTasks,
        projectMilestones,
        alerts,
        health: getProjectHealthScore(alerts, projectTasks, projectMilestones),
        riskLevel: summarizeRiskLevel(alerts),
        focusMinutes: sessions
          .filter(session => session.projectId === project.id)
          .reduce((sum, session) => sum + session.minutes, 0),
      };
    });
  }, [allDiaryEntries, allMilestones, allTasks, projects, sessions]);

  const allAlerts = summaries.flatMap(summary => summary.alerts);
  const urgentTasks = summaries.flatMap(summary =>
    summary.projectTasks.filter(task => task.priority === 'urgent' && task.status !== 'done')
  );
  const dueSoonTasks = summaries.flatMap(summary =>
    summary.projectTasks.filter(task => {
      if (task.status === 'done' || !task.dueDate) return false;
      const threeDaysLater = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
      return task.dueDate <= threeDaysLater;
    })
  );

  const stats = [
    { label: '活跃项目', value: projects.length, icon: BriefcaseBusiness, color: 'text-indigo-300' },
    { label: '风险提醒', value: allAlerts.length, icon: Clock3, color: 'text-rose-400' },
    { label: '紧急任务', value: urgentTasks.length, icon: FolderKanban, color: 'text-amber-400' },
    { label: '临期任务', value: dueSoonTasks.length, icon: Target, color: 'text-cyan-400' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">项目总览</h2>
          <p className="mt-1 text-sm text-slate-400">
            跨项目查看健康度、风险密度、专注投入与交付节奏，适合每天开工前快速扫一眼。
          </p>
        </div>
        <div className="rounded-[24px] border border-sky-500/20 bg-sky-500/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-sky-200">
            <TrendingUp size={15} />
            优先关注高风险与低健康分项目
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.label} className="glass rounded-[28px] p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">{stat.label}</span>
              <stat.icon size={16} className={stat.color} />
            </div>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <RiskPanel alerts={allAlerts.slice(0, 4)} compact />

      <div className="grid gap-4 xl:grid-cols-2">
        {summaries.map(summary => {
          const { project, projectTasks, projectMilestones, alerts, health, riskLevel, focusMinutes } = summary;
          const doneTasks = projectTasks.filter(task => task.status === 'done').length;
          const riskTone =
            riskLevel === 'high' ? 'text-rose-400' : riskLevel === 'medium' ? 'text-amber-400' : 'text-emerald-400';

          return (
            <button
              key={project.id}
              onClick={() => setCurrentProject(project.id!)}
              className="glass glass-hover rounded-[30px] p-6 text-left"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProjectFolderIcon name={project.name} color={project.color} size="sm" />
                    <h3 className="truncate text-lg font-semibold text-white">{project.name}</h3>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description || '暂无项目描述'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-semibold ${riskTone}`}>
                    {riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '中风险' : '稳定'}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-600">健康分 {health}</p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-3">
                  <p className="text-[10px] text-slate-600">任务完成</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {doneTasks}
                    <span className="text-sm font-normal text-slate-500"> / {projectTasks.length}</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-3">
                  <p className="text-[10px] text-slate-600">里程碑</p>
                  <p className="mt-1 text-lg font-bold text-white">{projectMilestones.length}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-3">
                  <p className="text-[10px] text-slate-600">风险提醒</p>
                  <p className={`mt-1 text-lg font-bold ${riskTone}`}>{alerts.length}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-3">
                  <p className="text-[10px] text-slate-600">专注投入</p>
                  <p className="mt-1 text-lg font-bold text-cyan-300">{Math.round(focusMinutes / 60)}h</p>
                </div>
              </div>

              <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/[0.03]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500"
                  style={{ width: `${health}%` }}
                />
              </div>

              {alerts.length > 0 ? (
                <div className="space-y-2">
                  {alerts.slice(0, 2).map(alert => (
                    <p key={alert.id} className="text-xs text-slate-400">
                      - {alert.title}：{alert.description}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">当前没有明显风险，节奏和里程碑都比较稳定。</p>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
