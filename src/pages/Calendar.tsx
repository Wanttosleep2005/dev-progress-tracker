import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  GitBranch,
  ListTodo,
  X,
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useTaskStore } from '../stores/useTaskStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useTimelineStore } from '../stores/useTimelineStore';
import { EVENT_TYPE_LABELS, PRIORITY_COLORS, STATUS_LABELS } from '../types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';

type ViewMode = 'month' | 'week' | 'day';
const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

export default function CalendarPage() {
  const currentProjectId = useAppStore(s => s.currentProjectId);
  const tasks = useTaskStore(s => s.tasks);
  const milestones = useMilestoneStore(s => s.milestones);
  const events = useTimelineStore(s => s.events);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const navigate = (dir: -1 | 1) => {
    if (viewMode === 'month') setCurrentDate(d => dir === -1 ? subMonths(d, 1) : addMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate(d => dir === -1 ? subWeeks(d, 1) : addWeeks(d, 1));
    else setCurrentDate(d => dir === -1 ? subDays(d, 1) : addDays(d, 1));
  };

  const goToday = () => setCurrentDate(new Date());

  // Get items for a specific date
  const getItemsForDate = (date: Date) => {
    const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), date));
    const dayMilestones = milestones.filter(m => m.dueDate && isSameDay(new Date(m.dueDate), date));
    const dayEvents = events.filter(e => isSameDay(new Date(e.date), date));
    return { tasks: dayTasks, milestones: dayMilestones, events: dayEvents };
  };

  // Month view days
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Week view days
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const headerTitle = viewMode === 'month'
    ? format(currentDate, 'yyyy 年 M 月', { locale: zhCN })
    : viewMode === 'week'
      ? `${format(weekDays[0], 'M/d')} - ${format(weekDays[6], 'M/d')}`
      : format(currentDate, 'yyyy 年 M 月 d 日', { locale: zhCN });

  const selectedItems = selectedDate ? getItemsForDate(selectedDate) : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            <CalendarDays className="text-sky-300" size={26} />
            日历
          </h2>
          <p className="mt-1 text-sm text-slate-400">月/周/日视角查看任务截止、里程碑和时间线事件。</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
            {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === mode ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'month' ? '月' : mode === 'week' ? '周' : '日'}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
            <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 text-slate-400 hover:text-white"><ChevronLeft size={16} /></button>
            <button onClick={goToday} className="rounded-lg px-3 py-1 text-xs text-slate-300 hover:text-white">今天</button>
            <button onClick={() => navigate(1)} className="rounded-lg p-1.5 text-slate-400 hover:text-white"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* Calendar body */}
      <div className="glass rounded-[30px] overflow-hidden">
        {viewMode === 'month' && (
          <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-white/[0.05]">
              {DAY_NAMES.map(d => (
                <div key={d} className="py-3 text-center text-xs font-medium text-slate-500">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7">
              {monthDays.map((day, idx) => {
                const items = getItemsForDate(day);
                const totalItems = items.tasks.length + items.milestones.length + items.events.length;
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[100px] border-b border-r border-white/[0.03] p-2 text-left transition hover:bg-white/[0.02] ${
                      isSelected ? 'bg-sky-500/10 ring-1 ring-inset ring-sky-500/20' : ''
                    } ${isToday ? 'bg-white/[0.02]' : ''} ${!isCurrentMonth ? 'opacity-30' : ''}`}
                    style={{ borderRightWidth: (idx + 1) % 7 === 0 ? '0' : undefined }}
                  >
                    <span className={`text-xs font-medium ${isToday ? 'text-sky-300' : 'text-slate-400'}`}>{format(day, 'd')}</span>
                    <div className="mt-1 space-y-0.5">
                      {items.tasks.slice(0, 2).map(t => (
                        <div key={t.id} className="flex items-center gap-1" title={t.title}>
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[t.priority] }} />
                          <span className="truncate text-[10px] text-slate-400">{t.title}</span>
                        </div>
                      ))}
                      {items.milestones.slice(0, 1).map(m => (
                        <div key={m.id} className="flex items-center gap-1" title={m.title}>
                          <Flag size={10} className="text-amber-400 shrink-0" />
                          <span className="truncate text-[10px] text-amber-300/70">{m.title}</span>
                        </div>
                      ))}
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

        {viewMode === 'week' && (
          <div>
            <div className="grid grid-cols-7 border-b border-white/[0.05]">
              {weekDays.map((day, idx) => {
                const items = getItemsForDate(day);
                const total = items.tasks.length + items.milestones.length + items.events.length;
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={idx} className={`py-2 text-center border-r border-white/[0.03] ${idx === 6 ? 'border-r-0' : ''} ${isToday ? 'bg-sky-500/5' : ''}`}>
                    <p className="text-[10px] text-slate-500">{DAY_NAMES[idx]}</p>
                    <p className={`text-sm font-semibold ${isToday ? 'text-sky-300' : 'text-white'}`}>{format(day, 'd')}</p>
                    {total > 0 && <p className="text-[9px] text-slate-500">{total} 项</p>}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 min-h-[500px]">
              {weekDays.map((day, idx) => {
                const items = getItemsForDate(day);
                return (
                  <div key={idx} className={`border-r border-white/[0.03] p-1 ${idx === 6 ? 'border-r-0' : ''}`}>
                    {items.tasks.map(t => (
                      <div key={t.id} className="mb-1 rounded-md px-1.5 py-1 text-[10px] truncate" style={{ backgroundColor: `${PRIORITY_COLORS[t.priority]}15`, color: PRIORITY_COLORS[t.priority] }} title={t.title}>
                        {t.title}
                      </div>
                    ))}
                    {items.milestones.map(m => (
                      <div key={m.id} className="mb-1 rounded-md bg-amber-500/10 px-1.5 py-1 text-[10px] text-amber-300 truncate" title={m.title}>
                        🚩 {m.title}
                      </div>
                    ))}
                    {items.events.map(e => (
                      <div key={e.id} className="mb-1 rounded-md bg-indigo-500/10 px-1.5 py-1 text-[10px] text-indigo-300 truncate" title={e.title}>
                        {e.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'day' && (
          <div className="min-h-[600px]">
            <div className="px-4 py-3 border-b border-white/[0.05]">
              <p className="text-sm font-semibold text-white">{format(currentDate, 'yyyy 年 M 月 d 日 EEEE', { locale: zhCN })}</p>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {HOURS.map(hour => {
                const dayItems = getItemsForDate(currentDate);
                const hourTasks = dayItems.tasks.filter(t => {
                  const d = new Date(t.dueDate!);
                  return d.getHours() === parseInt(hour);
                });
                return (
                  <div key={hour} className="flex min-h-[48px]">
                    <div className="w-16 shrink-0 py-2 text-center text-[10px] text-slate-600 border-r border-white/[0.03]">{hour}</div>
                    <div className="flex-1 p-1">
                      {hourTasks.map(t => (
                        <div key={t.id} className="mb-0.5 rounded-md px-2 py-1 text-xs truncate" style={{ backgroundColor: `${PRIORITY_COLORS[t.priority]}15`, color: PRIORITY_COLORS[t.priority] }}>
                          {t.title}
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

      {/* Day detail popup */}
      <AnimatePresence>
        {selectedDate && selectedItems && viewMode !== 'day' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="glass rounded-[24px] p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {format(selectedDate, 'yyyy 年 M 月 d 日 EEEE', { locale: zhCN })}
                <span className="ml-2 text-xs text-slate-500">
                  {selectedItems.tasks.length + selectedItems.milestones.length + selectedItems.events.length} 项
                </span>
              </h3>
              <button onClick={() => setSelectedDate(null)} className="rounded-lg p-1 text-slate-500 hover:text-white"><X size={16} /></button>
            </div>

            <div className="space-y-2">
              {selectedItems.tasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                  <ListTodo size={14} style={{ color: PRIORITY_COLORS[t.priority] }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{t.title}</p>
                    <p className="text-[10px] text-slate-500">{STATUS_LABELS[t.status]}</p>
                  </div>
                </div>
              ))}
              {selectedItems.milestones.map(m => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-3">
                  <Flag size={14} className="text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{m.title}</p>
                    <p className="text-[10px] text-amber-300/70">里程碑 · {m.progress}%</p>
                  </div>
                </div>
              ))}
              {selectedItems.events.map(e => (
                <div key={e.id} className="flex items-center gap-3 rounded-xl border border-indigo-500/10 bg-indigo-500/[0.03] p-3">
                  <GitBranch size={14} className="text-indigo-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{e.title}</p>
                    <p className="text-[10px] text-indigo-300/70">{EVENT_TYPE_LABELS[e.type]}</p>
                  </div>
                </div>
              ))}
              {selectedItems.tasks.length === 0 && selectedItems.milestones.length === 0 && selectedItems.events.length === 0 && (
                <p className="text-center text-sm text-slate-600 py-4">当天无事项</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
