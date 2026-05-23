import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Focus, ListChecks, PlayCircle, Route, ShieldAlert, TimerReset } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useDiaryStore } from '../stores/useDiaryStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useStatsStore } from '../stores/useStatsStore';
import { useTaskStore } from '../stores/useTaskStore';
import { analyzeProjectRisk } from '../lib/riskAnalysis';
import { getBlockingTasks } from '../lib/taskDependencies';
import { PRIORITY_LABELS, STATUS_LABELS, type Task } from '../types';

function sameDay(value: string | null, date = new Date()) {
  if (!value) return false;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return false;
  return target.getFullYear() === date.getFullYear() && target.getMonth() === date.getMonth() && target.getDate() === date.getDate();
}

function overdue(value: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function dueSort(a: Task, b: Task) {
  const av = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const bv = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  return av - bv;
}

function TaskRow({ task, tone = 'sky' }: { task: Task; tone?: 'sky' | 'rose' | 'amber' | 'emerald' }) {
  const navigate = useNavigate();
  const toneClass = {
    sky: 'border-sky-500/15 bg-sky-500/10 text-sky-200',
    rose: 'border-rose-500/15 bg-rose-500/10 text-rose-200',
    amber: 'border-amber-500/15 bg-amber-500/10 text-amber-200',
    emerald: 'border-emerald-500/15 bg-emerald-500/10 text-emerald-200',
  }[tone];

  return (
    <button onClick={() => navigate('/tasks')} className="flex w-full items-start gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 text-left transition hover:bg-white/[0.045]">
      <span className={`mt-1 rounded-full border px-2 py-1 text-[10px] ${toneClass}`}>{PRIORITY_LABELS[task.priority]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-white">{task.title}</p>
          <span className="shrink-0 text-[10px] text-slate-500">{STATUS_LABELS[task.status]}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{task.description || '暂无任务说明'}</p>
        {task.dueDate && <p className="mt-2 text-[11px] text-slate-400">截止：{new Date(task.dueDate).toLocaleString('zh-CN')}</p>}
      </div>
    </button>
  );
}

export default function TodayCommand() {
  const navigate = useNavigate();
  const tasks = useTaskStore(state => state.tasks);
  const milestones = useMilestoneStore(state => state.milestones);
  const diaryEntries = useDiaryStore(state => state.entries);
  const sessions = useStatsStore(state => state.sessions);
  const { projects, currentProjectId } = useAppStore();
  const project = projects.find(item => item.id === currentProjectId);

  useEffect(() => {
    useStatsStore.getState().loadSessions();
  }, []);

  const todayTasks = useMemo(() => tasks.filter(task => task.isTodayTask && task.status !== 'done').sort(dueSort), [tasks]);
  const dueToday = useMemo(() => tasks.filter(task => task.status !== 'done' && sameDay(task.dueDate)).sort(dueSort), [tasks]);
  const overdueTasks = useMemo(() => tasks.filter(task => task.status !== 'done' && overdue(task.dueDate)).sort(dueSort), [tasks]);
  const activeTasks = useMemo(() => tasks.filter(task => task.status === 'in_progress').sort(dueSort), [tasks]);
  const blockedTasks = useMemo(() => tasks.filter(task => task.status !== 'done' && getBlockingTasks(task, tasks).length > 0), [tasks]);
  const doneToday = useMemo(() => tasks.filter(task => task.status === 'done' && sameDay(task.updatedAt)).length, [tasks]);
  const riskAlerts = useMemo(() => {
    if (!project) return [];
    return analyzeProjectRisk({ project, tasks, milestones, diaryEntries, sessions });
  }, [diaryEntries, milestones, project, sessions, tasks]);

  const commandCards = [
    { label: '今日待推进', value: todayTasks.length, icon: ClipboardList, tone: 'text-cyan-300', path: '/today-tasks' },
    { label: '今日截止', value: dueToday.length, icon: CalendarClock, tone: 'text-amber-300', path: '/tasks' },
    { label: '被阻塞', value: blockedTasks.length, icon: ShieldAlert, tone: 'text-rose-300', path: '/dependencies' },
    { label: '今日完成', value: doneToday, icon: CheckCircle2, tone: 'text-emerald-300', path: '/analytics' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-5 py-8">
      <div className="flex flex-col gap-4 rounded-[30px] border border-white/[0.06] bg-[#0b1322] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            <Route size={26} className="text-cyan-300" />
            今日指挥台
          </h2>
          <p className="mt-1 text-sm text-slate-400">把当天要处理、会拖慢进度、已经阻塞和需要复盘的内容放在一个入口里。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/today-tasks')} className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20">
            <ListChecks size={15} />
            发布今日任务
          </button>
          <button onClick={() => navigate('/pomodoro')} className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20">
            <TimerReset size={15} />
            开始专注
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {commandCards.map(card => (
          <button key={card.label} onClick={() => navigate(card.path)} className="glass rounded-[26px] p-5 text-left transition hover:bg-white/[0.05]">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">{card.label}</span>
              <card.icon size={18} className={card.tone} />
            </div>
            <p className={`text-3xl font-bold ${card.tone}`}>{card.value}</p>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass rounded-[28px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <PlayCircle size={16} className="text-cyan-300" />
              今天先做什么
            </h3>
            <button onClick={() => navigate('/tasks')} className="text-xs text-sky-300 hover:text-sky-200">打开看板</button>
          </div>
          <div className="space-y-3">
            {overdueTasks.slice(0, 3).map(task => <TaskRow key={task.id} task={task} tone="rose" />)}
            {todayTasks.filter(task => !overdue(task.dueDate)).slice(0, Math.max(0, 6 - Math.min(3, overdueTasks.length))).map(task => <TaskRow key={task.id} task={task} tone="sky" />)}
            {todayTasks.length === 0 && overdueTasks.length === 0 && (
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 text-sm text-slate-500">今天还没有发布任务，可以先从今日任务页安排一下。</div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="glass rounded-[28px] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <AlertTriangle size={16} className="text-amber-300" />
              今日风险
            </h3>
            {riskAlerts.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 text-sm text-slate-500">当前没有明显风险。</p>
            ) : (
              <div className="space-y-3">
                {riskAlerts.slice(0, 3).map(alert => (
                  <div key={alert.id} className="rounded-2xl border border-amber-500/12 bg-amber-500/10 p-4">
                    <p className="text-sm font-semibold text-amber-100">{alert.title}</p>
                    <p className="mt-1 text-xs leading-5 text-amber-100/70">{alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass rounded-[28px] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Focus size={16} className="text-rose-300" />
              阻塞与推进
            </h3>
            <div className="space-y-3">
              {blockedTasks.slice(0, 4).map(task => <TaskRow key={task.id} task={task} tone="rose" />)}
              {blockedTasks.length === 0 && activeTasks.slice(0, 4).map(task => <TaskRow key={task.id} task={task} tone="emerald" />)}
              {blockedTasks.length === 0 && activeTasks.length === 0 && (
                <p className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 text-sm text-slate-500">没有阻塞任务，也没有进行中的任务。</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
