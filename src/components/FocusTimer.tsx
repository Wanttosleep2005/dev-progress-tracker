import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CircleDot, Pause, Play, Search, Square, TimerReset } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useStatsStore } from '../stores/useStatsStore';
import { useToast } from '../stores/useToast';
import { useTaskStore } from '../stores/useTaskStore';
import { useTaskTimerStore } from '../stores/useTaskTimerStore';
import { formatDurationFromSeconds } from '../lib/duration';

let globalState: 'idle' | 'running' | 'paused' = 'idle';
let globalSeconds = 0;
let globalInterval: ReturnType<typeof setInterval> | null = null;
let globalTaskTitle = '';
let globalTaskId: number | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(listener => listener());
}

function clearGlobalTimer() {
  if (globalInterval) {
    clearInterval(globalInterval);
    globalInterval = null;
  }
}

export function startFocusTimer(taskTitle?: string, taskId?: number | null) {
  // Pause task timer if running
  const taskTimer = useTaskTimerStore.getState();
  if (taskTimer.isRunning) {
    taskTimer.pause();
  }
  clearGlobalTimer();
  globalState = 'running';
  globalSeconds = 0;
  globalTaskTitle = taskTitle?.trim() || '';
  globalTaskId = taskId ?? null;
  globalInterval = setInterval(() => {
    globalSeconds += 1;
    notify();
  }, 1000);
  notify();
}

export function stopFocusTimer() {
  clearGlobalTimer();
  if (globalSeconds > 0) {
    useStatsStore.getState().addSession(
      globalSeconds,
      globalTaskTitle,
      useAppStore.getState().currentProjectId ?? undefined,
      globalTaskId
    );
    useToast.getState().add(`专注完成，已记录 ${formatDurationFromSeconds(globalSeconds, { allowZero: true })}。`, 'success');
  }
  globalState = 'idle';
  globalSeconds = 0;
  globalTaskTitle = '';
  globalTaskId = null;
  notify();
}

export function pauseFocusTimer() {
  clearGlobalTimer();
  globalState = 'paused';
  notify();
}

export function resumeFocusTimer() {
  clearGlobalTimer();
  globalState = 'running';
  globalInterval = setInterval(() => {
    globalSeconds += 1;
    notify();
  }, 1000);
  notify();
}

export function useFocusTimerState() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(value => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const hours = Math.floor(globalSeconds / 3600);
  const minutes = Math.floor((globalSeconds % 3600) / 60);
  const seconds = globalSeconds % 60;

  return {
    state: globalState,
    taskTitle: globalTaskTitle,
    taskId: globalTaskId,
    totalSeconds: globalSeconds,
    humanized: formatDurationFromSeconds(globalSeconds, { allowZero: true }),
    display: `${hours > 0 ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  };
}

export function FocusTimerPanel() {
  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const timer = useFocusTimerState();
  const active = timer.state !== 'idle';
  const tasks = useTaskStore(state => state.tasks);

  const candidates = useMemo(() => {
    const keyword = inputValue.trim().toLowerCase();
    if (!keyword) return [];
    return tasks
      .filter(task => task.status !== 'done')
      .filter(task => [task.title, task.description, ...task.tags].join(' ').toLowerCase().includes(keyword))
      .slice(0, 6);
  }, [inputValue, tasks]);

  const startWithInput = () => {
    const keyword = inputValue.trim();
    if (!keyword) return;
    const exactTask = candidates.find(task => task.title.trim().toLowerCase() === keyword.toLowerCase());
    startFocusTimer(exactTask?.title ?? keyword, exactTask?.id ?? null);
  };

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-[#0d1727]/90 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-500/15 bg-cyan-500/10 text-cyan-300">
            <TimerReset size={17} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Focus</p>
            <p className="mt-1 text-sm font-semibold text-white">专注计时</p>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[10px] ${
            timer.state === 'running'
              ? 'bg-emerald-500/10 text-emerald-400'
              : timer.state === 'paused'
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-white/[0.04] text-slate-500'
          }`}
        >
          {timer.state === 'running' ? '进行中' : timer.state === 'paused' ? '已暂停' : '待开始'}
        </span>
      </div>

      <div className="mb-4 rounded-3xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/12 via-indigo-500/8 to-transparent p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="text-3xl font-bold tracking-tight text-white">{timer.display}</div>
          <CircleDot size={18} className={timer.state === 'running' ? 'text-emerald-300' : 'text-slate-600'} />
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-slate-400">
          {timer.taskTitle || '输入一个新主题，或搜索已有任务并选择开始专注。'}
        </p>
      </div>

      {!active && (
        <div className="relative mb-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={inputValue}
            onFocus={() => setInputFocused(true)}
            onBlur={() => window.setTimeout(() => setInputFocused(false), 120)}
            onChange={event => setInputValue(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') startWithInput();
            }}
            placeholder="输入专注主题，或搜索任务"
            className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />

          {inputFocused && candidates.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101a2a] p-1 shadow-2xl">
              {candidates.map(task => (
                <button
                  key={task.id}
                  onClick={() => {
                    setInputValue(task.title);
                    startFocusTimer(task.title, task.id ?? null);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/[0.06]"
                >
                  <span className="truncate">{task.title}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{task.tags[0] || '任务'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {!active && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startWithInput}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!inputValue.trim()}
          >
            <Play size={14} />
            开始专注
          </motion.button>
        )}

        {timer.state === 'running' && (
          <>
            <button
              onClick={pauseFocusTimer}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05]"
            >
              <Pause size={14} />
              暂停
            </button>
            <button
              onClick={stopFocusTimer}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/20"
            >
              <Square size={14} />
              结束
            </button>
          </>
        )}

        {timer.state === 'paused' && (
          <>
            <button
              onClick={resumeFocusTimer}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500/90 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              <Play size={14} />
              继续
            </button>
            <button
              onClick={stopFocusTimer}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/20"
            >
              <Square size={14} />
              结束
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default FocusTimerPanel;
