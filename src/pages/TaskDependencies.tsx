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
import { ArrowDownToLine, RefreshCw, Search, Wand2, Workflow } from 'lucide-react';
import { useTaskStore } from '../stores/useTaskStore';
import { STATUS_LABELS, type Task, type TaskStatus } from '../types';
import { getBlockingTasks, getDependentTasks, getTaskDependencyIds, isTaskBlocked, normalizeDependencyIds } from '../lib/taskDependencies';

type NodeState = TaskStatus | 'blocked';

interface DependencyNodeData extends Record<string, unknown> {
  task: Task;
  tasks: Task[];
}

type DependencyNode = Node<DependencyNodeData, 'dependencyTask'>;
type DependencyEdge = Edge<{ dependency: true }>;

const NODE_WIDTH = 260;
const NODE_HEIGHT = 136;
const COLUMN_GAP = 360;
const ROW_GAP = 178;
const SIDE_SOURCE_HANDLE_CLASS = '!h-24 !w-8 !rounded-full !border-2 !border-cyan-100/70 !bg-cyan-400/55 !shadow-[0_0_18px_rgba(34,211,238,0.42)] !transition hover:!bg-cyan-300/80';
const SIDE_TARGET_HANDLE_CLASS = '!h-24 !w-8 !rounded-full !border-2 !border-cyan-100/70 !bg-[#08111f]/80 !shadow-[0_0_18px_rgba(34,211,238,0.28)] !transition hover:!bg-cyan-950';
const EDGE_SOURCE_HANDLE_CLASS = '!h-8 !w-24 !rounded-full !border-2 !border-cyan-100/70 !bg-cyan-400/50 !shadow-[0_0_18px_rgba(34,211,238,0.36)] !transition hover:!bg-cyan-300/75';
const EDGE_TARGET_HANDLE_CLASS = '!h-8 !w-24 !rounded-full !border-2 !border-cyan-100/70 !bg-[#08111f]/80 !shadow-[0_0_18px_rgba(34,211,238,0.24)] !transition hover:!bg-cyan-950';

const nodeStyles: Record<NodeState, string> = {
  done: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20',
  in_progress: 'border-sky-500/35 bg-sky-500/10 text-sky-100 shadow-sky-950/20',
  review: 'border-amber-500/35 bg-amber-500/10 text-amber-100 shadow-amber-950/20',
  todo: 'border-slate-500/25 bg-slate-500/10 text-slate-100 shadow-slate-950/20',
  blocked: 'border-red-500/40 bg-red-500/10 text-red-100 shadow-red-950/30',
};

const minimapColors: Record<NodeState, string> = {
  done: '#10b981',
  in_progress: '#0ea5e9',
  review: '#f59e0b',
  todo: '#64748b',
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
  return (
    <div className={`relative h-[136px] w-[260px] rounded-2xl border p-4 shadow-2xl backdrop-blur ${nodeStyles[state]} ${selected ? 'ring-2 ring-cyan-300/50' : ''}`}>
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className={SIDE_TARGET_HANDLE_CLASS}
        style={{ left: -14 }}
        isConnectable
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className={SIDE_SOURCE_HANDLE_CLASS}
        style={{ right: -14 }}
        isConnectable
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className={EDGE_TARGET_HANDLE_CLASS}
        style={{ left: '32%', top: -14 }}
        isConnectable
      />
      <Handle
        type="source"
        position={Position.Top}
        id="source-top"
        className={EDGE_SOURCE_HANDLE_CLASS}
        style={{ left: '68%', top: -14 }}
        isConnectable
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        className={EDGE_TARGET_HANDLE_CLASS}
        style={{ left: '32%', bottom: -14 }}
        isConnectable
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className={EDGE_SOURCE_HANDLE_CLASS}
        style={{ left: '68%', bottom: -14 }}
        isConnectable
      />
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold text-white">{task.title}</p>
          <p className="mt-1 text-[11px] text-slate-400">{STATUS_LABELS[task.status]}</p>
        </div>
        <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] text-slate-300">{state === 'blocked' ? '被阻塞' : STATUS_LABELS[task.status]}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] text-slate-300">依赖 {getTaskDependencyIds(task).length}</span>
        <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] text-slate-300">被依赖 {dependents.length}</span>
        {task.dueDate && <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] text-slate-300">{task.dueDate}</span>}
      </div>
      {blockers.length > 0 && (
        <p className="mt-3 line-clamp-2 text-[11px] text-red-100">依赖未完成：{blockers.map(item => item.title).join('、')}</p>
      )}
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
          markerEnd: { type: MarkerType.ArrowClosed, color: '#67e8f9', width: 18, height: 18 },
          style: { stroke: '#67e8f9', strokeWidth: 2 },
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
      markerEnd: { type: MarkerType.ArrowClosed, color: '#67e8f9', width: 18, height: 18 },
      style: { stroke: '#67e8f9', strokeWidth: 2 },
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
            connectionRadius={180}
            connectionLineType={ConnectionLineType.Bezier}
            isValidConnection={isValidConnection}
            defaultEdgeOptions={{
              type: 'bezier',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#67e8f9', width: 18, height: 18 },
              style: { stroke: '#67e8f9', strokeWidth: 2 },
            }}
            className="dependency-flow"
          >
            <Background color="rgba(148,163,184,0.18)" gap={22} size={1} />
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
