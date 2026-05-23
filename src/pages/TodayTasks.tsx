import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlarmClock, CalendarClock, ClipboardPlus, ListTodo, Megaphone, TimerReset, Trash2 } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useTaskStore } from '../stores/useTaskStore';
import { PRIORITY_LABELS, RECURRENCE_LABELS, STATUS_LABELS } from '../types';
import type { RecurrenceRule, TaskPriority } from '../types';
import { useToast } from '../stores/useToast';
import { formatDateTime } from '../lib/duration';

function formatCountdown(target: string | null) {
  if (!target) return '未设置截止时间';
  const due = new Date(target);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  if (diff <= 0) return '已到期';

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
  return `${minutes} 分钟`;
}

export default function TodayTasks() {
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const { tasks, add, update, remove } = useTaskStore();
  const { add: addToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [estimatedMinutes, setEstimatedMinutes] = useState('60');
  const [tags, setTags] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceRule>('none');

  const todayTasks = useMemo(
    () =>
      tasks
        .filter(task => task.isTodayTask)
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        }),
    [tasks]
  );

  const stats = useMemo(() => {
    const published = todayTasks.length;
    const pending = todayTasks.filter(task => task.status !== 'done').length;
    const dueSoon = todayTasks.filter(task => {
      if (task.status === 'done' || !task.dueDate) return false;
      const diff = new Date(task.dueDate).getTime() - Date.now();
      return diff > 0 && diff <= 24 * 60 * 60 * 1000;
    }).length;
    return { published, pending, dueSoon };
  }, [todayTasks]);

  const handlePublish = async () => {
    if (!currentProjectId || !title.trim()) return;
    await add({
      projectId: currentProjectId,
      title: title.trim(),
      description: description.trim(),
      status: 'todo',
      priority,
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
      dueDate: dueAt || null,
      milestoneId: null,
      estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) || null : null,
      url: '',
      recurrence,
      source: 'daily',
      remindAt: remindAt || null,
      isTodayTask: true,
      publishedAt: new Date().toISOString(),
    });
    addToast('今日任务已发布，概览区会同步展示。', 'success');
    setTitle('');
    setDescription('');
    setDueAt('');
    setRemindAt('');
    setEstimatedMinutes('60');
    setTags('');
    setRecurrence('none');
    setPriority('high');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">今日任务</h2>
          <p className="mt-1 text-sm text-slate-400">集中发布今天要推进的任务，让概览、提醒和倒计时都围绕当天执行节奏联动。</p>
        </div>
        <div className="rounded-[24px] border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-200">
          今日任务发布
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-[28px] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">今日已发布</span>
            <Megaphone size={16} className="text-sky-300" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.published}</p>
        </div>
        <div className="glass rounded-[28px] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">待推进</span>
            <ListTodo size={16} className="text-amber-300" />
          </div>
          <p className="text-3xl font-bold text-amber-300">{stats.pending}</p>
        </div>
        <div className="glass rounded-[28px] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">24 小时内到期</span>
            <AlarmClock size={16} className="text-rose-300" />
          </div>
          <p className="text-3xl font-bold text-rose-300">{stats.dueSoon}</p>
        </div>
      </div>

      <div className="glass rounded-[30px] p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <ClipboardPlus size={16} className="text-cyan-300" />
          发布今日任务
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="任务标题"
            className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none xl:col-span-2"
          />
          <input
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="任务说明"
            className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none xl:col-span-2"
          />
          <select
            value={priority}
            onChange={event => setPriority(event.target.value as TaskPriority)}
            className="rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none"
          >
            {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(item => (
              <option key={item} value={item}>
                {PRIORITY_LABELS[item]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="5"
            value={estimatedMinutes}
            onChange={event => setEstimatedMinutes(event.target.value)}
            placeholder="预估工时（分钟）"
            className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
          />
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <label className="mb-1 block text-[11px] text-slate-500">截止时间</label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={event => setDueAt(event.target.value)}
              className="w-full bg-transparent text-sm text-white focus:outline-none"
            />
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <label className="mb-1 block text-[11px] text-slate-500">提醒时间</label>
            <input
              type="datetime-local"
              value={remindAt}
              onChange={event => setRemindAt(event.target.value)}
              className="w-full bg-transparent text-sm text-white focus:outline-none"
            />
          </div>
          <input
            value={tags}
            onChange={event => setTags(event.target.value)}
            placeholder="标签，用逗号分隔"
            className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none xl:col-span-2"
          />
          <select value={recurrence} onChange={event => setRecurrence(event.target.value as RecurrenceRule)} className="custom-select rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none">
            {Object.entries(RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button onClick={handlePublish} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600">
            发布任务
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {todayTasks.map(task => (
          <div key={task.id} className="glass rounded-[28px] p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{task.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{task.description || '暂无任务说明'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300">{STATUS_LABELS[task.status]}</span>
                <button
                  onClick={() => task.id && remove(task.id)}
                  className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
                  aria-label="删除今日任务"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                  <CalendarClock size={12} />
                  截止时间
                </div>
                <p className="text-sm text-white">{formatDateTime(task.dueDate)}</p>
                <p className="mt-1 text-[11px] text-slate-500">{formatCountdown(task.dueDate)}</p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                  <TimerReset size={12} />
                  提醒时间
                </div>
                <p className="text-sm text-white">{formatDateTime(task.remindAt)}</p>
                <button
                  onClick={() => task.id && update(task.id, { status: task.status === 'done' ? 'todo' : 'done' })}
                  className="mt-2 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08]"
                >
                  {task.status === 'done' ? '恢复为待办' : '标记完成'}
                </button>
              </div>
            </div>
          </div>
        ))}

        {todayTasks.length === 0 && (
          <div className="glass rounded-[28px] p-10 text-center text-slate-500 xl:col-span-2">
            今天还没有发布任务，先创建一条当日重点事项吧。
          </div>
        )}
      </div>
    </motion.div>
  );
}
