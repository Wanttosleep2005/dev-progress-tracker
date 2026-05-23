import { useCallback, useMemo, useState, type DragEvent as ReactDragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckSquare,
  Clock3,
  Columns3,
  GitBranch,
  Link as LinkIcon,
  List,
  Lock,
  Plus,
  RefreshCw,
  Search,
  SquarePen,
  Timer as TimerIcon,
  Trash2,
  X,
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useTaskStore } from '../stores/useTaskStore';
import { useCloudStore } from '../stores/useCloudStore';
import { PRIORITY_COLORS, PRIORITY_LABELS, RECURRENCE_LABELS, STATUS_LABELS, TASK_TEMPLATES } from '../types';
import type { RecurrenceRule, Task, TaskPriority, TaskStatus, ViewMode } from '../types';
import { getTaskActualMinutes } from '../lib/reporting';
import { startFocusTimer } from '../components/FocusTimer';
import SelectField from '../components/ui/SelectField';
import { formatDurationDeltaFromMinutes, formatDurationFromMinutes } from '../lib/duration';
import { getBlockingTasks, getDependentTasks, getTaskDependencyIds, isTaskBlocked, normalizeDependencyIds } from '../lib/taskDependencies';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

const columnStyles: Record<TaskStatus, string> = {
  todo: 'border-slate-500/15 bg-slate-500/[0.04]',
  in_progress: 'border-sky-500/15 bg-sky-500/[0.04]',
  review: 'border-amber-500/15 bg-amber-500/[0.04]',
  done: 'border-emerald-500/15 bg-emerald-500/[0.04]',
};

const priorityRank = { urgent: 4, high: 3, medium: 2, low: 1 };

export default function TaskBoard() {
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const { tasks, add, update, remove, moveStatus } = useTaskStore();
  const { milestones, refresh } = useMilestoneStore();
  const canEditProject = useCloudStore(state => state.canEdit(currentProjectId));

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [dragOverMilestone, setDragOverMilestone] = useState<number | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [dependencyQuery, setDependencyQuery] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newTags, setNewTags] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newMilestoneId, setNewMilestoneId] = useState<number | null>(null);
  const [newEstimatedMinutes, setNewEstimatedMinutes] = useState('45');
  const [newUrl, setNewUrl] = useState('');
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceRule>('none');

  const milestoneTaskCount = useMemo(() => {
    return milestones.reduce<Record<number, number>>((acc, milestone) => {
      acc[milestone.id!] = tasks.filter(task => task.milestoneId === milestone.id).length;
      return acc;
    }, {});
  }, [milestones, tasks]);

  const resetCreateForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewPriority('medium');
    setNewTags('');
    setNewDueDate('');
    setNewMilestoneId(null);
    setNewEstimatedMinutes('45');
    setNewUrl('');
    setNewRecurrence('none');
  };

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim() || !currentProjectId) return;
    await add({
      projectId: currentProjectId,
      title: newTitle.trim(),
      description: newDesc.trim(),
      status: 'todo',
      priority: newPriority,
      tags: newTags.split(',').map(tag => tag.trim()).filter(Boolean),
      dueDate: newDueDate || null,
      milestoneId: newMilestoneId,
      estimatedMinutes: newEstimatedMinutes ? parseInt(newEstimatedMinutes) || null : null,
      url: newUrl.trim(),
      recurrence: newRecurrence,
      source: 'board',
      remindAt: null,
      isTodayTask: false,
      publishedAt: null,
      dependencyIds: [],
      dependsOn: [],
    });
    resetCreateForm();
  }, [add, currentProjectId, newDesc, newDueDate, newEstimatedMinutes, newMilestoneId, newPriority, newTags, newTitle, newUrl]);

  const handleDragStart = (event: ReactDragEvent<HTMLDivElement>, taskId: number) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(taskId));
    setDraggedTaskId(taskId);
  };

  const handleColumnDrop = async (event: ReactDragEvent<HTMLDivElement>, status: TaskStatus) => {
    event.preventDefault();
    const taskId = Number(event.dataTransfer.getData('text/plain'));
    setDragOverColumn(null);
    if (!taskId) return;
    const task = tasks.find(item => item.id === taskId);
    if (!task || task.status === status) return;
    await moveStatus(taskId, status);
    setDraggedTaskId(null);
  };

  const handleMilestoneDrop = async (event: ReactDragEvent<HTMLDivElement>, milestoneId: number | null) => {
    event.preventDefault();
    const taskId = Number(event.dataTransfer.getData('text/plain'));
    setDragOverMilestone(null);
    if (!taskId) return;
    await update(taskId, { milestoneId });
    if (currentProjectId) {
      await refresh(currentProjectId);
    }
    setDraggedTaskId(null);
  };

  const batchSetStatus = async (status: TaskStatus) => {
    for (const id of selectedIds) {
      await update(id, { status });
    }
    setSelectedIds(new Set());
    setBatchMode(false);
  };

  const batchDelete = async () => {
    for (const id of selectedIds) {
      await remove(id);
    }
    setSelectedIds(new Set());
    setBatchMode(false);
  };

  const columns = useMemo(() => COLUMNS.map(status => ({ status, tasks: tasks.filter(task => task.status === status) })), [tasks]);
  const priorityOptions = (['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(priority => ({ value: priority, label: PRIORITY_LABELS[priority] }));
  const statusOptions = COLUMNS.map(status => ({ value: status, label: STATUS_LABELS[status] }));
  const milestoneOptions = milestones.map(milestone => ({ value: milestone.id!, label: milestone.title }));
  const dependencyOptions = useMemo(() => {
    if (!editingTask) return [];
    const keyword = dependencyQuery.trim().toLowerCase();
    return tasks.filter(task => {
      if (!task.id || task.id === editingTask.id) return false;
      if (!keyword) return true;
      return (
        task.title.toLowerCase().includes(keyword) ||
        task.description.toLowerCase().includes(keyword) ||
        task.tags.some(tag => tag.toLowerCase().includes(keyword))
      );
    });
  }, [dependencyQuery, editingTask, tasks]);

  const taskSummary = useMemo(() => {
    const done = tasks.filter(task => task.status === 'done').length;
    const inProgress = tasks.filter(task => task.status === 'in_progress').length;
    const withMilestone = tasks.filter(task => task.milestoneId).length;
    return { done, inProgress, withMilestone };
  }, [tasks]);

  const TaskCard = ({ task }: { task: Task }) => {
    const actualMinutes = getTaskActualMinutes(task.id, task.title, task.projectId);
    const milestone = milestones.find(item => item.id === task.milestoneId);
    const isSelected = selectedIds.has(task.id ?? -1);
    const blocked = isTaskBlocked(task, tasks);
    const dependentCount = getDependentTasks(task, tasks).length;

    return (
      <motion.div
        layout
        draggable={canEditProject}
        onDragStart={event => {
          if (!task.id || !canEditProject) return;
          handleDragStart(event as unknown as ReactDragEvent<HTMLDivElement>, task.id);
        }}
        onDragEnd={() => {
          setDraggedTaskId(null);
          setDragOverColumn(null);
          setDragOverMilestone(null);
        }}
        onClick={() =>
          batchMode && task.id
            ? setSelectedIds(prev => {
                const next = new Set(prev);
                if (next.has(task.id!)) next.delete(task.id!);
                else next.add(task.id!);
                return next;
              })
            : (setDependencyQuery(''), setEditingTask({ ...task, dependsOn: getTaskDependencyIds(task), dependencyIds: getTaskDependencyIds(task) }))
        }
        whileHover={batchMode ? undefined : { y: -2 }}
        className={`group relative rounded-[24px] border bg-[#0e1524] p-4 transition-all ${canEditProject ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
          draggedTaskId === task.id ? 'scale-[0.98] opacity-50' : ''
        } ${isSelected ? 'border-sky-500/40 ring-2 ring-sky-500/20' : 'border-white/[0.06] hover:border-white/[0.12]'}`}
        style={{ boxShadow: `inset 0 0 0 1px ${PRIORITY_COLORS[task.priority]}20` }}
      >
        {batchMode && (
          <div className={`absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded border ${isSelected ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-600'}`}>
            {isSelected && <CheckSquare size={12} />}
          </div>
        )}

        <div className={`mb-3 flex items-start justify-between gap-2 ${batchMode ? 'pl-7' : ''}`}>
          <div className="min-w-0">
            <h4 className="line-clamp-2 text-sm font-semibold text-white">{task.title}</h4>
            {task.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p>}
          </div>
          {!batchMode && (
            <button
              onClick={event => {
                event.stopPropagation();
                if (task.id) remove(task.id);
              }}
              className="rounded-lg p-1 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={{ color: PRIORITY_COLORS[task.priority], backgroundColor: `${PRIORITY_COLORS[task.priority]}18` }}>
            {PRIORITY_LABELS[task.priority]}
          </span>
          {milestone && (
            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-300">
              {milestone.title}
            </span>
          )}
          {task.tags.slice(0, 2).map(tag => (
            <span key={tag} className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-slate-500">
              {tag}
            </span>
          ))}
          {blocked && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-[10px] text-red-300">
              <Lock size={10} />
              依赖未完成
            </span>
          )}
          {dependentCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-1 text-[10px] text-violet-300">
              <GitBranch size={10} />
              被 {dependentCount} 项依赖
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
          <div className="rounded-xl bg-white/[0.03] px-3 py-2">
            <div className="mb-1 flex items-center gap-1 text-slate-400">
              <Clock3 size={12} />
              预估
            </div>
            <span className="font-medium text-white">{formatDurationFromMinutes(task.estimatedMinutes)}</span>
          </div>
          <div className="rounded-xl bg-white/[0.03] px-3 py-2">
            <div className="mb-1 flex items-center gap-1 text-slate-400">
              <TimerIcon size={12} />
              实际
            </div>
            <span className="font-medium text-white">{formatDurationFromMinutes(actualMinutes)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
          {task.dueDate && (
            <span className="flex items-center gap-1 rounded-full bg-white/[0.03] px-2 py-1">
              <Calendar size={10} />
              {task.dueDate}
            </span>
          )}
          {task.url && (
            <a href={task.url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="ml-auto flex items-center gap-1 text-sky-300 hover:text-sky-200">
              <LinkIcon size={10} />
              链接
            </a>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-[32px] border border-white/[0.06] bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(10,16,27,0.94))] p-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">任务看板</h2>
          <p className="mt-1 text-sm text-slate-400">强化拖拽体验、工时对比和里程碑联动，让推进状态一眼可见。</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <p className="text-[11px] text-slate-500">进行中</p>
            <p className="mt-1 text-2xl font-bold text-cyan-300">{taskSummary.inProgress}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <p className="text-[11px] text-slate-500">已完成</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{taskSummary.done}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <p className="text-[11px] text-slate-500">已关联里程碑</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">{taskSummary.withMilestone}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setBatchMode(value => !value);
              setSelectedIds(new Set());
            }}
            className={`rounded-xl px-3 py-2 text-xs font-medium ${batchMode ? 'border border-sky-500/20 bg-sky-500/10 text-sky-300' : 'border border-white/[0.06] text-slate-400 hover:text-white'}`}
          >
            批量操作
          </button>
          <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
            <button onClick={() => setViewMode('kanban')} className={`rounded-lg p-2 ${viewMode === 'kanban' ? 'bg-sky-500/15 text-sky-300' : 'text-slate-500'}`}><Columns3 size={16} /></button>
            <button onClick={() => setViewMode('list')} className={`rounded-lg p-2 ${viewMode === 'list' ? 'bg-sky-500/15 text-sky-300' : 'text-slate-500'}`}><List size={16} /></button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setShowAdd(value => !value)} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05]">
            {showAdd ? '收起创建区' : '展开创建区'}
          </button>
          {currentProjectId && (
            <button onClick={() => refresh(currentProjectId)} className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm text-cyan-200 hover:bg-cyan-500/20">
              <RefreshCw size={14} className="mr-2 inline-block" />
              刷新里程碑进度
            </button>
          )}
          <button onClick={() => (showAdd ? handleAdd() : setShowAdd(true))} className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-600">
            <Plus size={16} className="mr-2 inline-block" />
            {showAdd ? '创建任务' : '新建任务'}
          </button>
        </div>
      </div>

      {batchMode && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-500/15 bg-sky-500/[0.05] p-3">
          <span className="text-xs text-sky-300">已选 {selectedIds.size} 项</span>
          {COLUMNS.map(status => (
            <button key={status} onClick={() => batchSetStatus(status)} className="rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.08]">
              {STATUS_LABELS[status]}
            </button>
          ))}
          <button onClick={batchDelete} className="ml-auto flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/20">
            <Trash2 size={12} />
            删除
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-[30px] border border-white/[0.06] bg-[#0a101b] p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {TASK_TEMPLATES.map((template, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setNewTitle(template.title);
                    setNewPriority(template.priority);
                    setNewTags(template.tags.join(', '));
                  }}
                  className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.06]"
                >
                  {template.title}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <input value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="任务标题" className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none xl:col-span-2" />
              <input value={newDesc} onChange={event => setNewDesc(event.target.value)} placeholder="任务说明" className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none xl:col-span-2" />
              <input value={newTags} onChange={event => setNewTags(event.target.value)} placeholder="标签，逗号分隔" className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none" />
              <input value={newUrl} onChange={event => setNewUrl(event.target.value)} placeholder="外部链接" className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none" />
              <input type="date" value={newDueDate} onChange={event => setNewDueDate(event.target.value)} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none" />
              <input type="number" min="0" step="5" value={newEstimatedMinutes} onChange={event => setNewEstimatedMinutes(event.target.value)} placeholder="预估工时（分钟）" className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none" />
              <select value={newRecurrence} onChange={event => setNewRecurrence(event.target.value as RecurrenceRule)} className="custom-select rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none">
                {Object.entries(RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <SelectField value={newPriority} onChange={event => setNewPriority(event.target.value as TaskPriority)} options={priorityOptions} />
              <SelectField value={newMilestoneId ?? ''} onChange={event => setNewMilestoneId(event.target.value ? parseInt(event.target.value) : null)} placeholder="暂不关联里程碑" options={milestoneOptions} />
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button onClick={resetCreateForm} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white">清空</button>
              <button onClick={handleAdd} className="rounded-xl bg-sky-500 px-6 py-2 text-sm font-medium text-white hover:bg-sky-600">创建任务</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-[30px] border border-white/[0.06] bg-[#09111d] p-4">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">里程碑联动区</h3>
            <p className="mt-1 text-xs text-slate-500">把任务直接拖到下方卡片即可关联里程碑，也可以拖到“未关联”里移除归属。</p>
          </div>
          <span className="rounded-full border border-white/[0.06] px-2 py-1 text-[10px] text-slate-500">{milestones.length} 个里程碑</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {milestones.map(milestone => (
            <div
              key={milestone.id}
              onDragOver={event => {
                event.preventDefault();
                setDragOverMilestone(milestone.id ?? null);
              }}
              onDragLeave={() => setDragOverMilestone(null)}
                    onDrop={event => canEditProject && handleMilestoneDrop(event, milestone.id ?? null)}
              className={`rounded-2xl border p-4 transition-all ${dragOverMilestone === milestone.id ? 'scale-[1.01] border-cyan-400/30 bg-cyan-500/10' : 'border-white/[0.06] bg-white/[0.02]'}`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-white">{milestone.title}</h4>
                  <p className="mt-1 text-[11px] text-slate-500">{milestone.description || '暂无描述'}</p>
                </div>
                <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400">{milestoneTaskCount[milestone.id!] ?? 0} 任务</span>
              </div>
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/[0.04]">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${milestone.progress}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{milestone.status}</span>
                <span>{milestone.progress}%</span>
              </div>
            </div>
          ))}

          <div
            onDragOver={event => {
              event.preventDefault();
              setDragOverMilestone(-1);
            }}
            onDragLeave={() => setDragOverMilestone(null)}
            onDrop={event => canEditProject && handleMilestoneDrop(event, null)}
            className={`rounded-2xl border border-dashed p-4 transition-all ${dragOverMilestone === -1 ? 'border-slate-300/40 bg-white/[0.05]' : 'border-white/[0.08] bg-transparent'}`}
          >
            <h4 className="text-sm font-semibold text-white">未关联</h4>
            <p className="mt-1 text-[11px] text-slate-500">把任务拖到这里即可移除里程碑归属。</p>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid min-[1100px]:min-w-[1100px] gap-4 xl:grid-cols-4">
            {columns.map(column => (
              <div
                key={column.status}
                onDragOver={event => {
                  event.preventDefault();
                  setDragOverColumn(column.status);
                }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={event => canEditProject && handleColumnDrop(event, column.status)}
                className={`flex min-h-[420px] flex-col rounded-[28px] border p-3 transition-all ${columnStyles[column.status]} ${dragOverColumn === column.status ? 'scale-[1.01] ring-2 ring-sky-500/20' : ''}`}
              >
                <div className="mb-3 flex items-center justify-between px-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{STATUS_LABELS[column.status]}</h3>
                    <p className="text-[11px] text-slate-500">{column.tasks.length} 个任务</p>
                  </div>
                  <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400">{column.tasks.filter(task => task.priority === 'urgent').length} 紧急</span>
                </div>
                <div className="space-y-3 overflow-y-auto pr-1">
                  {column.tasks.map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto">
          {tasks.slice().sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]).map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {editingTask && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-8" onClick={() => setEditingTask(null)}>
            <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 16 }} onClick={event => event.stopPropagation()} className="glass glow max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">编辑任务</h3>
                  <p className="mt-1 text-xs text-slate-500">更新任务信息，并直接查看预估工时和实际投入的偏差。</p>
                </div>
                <button onClick={() => setEditingTask(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05]">
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <label className="mb-1.5 block text-xs text-slate-400">标题</label>
                  <input value={editingTask.title} onChange={event => setEditingTask({ ...editingTask, title: event.target.value })} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none" />
                </div>
                <div className="lg:col-span-2">
                  <label className="mb-1.5 block text-xs text-slate-400">描述</label>
                  <textarea value={editingTask.description} onChange={event => setEditingTask({ ...editingTask, description: event.target.value })} rows={3} className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">状态</label>
                  <SelectField value={editingTask.status} onChange={event => setEditingTask({ ...editingTask, status: event.target.value as TaskStatus })} options={statusOptions} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">优先级</label>
                  <SelectField value={editingTask.priority} onChange={event => setEditingTask({ ...editingTask, priority: event.target.value as TaskPriority })} options={priorityOptions} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">截止日期</label>
                  <input type="date" value={editingTask.dueDate || ''} onChange={event => setEditingTask({ ...editingTask, dueDate: event.target.value || null })} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">预估工时（分钟）</label>
                  <input type="number" min="0" step="5" value={editingTask.estimatedMinutes ?? ''} onChange={event => setEditingTask({ ...editingTask, estimatedMinutes: event.target.value ? parseInt(event.target.value) : null })} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none" />
                </div>
                <div className="lg:col-span-2">
                  <label className="mb-1.5 block text-xs text-slate-400">里程碑</label>
                  <SelectField value={editingTask.milestoneId ?? ''} onChange={event => setEditingTask({ ...editingTask, milestoneId: event.target.value ? parseInt(event.target.value) : null })} placeholder="暂不关联里程碑" options={milestoneOptions} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">循环</label>
                  <select value={editingTask.recurrence ?? 'none'} onChange={event => setEditingTask({ ...editingTask, recurrence: event.target.value as RecurrenceRule })} className="custom-select w-full rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none">
                    {Object.entries(RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-300">依赖任务</label>
                      <p className="mt-1 text-[11px] text-slate-500">被选中的任务完成后，当前任务才能进入进行中。</p>
                    </div>
                    <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400">
                      {getTaskDependencyIds(editingTask).length} 项
                    </span>
                  </div>
                  <div className="relative mb-3">
                    <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={dependencyQuery}
                      onChange={event => setDependencyQuery(event.target.value)}
                      placeholder="搜索任务名称、说明或标签"
                      className="w-full rounded-xl border border-white/[0.06] bg-[#0a101a] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 outline-none focus:border-sky-500/40"
                    />
                  </div>
                  <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                    {dependencyOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">暂无可选择的其他任务。</p>
                    ) : (
                      dependencyOptions.map(task => {
                        const ids = getTaskDependencyIds(editingTask);
                        const checked = task.id ? ids.includes(task.id) : false;
                        return (
                          <label key={task.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-[#0a101a] px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.04]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={event => {
                                const nextIds = event.target.checked
                                  ? normalizeDependencyIds([...ids, task.id!], editingTask.id)
                                  : ids.filter(id => id !== task.id);
                                setEditingTask({ ...editingTask, dependsOn: nextIds, dependencyIds: nextIds });
                              }}
                              className="h-4 w-4 rounded border-white/[0.12] bg-white/[0.04]"
                            />
                            <span className="min-w-0 flex-1 truncate">{task.title}</span>
                            <span className={`rounded-full px-2 py-1 text-[10px] ${task.status === 'done' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/[0.04] text-slate-400'}`}>
                              {STATUS_LABELS[task.status]}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {getBlockingTasks(editingTask, tasks).length > 0 && (
                    <p className="mt-3 rounded-xl border border-red-500/15 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                      依赖未完成：{getBlockingTasks(editingTask, tasks).map(task => task.title).join('、')}
                    </p>
                  )}
                </div>
                <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">工时对比</span>
                    <span className="text-xs text-slate-400">实际 {formatDurationFromMinutes(getTaskActualMinutes(editingTask.id, editingTask.title, editingTask.projectId))}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-xs text-slate-500">预估</p>
                      <p className="mt-1 font-semibold text-white">{formatDurationFromMinutes(editingTask.estimatedMinutes)}</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-xs text-slate-500">偏差</p>
                      <p className="mt-1 font-semibold text-white">{formatDurationDeltaFromMinutes(getTaskActualMinutes(editingTask.id, editingTask.title, editingTask.projectId) - (editingTask.estimatedMinutes ?? 0))}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <button onClick={() => startFocusTimer(editingTask.title, editingTask.id ?? null)} className="flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 hover:bg-sky-500/20">
                    <TimerIcon size={14} />
                    开始专注
                  </button>
                  <button disabled={!canEditProject} onClick={() => { if (editingTask.id) remove(editingTask.id); setEditingTask(null); }} className="rounded-xl px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40">
                    删除任务
                  </button>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditingTask(null)} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
                  <button
                    disabled={!canEditProject}
                    onClick={async () => {
                      if (editingTask.id) {
                        await update(editingTask.id, {
                          title: editingTask.title,
                          description: editingTask.description,
                          status: editingTask.status,
                          priority: editingTask.priority,
                          dueDate: editingTask.dueDate,
                          milestoneId: editingTask.milestoneId,
                          estimatedMinutes: editingTask.estimatedMinutes,
                          url: editingTask.url,
                          recurrence: editingTask.recurrence ?? 'none',
                          dependsOn: getTaskDependencyIds(editingTask),
                          dependencyIds: getTaskDependencyIds(editingTask),
                        });
                        if (currentProjectId) {
                          await refresh(currentProjectId);
                        }
                      }
                      setEditingTask(null);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <SquarePen size={14} />
                    保存
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
