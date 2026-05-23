import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Background,
  ConnectionMode,
  ConnectionLineType,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnConnect,
  type OnEdgesDelete,
  type OnNodeDrag,
  type IsValidConnection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowDownToLine, ArrowUp, Calendar, Clock, GitBranch, RefreshCw, Search, Wand2, Workflow } from 'lucide-react';
import { useTaskStore } from '../stores/useTaskStore';
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS, type Task, type TaskStatus } from '../types';
import { getBlockingTasks, getDependentTasks, getTaskDependencyIds, isTaskBlocked, normalizeDependencyIds } from '../lib/taskDependencies';

type NodeState = TaskStatus | 'blocked';

interface DependencyNodeData extends Record<string, unknown> {
  task: Task;
  tasks: Task[];
}

type DependencyNode = Node<DependencyNodeData, 'dependencyTask'>;
type DependencyEdge = Edge<{ dependency: true }>;

const NODE_WIDTH = 280;
const NODE_HEIGHT = 160;
const COLUMN_GAP = 400;
const ROW_GAP = 200;
const SIDE_SOURCE_HANDLE_CLASS = '!h-12 !w-4 !rounded-full !border-2 !border-cyan-400/60 !bg-cyan-400/40 !shadow-[0_0_12px_rgba(34,211,238,0.35)] !transition hover:!bg-cyan-300/70';
const SIDE_TARGET_HANDLE_CLASS = '!h-12 !w-4 !rounded-full !border-2 !border-cyan-400/40 !bg-[#08111f]/80 !shadow-[0_0_12px_rgba(34,211,238,0.2)] !transition hover:!bg-cyan-950';
const EDGE_SOURCE_HANDLE_CLASS = '!h-4 !w-12 !rounded-full !border-2 !border-cyan-400/60 !bg-cyan-400/40 !shadow-[0_0_12px_rgba(34,211,238,0.3)] !transition hover:!bg-cyan-300/65';
const EDGE_TARGET_HANDLE_CLASS = '!h-4 !w-12 !rounded-full !border-2 !border-cyan-400/40 !bg-[#08111f]/80 !shadow-[0_0_12px_rgba(34,211,238,0.18)] !transition hover:!bg-cyan-950';

const minimapColors: Record<NodeState, string> = {
  done: STATUS_COLORS.done,
  in_progress: STATUS_COLORS.in_progress,
  review: STATUS_COLORS.review,
  todo: STATUS_COLORS.todo,
  blocked: '#ef4444',
};

function getNodeState(task: Task, tasks: Task[]): NodeState {
  return isTaskBlocked(task, tasks) ? 'blocked' : task.status;
}

function wouldCreateCycle(tasks: Task[], dependencyId: number, targetId: number) {
  const byId = new Map(tasks.filter(task => task.id).map(task => [task.id!, task]));
  const visit = (id: number, seen = new Set<number>()): boolean => {
    if (id === targetId) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    const task = byId.get(id);
    if (!task) return false;
    return getTaskDependencyIds(task).some(nextId => visit(nextId, seen));
  };
  return visit(dependencyId);
}

function layoutTasks(tasks: Task[]) {
  const byId = new Map(tasks.filter(task => task.id).map(task => [task.id!, task]));
  const depthCache = new Map<number, number>();
  const getDepth = (task: Task, stack = new Set<number>()): number => {
    if (!task.id) return 0;
    if (depthCache.has(task.id)) return depthCache.get(task.id)!;
    if (stack.has(task.id)) return 0;
    stack.add(task.id);
    const dependencies = getTaskDependencyIds(task)
      .map(id => byId.get(id))
      .filter(Boolean) as Task[];
    const depth = dependencies.length === 0 ? 0 : Math.max(...dependencies.map(dependency => getDepth(dependency, stack) + 1));
    depthCache.set(task.id, depth);
    stack.delete(task.id);
    return depth;
  };

  const groups = new Map<number, Task[]>();
  tasks.forEach(task => {
    const depth = getDepth(task);
    groups.set(depth, [...(groups.get(depth) ?? []), task]);
  });

  const positions = new Map<number, { x: number; y: number }>();
  [...groups.entries()].forEach(([depth, group]) => {
    group
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
      .forEach((task, index) => {
        if (!task.id) return;
        positions.set(task.id, { x: depth * COLUMN_GAP, y: index * ROW_GAP });
      });
  });
  return positions;
}

function DependencyTaskNode({ data, selected }: NodeProps<DependencyNode>) {
  const { task, tasks } = data;
  const state = getNodeState(task, tasks);
  const blockers = getBlockingTasks(task, tasks);
  const dependents = getDependentTasks(task, tasks);
  const depCount = getTaskDependencyIds(task).length;
  const subtaskTotal = task.subtasks?.length || 0;
  const subtaskDone = task.subtasks?.filter(s => s.done).length || 0;
  const subtaskProgress = subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0;

  return (
    <div
      className={`relative w-[280px] rounded-2xl border transition-all duration-200 ${
        selected ? 'ring-2 ring-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.15)]' : 'shadow-lg'
      }`}
    >
      {/* Handles - outside card to avoid overflow clipping */}
      <Handle type="target" position={Position.Left} id="target-left" className={`${SIDE_TARGET_HANDLE_CLASS} z-10`} style={{ left: -14 }} isConnectable />
      <Handle type="source" position={Position.Right} id="source-right" className={`${SIDE_SOURCE_HANDLE_CLASS} z-10`} style={{ right: -14 }} isConnectable />
      <Handle type="target" position={Position.Top} id="target-top" className={`${EDGE_TARGET_HANDLE_CLASS} z-10`} style={{ left: '32%', top: -14 }} isConnectable />
      <Handle type="source" position={Position.Top} id="source-top" className={`${EDGE_SOURCE_HANDLE_CLASS} z-10`} style={{ left: '68%', top: -14 }} isConnectable />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className={`${EDGE_TARGET_HANDLE_CLASS} z-10`} style={{ left: '32%', bottom: -14 }} isConnectable />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className={`${EDGE_SOURCE_HANDLE_CLASS} z-10`} style={{ left: '68%', bottom: -14 }} isConnectable />

      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl overflow-hidden" style={{ backgroundColor: STATUS_COLORS[task.status] }} />

      {/* Main card body */}
      <div className="bg-[#0b1424]/95 backdrop-blur p-4 pl-5 rounded-2xl overflow-hidden">

        {/* Header row: status dot + priority */}
        <div className="mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[task.status] }} />
          <span className="text-[10px] font-medium" style={{ color: STATUS_COLORS[task.status] }}>{STATUS_LABELS[task.status]}</span>
          {state === 'blocked' && (
            <span className="ml-auto rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-300 font-medium">被阻塞</span>
          )}
          <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ color: PRIORITY_COLORS[task.priority], backgroundColor: `${PRIORITY_COLORS[task.priority]}12` }}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>

        {/* Title */}
        <p className="mb-1.5 line-clamp-2 text-sm font-bold text-white leading-tight">{task.title}</p>
        {task.description && (
          <p className="mb-2 line-clamp-1 text-[11px] text-slate-500/80">{task.description}</p>
        )}

        {/* Meta chips */}
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {depCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-cyan-500/8 px-1.5 py-0.5 text-[9px] text-cyan-300/80">
              <GitBranch size={9} /> {depCount}
            </span>
          )}
          {dependents.length > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-500/8 px-1.5 py-0.5 text-[9px] text-violet-300/80">
              <ArrowUp size={9} /> {dependents.length}
            </span>
          )}
          {task.dueDate && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-400">
              <Calendar size={9} /> {task.dueDate}
            </span>
          )}
          {(task.trackedMinutes ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/8 px-1.5 py-0.5 text-[9px] text-emerald-300/80">
              <Clock size={9} /> {Math.floor((task.trackedMinutes ?? 0) / 60)}h
            </span>
          )}
        </div>

        {/* Subtask progress bar */}
        {subtaskTotal > 0 && (
          <div className="mt-2">
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500/70 to-blue-500/70" style={{ width: `${subtaskProgress}%` }} />
            </div>
            <p className="mt-0.5 text-[9px] text-slate-600">{subtaskDone}/{subtaskTotal} 子任务</p>
          </div>
        )}

        {/* Blocked warning */}
        {blockers.length > 0 && (
          <div className="mt-2 rounded-md bg-red-500/5 border border-red-500/10 px-2 py-1">
            <p className="text-[9px] text-red-300/70 leading-tight">等待: {blockers.map(b => b.title).join(', ')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = {
  dependencyTask: DependencyTaskNode,
};

export default function TaskDependencies() {
  const { tasks, update, load } = useTaskStore();
  const [query, setQuery] = useState('');
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [nodes, setNodes, onNodesChange] = useNodesState<DependencyNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DependencyEdge>([]);

  const visibleTasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return keyword
      ? tasks.filter(task => task.title.toLowerCase().includes(keyword) || task.tags.some(tag => tag.toLowerCase().includes(keyword)))
      : tasks;
  }, [query, tasks]);

  const autoPositions = useMemo(() => layoutTasks(visibleTasks), [visibleTasks]);

  useEffect(() => {
    const nextNodes: DependencyNode[] = visibleTasks
      .filter(task => task.id)
      .map(task => {
        const id = String(task.id);
        const position = manualPositions[id] ?? autoPositions.get(task.id!) ?? { x: 0, y: 0 };
        const state = getNodeState(task, visibleTasks);
        return {
          id,
          type: 'dependencyTask',
          position,
          data: { task, tasks: visibleTasks },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          style: { width: NODE_WIDTH, height: NODE_HEIGHT },
          draggable: true,
          selectable: true,
          deletable: false,
          ariaLabel: `任务 ${task.title}`,
          className: state === 'blocked' ? 'dependency-node-blocked' : undefined,
        };
      });

    const visibleIds = new Set(nextNodes.map(node => Number(node.id)));
    const nextEdges: DependencyEdge[] = visibleTasks.flatMap(task => {
      if (!task.id) return [];
      return getTaskDependencyIds(task)
        .filter(dependencyId => visibleIds.has(dependencyId))
        .map(dependencyId => ({
          id: `${dependencyId}->${task.id}`,
          source: String(dependencyId),
          target: String(task.id),
          sourceHandle: null,
          targetHandle: null,
          type: 'bezier',
          data: { dependency: true },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#67e8f9', width: 14, height: 14 },
          style: { stroke: '#67e8f9', strokeWidth: 2, opacity: 0.7 },
        }));
    });

    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [autoPositions, manualPositions, setEdges, setNodes, visibleTasks]);

  const persistDependency = useCallback(async (targetId: number, nextDependencyIds: number[]) => {
    const target = tasks.find(task => task.id === targetId);
    if (!target?.id) return;
    const normalized = normalizeDependencyIds(nextDependencyIds, target.id);
    await update(target.id, { dependsOn: normalized, dependencyIds: normalized });
  }, [tasks, update]);

  const onConnect = useCallback<OnConnect>(async (connection: Connection) => {
    const sourceId = Number(connection.source);
    const targetId = Number(connection.target);
    if (!sourceId || !targetId || sourceId === targetId) return;
    if (wouldCreateCycle(tasks, sourceId, targetId)) return;

    const target = tasks.find(task => task.id === targetId);
    if (!target) return;
    if (getTaskDependencyIds(target).includes(sourceId)) return;
    const nextDependencyIds = normalizeDependencyIds([...getTaskDependencyIds(target), sourceId], targetId);
    setEdges(current => addEdge({
      ...connection,
      id: `${sourceId}->${targetId}`,
      type: 'bezier',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#67e8f9', width: 14, height: 14 },
      style: { stroke: '#67e8f9', strokeWidth: 2, opacity: 0.7 },
      data: { dependency: true },
    }, current));
    await persistDependency(targetId, nextDependencyIds);
  }, [persistDependency, setEdges, tasks]);

  const onEdgesDelete = useCallback<OnEdgesDelete<DependencyEdge>>(async (deletedEdges) => {
    for (const edge of deletedEdges) {
      const targetId = Number(edge.target);
      const sourceId = Number(edge.source);
      const target = tasks.find(task => task.id === targetId);
      if (!target) continue;
      await persistDependency(targetId, getTaskDependencyIds(target).filter(id => id !== sourceId));
    }
  }, [persistDependency, tasks]);

  const onNodeDragStop = useCallback<OnNodeDrag<DependencyNode>>((_, node) => {
    setManualPositions(current => ({ ...current, [node.id]: node.position }));
  }, []);

  const isValidConnection = useCallback<IsValidConnection<DependencyEdge>>((connection) => {
    const sourceId = Number(connection.source);
    const targetId = Number(connection.target);
    if (!sourceId || !targetId || sourceId === targetId) return false;
    if (wouldCreateCycle(tasks, sourceId, targetId)) return false;
    const target = tasks.find(task => task.id === targetId);
    return Boolean(target && !getTaskDependencyIds(target).includes(sourceId));
  }, [tasks]);

  const resetLayout = () => {
    setManualPositions({});
  };

  const hasTasks = visibleTasks.length > 0;
  const blockedCount = visibleTasks.filter(task => isTaskBlocked(task, visibleTasks)).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[calc(100vh-150px)] flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-[30px] border border-white/[0.06] bg-[#0b1322] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            <Workflow className="text-cyan-300" size={26} />
            任务依赖
          </h2>
          <p className="mt-1 text-sm text-slate-400">从节点右侧拖出连线到另一个节点即可添加依赖，选中连线后按 Delete 删除。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索任务或标签" className="w-56 rounded-xl border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/40" />
          </div>
          <button onClick={resetLayout} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05]">
            <Wand2 size={14} />
            自动布局
          </button>
          <button onClick={() => tasks[0]?.projectId && load(tasks[0].projectId)} className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20">
            <RefreshCw size={14} />
            刷新
          </button>
        </div>
      </div>

      <div className="relative h-[calc(100vh-260px)] min-h-[620px] overflow-hidden rounded-[30px] border border-white/[0.06] bg-[linear-gradient(180deg,#08111f,#060b13)]">
        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span className="rounded-full bg-white/[0.05] px-2 py-1">节点 {visibleTasks.length}</span>
          <span className="rounded-full bg-white/[0.05] px-2 py-1">依赖线 {edges.length}</span>
          <span className="rounded-full bg-white/[0.05] px-2 py-1">阻塞 {blockedCount}</span>
        </div>

        {!hasTasks ? (
          <div className="flex h-full min-h-[560px] items-center justify-center text-center">
            <div>
              <ArrowDownToLine size={38} className="mx-auto mb-3 text-slate-700" />
              <p className="text-sm text-slate-400">暂无任务依赖数据</p>
              <p className="mt-1 text-xs text-slate-600">创建任务后，这里会用 React Flow 生成可交互关系图。</p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.35}
            maxZoom={1.6}
            connectOnClick
            connectionMode={ConnectionMode.Loose}
            connectionRadius={200}
            connectionLineType={ConnectionLineType.Bezier}
            isValidConnection={isValidConnection}
            defaultEdgeOptions={{
              type: 'bezier',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#67e8f9', width: 14, height: 14 },
              style: { stroke: '#67e8f9', strokeWidth: 2, opacity: 0.7, filter: 'drop-shadow(0 0 4px rgba(103,232,249,0.3))' },
            }}
            className="dependency-flow"
          >
            <Background color="rgba(148,163,184,0.12)" gap={24} size={1.5} />
            <Controls showInteractive={false} position="bottom-right" />
            <MiniMap
              pannable
              zoomable
              position="bottom-left"
              nodeColor={node => minimapColors[getNodeState((node.data as DependencyNodeData).task, (node.data as DependencyNodeData).tasks)]}
              maskColor="rgba(2,6,23,0.72)"
              className="!bg-[#0b1322] !border !border-white/[0.08]"
            />
          </ReactFlow>
        )}
      </div>
    </motion.div>
  );
}
