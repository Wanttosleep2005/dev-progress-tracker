import { lazy, Suspense, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Clock3, Gauge, ListChecks, TimerReset, TrendingUp } from 'lucide-react';
import { useDiaryStore } from '../stores/useDiaryStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useStatsStore } from '../stores/useStatsStore';
import { useTaskStore } from '../stores/useTaskStore';
import { MOOD_COLORS, PRIORITY_LABELS, STATUS_LABELS } from '../types';
import type { MoodType, TaskPriority, TaskStatus } from '../types';
import { getTaskActualMinutes } from '../lib/reporting';
import { formatDurationDeltaFromMinutes, formatDurationFromMinutes } from '../lib/duration';

const AnalyticsCharts = lazy(() => import('../components/charts/AnalyticsCharts'));

const moodScoreMap: Record<MoodType, number> = {
  great: 5,
  good: 4,
  meh: 3,
  bad: 2,
  terrible: 1,
};

const statusOrder: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
const priorityOrder: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export default function Analytics() {
  const tasks = useTaskStore(state => state.tasks);
  const milestones = useMilestoneStore(state => state.milestones);
  const entries = useDiaryStore(state => state.entries);
  const sessions = useStatsStore(state => state.sessions);

  const totalFocusMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const totalEstimated = tasks.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);
  const totalActual = tasks.reduce((sum, task) => sum + getTaskActualMinutes(task.id, task.title, task.projectId), 0);
  const activeMilestones = milestones.filter(milestone => milestone.status !== 'completed').length;
  const averageMilestoneProgress = average(milestones.map(milestone => milestone.progress));

  const dailyFocusTrend = useMemo(() => {
    const points = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().split('T')[0];
      return {
        key,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        minutes: sessions.filter(session => session.date === key).reduce((sum, session) => sum + session.minutes, 0),
      };
    });

    return {
      labels: points.map(point => point.label),
      datasets: [
        {
          label: '专注分钟',
          data: points.map(point => point.minutes),
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34,211,238,0.14)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    };
  }, [sessions]);

  const statusData = useMemo(
    () => ({
      labels: statusOrder.map(status => STATUS_LABELS[status]),
      datasets: [
        {
          data: statusOrder.map(status => tasks.filter(task => task.status === status).length),
          backgroundColor: ['#64748b', '#38bdf8', '#f59e0b', '#22c55e'],
          borderWidth: 0,
        },
      ],
    }),
    [tasks]
  );

  const effortData = useMemo(() => {
    const focusTasks = tasks
      .map(task => ({
        title: task.title,
        estimated: task.estimatedMinutes ?? 0,
        actual: getTaskActualMinutes(task.id, task.title, task.projectId),
      }))
      .filter(task => task.estimated > 0 || task.actual > 0)
      .sort((a, b) => b.actual + b.estimated - (a.actual + a.estimated))
      .slice(0, 6);

    return {
      labels: focusTasks.map(task => (task.title.length > 8 ? `${task.title.slice(0, 8)}...` : task.title)),
      datasets: [
        {
          label: '预估',
          data: focusTasks.map(task => task.estimated),
          backgroundColor: '#38bdf8',
          borderRadius: 8,
        },
        {
          label: '实际',
          data: focusTasks.map(task => task.actual),
          backgroundColor: '#f59e0b',
          borderRadius: 8,
        },
      ],
    };
  }, [tasks]);

  const priorityData = useMemo(
    () => ({
      labels: priorityOrder.map(priority => PRIORITY_LABELS[priority]),
      datasets: [
        {
          label: '任务数',
          data: priorityOrder.map(priority => tasks.filter(task => task.priority === priority).length),
          backgroundColor: ['#ef4444', '#f59e0b', '#38bdf8', '#64748b'],
          borderRadius: 8,
        },
      ],
    }),
    [tasks]
  );

  const weeklyDeliveryData = useMemo(() => {
    const completedTasks = tasks.filter(task => task.status === 'done').length;
    const focusByTask = sessions.filter(session => session.taskId).length;
    const diaryActiveDays = new Set(entries.map(entry => entry.date)).size;

    return {
      labels: ['任务完成', '里程碑推进', '专注投入', '日志复盘', '节奏稳定'],
      datasets: [
        {
          label: '当前表现',
          data: [
            Math.min(100, completedTasks * 10),
            averageMilestoneProgress,
            Math.min(100, Math.round(totalFocusMinutes / 12)),
            Math.min(100, diaryActiveDays * 12),
            Math.min(100, sessions.length * 8),
          ],
          backgroundColor: 'rgba(56,189,248,0.18)',
          borderColor: '#38bdf8',
        },
      ],
    };
  }, [averageMilestoneProgress, entries, sessions, tasks, totalFocusMinutes]);

  const moodTrend = useMemo(() => {
    const points = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().split('T')[0];
      const entry = entries.find(item => item.date === key);
      return {
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        value: entry ? moodScoreMap[entry.mood] : null,
      };
    });

    return {
      labels: points.map(point => point.label),
      datasets: [
        {
          label: '状态评分',
          data: points.map(point => point.value),
          borderColor: '#fbbf24',
          backgroundColor: 'rgba(251,191,36,0.14)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          spanGaps: true,
        },
      ],
    };
  }, [entries]);

  const focusRanking = useMemo(() => {
    const ranking = new Map<number, { title: string; minutes: number }>();

    sessions.forEach(session => {
      if (!session.taskId) return;
      const task = tasks.find(item => item.id === session.taskId);
      if (!task) return;
      const current = ranking.get(session.taskId) ?? { title: task.title, minutes: 0 };
      current.minutes += session.minutes;
      ranking.set(session.taskId, current);
    });

    return Array.from(ranking.values()).sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  }, [sessions, tasks]);

  const insightCards = [
    {
      label: '累计专注',
      value: formatDurationFromMinutes(totalFocusMinutes, { compact: true, allowZero: true }),
      detail: `${sessions.length} 条记录`,
      icon: TimerReset,
      tone: 'text-cyan-300',
    },
    {
      label: '工时偏差',
      value: formatDurationDeltaFromMinutes(totalActual - totalEstimated),
      detail: '预估与实际对比',
      icon: Clock3,
      tone: totalActual > totalEstimated ? 'text-amber-300' : 'text-emerald-300',
    },
    {
      label: '活跃里程碑',
      value: `${activeMilestones}`,
      detail: `平均进度 ${averageMilestoneProgress}%`,
      icon: Gauge,
      tone: 'text-violet-300',
    },
    {
      label: '任务完成率',
      value: `${tasks.length > 0 ? Math.round((tasks.filter(task => task.status === 'done').length / tasks.length) * 100) : 0}%`,
      detail: '当前项目执行表现',
      icon: ListChecks,
      tone: 'text-emerald-300',
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">数据分析</h2>
          <p className="mt-1 text-sm text-slate-400">从任务、专注、日志和里程碑四条线交叉观察项目状态，形成更完整的产品化仪表盘。</p>
        </div>
        <div className="rounded-[24px] border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-200">
          分析视图已按需加载，减轻首屏压力
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {insightCards.map(card => (
          <div key={card.label} className="glass rounded-[28px] p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">{card.label}</span>
              <card.icon size={16} className={card.tone} />
            </div>
            <p className={`text-3xl font-bold ${card.tone}`}>{card.value}</p>
            <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass rounded-[30px] p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-300" />
            <h3 className="text-sm font-semibold text-slate-200">分析摘要</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500">专注绑定任务率</p>
              <p className="mt-2 text-lg font-semibold text-white">{sessions.length > 0 ? Math.round((sessions.filter(session => session.taskId).length / sessions.length) * 100) : 0}%</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500">日志覆盖天数</p>
              <p className="mt-2 text-lg font-semibold text-white">{new Set(entries.map(entry => entry.date)).size} 天</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500">有预估工时任务</p>
              <p className="mt-2 text-lg font-semibold text-white">{tasks.filter(task => task.estimatedMinutes).length} 个</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500">平均状态评分</p>
              <p className="mt-2 text-lg font-semibold text-white">{entries.length > 0 ? average(entries.map(entry => moodScoreMap[entry.mood])) : '--'}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-[30px] p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-amber-300" />
            <h3 className="text-sm font-semibold text-slate-200">专注任务排行</h3>
          </div>
          {focusRanking.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 text-sm text-slate-500">当前还没有绑定到任务的专注记录。</div>
          ) : (
            <div className="space-y-3">
              {focusRanking.map((item, index) => (
                <div key={item.title} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-white">{index + 1}. {item.title}</p>
                    <span className="text-xs text-cyan-300">{formatDurationFromMinutes(item.minutes, { compact: true, allowZero: true })}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-500" style={{ width: `${Math.min(100, (item.minutes / Math.max(focusRanking[0]?.minutes || 1, 1)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Suspense fallback={<div className="glass rounded-[28px] p-5 text-sm text-slate-500">正在加载分析图表...</div>}>
        <AnalyticsCharts
          dailyFocusTrend={dailyFocusTrend}
          statusData={statusData}
          effortData={effortData}
          priorityData={priorityData}
          weeklyDeliveryData={weeklyDeliveryData}
          moodTrend={moodTrend}
        />
      </Suspense>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="glass rounded-[28px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Gauge size={16} className="text-violet-300" />
            状态日志拆解
          </h3>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">当前还没有日志记录，后续会在这里展示状态与节奏的变化趋势。</p>
          ) : (
            <div className="space-y-3">
              {(['great', 'good', 'meh', 'bad', 'terrible'] as MoodType[]).map(mood => {
                const count = entries.filter(entry => entry.mood === mood).length;
                return (
                  <div key={mood}>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span>{mood}</span>
                      <span>{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
                      <div className="h-full rounded-full" style={{ width: `${entries.length > 0 ? (count / entries.length) * 100 : 0}%`, backgroundColor: MOOD_COLORS[mood] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass rounded-[28px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Clock3 size={16} className="text-cyan-300" />
            任务效率提示
          </h3>
          <div className="space-y-3">
            {tasks
              .map(task => {
                const actual = getTaskActualMinutes(task.id, task.title, task.projectId);
                const estimate = task.estimatedMinutes ?? 0;
                const delta = actual - estimate;
                return { task, actual, estimate, delta };
              })
              .filter(item => item.estimate > 0 || item.actual > 0)
              .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
              .slice(0, 5)
              .map(item => (
                <div key={item.task.id} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-white">{item.task.title}</p>
                    <span className={`text-xs ${item.delta > 0 ? 'text-amber-300' : item.delta < 0 ? 'text-emerald-300' : 'text-slate-300'}`}>{formatDurationDeltaFromMinutes(item.delta)}</span>
                  </div>
                  <p className="text-xs text-slate-500">预估 {formatDurationFromMinutes(item.estimate, { allowZero: true })} · 实际 {formatDurationFromMinutes(item.actual, { allowZero: true })}</p>
                </div>
              ))}
            {tasks.filter(task => (task.estimatedMinutes ?? 0) > 0 || getTaskActualMinutes(task.id, task.title, task.projectId) > 0).length === 0 && (
              <p className="text-sm text-slate-500">当前还没有足够的工时对比数据。</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
