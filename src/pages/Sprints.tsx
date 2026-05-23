import { memo, useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, Clock, Flame, Plus, Rocket, Target, Trash2, X, Zap } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useSprintStore } from '../stores/useSprintStore';
import { useTaskStore } from '../stores/useTaskStore';
import { SPRINT_STATUS_LABELS, STATUS_LABELS } from '../types';
import type { Sprint } from '../types';

const SPRINT_STATUS_COLORS: Record<Sprint['status'], string> = {
  planning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  active: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

const STATUS_DOT: Record<Sprint['status'], string> = {
  planning: 'bg-amber-400',
  active: 'bg-sky-400',
  completed: 'bg-emerald-400',
};

const SprintTaskItem = memo(function SprintTaskItem({ title, status }: { title: string; status: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300 truncate">
      <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${status === 'done' ? 'bg-emerald-400' : status === 'in_progress' ? 'bg-sky-400' : 'bg-slate-500'}`} />
      {title}
    </div>
  );
});

export default function Sprints() {
  const currentProjectId = useAppStore(s => s.currentProjectId);
  const { sprints, loading, load, add, update, remove } = useSprintStore();
  const { tasks, update: updateTask } = useTaskStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newStart, setNewStart] = useState(new Date().toISOString().split('T')[0]);
  const [newEnd, setNewEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const dragOverSprintIdRef = useRef<number | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const setDragOverSprintId = useCallback((id: number | null) => {
    dragOverSprintIdRef.current = id;
  }, []);

  useEffect(() => {
    if (currentProjectId) load(currentProjectId);
  }, [currentProjectId, load]);

  const sprintTasks = useMemo(() => {
    const result: Record<number, typeof tasks> = {};
    for (const s of sprints) {
      if (s.id) result[s.id] = tasks.filter(t => t.sprintId === s.id);
    }
    return result;
  }, [sprints, tasks]);

  const unassignedTasks = useMemo(() => tasks.filter(t => !t.sprintId), [tasks]);

  const activeSprints = useMemo(() => sprints.filter(s => s.status === 'active'), [sprints]);
  const planningSprints = useMemo(() => sprints.filter(s => s.status === 'planning'), [sprints]);
  const completedSprints = useMemo(() => sprints.filter(s => s.status === 'completed'), [sprints]);

  const totalSprintTasks = Object.values(sprintTasks).flat().length;
  const completedSprintTasks = Object.values(sprintTasks)
    .flat()
    .filter(t => t.status === 'done').length;
  const completionRate = totalSprintTasks > 0 ? Math.round((completedSprintTasks / totalSprintTasks) * 100) : 0;

  const handleDragStart = useCallback((event: ReactDragEvent<HTMLDivElement>, taskId: number) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(taskId));
    setDraggedTaskId(taskId);
  }, []);

  const handleSprintDrop = useCallback(async (event: ReactDragEvent<HTMLDivElement>, sprintId: number) => {
    event.preventDefault();
    const taskId = Number(event.dataTransfer.getData('text/plain'));
    setDragOverSprintId(null);
    setDraggedTaskId(null);
    if (!taskId) return;
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;
    if (task.sprintId === sprintId) return;
    await updateTask(taskId, { sprintId });
  }, [tasks, updateTask]);

  const handleUnassignedDrop = useCallback(async (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const taskId = Number(event.dataTransfer.getData('text/plain'));
    setDragOverSprintId(null);
    setDraggedTaskId(null);
    if (!taskId) return;
    await updateTask(taskId, { sprintId: null });
  }, [updateTask]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !currentProjectId || !newStart || !newEnd) return;
    await add({
      projectId: currentProjectId,
      name: newName.trim(),
      goal: newGoal.trim(),
      status: 'planning',
      startDate: newStart,
      endDate: newEnd,
    });
    setNewName('');
    setNewGoal('');
    setNewStart(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setNewEnd(d.toISOString().split('T')[0]);
    setShowCreate(false);
  }, [add, currentProjectId, newEnd, newGoal, newName, newStart]);

  const handleActivate = async (sprint: Sprint) => {
    if (!sprint.id) return;
    await update(sprint.id, { status: 'active' });
  };

  const handleComplete = async (sprint: Sprint) => {
    if (!sprint.id) return;
    await update(sprint.id, { status: 'completed' });
  };

  const handleDelete = async (sprint: Sprint) => {
    if (!sprint.id) return;
    const sprintTaskIds = (sprintTasks[sprint.id] || []).map(t => t.id!).filter(Boolean);
    for (const tid of sprintTaskIds) {
      await updateTask(tid, { sprintId: null });
    }
    await remove(sprint.id);
  };

  const getProgress = (sprintId: number) => {
    const sts = sprintTasks[sprintId] || [];
    if (sts.length === 0) return 0;
    return Math.round((sts.filter(t => t.status === 'done').length / sts.length) * 100);
  };

  const SprintCard = ({ sprint }: { sprint: Sprint }) => {
    const sid = sprint.id!;
    const sts = sprintTasks[sid] || [];
    const progress = getProgress(sid);
    const visibleTasks = sts.slice(0, 5);
    const hiddenCount = sts.length - 5;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        onDragOver={event => {
          event.preventDefault();
          setDragOverSprintId(sid);
        }}
        onDragLeave={() => setDragOverSprintId(null)}
        onDrop={event => handleSprintDrop(event, sid)}
        className="rounded-[28px] border border-white/[0.06] bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(10,16,27,0.94))] p-5 transition-all"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-bold text-white">{sprint.name}</h3>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${SPRINT_STATUS_COLORS[sprint.status]}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[sprint.status]}`} />
                {SPRINT_STATUS_LABELS[sprint.status]}
              </span>
            </div>
            {sprint.goal && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{sprint.goal}</p>}
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <Calendar size={13} className="shrink-0" />
          <span>{sprint.startDate}</span>
          <span className="text-slate-600">→</span>
          <span>{sprint.endDate}</span>
        </div>

        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              {sts.filter(t => t.status === 'done').length}/{sts.length} 任务完成
            </span>
            <span className="font-medium text-white">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                sprint.status === 'completed'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
            />
          </div>
        </div>

        {sts.length > 0 && (
          <div className="mb-4 space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-600">关联任务</p>
            {visibleTasks.map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={event => task.id && handleDragStart(event, task.id)}
                onDragEnd={() => {
                  setDraggedTaskId(null);
                  setDragOverSprintId(null);
                }}
                className={draggedTaskId === task.id ? 'cursor-grab opacity-50' : 'cursor-grab'}
              >
                <SprintTaskItem title={task.title} status={task.status} />
              </div>
            ))}
            {hiddenCount > 0 && (
              <p className="pl-6 text-[10px] text-slate-600">+{hiddenCount} 个更多任务</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {sprint.status === 'planning' && (
            <button
              onClick={() => handleActivate(sprint)}
              className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 transition"
            >
              <Rocket size={13} />
              启动冲刺
            </button>
          )}
          {sprint.status === 'active' && (
            <button
              onClick={() => handleComplete(sprint)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <Target size={13} />
              完成冲刺
            </button>
          )}
          <button
            onClick={() => handleDelete(sprint)}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] px-3 py-1.5 text-xs text-slate-400 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300 transition"
          >
            <Trash2 size={13} />
            删除
          </button>
        </div>
      </motion.div>
    );
  };

  if (loading && sprints.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-4 text-sm text-slate-400">
          加载冲刺数据...
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-[32px] border border-white/[0.06] bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(10,16,27,0.94))] p-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">⚡ 冲刺管理</h2>
          <p className="mt-1 text-sm text-slate-400">规划、执行并追踪开发冲刺，将任务拖入 Sprint 即可关联。</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <p className="text-[11px] text-slate-500">进行中冲刺</p>
            <p className="mt-1 text-2xl font-bold text-sky-300">{activeSprints.length}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <p className="text-[11px] text-slate-500">冲刺内任务</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">{totalSprintTasks}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <p className="text-[11px] text-slate-500">完成率</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{completionRate}%</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <span className="text-xs text-slate-500">共 {sprints.length} 个冲刺</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowCreate(value => !value)}
            className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05]"
          >
            {showCreate ? '收起表单' : '展开表单'}
          </button>
          <button
            onClick={() => (showCreate ? handleCreate() : setShowCreate(true))}
            className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-600"
          >
            <Plus size={16} />
            创建冲刺
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-[30px] border border-white/[0.06] bg-[#0a101b] p-5"
          >
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white">创建新冲刺</h3>
              <p className="mt-1 text-xs text-slate-500">设置冲刺名称、目标和时间范围。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">冲刺名称</label>
                <input
                  value={newName}
                  onChange={event => setNewName(event.target.value)}
                  placeholder="例如：Sprint 1 - 用户认证模块"
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
                  onKeyDown={event => event.key === 'Enter' && handleCreate()}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">冲刺目标</label>
                <input
                  value={newGoal}
                  onChange={event => setNewGoal(event.target.value)}
                  placeholder="本次冲刺要达成的目标"
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">开始日期</label>
                <input
                  type="date"
                  value={newStart}
                  onChange={event => {
                    setNewStart(event.target.value);
                    if (event.target.value) {
                      const d = new Date(event.target.value);
                      d.setDate(d.getDate() + 14);
                      setNewEnd(d.toISOString().split('T')[0]);
                    }
                  }}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">结束日期</label>
                <input
                  type="date"
                  value={newEnd}
                  onChange={event => setNewEnd(event.target.value)}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white">
                取消
              </button>
              <button onClick={handleCreate} className="rounded-xl bg-sky-500 px-6 py-2 text-sm font-medium text-white hover:bg-sky-600">
                创建冲刺
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {sprints.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-white/[0.06] bg-[#09111d] py-20">
          <Zap size={40} className="text-slate-600" />
          <p className="mt-4 text-sm text-slate-500">尚未创建任何冲刺</p>
          <p className="mt-1 text-xs text-slate-600">点击上方「创建冲刺」开始规划您的开发周期</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          {activeSprints.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-orange-400" />
                  <h3 className="text-base font-semibold text-white">进行中的冲刺</h3>
                </div>
                <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-500">{activeSprints.length}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence>
                  {activeSprints.map(sprint => (
                    <SprintCard key={sprint.id} sprint={sprint} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {planningSprints.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-amber-400" />
                  <h3 className="text-base font-semibold text-white">规划中的冲刺</h3>
                </div>
                <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-500">{planningSprints.length}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence>
                  {planningSprints.map(sprint => (
                    <SprintCard key={sprint.id} sprint={sprint} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {completedSprints.length > 0 && (
            <section>
              <button
                onClick={() => setShowCompleted(value => !value)}
                className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:bg-white/[0.04]"
              >
                <Target size={18} className="text-emerald-400" />
                <h3 className="flex-1 text-base font-semibold text-white">已完成的冲刺</h3>
                <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-500">{completedSprints.length}</span>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition ${showCompleted ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence>
                {showCompleted && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 pb-4">
                      {completedSprints.map(sprint => (
                        <SprintCard key={sprint.id} sprint={sprint} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}
        </div>
      )}

      {unassignedTasks.length > 0 && (
        <div
          onDragOver={event => {
            event.preventDefault();
            setDragOverSprintId(-1);
          }}
          onDragLeave={() => setDragOverSprintId(null)}
          onDrop={handleUnassignedDrop}
          className="rounded-[30px] border border-dashed border-white/[0.08] bg-[#09111d] p-5 transition-all hover:border-sky-400/20"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">未分配任务</span>
            <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-500">{unassignedTasks.length}</span>
          </div>
          {unassignedTasks.length === 0 ? (
            <p className="text-xs text-slate-600">所有任务都已分配到冲刺中。</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {unassignedTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={event => task.id && handleDragStart(event, task.id)}
                  onDragEnd={() => {
                    setDraggedTaskId(null);
                    setDragOverSprintId(null);
                  }}
                  className={`flex cursor-grab items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0e1524] px-3 py-2.5 text-xs transition hover:border-white/[0.12] ${
                    draggedTaskId === task.id ? 'scale-[0.98] opacity-50' : ''
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${
                    task.status === 'done' ? 'bg-emerald-400' :
                    task.status === 'in_progress' ? 'bg-sky-400' :
                    task.status === 'review' ? 'bg-amber-400' :
                    'bg-slate-500'
                  }`} />
                  <span className="truncate text-slate-300">{task.title}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-600">{STATUS_LABELS[task.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
