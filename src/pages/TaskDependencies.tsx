import { useMemo, useState, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownToLine, GitBranch, Minus, Plus, RefreshCw, Search, ZoomIn } from 'lucide-react';
import { useTaskStore } from '../stores/useTaskStore';
import { STATUS_LABELS, type Task } from '../types';
import { getBlockingTasks, getDependentTasks, getTaskDependencyIds, isTaskBlocked } from '../lib/taskDependencies';

const nodeStyles = {
  done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  in_progress: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  todo: 'border-slate-500/25 bg-slate-500/10 text-slate-100',
  blocked: 'border-red-500/35 bg-red-500/10 text-red-100',
  review: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
};

const dotStyles = {
  done: 'bg-emerald-400',
  in_progress: 'bg-sky-400',
  todo: 'bg-slate-400',
  blocked: 'bg-red-400',
  review: 'bg-amber-400',
};

function getNodeState(task: Task, tasks: Task[]) {
  if (isTaskBlocked(task, tasks)) return 'blocked';
  return task.status;
}

function TaskNode({ task, tasks, x, y }: { task: Task; tasks: Task[]; x: number; y: number }) {
  const state = getNodeState(task, tasks);
  const blockers = getBlockingTasks(task, tasks);
  const dependents = getDependentTasks(task, tasks);
  return (
    <div
      className={`absolute w-64 rounded-2xl border p-4 shadow-2xl backdrop-blur ${nodeStyles[state]}`}
      style={{ left: x, top: y }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold text-white">{task.title}</p>
          <p className="mt-1 text-[11px] text-slate-400">{STATUS_LABELS[task.status]}</p>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotStyles[state]}`} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] text-slate-300">依赖 {getTaskDependencyIds(task).length}</span>
        <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] text-slate-300">被依赖 {dependents.length}</span>
        {blockers.length > 0 && <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] text-red-200">阻塞中</span>}
      </div>
      {blockers.length > 0 && (
        <p className="mt-3 line-clamp-2 text-[11px] text-red-100">未完成依赖：{blockers.map(item => item.title).join('、')}</p>
      )}
    </div>
  );
}

export default function TaskDependencies() {
  const { tasks, load } = useTaskStore();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [query, setQuery] = useState('');

  const visibleTasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return keyword ? tasks.filter(task => task.title.toLowerCase().includes(keyword)) : tasks;
  }, [query, tasks]);

  const positions = useMemo(() => {
    const byId = new Map<number, Task>();
    visibleTasks.forEach(task => task.id && byId.set(task.id, task));
    const depthCache = new Map<number, number>();
    const getDepth = (task: Task, stack = new Set<number>()): number => {
      if (!task.id) return 0;
      if (depthCache.has(task.id)) return depthCache.get(task.id)!;
      if (stack.has(task.id)) return 0;
      stack.add(task.id);
      const deps = getTaskDependencyIds(task).map(id => byId.get(id)).filter(Boolean) as Task[];
      const depth = deps.length === 0 ? 0 : Math.max(...deps.map(dep => getDepth(dep, stack) + 1));
      depthCache.set(task.id, depth);
      stack.delete(task.id);
      return depth;
    };

    const groups = new Map<number, Task[]>();
    visibleTasks.forEach(task => {
      const depth = getDepth(task);
      groups.set(depth, [...(groups.get(depth) ?? []), task]);
    });

    const map = new Map<number, { x: number; y: number }>();
    [...groups.entries()].forEach(([depth, group]) => {
      group.forEach((task, index) => {
        if (!task.id) return;
        map.set(task.id, { x: depth * 340, y: index * 170 });
      });
    });
    return map;
  }, [visibleTasks]);

  const edges = useMemo(() => {
    const ids = new Set(visibleTasks.map(task => task.id).filter(Boolean));
    return visibleTasks.flatMap(task => {
      if (!task.id) return [];
      return getTaskDependencyIds(task)
        .filter(depId => ids.has(depId))
        .map(depId => ({ from: depId, to: task.id! }));
    });
  }, [visibleTasks]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    setOffset({
      x: dragStart.ox + event.clientX - dragStart.x,
      y: dragStart.oy + event.clientY - dragStart.y,
    });
  };

  const resetView = () => {
    setScale(1);
    setOffset({ x: 40, y: 40 });
  };

  const canvasWidth = Math.max(900, Math.max(0, ...Array.from(positions.values()).map(pos => pos.x)) + 360);
  const canvasHeight = Math.max(560, Math.max(0, ...Array.from(positions.values()).map(pos => pos.y)) + 220);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[calc(100vh-150px)] flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-[30px] border border-white/[0.06] bg-[#0b1322] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            <GitBranch className="text-cyan-300" size={26} />
            任务依赖
          </h2>
          <p className="mt-1 text-sm text-slate-400">用节点和箭头查看任务阻塞关系，红色节点表示依赖尚未完成。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="筛选任务" className="w-56 rounded-xl border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/40" />
          </div>
          <button onClick={() => setScale(value => Math.max(0.55, Number((value - 0.1).toFixed(2))))} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2 text-slate-300 hover:bg-white/[0.05]"><Minus size={16} /></button>
          <button onClick={() => setScale(value => Math.min(1.8, Number((value + 0.1).toFixed(2))))} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2 text-slate-300 hover:bg-white/[0.05]"><Plus size={16} /></button>
          <button onClick={resetView} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05]">
            <ZoomIn size={14} />
            重置视图
          </button>
          <button onClick={() => tasks[0]?.projectId && load(tasks[0].projectId)} className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20">
            <RefreshCw size={14} />
            刷新
          </button>
        </div>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-[30px] border border-white/[0.06] bg-[linear-gradient(180deg,#08111f,#060b13)]"
        onPointerDown={event => setDragStart({ x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y })}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDragStart(null)}
        onPointerLeave={() => setDragStart(null)}
      >
        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span className="rounded-full bg-white/[0.04] px-2 py-1">缩放 {Math.round(scale * 100)}%</span>
          <span className="rounded-full bg-white/[0.04] px-2 py-1">节点 {visibleTasks.length}</span>
          <span className="rounded-full bg-white/[0.04] px-2 py-1">依赖线 {edges.length}</span>
        </div>

        {visibleTasks.length === 0 ? (
          <div className="flex h-full min-h-[520px] items-center justify-center text-center">
            <div>
              <ArrowDownToLine size={38} className="mx-auto mb-3 text-slate-700" />
              <p className="text-sm text-slate-400">暂无任务依赖数据</p>
              <p className="mt-1 text-xs text-slate-600">在任务编辑弹窗里选择依赖任务后，这里会自动生成关系图。</p>
            </div>
          </div>
        ) : (
          <div
            className="absolute origin-top-left"
            style={{ width: canvasWidth, height: canvasHeight, transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          >
            <svg className="absolute inset-0 overflow-visible" width={canvasWidth} height={canvasHeight}>
              <defs>
                <marker id="dependency-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,6 L9,3 z" fill="#67e8f9" />
                </marker>
              </defs>
              {edges.map(edge => {
                const from = positions.get(edge.from);
                const to = positions.get(edge.to);
                if (!from || !to) return null;
                const x1 = from.x + 256;
                const y1 = from.y + 72;
                const x2 = to.x;
                const y2 = to.y + 72;
                const mid = x1 + Math.max(40, (x2 - x1) / 2);
                return (
                  <path
                    key={`${edge.from}-${edge.to}`}
                    d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="#67e8f9"
                    strokeWidth="2"
                    strokeOpacity="0.7"
                    markerEnd="url(#dependency-arrow)"
                  />
                );
              })}
            </svg>
            {visibleTasks.map(task => {
              if (!task.id) return null;
              const pos = positions.get(task.id);
              if (!pos) return null;
              return <TaskNode key={task.id} task={task} tasks={visibleTasks} x={pos.x} y={pos.y} />;
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
