import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import QuickActions from '../QuickActions';
import Toast from '../Toast';
import { useAppStore } from '../../stores/useAppStore';
import { useTaskStore } from '../../stores/useTaskStore';
import { useMilestoneStore } from '../../stores/useMilestoneStore';
import { useTimelineStore } from '../../stores/useTimelineStore';
import { useDiaryStore } from '../../stores/useDiaryStore';
import { useInitTheme } from '../../stores/useTheme';
import { useToast } from '../../stores/useToast';
import { useStatsStore } from '../../stores/useStatsStore';
import { useCommandPalette } from '../../stores/useCommandPalette';
import { analyzeProjectRisk, formatRiskToast } from '../../lib/riskAnalysis';
import { useInitPreferences } from '../../stores/usePreferences';
import { useCloudStore } from '../../stores/useCloudStore';
import { useNotificationStore } from '../../stores/useNotificationStore';

const PAGE_TITLES: Record<string, string> = {
  '/today-command': '今日指挥台',
  '/backup': '备份与恢复',
  '/': '概览',
  '/portfolio': '项目总览',
  '/today-tasks': '今日任务',
  '/focus-sessions': '专注记录',
  '/tasks': '任务看板',
  '/dependencies': '任务依赖',
  '/pomodoro': '番茄钟',
  '/milestones': '里程碑',
  '/timeline': '时间线',
  '/diary': '开发日志',
  '/analytics': '数据分析',
  '/gantt': '甘特图',
  '/collaboration': '团队协作',
  '/collaboration-control': '协作诊断',
  '/ai-command': 'AI 指令中心',
  '/projects': '项目管理',
  '/settings': '设置',
};

function toLocalDateTimeMinute(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function Layout() {
  useInitTheme();
  useInitPreferences();
  const location = useLocation();
  const loadProjects = useAppStore(state => state.loadProjects);
  const loadAchievements = useAppStore(state => state.loadAchievements);
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const setCurrentProject = useAppStore(state => state.setCurrentProject);
  const projects = useAppStore(state => state.projects);
  const loadTasks = useTaskStore(state => state.load);
  const taskItems = useTaskStore(state => state.tasks);
  const loadMilestones = useMilestoneStore(state => state.load);
  const milestoneItems = useMilestoneStore(state => state.milestones);
  const loadTimeline = useTimelineStore(state => state.load);
  const loadDiary = useDiaryStore(state => state.load);
  const diaryEntries = useDiaryStore(state => state.entries);
  const { toasts, add: addToast } = useToast();
  const { openPalette, query, setQuery } = useCommandPalette();
  const initCloud = useCloudStore(state => state.init);
  const syncNow = useCloudStore(state => state.syncNow);
  const touchPresence = useCloudStore(state => state.touchPresence);
  const syncState = useCloudStore(state => state.syncState);
  const loadTeam = useCloudStore(state => state.loadTeam);
  const initNotifications = useNotificationStore(state => state.init);
  const checkTaskNotifications = useNotificationStore(state => state.checkTaskNotifications);
  const [riskToastCache] = useState<Set<string>>(() => new Set());
  const [taskToastCache] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    useStatsStore.getState().loadSessions();
    initCloud();
    initNotifications();
  }, []);

  useEffect(() => {
    const handleOnline = () => syncNow();
    const handleVisible = () => {
      if (document.visibilityState === 'visible') touchPresence();
    };
    const handleFocus = () => touchPresence();
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisible);
    const timer = setInterval(() => {
      syncNow();
    }, 60000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisible);
      clearInterval(timer);
    };
  }, [syncNow, touchPresence]);

  useEffect(() => {
    loadProjects();
    loadAchievements();
  }, [loadProjects, loadAchievements]);

  useEffect(() => {
    if (!currentProjectId && projects.length > 0) {
      setCurrentProject(projects[0].id!);
    }
  }, [projects, currentProjectId, setCurrentProject]);

  useEffect(() => {
    if (!currentProjectId) return;
    loadTasks(currentProjectId);
    loadMilestones(currentProjectId);
    loadTimeline(currentProjectId);
    loadDiary(currentProjectId);
    loadTeam(currentProjectId);
  }, [currentProjectId, loadTasks, loadMilestones, loadTimeline, loadDiary, loadTeam]);

  useEffect(() => {
    if (!currentProjectId) return;
    const timer = setTimeout(() => {
      const tasks = useTaskStore.getState().tasks;
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const urgent = tasks.filter(task => {
        if (task.status === 'done' || !task.dueDate || task.priority !== 'urgent') return false;
        return new Date(task.dueDate).getTime() <= tomorrow.getTime();
      });
      const dueSoon = tasks.filter(task => {
        if (task.status === 'done' || !task.dueDate || task.priority === 'urgent') return false;
        const due = new Date(task.dueDate).getTime();
        return due <= tomorrow.getTime() && due >= now.getTime();
      });
      const remindNow = tasks.filter(task => {
        if (task.status === 'done' || !task.remindAt) return false;
        const minuteKey = toLocalDateTimeMinute(task.remindAt);
        if (!minuteKey) return false;
        const cacheKey = `remind:${task.id}:${minuteKey}`;
        if (taskToastCache.has(cacheKey)) return false;
        if (minuteKey !== toLocalDateTimeMinute(new Date().toISOString())) return false;
        taskToastCache.add(cacheKey);
        return true;
      });

      if (urgent.length > 0) {
        addToast(`有 ${urgent.length} 个紧急任务即将到期，请尽快处理。`, 'error');
      } else if (dueSoon.length > 0) {
        addToast(`有 ${dueSoon.length} 个任务将在 24 小时内到期。`, 'warning');
      }

      remindNow.forEach(task => {
        addToast(`提醒：${task.title} 到了计划处理时间。`, 'info');
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [currentProjectId, addToast, taskToastCache]);

  useEffect(() => {
    checkTaskNotifications(taskItems);
    const timer = setInterval(() => checkTaskNotifications(useTaskStore.getState().tasks), 60000);
    return () => clearInterval(timer);
  }, [taskItems, checkTaskNotifications]);

  useEffect(() => {
    if (!currentProjectId) return;
    const project = projects.find(item => item.id === currentProjectId);
    if (!project) return;

    const alerts = analyzeProjectRisk({
      project,
      tasks: taskItems,
      milestones: milestoneItems,
      diaryEntries,
      sessions: useStatsStore.getState().sessions,
    });

    alerts.slice(0, 2).forEach(alert => {
      const key = `${alert.projectId}:${alert.id}`;
      if (riskToastCache.has(key)) return;
      riskToastCache.add(key);
      addToast(formatRiskToast(alert), alert.level === 'high' ? 'error' : 'warning');
    });
  }, [currentProjectId, projects, taskItems, milestoneItems, diaryEntries, riskToastCache, addToast]);

  const currentProject = useMemo(() => projects.find(project => project.id === currentProjectId), [projects, currentProjectId]);
  const pageTitle = PAGE_TITLES[location.pathname] ?? '项目工作监控系统';

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(39,138,255,0.14),_transparent_28%),linear-gradient(180deg,_#05070d_0%,_#0b1220_100%)]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-white/[0.05] bg-[#0a1320]/78 px-4 py-4 backdrop-blur xl:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                <Sparkles size={12} />
                {currentProject ? `${currentProject.icon} ${currentProject.name}` : '项目工作监控系统'}
              </div>
              <h1 className="truncate text-xl font-semibold text-white">{pageTitle}</h1>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                <span
                  className={`h-2 w-2 rounded-full ${
                    syncState.syncStatus === 'synced'
                      ? 'bg-emerald-400'
                      : syncState.syncStatus === 'syncing'
                        ? 'bg-cyan-400'
                        : syncState.syncStatus === 'conflict'
                          ? 'bg-amber-400'
                          : 'bg-slate-500'
                  }`}
                />
                {syncState.syncStatus === 'synced'
                  ? '已同步'
                  : syncState.syncStatus === 'syncing'
                    ? `待同步 ${syncState.pendingChanges}`
                    : syncState.syncStatus === 'conflict'
                      ? '存在冲突'
                      : '离线'}
              </div>
              <div className="relative w-full sm:w-[340px]">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onFocus={() => openPalette(query)}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="搜索页面、任务、项目或标签"
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:bg-white/[0.06]"
                />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 xl:px-6">
          <Outlet />
        </main>
      </div>

      <CommandPalette />
      <QuickActions />
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-3">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} />
          </div>
        ))}
      </div>
    </div>
  );
}
