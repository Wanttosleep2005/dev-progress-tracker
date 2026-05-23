import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Filter, GitMerge, LocateFixed } from 'lucide-react';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useTaskStore } from '../stores/useTaskStore';
import { STATUS_LABELS, type Task, type TaskStatus } from '../types';
import { getTaskDependencyIds } from '../lib/taskDependencies';

type GanttScale = 'day' | 'week' | 'month';

const statusColors: Record<TaskStatus, string> = {
  todo: 'bg-slate-500',
  in_progress: 'bg-blue-500',
  review: 'bg-orange-500',
  done: 'bg-emerald-500',
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getVisibleDays(anchor: Date, scale: GanttScale) {
  const length = scale === 'day' ? 14 : scale === 'week' ? 42 : 90;
  const start = addDays(startOfDay(anchor), scale === 'day' ? -3 : scale === 'week' ? -14 : -30);
  return Array.from({ length }, (_, index) => addDays(start, index));
}

function dateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function taskStart(task: Task) {
  return startOfDay(new Date(task.plannedStartAt || task.createdAt));
}

function taskEnd(task: Task) {
  return startOfDay(new Date(task.plannedEndAt || task.dueDate || task.updatedAt || task.createdAt));
}

export default function Gantt() {
  const tasks = useTaskStore(state => state.tasks);
  const updateTask = useTaskStore(state => state.update);
  const milestones = useMilestoneStore(state => state.milestones);
  const [scale, setScale] = useState<GanttScale>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);

  const visibleDays = useMemo(() => getVisibleDays(anchor, scale), [anchor, scale]);
  const start = visibleDays[0];
  const dayWidth = scale === 'day' ? 72 : scale === 'week' ? 40 : 24;
  const timelineWidth = visibleDays.length * dayWidth;
  const filteredTasks = useMemo(
    () =>
      tasks
        .filter(task => statusFilter === 'all' || task.status === statusFilter)
        .filter(task => memberFilter === 'all' || (task.assigneeId || 'unassigned') === memberFilter)
        .sort((a, b) => taskStart(a).getTime() - taskStart(b).getTime()),
    [memberFilter, statusFilter, tasks]
  );

  const members = Array.from(new Set(tasks.map(task => task.assigneeId || 'unassigned')));

  const getOffset = (date: Date) => Math.max(0, Math.round((startOfDay(date).getTime() - start.getTime()) / 86400000) * dayWidth);
  const getWidth = (task: Task) => {
    const duration = Math.max(1, Math.round((taskEnd(task).getTime() - taskStart(task).getTime()) / 86400000) + 1);
    return Math.max(dayWidth, duration * dayWidth);
  };

  const moveTaskTo = async (task: Task, dayIndex: number) => {
    if (!task.id) return;
    const duration = Math.max(0, Math.round((taskEnd(task).getTime() - taskStart(task).getTime()) / 86400000));
    const plannedStartAt = dateKey(addDays(start, dayIndex));
    const plannedEndAt = dateKey(addDays(start, dayIndex + duration));
    await updateTask(task.id, { plannedStartAt, plannedEndAt, dueDate: plannedEndAt });
  };

  const exportPng = async () => {
    window.print();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">甘特图</h2>
          <p className="mt-1 text-sm text-slate-400">按时间线查看任务、里程碑、排期跨度和阻塞依赖关系。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAnchor(addDays(anchor, scale === 'day' ? -1 : scale === 'week' ? -7 : -30))} className="rounded-xl border border-white/[0.06] p-2 text-slate-300 hover:bg-white/[0.04]"><ChevronLeft size={16} /></button>
          <button onClick={() => setAnchor(new Date())} className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200"><LocateFixed size={14} />今天</button>
          <button onClick={() => setAnchor(addDays(anchor, scale === 'day' ? 1 : scale === 'week' ? 7 : 30))} className="rounded-xl border border-white/[0.06] p-2 text-slate-300 hover:bg-white/[0.04]"><ChevronRight size={16} /></button>
          <button onClick={exportPng} className="flex items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.04]"><Download size={14} />导出</button>
        </div>
      </div>

      <div className="glass rounded-[30px] p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <CalendarDays size={16} className="text-cyan-300" />
            时间线视图
          </div>
          <div className="flex flex-wrap gap-2">
            {(['day', 'week', 'month'] as GanttScale[]).map(item => (
              <button key={item} onClick={() => setScale(item)} className={`rounded-xl px-3 py-2 text-xs ${scale === item ? 'bg-cyan-500/15 text-cyan-200' : 'border border-white/[0.06] text-slate-400'}`}>
                {item === 'day' ? '日视图' : item === 'week' ? '周视图' : '月视图'}
              </button>
            ))}
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as TaskStatus | 'all')} className="rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-xs text-white">
              <option value="all">全部状态</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={memberFilter} onChange={event => setMemberFilter(event.target.value)} className="rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-xs text-white">
              <option value="all">全部成员</option>
              {members.map(member => <option key={member} value={member}>{member === 'unassigned' ? '未分配' : member}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border border-white/[0.06]">
          <div className="grid min-w-[980px]" style={{ gridTemplateColumns: `260px ${timelineWidth}px` }}>
            <div className="sticky left-0 z-20 border-b border-r border-white/[0.06] bg-[#0b1422] p-3 text-xs text-slate-500">任务 / 里程碑</div>
            <div className="flex border-b border-white/[0.06]" style={{ width: timelineWidth }}>
              {visibleDays.map((day, index) => (
                <div key={dateKey(day)} className={`shrink-0 border-r border-white/[0.04] p-2 text-center text-[10px] ${dateKey(day) === dateKey(new Date()) ? 'bg-cyan-500/10 text-cyan-200' : 'text-slate-500'}`} style={{ width: dayWidth }}>
                  {scale === 'month' && index % 7 !== 0 ? '' : `${day.getMonth() + 1}/${day.getDate()}`}
                </div>
              ))}
            </div>

            {filteredTasks.map(task => {
              const left = getOffset(taskStart(task));
              const width = getWidth(task);
              const progress = task.status === 'done' ? 100 : task.status === 'review' ? 75 : task.status === 'in_progress' ? 45 : 8;
              return (
                <div key={task.id} className="contents">
                  <button className="sticky left-0 z-10 flex items-center justify-between gap-3 border-r border-t border-white/[0.06] bg-[#0b1422] p-3 text-left hover:bg-white/[0.04]">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{task.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{STATUS_LABELS[task.status]} · {task.assigneeId || '未分配'}</p>
                    </div>
                    {getTaskDependencyIds(task).length > 0 && <GitMerge size={14} className="text-amber-300" />}
                  </button>
                  <div
                    className={`relative h-16 border-t border-white/[0.06] bg-white/[0.01] ${draggingTaskId === task.id ? 'bg-cyan-500/[0.04]' : ''}`}
                    style={{ width: timelineWidth }}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => {
                      event.preventDefault();
                      const taskId = Number(event.dataTransfer.getData('text/plain'));
                      const moving = filteredTasks.find(item => item.id === taskId);
                      if (!moving) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      const dayIndex = Math.max(0, Math.round((event.clientX - rect.left) / dayWidth));
                      moveTaskTo(moving, dayIndex);
                      setDraggingTaskId(null);
                    }}
                  >
                    <div
                      draggable
                      onDragStart={event => {
                        if (!task.id) return;
                        event.dataTransfer.setData('text/plain', String(task.id));
                        setDraggingTaskId(task.id);
                      }}
                      onDragEnd={() => setDraggingTaskId(null)}
                      title={`${task.title}\n${task.createdAt} - ${task.dueDate || task.updatedAt}\n负责人：${task.assigneeId || '未分配'}`}
                      className={`absolute top-4 h-8 cursor-grab overflow-hidden rounded-xl ${statusColors[task.status]} shadow-lg active:cursor-grabbing`}
                      style={{ left, width }}
                    >
                      <div className="h-full bg-white/20" style={{ width: `${progress}%` }} />
                      <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-white">{progress}%</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {milestones.map(milestone => (
              <div key={`m-${milestone.id}`} className="contents">
                <div className="sticky left-0 z-10 border-r border-t border-white/[0.06] bg-[#0b1422] p-3">
                  <p className="truncate text-sm text-amber-200">◆ {milestone.title}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{milestone.status}</p>
                </div>
                <div className="relative h-12 border-t border-white/[0.06] bg-amber-500/[0.02]" style={{ width: timelineWidth }}>
                  {milestone.dueDate && (
                    <div className="absolute top-2 h-8 w-1 rounded-full bg-amber-300" style={{ left: getOffset(new Date(milestone.dueDate)) }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><Filter size={12} />状态/成员筛选已启用</span>
          <span>依赖关系使用任务上的 dependsOn 字段绘制标记；后续可扩展为完整箭头线。</span>
        </div>
      </div>
    </motion.div>
  );
}
