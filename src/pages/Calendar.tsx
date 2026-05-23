import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  GitBranch,
  ListTodo,
  Plus,
  X,
  Circle,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useTaskStore } from '../stores/useTaskStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useTimelineStore } from '../stores/useTimelineStore';
import { EVENT_TYPE_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS, MILESTONE_STATUS_LABELS } from '../types';
import type { Task, TaskPriority, Milestone, TimelineEvent, MilestoneType } from '../types';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────
type ViewMode = 'month' | 'week' | 'day';
type CreateType = 'task' | 'milestone' | 'event';

interface DayItems {
  tasks: Task[];
  milestones: Milestone[];
  events: TimelineEvent[];
  multiDayEvents: TimelineEvent[];
  total: number;
}

// ── Constants ──────────────────────────────────────────
const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const DENSITY_THRESHOLDS = [0, 1, 3, 5, 8];

// ── Helpers ────────────────────────────────────────────
function toDateKey(dateStr: string): string {
  return dateStr.substring(0, 10);
}

function safeParseDate(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function getDensityClass(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return '';
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 'bg-sky-500/[0.03]';
  if (ratio <= 0.5) return 'bg-sky-500/[0.06]';
  if (ratio <= 0.75) return 'bg-sky-500/[0.10]';
  return 'bg-sky-500/[0.15]';
}

function getMultiDaySpanStyle(
  event: TimelineEvent,
  day: Date,
): { isStart: boolean; isEnd: boolean } {
  const startDate = safeParseDate(event.date);
  const endDate = event.endDate ? safeParseDate(event.endDate) : startDate;
  const isStart = isSameDay(day, startDate);
  const isEnd = isSameDay(day, endDate);
  return { isStart, isEnd };
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  release: '#22d3ee',
  bugfix: '#f87171',
  milestone: '#fbbf24',
  decision: '#a78bfa',
  other: '#94a3b8',
};

// ── Component ──────────────────────────────────────────
export default function CalendarPage() {
  const currentProjectId = useAppStore(s => s.currentProjectId);
  const tasks = useTaskStore(s => s.tasks);
  const milestones = useMilestoneStore(s => s.milestones);
  const events = useTimelineStore(s => s.events);

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [createType, setCreateType] = useState<CreateType | null>(null);
  const [createTitle, setCreateTitle] = useState('');
  const [createPriority, setCreatePriority] = useState<TaskPriority>('medium');
  const [createMilestoneType, setCreateMilestoneType] = useState<MilestoneType>('progress');
  const [createEventType, setCreateEventType] = useState<'release' | 'bugfix' | 'milestone' | 'decision' | 'other'>('other');
  const [createEndDate, setCreateEndDate] = useState('');

  // ── 1. Date index cache ──────────────────────────────
  const dateIndex = useMemo(() => {
    const map = new Map<string, DayItems>();
    const ensure = (key: string): DayItems => {
      if (!map.has(key)) {
        map.set(key, { tasks: [], milestones: [], events: [], multiDayEvents: [], total: 0 });
      }
      return map.get(key)!;
    };

    for (const t of tasks) {
      if (t.dueDate) {
        const items = ensure(toDateKey(t.dueDate));
        items.tasks.push(t);
        items.total++;
      }
    }
    for (const m of milestones) {
      if (m.dueDate) {
        const items = ensure(toDateKey(m.dueDate));
        items.milestones.push(m);
        items.total++;
      }
    }
    for (const e of events) {
      const startKey = toDateKey(e.date);
      const endKey = e.endDate ? toDateKey(e.endDate) : startKey;
      // first day gets the event in the main list
      const startItems = ensure(startKey);
      startItems.events.push(e);
      startItems.total++;
      // multi-day: add to subsequent days
      if (e.endDate && startKey !== endKey) {
        const start = safeParseDate(e.date);
        const end = safeParseDate(e.endDate);
        // normalize - swap if end is before start
        const s = start <= end ? start : end;
        const e2 = start <= end ? end : start;
        let cursor = addDays(s, 1);
        while (cursor <= e2) {
          const key = format(cursor, 'yyyy-MM-dd');
          const items = ensure(key);
          items.multiDayEvents.push(e);
          items.total++;
          cursor = addDays(cursor, 1);
        }
      }
    }
    return map;
  }, [tasks, milestones, events]);

  const getItemsForDate = useCallback(
    (date: Date): DayItems => {
      const key = format(date, 'yyyy-MM-dd');
      return dateIndex.get(key) ?? { tasks: [], milestones: [], events: [], multiDayEvents: [], total: 0 };
    },
    [dateIndex],
  );

  // ── Navigation ───────────────────────────────────────
  const navigate = (dir: -1 | 1) => {
    if (viewMode === 'month') setCurrentDate(d => (dir === -1 ? subMonths(d, 1) : addMonths(d, 1)));
    else if (viewMode === 'week') setCurrentDate(d => (dir === -1 ? subWeeks(d, 1) : addWeeks(d, 1)));
    else setCurrentDate(d => (dir === -1 ? subDays(d, 1) : addDays(d, 1)));
  };

  const goToday = () => setCurrentDate(new Date());

  // ── Month / Week days ────────────────────────────────
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // ── 4. Heat density ──────────────────────────────────
  const maxItems = useMemo(() => {
    const visibleDays = viewMode === 'month' ? monthDays : viewMode === 'week' ? weekDays : [currentDate];
    let max = 0;
    for (const d of visibleDays) {
      const items = getItemsForDate(d);
      if (items.total > max) max = items.total;
    }
    return max;
  }, [viewMode, monthDays, weekDays, currentDate, getItemsForDate]);

  // ── Selected day items ───────────────────────────────
  const selectedItems = selectedDate ? getItemsForDate(selectedDate) : null;
  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';

  // ── Create handlers ──────────────────────────────────
  const resetCreateForm = () => {
    setCreateType(null);
    setCreateTitle('');
    setCreatePriority('medium');
    setCreateMilestoneType('progress');
    setCreateEventType('other');
    setCreateEndDate('');
  };

  const handleCreate = async () => {
    if (!createTitle.trim() || !selectedDate || !currentProjectId) return;
    const now = new Date().toISOString();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    if (createType === 'task') {
      await useTaskStore.getState().add({
        projectId: currentProjectId,
        title: createTitle.trim(),
        description: '',
        status: 'todo',
        priority: createPriority,
        tags: [],
        dueDate: dateStr,
        plannedStartAt: null,
        plannedEndAt: null,
        milestoneId: null,
        estimatedMinutes: null,
        url: '',
        recurrence: 'none',
        source: 'board',
        remindAt: null,
        isTodayTask: false,
        publishedAt: null,
        assigneeId: null,
        dependsOn: [],
        subtasks: [],
        trackedMinutes: 0,
        pomodoroGoal: null,
        sprintId: null,
        createdBy: null,
        updatedBy: null,
        remoteId: null,
        syncUpdatedAt: now,
      });
    } else if (createType === 'milestone') {
      await useMilestoneStore.getState().add({
        projectId: currentProjectId,
        title: createTitle.trim(),
        description: '',
        dueDate: dateStr,
        type: createMilestoneType,
        progress: 0,
        status: 'upcoming',
        taskIds: [],
        createdBy: null,
        updatedBy: null,
        remoteId: null,
        syncUpdatedAt: now,
      });
    } else if (createType === 'event') {
      const evtPayload: Omit<TimelineEvent, 'id' | 'createdAt'> = {
        projectId: currentProjectId,
        title: createTitle.trim(),
        description: '',
        type: createEventType,
        date: dateStr,
        relatedTaskId: null,
        source: 'manual',
      };
      if (createEndDate) {
        evtPayload.endDate = createEndDate;
      }
      await useTimelineStore.getState().add(evtPayload);
    }
    resetCreateForm();
  };

  // ── Toggle task completion ───────────────────────────
  const toggleTaskDone = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    if (task.id != null) {
      await useTaskStore.getState().moveStatus(task.id, newStatus);
    }
  };

  // ── Render: Quick create inline form ─────────────────
  const renderCreateForm = () => (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mx-1 mb-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3">
        <div className="mb-2 flex items-center gap-2">
          {(['task', 'milestone', 'event'] as CreateType[]).map(t => (
            <button
              key={t}
              onClick={() => setCreateType(t)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                createType === t
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t === 'task' ? '任务' : t === 'milestone' ? '里程碑' : '事件'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={createTitle}
            onChange={e => setCreateTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder={
              createType === 'task'
                ? '任务标题...'
                : createType === 'milestone'
                  ? '里程碑标题...'
                  : '事件标题...'
            }
            className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-500/40"
          />
          {createType === 'task' && (
            <select
              value={createPriority}
              onChange={e => setCreatePriority(e.target.value as TaskPriority)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-xs text-slate-300 outline-none"
            >
              {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(p => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          )}
          {createType === 'milestone' && (
            <select
              value={createMilestoneType}
              onChange={e => setCreateMilestoneType(e.target.value as MilestoneType)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-xs text-slate-300 outline-none"
            >
              <option value="progress">进度型</option>
              <option value="completion">完成型</option>
            </select>
          )}
          {createType === 'event' && (
            <>
              <select
                value={createEventType}
                onChange={e => setCreateEventType(e.target.value as typeof createEventType)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-xs text-slate-300 outline-none"
              >
                {(['release', 'bugfix', 'milestone', 'decision', 'other'] as const).map(et => (
                  <option key={et} value={et}>{EVENT_TYPE_LABELS[et]}</option>
                ))}
              </select>
              <input
                type="date"
                value={createEndDate}
                onChange={e => setCreateEndDate(e.target.value)}
                placeholder="结束日期"
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-xs text-slate-300 outline-none"
              />
            </>
          )}
          <button
            onClick={handleCreate}
            disabled={!createTitle.trim()}
            className="rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/30 disabled:opacity-30 transition"
          >
            创建
          </button>
          <button onClick={resetCreateForm} className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:text-white transition">
            取消
          </button>
        </div>
      </div>
    </motion.div>
  );

  // ── Render: Multi-day event bar ──────────────────────
  const renderMultiDayBar = (event: TimelineEvent, day: Date) => {
    const { isStart, isEnd } = getMultiDaySpanStyle(event, day);
    const color = EVENT_TYPE_COLORS[event.type] ?? EVENT_TYPE_COLORS.other;
    return (
      <div
        key={`multi-${event.id}-${format(day, 'yyyy-MM-dd')}`}
        className={`mb-0.5 truncate px-1 py-[1px] text-[9px] leading-tight ${
          isStart ? 'rounded-l-md' : ''
        } ${isEnd ? 'rounded-r-md' : ''}`}
        style={{ backgroundColor: `${color}20`, color }}
        title={`${event.title}${event.endDate ? ` (${event.date.substring(0, 10)}~${event.endDate.substring(0, 10)})` : ''}`}
      >
        {isStart ? event.title : ''}
      </div>
    );
  };

  // ── No project guard ─────────────────────────────────
  if (!currentProjectId) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-5">
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-slate-500">请先选择一个项目</p>
        </div>
      </motion.div>
    );
  }

  // ── Main render ──────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
          <CalendarDays className="text-sky-300" size={22} />
          日历
        </h2>
        {/* View mode toggle */}
        <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
          {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                if (mode === 'month') setCurrentDate(new Date());
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === mode ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode === 'month' ? '月' : mode === 'week' ? '周' : '日'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div className="glass rounded-[30px] overflow-hidden">
        {/* ── Month View ──────────────────────────── */}
        {viewMode === 'month' && (
          <div>
            {/* Month title + navigation - like a real calendar */}
            <div className="flex items-center justify-between border-b border-white/[0.05] px-6 py-4">
              <button onClick={() => navigate(-1)} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/[0.04] transition">
                <ChevronLeft size={22} />
              </button>
              <div className="text-center">
                <h3 className="text-3xl font-bold tracking-tight text-white">
                  {format(currentDate, 'yyyy 年 M 月', { locale: zhCN })}
                </h3>
                {!isSameMonth(currentDate, new Date()) && (
                  <button onClick={goToday} className="mt-1 text-xs text-sky-400 hover:text-sky-300 transition">
                    回到本月
                  </button>
                )}
              </div>
              <button onClick={() => navigate(1)} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/[0.04] transition">
                <ChevronRight size={22} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-white/[0.05]">
              {DAY_NAMES.map((d, idx) => (
                <div
                  key={d}
                  className={`py-3 text-center text-xs font-medium ${
                    idx >= 5 ? 'text-slate-600 bg-white/[0.015]' : 'text-slate-500'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7">
              {monthDays.map((day, idx) => {
                const items = getItemsForDate(day);
                const totalItems = items.total;
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isWeekend = idx % 7 >= 5;
                const densityClass = getDensityClass(totalItems, maxItems);
                const allMultiDay = [...items.multiDayEvents];
                // Also include items.events that have endDate as multi-day
                const startDayEvents = items.events.filter(e => e.endDate);
                const combinedMultiDay = [...allMultiDay, ...startDayEvents];

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedDate(day);
                      resetCreateForm();
                    }}
                    className={`group relative min-h-[100px] border-b border-r border-white/[0.03] text-left transition hover:bg-white/[0.02] ${
                      isSelected ? 'bg-sky-500/10 ring-1 ring-inset ring-sky-500/20 z-10' : ''
                    } ${isToday ? 'ring-1 ring-inset ring-sky-500/40' : ''} ${
                      !isCurrentMonth ? 'opacity-35' : ''
                    } ${isWeekend ? 'bg-white/[0.012]' : ''} ${!isCurrentMonth ? '' : densityClass}`}
                    style={{ borderRightWidth: (idx + 1) % 7 === 0 ? '0' : undefined }}
                  >
                    {/* Quick-add button (hover) */}
                    <span
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-md opacity-0 group-hover:opacity-100 text-slate-500 hover:text-sky-300 hover:bg-sky-500/10 transition z-10"
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedDate(day);
                        setCreateType('task');
                      }}
                      title="快速添加"
                    >
                      <Plus size={14} />
                    </span>

                    <span
                      className={`text-xs font-medium ${
                        isToday
                          ? 'inline-flex items-center justify-center h-5 w-5 rounded-full bg-sky-500 text-white'
                          : isWeekend
                            ? 'text-slate-600'
                            : 'text-slate-400'
                      }`}
                    >
                      {isCurrentMonth ? format(day, 'd') : format(day, 'M月d', { locale: zhCN })}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {/* Multi-day event bars */}
                      {combinedMultiDay.slice(0, 2).map(e => renderMultiDayBar(e, day))}
                      {combinedMultiDay.length > 2 && (
                        <div className="text-[9px] text-slate-600">+{combinedMultiDay.length - 2}</div>
                      )}
                      {/* Tasks */}
                      {items.tasks.slice(0, 2).map(t => {
                        const isDone = t.status === 'done';
                        return (
                          <div key={t.id} className="flex items-center gap-1" title={t.title}>
                            {isDone ? (
                              <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                            ) : (
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: PRIORITY_COLORS[t.priority] }}
                              />
                            )}
                            {t.recurrence !== 'none' && <RefreshCw size={8} className="text-slate-600 shrink-0" />}
                            <span className={`truncate text-[10px] ${isDone ? 'text-slate-600 line-through' : 'text-slate-400'}`}>
                              {t.title}
                            </span>
                          </div>
                        );
                      })}
                      {/* Milestones */}
                      {items.milestones.slice(0, 1).map(m => (
                        <div key={m.id} className="flex items-center gap-1" title={`${m.title} · ${m.progress}%`}>
                          <Flag size={10} className="text-amber-400 shrink-0" />
                          <span className="truncate text-[10px] text-amber-300/70">{m.title}</span>
                        </div>
                      ))}
                      {/* "More" indicator */}
                      {totalItems > 3 && (
                        <span className="text-[9px] text-slate-600">+{totalItems - 3} 更多</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Week View ───────────────────────────── */}
        {viewMode === 'week' && (
          <div>
            {/* Week title + navigation */}
            <div className="flex items-center justify-between border-b border-white/[0.05] px-6 py-4">
              <button onClick={() => navigate(-1)} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/[0.04] transition">
                <ChevronLeft size={22} />
              </button>
              <div className="text-center">
                <h3 className="text-2xl font-bold tracking-tight text-white">
                  {format(weekDays[0], 'M 月 d 日', { locale: zhCN })} - {format(weekDays[6], 'M 月 d 日', { locale: zhCN })}
                </h3>
                <button onClick={goToday} className="mt-1 text-xs text-sky-400 hover:text-sky-300 transition">
                  回到本周
                </button>
              </div>
              <button onClick={() => navigate(1)} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/[0.04] transition">
                <ChevronRight size={22} />
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-white/[0.05]">
              {weekDays.map((day, idx) => {
                const items = getItemsForDate(day);
                const total = items.total;
                const isToday = isSameDay(day, new Date());
                const isWeekend = idx >= 5;
                return (
                  <div
                    key={idx}
                    className={`py-2 text-center border-r border-white/[0.03] cursor-pointer hover:bg-white/[0.02] transition ${
                      idx === 6 ? 'border-r-0' : ''
                    } ${isToday ? 'bg-sky-500/5' : ''} ${isWeekend ? 'bg-white/[0.012]' : ''}`}
                    onClick={() => {
                      setSelectedDate(day);
                      resetCreateForm();
                    }}
                  >
                    <p className={`text-[10px] ${isWeekend ? 'text-slate-600' : 'text-slate-500'}`}>
                      {DAY_NAMES[idx]}
                    </p>
                    <p className={`text-sm font-semibold ${isToday ? 'text-sky-300' : 'text-white'}`}>
                      {format(day, 'd')}
                    </p>
                    {total > 0 && <p className="text-[9px] text-slate-500">{total} 项</p>}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 min-h-[500px]">
              {weekDays.map((day, idx) => {
                const items = getItemsForDate(day);
                const isWeekend = idx >= 5;
                const allMultiDay = [
                  ...items.multiDayEvents,
                  ...items.events.filter(e => e.endDate),
                ];
                return (
                  <div
                    key={idx}
                    className={`border-r border-white/[0.03] p-1 ${idx === 6 ? 'border-r-0' : ''} ${
                      isWeekend ? 'bg-white/[0.012]' : ''
                    }`}
                  >
                    {/* Multi-day events */}
                    {allMultiDay.map(e => renderMultiDayBar(e, day))}
                    {/* Tasks */}
                    {items.tasks.map(t => {
                      const isDone = t.status === 'done';
                      return (
                        <div
                          key={t.id}
                          onClick={e => {
                            e.stopPropagation();
                            toggleTaskDone(t);
                          }}
                          className={`mb-1 flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[10px] truncate transition hover:brightness-125 ${
                            isDone ? 'bg-emerald-500/8 text-emerald-400/60 line-through' : ''
                          }`}
                          style={
                            isDone
                              ? {}
                              : { backgroundColor: `${PRIORITY_COLORS[t.priority]}15`, color: PRIORITY_COLORS[t.priority] }
                          }
                          title={`${t.title} · 点击切换完成状态`}
                        >
                          {isDone ? (
                            <CheckCircle2 size={10} className="shrink-0" />
                          ) : (
                            <Circle size={10} className="shrink-0 opacity-50" />
                          )}
                          {t.title}
                        </div>
                      );
                    })}
                    {items.milestones.map(m => (
                      <div
                        key={m.id}
                        className="mb-1 rounded-md bg-amber-500/10 px-1.5 py-1 text-[10px] text-amber-300 truncate"
                        title={m.title}
                      >
                        🚩 {m.title}
                      </div>
                    ))}
                    {items.events.filter(e => !e.endDate).map(e => (
                      <div
                        key={e.id}
                        className="mb-1 rounded-md bg-indigo-500/10 px-1.5 py-1 text-[10px] text-indigo-300 truncate"
                        title={e.title}
                      >
                        {e.title}
                      </div>
                    ))}
                    {/* Quick add */}
                    <button
                      className="mt-1 flex w-full items-center justify-center rounded-md py-1 text-slate-700 hover:text-slate-400 hover:bg-white/[0.03] transition opacity-0 hover:opacity-100"
                      onClick={() => {
                        setSelectedDate(day);
                        setCreateType('task');
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Day View ────────────────────────────── */}
        {viewMode === 'day' && (
          <div className="min-h-[600px]">
            {/* Day title + navigation */}
            <div className="flex items-center justify-between border-b border-white/[0.05] px-6 py-4">
              <button onClick={() => navigate(-1)} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/[0.04] transition">
                <ChevronLeft size={22} />
              </button>
              <div className="text-center">
                <h3 className="text-2xl font-bold tracking-tight text-white">
                  {format(currentDate, 'M 月 d 日', { locale: zhCN })}
                </h3>
                <p className="text-sm text-slate-400">{format(currentDate, 'EEEE', { locale: zhCN })}</p>
                {!isSameDay(currentDate, new Date()) && (
                  <button onClick={goToday} className="mt-1 text-xs text-sky-400 hover:text-sky-300 transition">
                    回到今天
                  </button>
                )}
              </div>
              <button onClick={() => navigate(1)} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/[0.04] transition">
                <ChevronRight size={22} />
              </button>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {HOURS.map(hour => {
                const h = parseInt(hour);
                const dayItems = getItemsForDate(currentDate);
                const hourTasks = dayItems.tasks.filter(t => {
                  const d = safeParseDate(t.dueDate!);
                  return d.getHours() === h;
                });
                return (
                  <div key={hour} className="flex min-h-[48px]">
                    <div className="w-16 shrink-0 py-2 text-center text-[10px] text-slate-600 border-r border-white/[0.03]">
                      {hour}
                    </div>
                    <div className="flex-1 p-1">
                      {hourTasks.map(t => (
                        <div
                          key={t.id}
                          onClick={() => toggleTaskDone(t)}
                          className="mb-0.5 cursor-pointer rounded-md px-2 py-1 text-xs truncate hover:brightness-125 transition"
                          style={{
                            backgroundColor: `${PRIORITY_COLORS[t.priority]}15`,
                            color: PRIORITY_COLORS[t.priority],
                          }}
                        >
                          {t.status === 'done' && <CheckCircle2 size={10} className="inline mr-1 text-emerald-400" />}
                          {t.status === 'done' ? <span className="line-through opacity-60">{t.title}</span> : t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Day detail popup ──────────────────────── */}
      <AnimatePresence>
        {selectedDate && selectedItems && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="glass rounded-[24px] p-5"
          >
            {/* Popup header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {format(selectedDate, 'yyyy 年 M 月 d 日 EEEE', { locale: zhCN })}
                <span className="ml-2 text-xs text-slate-500">{selectedItems.total} 项</span>
              </h3>
              <div className="flex items-center gap-2">
                {!createType && (
                  <>
                    <button
                      onClick={() => setCreateType('task')}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-sky-300 hover:bg-sky-500/10 transition"
                    >
                      <Plus size={12} /> 任务
                    </button>
                    <button
                      onClick={() => setCreateType('milestone')}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-amber-300 hover:bg-amber-500/10 transition"
                    >
                      <Plus size={12} /> 里程碑
                    </button>
                    <button
                      onClick={() => setCreateType('event')}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-indigo-300 hover:bg-indigo-500/10 transition"
                    >
                      <Plus size={12} /> 事件
                    </button>
                  </>
                )}
                <button onClick={() => setSelectedDate(null)} className="rounded-lg p-1 text-slate-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Inline create form */}
            <AnimatePresence>{createType && renderCreateForm()}</AnimatePresence>

            {/* Items list */}
            <div className="space-y-2">
              {selectedItems.tasks.map(t => {
                const isDone = t.status === 'done';
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition group ${
                      isDone
                        ? 'border-emerald-500/10 bg-emerald-500/[0.03]'
                        : 'border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08]'
                    }`}
                  >
                    <button
                      onClick={() => toggleTaskDone(t)}
                      className="shrink-0 hover:scale-110 transition-transform"
                      title={isDone ? '标记为待办' : '标记为完成'}
                    >
                      {isDone ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : (
                        <Circle size={16} style={{ color: PRIORITY_COLORS[t.priority] }} />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${isDone ? 'text-slate-500 line-through' : 'text-white'}`}>
                        {t.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className={`text-[10px] ${isDone ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {STATUS_LABELS[t.status]}
                        </p>
                        {t.recurrence !== 'none' && (
                          <span className="text-[9px] text-purple-400 flex items-center gap-0.5">
                            <RefreshCw size={8} /> 重复
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {selectedItems.milestones.map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-3"
                >
                  <Flag size={14} className="text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{m.title}</p>
                    <p className="text-[10px] text-amber-300/70">
                      {MILESTONE_STATUS_LABELS[m.status]} · {m.progress}%
                    </p>
                  </div>
                </div>
              ))}
              {selectedItems.events.map(e => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl border border-indigo-500/10 bg-indigo-500/[0.03] p-3"
                >
                  <GitBranch size={14} className="text-indigo-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{e.title}</p>
                    <p className="text-[10px] text-indigo-300/70">
                      {EVENT_TYPE_LABELS[e.type]}
                      {e.endDate && ` · ${e.date.substring(0, 10)} ~ ${e.endDate.substring(0, 10)}`}
                    </p>
                  </div>
                </div>
              ))}
              {selectedItems.tasks.length === 0 &&
                selectedItems.milestones.length === 0 &&
                selectedItems.events.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sm text-slate-600">当天无事项</p>
                    {!createType && (
                      <button
                        onClick={() => setCreateType('task')}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs text-sky-400 hover:bg-sky-500/10 transition"
                      >
                        <Plus size={12} /> 添加第一个事项
                      </button>
                    )}
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
