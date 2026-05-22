import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Coffee, Pause, Play, Settings2, SkipBack, SkipForward, Square, Target, TimerReset } from 'lucide-react';
import { usePomodoroStore } from '../stores/usePomodoroStore';
import { useTaskStore } from '../stores/useTaskStore';
import { useNotificationStore } from '../stores/useNotificationStore';
import { formatDurationFromSeconds } from '../lib/duration';

const phaseLabel = {
  work: '工作',
  short_break: '短休息',
  long_break: '长休息',
};

const workOptions = [15, 20, 25, 30, 45, 60];
const shortBreakOptions = [3, 5, 10];
const longBreakOptions = [10, 15, 20];

function CircularProgress({ progress, label, detail }: { progress: number; label: string; detail: string }) {
  const radius = 112;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference - (progress / 100) * circumference;
  return (
    <div className="relative flex h-72 w-72 items-center justify-center">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 260 260">
        <circle cx="130" cy="130" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="14" fill="none" />
        <motion.circle
          cx="130"
          cy="130"
          r={radius}
          stroke="url(#pomodoroGradient)"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: dash }}
          transition={{ duration: 0.35 }}
        />
        <defs>
          <linearGradient id="pomodoroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="55%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">{label}</p>
        <p className="mt-3 text-5xl font-bold tracking-tight text-white">{detail}</p>
      </div>
    </div>
  );
}

export default function Pomodoro() {
  const {
    config,
    sessions,
    phase,
    state,
    remainingSeconds,
    cycleCount,
    taskTitle,
    taskId,
    updateConfig,
    start,
    pause,
    resume,
    stop,
    skipToPrevious,
    skipToNext,
    tick,
  } = usePomodoroStore();
  const tasks = useTaskStore(store => store.tasks);
  const { settings: notificationSettings, requestPermission, updateSettings } = useNotificationStore();
  const [draftTitle, setDraftTitle] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [tick]);

  const totalSeconds = (phase === 'work' ? config.workMinutes : phase === 'short_break' ? config.shortBreakMinutes : config.longBreakMinutes) * 60;
  const progress = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter(session => session.date === today && session.phase === 'work' && session.completed);
  const todaySeconds = todaySessions.reduce((sum, session) => sum + session.seconds, 0);
  const goalProgress = Math.min(100, Math.round((todaySessions.length / Math.max(config.dailyGoal, 1)) * 100));

  const taskPomodoros = useMemo(() => {
    const map = new Map<string, { title: string; count: number }>();
    sessions.filter(session => session.phase === 'work' && session.completed).forEach(session => {
      const key = String(session.taskId || session.taskTitle || 'custom');
      const current = map.get(key) || { title: session.taskTitle || '自定义专注', count: 0 };
      current.count += 1;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [sessions]);

  const startTimer = () => {
    const selectedTask = tasks.find(task => task.id === selectedTaskId);
    start(selectedTask?.title || draftTitle, selectedTask?.id ?? null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">番茄钟</h2>
          <p className="mt-1 text-sm text-slate-400">完整番茄工作法：工作、短休息、长休息循环，并自动写入专注统计。</p>
        </div>
        <button
          onClick={notificationSettings.permission === 'granted' ? () => updateSettings({ enabled: !notificationSettings.enabled }) : requestPermission}
          className="flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200 hover:bg-cyan-500/20"
        >
          <Bell size={16} />
          {notificationSettings.permission === 'granted' ? (notificationSettings.enabled ? '通知已开启' : '开启通知') : '授权通知'}
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="glass flex flex-col items-center rounded-[32px] p-6">
          <CircularProgress
            progress={progress}
            label={`${phaseLabel[phase]} · 第 ${cycleCount + 1} 轮`}
            detail={config.showMinutesOnly ? `${Math.ceil(remainingSeconds / 60)}m` : formatDurationFromSeconds(remainingSeconds, { compact: true, allowZero: true })}
          />
          <p className="mt-2 text-sm text-slate-400">{taskTitle || '选择任务或输入自定义专注主题'}</p>

          <div className="mt-6 grid w-full gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              value={draftTitle}
              onChange={event => setDraftTitle(event.target.value)}
              placeholder="自定义专注主题"
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
            <select
              value={selectedTaskId ?? ''}
              onChange={event => setSelectedTaskId(event.target.value ? Number(event.target.value) : null)}
              className="rounded-2xl border border-white/[0.06] bg-[#0d1726]/90 px-4 py-3 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
            >
              <option value="">不绑定任务</option>
              {tasks.filter(task => task.status !== 'done').map(task => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
            <div className="flex gap-2">
              {state === 'idle' && (
                <button onClick={startTimer} className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-600">
                  <Play size={16} />
                  开始
                </button>
              )}
              {state === 'running' && (
                <button onClick={pause} className="flex items-center gap-2 rounded-2xl border border-white/[0.08] px-5 py-3 text-sm text-slate-200 hover:bg-white/[0.05]">
                  <Pause size={16} />
                  暂停
                </button>
              )}
              {state === 'paused' && (
                <button onClick={resume} className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-600">
                  <Play size={16} />
                  继续
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button onClick={() => stop(false)} className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20">
              <Square size={14} />
              提前结束
            </button>
            <button onClick={() => skipToPrevious()} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.05]">
              <SkipBack size={14} />
              回到上一阶段
            </button>
            <button onClick={() => skipToNext()} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.05]">
              <SkipForward size={14} />
              跳到下一阶段
            </button>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="glass rounded-[30px] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Target size={16} className="text-emerald-300" />
              今日目标
            </h3>
            <div className="flex items-center gap-4">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10">
                <span className="text-xl font-bold text-emerald-300">{goalProgress}%</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{todaySessions.length} / {config.dailyGoal}</p>
                <p className="mt-1 text-sm text-slate-500">完成番茄 · {formatDurationFromSeconds(todaySeconds, { compact: true, allowZero: true })}</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-[30px] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Settings2 size={16} className="text-cyan-300" />
              番茄配置
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-500">工作时长
                <select value={config.workMinutes} onChange={event => updateConfig({ workMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-sm text-white">
                  {workOptions.map(value => <option key={value} value={value}>{value} 分钟</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-500">短休息
                <select value={config.shortBreakMinutes} onChange={event => updateConfig({ shortBreakMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-sm text-white">
                  {shortBreakOptions.map(value => <option key={value} value={value}>{value} 分钟</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-500">长休息
                <select value={config.longBreakMinutes} onChange={event => updateConfig({ longBreakMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-sm text-white">
                  {longBreakOptions.map(value => <option key={value} value={value}>{value} 分钟</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-500">长休息间隔
                <input type="number" min="2" value={config.longBreakInterval} onChange={event => updateConfig({ longBreakInterval: Number(event.target.value) || 4 })} className="mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white" />
              </label>
              <label className="text-xs text-slate-500">每日番茄目标
                <input type="number" min="1" value={config.dailyGoal} onChange={event => updateConfig({ dailyGoal: Number(event.target.value) || 1 })} className="mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => updateConfig({ showMinutesOnly: !config.showMinutesOnly })} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                  {config.showMinutesOnly ? '分钟显示' : '精确显示'}
                </button>
                <button onClick={() => updateConfig({ doNotDisturb: !config.doNotDisturb })} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                  {config.doNotDisturb ? '勿扰中' : '允许提醒'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="glass rounded-[30px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <TimerReset size={16} className="text-cyan-300" />
            历史统计
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500">累计番茄</p>
              <p className="mt-2 text-2xl font-bold text-white">{sessions.filter(session => session.phase === 'work' && session.completed).length}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500">本周番茄</p>
              <p className="mt-2 text-2xl font-bold text-white">{sessions.filter(session => session.phase === 'work' && Date.now() - new Date(session.createdAt).getTime() < 7 * 86400000).length}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500">休息完成</p>
              <p className="mt-2 text-2xl font-bold text-white">{sessions.filter(session => session.phase !== 'work' && session.completed).length}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-[30px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Coffee size={16} className="text-amber-300" />
            任务番茄消耗
          </h3>
          {taskPomodoros.length === 0 ? (
            <p className="text-sm text-slate-500">完成一个绑定任务的番茄后，这里会展示任务消耗分布。</p>
          ) : (
            <div className="space-y-3">
              {taskPomodoros.map(item => (
                <div key={item.title} className="flex items-center justify-between rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
                  <span className="truncate text-sm text-slate-200">{item.title}</span>
                  <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300">{item.count} 个番茄</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
