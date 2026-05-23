import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flag,
  GitBranch,
  Gauge,
  Layers3,
  ListTodo,
  Route,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useDiaryStore } from '../stores/useDiaryStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useStatsStore } from '../stores/useStatsStore';
import { useTaskStore } from '../stores/useTaskStore';
import { useTimelineStore } from '../stores/useTimelineStore';
import ActivityHeatmap from '../components/ActivityHeatmap';
import CountdownClock from '../components/CountdownClock';
import PersonalStats from '../components/PersonalStats';
import RiskPanel from '../components/RiskPanel';
import TodayFocus from '../components/TodayFocus';
import WeeklyRhythm from '../components/WeeklyRhythm';
import { ACHIEVEMENTS, EVENT_TYPE_LABELS, MILESTONE_STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS } from '../types';
import type { Achievement, Milestone, Task, TaskStatus } from '../types';
import AchievementUnlockModal from '../components/AchievementUnlockModal';
import { analyzeProjectRisk } from '../lib/riskAnalysis';
import { formatDateTime } from '../lib/duration';

const OverviewCharts = lazy(() => import('../components/charts/OverviewCharts'));

const statusOrder: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
const PAGE_SIZE = 5;

function getDeadlineText(dueDate: string | null) {
  if (!dueDate) return '未设置截止时间';
  const diff = new Date(dueDate).getTime() - Date.now();
  if (diff <= 0) return '已到期';
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)} 天后到期`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟后到期`;
  return `${minutes} 分钟后到期`;
}

function getPageCount(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function getPageItems<T>(items: T[], page: number) {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

function formatCompactDateTime(value: string | null) {
  if (!value) return '未设置';
  const text = formatDateTime(value);
  return text === '未设置' ? text : text.replace(/\//g, '-');
}

function Pager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (next: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;

  return (
    <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3">
      <span className="text-[11px] text-slate-500">
        第 {page} / {totalPages} 页 · 共 {total} 条
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="上一页"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="下一页"
        >
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const tasks = useTaskStore(state => state.tasks);
  const milestones = useMilestoneStore(state => state.milestones);
  const events = useTimelineStore(state => state.events);
  const diaryEntries = useDiaryStore(state => state.entries);
  const diaryCount = diaryEntries.length;
  const { projects, currentProjectId, achievements } = useAppStore();
  const project = projects.find(item => item.id === currentProjectId);
  const unlockedAchievements = achievements.filter(item => item.unlockedAt);
  const sessions = useStatsStore(state => state.sessions);
  const [actionPage, setActionPage] = useState(1);
  const [milestonePage, setMilestonePage] = useState(1);
  const [showAchievement, setShowAchievement] = useState<Achievement | null>(null);
  const prevUnlockedKeys = useRef(unlockedAchievements.map(a => a.key).join(','));

  useEffect(() => {
    const currentKeys = unlockedAchievements.map(a => a.key).join(',');
    if (prevUnlockedKeys.current && currentKeys !== prevUnlockedKeys.current) {
      const prevKeys = new Set(prevUnlockedKeys.current.split(','));
      const newUnlocked = unlockedAchievements.find(a => !prevKeys.has(a.key));
      if (newUnlocked) {
        setShowAchievement(newUnlocked);
      }
    }
    prevUnlockedKeys.current = currentKeys;
  }, [unlockedAchievements]);

  useEffect(() => {
    useStatsStore.getState().loadSessions();
  }, []);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(task => task.status === 'done').length;
    const inProgress = tasks.filter(task => task.status === 'in_progress').length;
    const blocked = tasks.filter(task => task.priority === 'urgent' && task.status !== 'done').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, blocked, progress };
  }, [tasks]);

  const todayTasks = useMemo(
    () => tasks.filter(task => task.isTodayTask).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
    [tasks]
  );
  const activeMilestones = useMemo(
    () => milestones.filter(milestone => milestone.status !== 'completed'),
    [milestones]
  );
  const recentEvents = useMemo(() => events.slice(0, 6), [events]);
  const riskAlerts = useMemo(() => {
    if (!project) return [];
    return analyzeProjectRisk({
      project,
      tasks,
      milestones,
      diaryEntries,
      sessions,
    });
  }, [project, tasks, milestones, diaryEntries, sessions]);

  const pieData = useMemo(
    () => ({
      labels: statusOrder.map(status => STATUS_LABELS[status]),
      datasets: [
        {
          data: statusOrder.map(status => tasks.filter(task => task.status === status).length),
          backgroundColor: statusOrder.map(status => STATUS_COLORS[status]),
          borderWidth: 0,
        },
      ],
    }),
    [tasks]
  );

  const weeklyTrend = useMemo(() => {
    const now = new Date();
    const weeks: { label: string; tasks: number; events: number }[] = [];

    for (let index = 3; index >= 0; index -= 1) {
      const end = new Date(now);
      end.setDate(end.getDate() - index * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 7);
      const inRange = (dateValue: string) => {
        const date = new Date(dateValue);
        return date >= start && date <= end;
      };

      weeks.push({
        label: `第 ${4 - index} 周`,
        tasks: tasks.filter(task => task.status === 'done' && inRange(task.updatedAt)).length,
        events: events.filter(event => inRange(event.date)).length,
      });
    }

    return {
      labels: weeks.map(week => week.label),
      datasets: [
        {
          label: '完成任务',
          data: weeks.map(week => week.tasks),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.12)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#22c55e',
        },
        {
          label: '新增事件',
          data: weeks.map(week => week.events),
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96,165,250,0.12)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#60a5fa',
        },
      ],
    };
  }, [events, tasks]);

  const actionTasks = useMemo(
    () =>
      tasks
        .filter(task => task.status === 'in_progress' || task.status === 'todo')
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'in_progress' ? -1 : 1;
          const priorityRank = { urgent: 4, high: 3, medium: 2, low: 1 };
          return priorityRank[b.priority] - priorityRank[a.priority];
        }),
    [tasks]
  );
  const actionTotalPages = getPageCount(actionTasks.length);
  const milestoneTotalPages = getPageCount(activeMilestones.length);
  const pagedActionTasks = useMemo(() => getPageItems(actionTasks, actionPage), [actionPage, actionTasks]);
  const pagedMilestones = useMemo(() => getPageItems(activeMilestones, milestonePage), [activeMilestones, milestonePage]);

  useEffect(() => {
    if (actionPage > actionTotalPages) setActionPage(actionTotalPages);
  }, [actionPage, actionTotalPages]);

  useEffect(() => {
    if (milestonePage > milestoneTotalPages) setMilestonePage(milestoneTotalPages);
  }, [milestonePage, milestoneTotalPages]);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="mx-auto max-w-7xl space-y-6">
      <motion.div variants={item} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
            {project ? project.name : '概览'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            聚合任务、风险、节奏、里程碑和今日安排，形成更完整的项目仪表盘。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
          <TrendingUp size={16} className="text-sky-300" />
          <span className="text-sm font-medium text-sky-200">当前完成度 {stats.progress}%</span>
        </div>
      </motion.div>

      {todayTasks.length > 0 && (
        <motion.div variants={item} className="glass rounded-[30px] border border-cyan-500/12 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <AlarmClock size={16} className="text-cyan-300" />
                今日任务发布区
              </h3>
              <p className="mt-1 text-xs text-slate-500">这里集中显示今天已经发布的重点任务，适合快速浏览当天安排。</p>
            </div>
            <button onClick={() => navigate('/today-tasks')} className="text-xs text-sky-300 hover:text-sky-200">前往今日任务</button>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            {todayTasks.slice(0, 3).map(task => (
              <button
                key={task.id}
                onClick={() => navigate('/today-tasks')}
                className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.04]"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">{task.title}</p>
                  <span className="text-[10px] text-sky-300">{STATUS_LABELS[task.status]}</span>
                </div>
                <p className="line-clamp-2 text-xs text-slate-500">{task.description || '暂无任务说明'}</p>
                <p className="mt-3 text-[11px] text-amber-300">{getDeadlineText(task.dueDate)}</p>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* 成就进度 */}
      <motion.div variants={item}>
        <button onClick={() => navigate('/achievements')} className="glass w-full rounded-[28px] p-5 text-left transition hover:bg-white/[0.05]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
              <Trophy size={22} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">成就进度</h3>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.04]">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${Math.round((unlockedAchievements.length / ACHIEVEMENTS.length) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{unlockedAchievements.length} / {ACHIEVEMENTS.length} 已解锁</p>
            </div>
            <span className="text-slate-600">→</span>
          </div>
        </button>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_320px]">
        <TodayFocus />
        <div>
          {project?.deadline ? (
            <CountdownClock deadline={project.deadline} createdAt={project.createdAt} />
          ) : (
            <div className="glass flex min-h-[220px] flex-col items-center justify-center p-5 text-center">
              <Clock size={32} className="mb-3 text-slate-600" />
              <p className="mb-1 text-sm text-slate-500">当前项目还没有设置截止日期</p>
              <p className="text-xs text-slate-600">可以在左侧项目菜单中补充截止日期，用于倒计时和风险提醒。</p>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={item}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '任务总数', value: stats.total, icon: Layers3, tone: 'text-slate-200', bg: 'bg-slate-400/10' },
            { label: '已完成', value: stats.done, icon: CheckCircle2, tone: 'text-emerald-400', bg: 'bg-emerald-400/10' },
            { label: '进行中', value: stats.inProgress, icon: Gauge, tone: 'text-cyan-400', bg: 'bg-cyan-400/10' },
            { label: '紧急待处理', value: stats.blocked, icon: AlarmClock, tone: 'text-rose-400', bg: 'bg-rose-400/10' },
          ].map(card => (
            <div key={card.label} className="glass rounded-[28px] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">{card.label}</span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-2xl ${card.bg}`}>
                  <card.icon size={16} className={card.tone} />
                </div>
              </div>
              <p className={`text-3xl font-bold ${card.tone}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={item}>
        <RiskPanel alerts={riskAlerts} />
      </motion.div>

      <motion.div variants={item} className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(340px,0.72fr)]">
        <div className="glass rounded-[30px] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Route size={16} className="text-sky-300" />
                近期行动清单
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">按状态和优先级排序，每页最多展示 5 条</p>
            </div>
            <button onClick={() => navigate('/tasks')} className="text-xs text-sky-300 hover:text-sky-200">打开看板</button>
          </div>

          {actionTasks.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 text-sm text-slate-500">
              当前没有待办或进行中的任务。
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {pagedActionTasks.map((task: Task) => (
                <button
                  key={task.id}
                  onClick={() => navigate('/tasks')}
                  className="group flex w-full items-start gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3.5 text-left transition hover:border-sky-400/18 hover:bg-white/[0.045]"
                >
                  <div className={`mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${task.status === 'in_progress' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-slate-500/10 text-slate-400'}`}>
                    <ListTodo size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-white">{task.title}</p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400">{STATUS_LABELS[task.status]}</span>
                        <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300">{PRIORITY_LABELS[task.priority]}</span>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-xs text-slate-500">{task.description || '暂无任务说明'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/12 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                        <CalendarClock size={10} />
                        截止时间：{formatCompactDateTime(task.dueDate)}
                      </span>
                      {task.isTodayTask && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/12 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">
                          <AlarmClock size={10} />
                          提醒时间：{formatCompactDateTime(task.remindAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                ))}
              </div>
              <Pager page={actionPage} totalPages={actionTotalPages} total={actionTasks.length} onChange={setActionPage} />
            </>
          )}
        </div>

        <div className="grid gap-4">
          <WeeklyRhythm />
          <PersonalStats />
        </div>
      </motion.div>

      <motion.div variants={item} className="glass rounded-[28px] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Activity size={16} className="text-emerald-400" />
          活跃热力图
        </h3>
        <ActivityHeatmap />
      </motion.div>

      <motion.div variants={item}>
        <Suspense fallback={<div className="glass rounded-[28px] p-5 text-sm text-slate-500">正在加载图表...</div>}>
          <OverviewCharts pieData={pieData} weeklyTrend={weeklyTrend} />
        </Suspense>
      </motion.div>

      <motion.div variants={item} className="grid items-start gap-4 xl:grid-cols-2">
        <div className="glass rounded-[28px] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Flag size={16} className="text-amber-300" />
                活跃里程碑
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">每页最多展示 5 条，按当前进度快速扫视</p>
            </div>
            <button onClick={() => navigate('/milestones')} className="text-xs text-sky-300 hover:text-sky-200">查看全部</button>
          </div>

          {activeMilestones.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 text-center text-sm text-slate-500">当前没有进行中的里程碑。</div>
          ) : (
            <>
              <div className="space-y-2.5">
                {pagedMilestones.map((milestone: Milestone) => (
                <button
                  key={milestone.id}
                  onClick={() => navigate('/milestones')}
                  className="w-full rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3.5 text-left transition hover:border-amber-400/18 hover:bg-white/[0.045]"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-100">{milestone.title}</span>
                      <span className="mt-1 block truncate text-[11px] text-slate-500">{milestone.description || '暂无里程碑说明'}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">{MILESTONE_STATUS_LABELS[milestone.status]}</span>
                  </div>
                  <div className="mb-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400" style={{ width: `${milestone.progress}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold text-amber-200">{milestone.progress}%</span>
                  </div>
                  {milestone.dueDate && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.05] bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400">
                      <CalendarClock size={10} />
                      目标日期：{formatCompactDateTime(milestone.dueDate)}
                    </span>
                  )}
                </button>
                ))}
              </div>
              <Pager page={milestonePage} totalPages={milestoneTotalPages} total={activeMilestones.length} onChange={setMilestonePage} />
            </>
          )}
        </div>

        <div className="glass rounded-[28px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <GitBranch size={16} className="text-emerald-400" />
              最近动态
            </h3>
            <button onClick={() => navigate('/timeline')} className="text-xs text-sky-300 hover:text-sky-200">打开时间线</button>
          </div>

          {recentEvents.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">还没有项目事件记录。</div>
          ) : (
            <div className="space-y-3">
              {recentEvents.map(event => (
                <button
                  key={event.id}
                  onClick={() => navigate('/timeline')}
                  className="flex w-full items-start gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.04]"
                >
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400/70" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-200">{event.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {EVENT_TYPE_LABELS[event.type]} · {new Date(event.date).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 md:grid-cols-3">
        <button onClick={() => navigate('/diary')} className="glass flex items-center gap-4 rounded-[28px] p-4 text-left transition hover:bg-white/[0.05]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10">
            <BookOpen size={20} className="text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">开发日志</p>
            <p className="text-lg font-bold text-white">{diaryCount} <span className="text-sm font-normal text-slate-500">篇</span></p>
          </div>
        </button>

        <button onClick={() => navigate('/milestones')} className="glass flex items-center gap-4 rounded-[28px] p-4 text-left transition hover:bg-white/[0.05]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10">
            <Target size={20} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">里程碑</p>
            <p className="text-lg font-bold text-white">{milestones.length} <span className="text-sm font-normal text-slate-500">个</span></p>
          </div>
        </button>

        <button onClick={() => navigate('/analytics')} className="glass flex items-center gap-4 rounded-[28px] p-4 text-left transition hover:bg-white/[0.05]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10">
            <Trophy size={20} className="text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">成就进度</p>
            <p className="text-lg font-bold text-white">{unlockedAchievements.length} <span className="text-sm font-normal text-slate-500">/ {ACHIEVEMENTS.length}</span></p>
          </div>
        </button>
      </motion.div>

      <AchievementUnlockModal achievement={showAchievement} onClose={() => setShowAchievement(null)} />
    </motion.div>
  );
}
