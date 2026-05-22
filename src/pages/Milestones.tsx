import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Flag, Link2, Plus, RefreshCcw, Target, X } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useTaskStore } from '../stores/useTaskStore';
import { MILESTONE_STATUS_LABELS, STATUS_LABELS } from '../types';
import type { MilestoneType } from '../types';

export default function Milestones() {
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const { milestones, add, update, remove, refresh, loading } = useMilestoneStore();
  const tasks = useTaskStore(state => state.tasks);

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [newType, setNewType] = useState<MilestoneType>('progress');
  const [refreshing, setRefreshing] = useState(false);

  const milestoneSummaries = useMemo(() => {
    return milestones.map(milestone => {
      const linkedTasks = tasks.filter(task => task.milestoneId === milestone.id);
      const doneTasks = linkedTasks.filter(task => task.status === 'done').length;
      return { milestone, linkedTasks, doneTasks };
    });
  }, [milestones, tasks]);

  const handleAdd = useCallback(async () => {
    if (!title.trim() || !currentProjectId) return;
    await add({
      projectId: currentProjectId,
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate || null,
      type: newType,
      progress: 0,
      status: newType === 'completion' ? 'upcoming' : 'active',
      taskIds: [],
    });
    setTitle('');
    setDescription('');
    setDueDate('');
    setNewType('progress');
    setShowAdd(false);
  }, [add, currentProjectId, description, dueDate, newType, title]);

  const handleRefresh = useCallback(async () => {
    if (!currentProjectId) return;
    setRefreshing(true);
    await refresh(currentProjectId);
    setRefreshing(false);
  }, [currentProjectId, refresh]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">里程碑</h2>
          <p className="mt-1 text-sm text-slate-400">扩大卡片展示范围，突出阶段目标、联动任务和实时进度变化。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRefresh}
            disabled={!currentProjectId || refreshing || loading}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw size={16} className={`mr-2 inline-block ${refreshing ? 'animate-spin' : ''}`} />
            刷新进度
          </button>
          <button onClick={() => setShowAdd(value => !value)} className="rounded-2xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-600">
            <Plus size={16} className="mr-2 inline-block" />
            新建里程碑
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-[30px] border border-white/[0.06] bg-[#0c1321] p-5"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="里程碑名称"
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-indigo-500/50 focus:outline-none"
              />
              <input
                type="date"
                value={dueDate}
                onChange={event => setDueDate(event.target.value)}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
              />
              <input
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder="里程碑说明"
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-indigo-500/50 focus:outline-none lg:col-span-2"
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button
                onClick={() => setNewType('progress')}
                className={`rounded-[24px] border p-4 text-left ${
                  newType === 'progress'
                    ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-400'
                }`}
              >
                <p className="text-sm font-semibold">进度型</p>
                <p className="mt-1 text-xs opacity-70">适合和一组任务绑定，进度会根据任务完成情况自动更新。</p>
              </button>
              <button
                onClick={() => setNewType('completion')}
                className={`rounded-[24px] border p-4 text-left ${
                  newType === 'completion'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-400'
                }`}
              >
                <p className="text-sm font-semibold">完成型</p>
                <p className="mt-1 text-xs opacity-70">适合关键节点或发布事件，手动确认完成即可。</p>
              </button>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
              <button onClick={handleAdd} className="rounded-xl bg-indigo-500 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-600">创建</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {milestoneSummaries.length === 0 ? (
        <div className="rounded-[30px] border border-dashed border-white/[0.08] py-20 text-center">
          <Target size={42} className="mx-auto mb-3 text-slate-700" />
          <p className="text-slate-400">还没有里程碑</p>
          <p className="mt-1 text-sm text-slate-600">可以为版本发布、关键交付或阶段验收建立明确节点。</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {milestoneSummaries.map(({ milestone, linkedTasks, doneTasks }) => {
            const completionMode = milestone.type === 'completion';
            return (
              <motion.div key={milestone.id} layout className="rounded-[32px] border border-white/[0.06] bg-[#0b1322] p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-2xl p-3 ${milestone.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-300'}`}>
                      {completionMode ? <CheckCircle2 size={20} /> : <Flag size={20} />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-white">{milestone.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{milestone.description || '暂无里程碑说明'}</p>
                    </div>
                  </div>
                  <button onClick={() => milestone.id && remove(milestone.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
                    <X size={14} />
                  </button>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-1 text-[10px] ${completionMode ? 'bg-purple-500/10 text-purple-300' : 'bg-cyan-500/10 text-cyan-300'}`}>
                    {completionMode ? '完成型' : '进度型'}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[10px] ${
                    milestone.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : milestone.status === 'active'
                        ? 'bg-sky-500/10 text-sky-300'
                        : 'bg-white/[0.04] text-slate-400'
                  }`}>
                    {MILESTONE_STATUS_LABELS[milestone.status]}
                  </span>
                  {milestone.dueDate && (
                    <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400">目标日期 {milestone.dueDate}</span>
                  )}
                </div>

                {completionMode ? (
                  <button
                    onClick={() =>
                      milestone.id &&
                      update(milestone.id, {
                        status: milestone.status === 'completed' ? 'upcoming' : 'completed',
                        progress: milestone.status === 'completed' ? 0 : 100,
                      })
                    }
                    className={`mb-5 rounded-2xl px-4 py-3 text-sm font-medium ${
                      milestone.status === 'completed'
                        ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        : 'border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-emerald-500/30 hover:text-emerald-300'
                    }`}
                  >
                    {milestone.status === 'completed' ? '已达成，点击重置' : '点击标记完成'}
                  </button>
                ) : (
                  <div className="mb-5">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>当前进度</span>
                      <span>{milestone.progress}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/[0.04]">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500" style={{ width: `${milestone.progress}%` }} />
                    </div>
                  </div>
                )}

                <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Link2 size={14} className="text-cyan-300" />
                      关联任务
                    </div>
                    <span className="text-xs text-slate-500">{doneTasks}/{linkedTasks.length} 已完成</span>
                  </div>

                  {linkedTasks.length === 0 ? (
                    <p className="text-sm text-slate-500">当前还没有任务关联到这个里程碑，可以去任务看板中直接拖拽关联。</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedTasks.map(task => (
                        <div key={task.id} className="flex items-center justify-between rounded-2xl bg-[#0a101a] px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate text-white">{task.title}</p>
                            <p className="mt-1 text-[11px] text-slate-500">{STATUS_LABELS[task.status]}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[10px] ${task.status === 'done' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/[0.04] text-slate-400'}`}>
                            {task.status === 'done' ? '完成' : '处理中'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
