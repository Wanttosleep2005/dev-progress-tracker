import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import type { Edge, Node, NodeMouseHandler, NodeProps, OnNodeDrag } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ChevronRight,
  FilePlus2,
  FolderPlus,
  FolderTree,
  Link2,
  RefreshCw,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useArchStore } from '../stores/useArchStore';
import { useCloudStore } from '../stores/useCloudStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useTaskStore } from '../stores/useTaskStore';
import { useToast } from '../stores/useToast';
import { MILESTONE_STATUS_LABELS, STATUS_COLORS, STATUS_LABELS, type ArchNode } from '../types';

interface ArchNodeData extends Record<string, unknown> {
  node: ArchNode;
  childCount: number;
  childFileCount: number;
  childFolderCount: number;
  relatedTaskCount: number;
  relatedTaskDone: number;
  relatedMilestoneCount: number;
  relatedMilestoneDone: number;
  collapsed: boolean;
  editable: boolean;
  lockedRoot: boolean;
  dropTarget: boolean;
  onAdd: (parentId: string, type: ArchNode['type']) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

type FlowArchNode = Node<ArchNodeData, 'archNode'>;
type FlowArchEdge = Edge<{ parent: true }>;

const NODE_WIDTH = 248;
const NODE_HEIGHT = 132;
const SUBTREE_GAP = 56;
const LEVEL_GAP = 164;
const MAX_RENDERED_ARCH_NODES = 350;

const FILE_EXTENSIONS = ['py', 'js', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'yml', 'sql', 'dockerfile', 'other'] as const;

const EXTENSION_STYLE: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  py: { icon: 'PY', color: '#22d3ee', bg: 'bg-cyan-500/5', label: 'Python' },
  js: { icon: 'JS', color: '#facc15', bg: 'bg-yellow-500/5', label: 'JavaScript' },
  ts: { icon: 'TS', color: '#38bdf8', bg: 'bg-sky-500/5', label: 'TypeScript' },
  tsx: { icon: 'TSX', color: '#60a5fa', bg: 'bg-blue-500/5', label: 'React TSX' },
  html: { icon: 'HTML', color: '#fb923c', bg: 'bg-orange-500/5', label: 'HTML' },
  css: { icon: 'CSS', color: '#3b82f6', bg: 'bg-blue-500/5', label: 'CSS' },
  json: { icon: '{}', color: '#94a3b8', bg: 'bg-slate-500/5', label: 'JSON' },
  md: { icon: 'MD', color: '#e2e8f0', bg: 'bg-white/[0.03]', label: 'Markdown' },
  yml: { icon: 'YML', color: '#a78bfa', bg: 'bg-violet-500/5', label: 'YAML' },
  sql: { icon: 'SQL', color: '#34d399', bg: 'bg-emerald-500/5', label: 'SQL' },
  dockerfile: { icon: 'DOC', color: '#38bdf8', bg: 'bg-sky-500/5', label: 'Dockerfile' },
  other: { icon: 'FILE', color: '#cbd5e1', bg: 'bg-white/[0.02]', label: '文件' },
};

function getSafeParentId(node: ArchNode, nodesById: Map<string, ArchNode>) {
  const parentId = typeof node.parentId === 'string' ? node.parentId : null;
  if (!parentId || parentId === node.id) return null;
  const parent = nodesById.get(parentId);
  if (!parent || parent.type !== 'folder') return null;

  const seen = new Set<string>([node.id]);
  let cursor: ArchNode | undefined = parent;
  while (cursor) {
    if (seen.has(cursor.id)) return null;
    seen.add(cursor.id);
    cursor = cursor.parentId ? nodesById.get(cursor.parentId) : undefined;
  }
  return parentId;
}

function sanitizeArchNodesForRender(nodes: ArchNode[]) {
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  return nodes.map(node => {
    const safeParentId = getSafeParentId(node, nodesById);
    const safeType = node.type === 'folder' || node.type === 'file' ? node.type : 'file';
    if ((node.parentId ?? null) === safeParentId && node.type === safeType) return node;
    // Remote sync may briefly produce invalid parent graphs; render from a safe copy instead of crashing layout.
    return { ...node, type: safeType, parentId: safeParentId };
  });
}

function buildChildrenMap(nodes: ArchNode[]) {
  const map = new Map<string | null, ArchNode[]>();
  for (const node of nodes) {
    const siblings = map.get(node.parentId) ?? [];
    siblings.push(node);
    map.set(node.parentId, siblings);
  }
  for (const siblings of map.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'));
  }
  return map;
}

function getHiddenIds(nodes: ArchNode[], collapsedIds: Set<string>) {
  const childrenMap = buildChildrenMap(nodes);
  const hidden = new Set<string>();
  const hideChildren = (parentId: string) => {
    for (const child of childrenMap.get(parentId) ?? []) {
      if (hidden.has(child.id)) continue;
      hidden.add(child.id);
      hideChildren(child.id);
    }
  };
  collapsedIds.forEach(hideChildren);
  return hidden;
}

function isDescendantNode(nodes: ArchNode[], ancestorId: string, targetId: string) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  let cursor = byId.get(targetId);
  const seen = new Set<string>();
  while (cursor?.parentId) {
    if (seen.has(cursor.id)) return false;
    seen.add(cursor.id);
    if (cursor.parentId === ancestorId) return true;
    cursor = byId.get(cursor.parentId);
  }
  return false;
}

function layoutTree(nodes: ArchNode[]) {
  const childrenMap = buildChildrenMap(nodes);
  const positions = new Map<string, { x: number; y: number }>();
  const subtreeWidth = new Map<string, number>();

  const measure = (node: ArchNode, active = new Set<string>()): number => {
    if (subtreeWidth.has(node.id)) return subtreeWidth.get(node.id) ?? NODE_WIDTH;
    if (active.has(node.id)) return NODE_WIDTH;
    active.add(node.id);
    const children = childrenMap.get(node.id) ?? [];
    if (children.length === 0) {
      subtreeWidth.set(node.id, NODE_WIDTH);
      active.delete(node.id);
      return NODE_WIDTH;
    }
    const childrenWidth = children.reduce((sum, child) => sum + measure(child, active), 0) + SUBTREE_GAP * (children.length - 1);
    const width = Math.max(NODE_WIDTH, childrenWidth);
    subtreeWidth.set(node.id, width);
    active.delete(node.id);
    return width;
  };

  const place = (node: ArchNode, left: number, depth: number, active = new Set<string>()) => {
    if (active.has(node.id)) return;
    active.add(node.id);
    const width = subtreeWidth.get(node.id) ?? NODE_WIDTH;
    positions.set(node.id, { x: left + width / 2 - NODE_WIDTH / 2, y: depth * LEVEL_GAP });
    const children = childrenMap.get(node.id) ?? [];
    const childrenWidth = children.reduce((sum, child) => sum + (subtreeWidth.get(child.id) ?? NODE_WIDTH), 0)
      + SUBTREE_GAP * Math.max(0, children.length - 1);
    let cursor = left + Math.max(0, (width - childrenWidth) / 2);
    children.forEach(child => {
      const childWidth = subtreeWidth.get(child.id) ?? NODE_WIDTH;
      place(child, cursor + 20, depth + 1, active);
      cursor += childWidth + SUBTREE_GAP;
    });
    active.delete(node.id);
  };

  const roots = childrenMap.get(null) ?? [];
  roots.forEach(root => measure(root));
  const totalWidth = roots.reduce((sum, root) => sum + (subtreeWidth.get(root.id) ?? NODE_WIDTH), 0)
    + SUBTREE_GAP * Math.max(0, roots.length - 1);
  let cursor = -totalWidth / 2;
  roots.forEach(root => {
    const width = subtreeWidth.get(root.id) ?? NODE_WIDTH;
    place(root, cursor, 0);
    cursor += width + SUBTREE_GAP;
  });
  return positions;
}

function getFileExtension(node: ArchNode) {
  if (node.extension && EXTENSION_STYLE[node.extension]) return node.extension;
  const ext = node.name.includes('.') ? node.name.split('.').pop()?.toLowerCase() : '';
  return ext && EXTENSION_STYLE[ext] ? ext : 'other';
}

function getExtensionStyle(node: ArchNode) {
  return EXTENSION_STYLE[getFileExtension(node)] ?? EXTENSION_STYLE.other;
}

function withExtension(name: string, extension: string) {
  const trimmed = name.trim();
  if (!trimmed) return extension === 'dockerfile' ? 'Dockerfile' : `new-file.${extension === 'other' ? 'txt' : extension}`;
  if (extension === 'other') return trimmed;
  if (extension === 'dockerfile') return trimmed.toLowerCase() === 'dockerfile' ? 'Dockerfile' : trimmed;
  return trimmed.endsWith(`.${extension}`) ? trimmed : `${trimmed.replace(/\.[^.]+$/, '')}.${extension}`;
}

function normalizeIdList(value: unknown) {
  // Older payloads may contain string ids or malformed values; normalize before joining local records.
  return Array.isArray(value)
    ? value.map(id => Number(id)).filter(id => Number.isFinite(id))
    : [];
}

function getNodeDescription(node: ArchNode) {
  return typeof node.description === 'string' ? node.description : '';
}

function truncateDescription(value: string) {
  const compact = value.replace(/[#>*_`~\-[\]()]/g, '').replace(/\s+/g, ' ').trim();
  return compact.length > 60 ? `${compact.slice(0, 60)}...` : compact;
}

function ArchFlowNode({ data, selected }: NodeProps<FlowArchNode>) {
  const {
    node,
    childCount,
    childFileCount,
    childFolderCount,
    relatedTaskCount,
    relatedTaskDone,
    relatedMilestoneCount,
    relatedMilestoneDone,
    collapsed,
    editable,
    lockedRoot,
    dropTarget,
    onAdd,
    onToggle,
    onDelete,
  } = data;
  const isFolder = node.type === 'folder';
  const fileStyle = getExtensionStyle(node);
  const milestonesCompleted = relatedMilestoneCount > 0 && relatedMilestoneDone === relatedMilestoneCount;
  const accentColor = milestonesCompleted ? '#22c55e' : isFolder ? '#22d3ee' : fileStyle.color;
  const taskProgress = relatedTaskCount > 0 ? Math.round((relatedTaskDone / relatedTaskCount) * 100) : 0;
  const folderSummary = childCount === 0 ? '空文件夹' : `${childFileCount} 文件 / ${childFolderCount} 文件夹`;
  const subtitle = relatedTaskCount > 0
    ? `关联 ${relatedTaskCount} 个任务 · ${relatedTaskDone}/${relatedTaskCount} 已完成`
    : lockedRoot ? '项目根目录' : isFolder ? folderSummary : fileStyle.label;
  const description = getNodeDescription(node);

  return (
    <div
      className={`relative w-[248px] rounded-2xl border p-3 shadow-lg backdrop-blur transition hover:bg-white/[0.04] ${
        isFolder ? 'bg-cyan-500/5' : fileStyle.bg
      } ${dropTarget ? 'border-cyan-300/70 ring-2 ring-cyan-400/70 shadow-[0_0_28px_rgba(34,211,238,0.22)]' : selected ? 'border-sky-400/60 ring-2 ring-sky-500/40 shadow-[0_0_24px_rgba(14,165,233,0.18)]' : 'border-white/[0.08]'}`}
    >
      <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl" style={{ backgroundColor: accentColor }} />
      <Handle type="target" position={Position.Top} className="!h-3 !w-10 !rounded-full !border-slate-500/50 !bg-[#08111f]" />
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-10 !rounded-full !border-slate-500/50 !bg-slate-500/40" />

      <div className="flex items-center gap-2 pl-1">
        <button
          disabled={!isFolder || childCount === 0}
          onClick={event => {
            event.stopPropagation();
            if (isFolder && childCount > 0) onToggle(node.id);
          }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition ${
            isFolder && childCount > 0 ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]' : 'text-slate-700'
          }`}
          title={collapsed ? '展开' : '折叠'}
        >
          <ChevronRight size={14} className={`transition ${!collapsed && childCount > 0 ? 'rotate-90' : ''}`} />
        </button>
        {isFolder ? (
          <span className="flex h-7 min-w-10 items-center justify-center rounded-lg bg-cyan-500/10 px-1.5 text-[10px] font-bold text-cyan-200">
            DIR
          </span>
        ) : (
          <span className="flex h-7 min-w-10 items-center justify-center rounded-lg px-1.5 text-[10px] font-bold" style={{ color: fileStyle.color, backgroundColor: `${fileStyle.color}14` }}>
            {fileStyle.icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{node.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">{subtitle}</p>
          {description && (
            <p className="mt-1 truncate text-[10px] leading-tight text-slate-500">
              {truncateDescription(description)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-white/[0.05] pl-1 pt-2">
        {isFolder && (
          <>
            <button disabled={!editable} onClick={event => { event.stopPropagation(); onAdd(node.id, 'folder'); }} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.05] hover:text-sky-300 disabled:opacity-40" title="添加文件夹">
              <FolderPlus size={14} />
            </button>
            <button disabled={!editable} onClick={event => { event.stopPropagation(); onAdd(node.id, 'file'); }} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.05] hover:text-emerald-300 disabled:opacity-40" title="添加文件">
              <FilePlus2 size={14} />
            </button>
          </>
        )}
        {!lockedRoot && (
          <button disabled={!editable} onClick={event => { event.stopPropagation(); onDelete(node.id); }} className="ml-auto rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40" title="删除节点">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {relatedMilestoneCount > 0 && (
        <div className="mt-2 rounded-md bg-emerald-500/5 px-2 py-1 text-[9px] text-emerald-200">
          里程碑 {relatedMilestoneDone}/{relatedMilestoneCount} 已完成
        </div>
      )}
      {relatedTaskCount > 0 && (
        <div className="absolute bottom-0 left-3 right-3 h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-sky-500" style={{ width: `${taskProgress}%` }} />
        </div>
      )}
    </div>
  );
}

const nodeTypes = { archNode: ArchFlowNode };

interface CreateDialogState {
  parentId: string | null;
  type: ArchNode['type'];
  name: string;
  extension: string;
}

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

interface RelationDialogState {
  nodeId: string;
  mode: 'tasks' | 'milestones';
}

interface DescriptionDialogState {
  nodeId: string;
  value: string;
}

export default function Architecture() {
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const currentProject = useAppStore(state => state.projects.find(project => project.id === currentProjectId));
  const canEdit = useCloudStore(state => state.canEdit);
  const addToast = useToast(state => state.add);
  const { nodes: archNodes, loading: archLoading, load, add, update, remove, ensureRoot } = useArchStore();
  const tasks = useTaskStore(state => state.tasks);
  const loadTasks = useTaskStore(state => state.load);
  const milestones = useMilestoneStore(state => state.milestones);
  const loadMilestones = useMilestoneStore(state => state.load);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [createDialog, setCreateDialog] = useState<CreateDialogState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [relationDialog, setRelationDialog] = useState<RelationDialogState | null>(null);
  const [descriptionDialog, setDescriptionDialog] = useState<DescriptionDialogState | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [promptedRootSync, setPromptedRootSync] = useState<Set<string>>(() => new Set());
  const [loadedProjectId, setLoadedProjectId] = useState<number | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowArchNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowArchEdge>([]);

  const editable = Boolean(currentProjectId && canEdit(currentProjectId));
  const projectTasks = useMemo(() => tasks.filter(task => task.projectId === currentProjectId), [currentProjectId, tasks]);
  const projectMilestones = useMemo(() => milestones.filter(milestone => milestone.projectId === currentProjectId), [currentProjectId, milestones]);
  const taskById = useMemo(() => new Map(projectTasks.filter(task => task.id).map(task => [task.id!, task])), [projectTasks]);
  const milestoneById = useMemo(() => new Map(projectMilestones.filter(milestone => milestone.id).map(milestone => [milestone.id!, milestone])), [projectMilestones]);
  const renderArchNodes = useMemo(() => sanitizeArchNodesForRender(archNodes), [archNodes]);
  const childrenMap = useMemo(() => buildChildrenMap(renderArchNodes), [renderArchNodes]);
  const rootNode = useMemo(() => renderArchNodes.find(node => node.parentId === null && node.type === 'folder') ?? null, [renderArchNodes]);
  const tooManyNodes = archNodes.length > MAX_RENDERED_ARCH_NODES;
  const visibleArchNodes = useMemo(() => {
    if (tooManyNodes) return [];
    const hiddenIds = getHiddenIds(renderArchNodes, collapsedIds);
    return renderArchNodes.filter(node => !hiddenIds.has(node.id));
  }, [collapsedIds, renderArchNodes, tooManyNodes]);
  const autoPositions = useMemo(() => layoutTree(visibleArchNodes), [visibleArchNodes]);

  const openCreateDialog = useCallback((parentId: string | null, type: ArchNode['type']) => {
    setCreateDialog({
      parentId,
      type,
      name: type === 'folder' ? '新文件夹' : 'index',
      extension: 'ts',
    });
  }, []);

  const submitCreateDialog = useCallback(async () => {
    if (!currentProjectId || !createDialog) return;
    const finalName = createDialog.type === 'file'
      ? withExtension(createDialog.name, createDialog.extension)
      : createDialog.name.trim() || '新文件夹';
    await add({
      projectId: currentProjectId,
      parentId: createDialog.parentId,
      type: createDialog.type,
      name: finalName,
      extension: createDialog.type === 'file' ? createDialog.extension : null,
    });
    setCreateDialog(null);
  }, [add, createDialog, currentProjectId]);

  const renameNode = useCallback(async (node: ArchNode) => {
    if (!editable) return;
    const nextName = window.prompt('重命名节点', node.name);
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed) {
      addToast('节点名称不能为空。', 'warning');
      return;
    }
    await update(node.id, { name: node.type === 'file' ? withExtension(trimmed, getFileExtension(node)) : trimmed });
  }, [addToast, editable, update]);

  const openDescriptionDialog = useCallback((node: ArchNode) => {
    setContextMenu(null);
    setDescriptionDialog({ nodeId: node.id, value: getNodeDescription(node) });
  }, []);

  const handleNodeDoubleClick = useCallback<NodeMouseHandler<FlowArchNode>>((_, node) => {
    // Double click now edits markdown description; rename stays in the right-click menu.
    if (!editable) return;
    openDescriptionDialog(node.data.node);
  }, [editable, openDescriptionDialog]);

  const handleDelete = useCallback(async (id: string) => {
    if (!editable) return;
    const target = archNodes.find(node => node.id === id);
    if (!target) return;
    if (target.id === rootNode?.id) {
      addToast('项目根目录不可删除。', 'warning');
      return;
    }
    const childCount = childrenMap.get(id)?.length ?? 0;
    const message = childCount > 0
      ? `删除文件夹「${target.name}」会同时删除所有子节点，确定继续吗？`
      : `确定删除「${target.name}」吗？`;
    if (!window.confirm(message)) return;
    await remove(id);
  }, [addToast, archNodes, childrenMap, editable, remove, rootNode?.id]);

  useEffect(() => {
    if (!currentProjectId) {
      setLoadedProjectId(null);
      return;
    }
    let cancelled = false;
    setLoadedProjectId(null);
    Promise.all([
      load(currentProjectId),
      loadTasks(currentProjectId),
      loadMilestones(currentProjectId),
    ]).then(() => {
      if (!cancelled) setLoadedProjectId(currentProjectId);
    }).catch(() => {
      if (!cancelled) setLoadedProjectId(currentProjectId);
    });
    return () => {
      cancelled = true;
    };
  }, [currentProjectId, load, loadMilestones, loadTasks]);

  useEffect(() => {
    if (!currentProjectId || !currentProject || !editable) return;
    if (archLoading || loadedProjectId !== currentProjectId) return;
    if (archNodes.length === 0) {
      ensureRoot(currentProjectId, currentProject.name).catch(() => undefined);
      return;
    }
    const root = renderArchNodes.find(node => node.parentId === null && node.type === 'folder');
    if (root && root.name !== currentProject.name && root.name === 'project') {
      update(root.id, { name: currentProject.name }).catch(() => undefined);
      return;
    }
    if (root && root.name !== currentProject.name && !promptedRootSync.has(root.id)) {
      setPromptedRootSync(current => new Set(current).add(root.id));
      if (window.confirm(`项目名已变更为「${currentProject.name}」，是否同步更新架构图根目录名？`)) {
        update(root.id, { name: currentProject.name }).catch(() => undefined);
      }
    }
  }, [archLoading, archNodes.length, currentProject, currentProjectId, editable, ensureRoot, loadedProjectId, promptedRootSync, renderArchNodes, update]);

  useEffect(() => {
    const nextNodes: FlowArchNode[] = visibleArchNodes.map(node => {
      const position = manualPositions[node.id] ?? autoPositions.get(node.id) ?? { x: 0, y: 0 };
      const lockedRoot = node.id === rootNode?.id;
      const children = childrenMap.get(node.id) ?? [];
      // Counts and relation summaries are derived UI data only; they are not written back to IndexedDB.
      const relatedTasks = normalizeIdList(node.relatedTaskIds).map(id => taskById.get(id)).filter(Boolean);
      const relatedMilestones = normalizeIdList(node.relatedMilestoneIds).map(id => milestoneById.get(id)).filter(Boolean);
      return {
        id: node.id,
        type: 'archNode',
        position,
        data: {
          node,
          childCount: children.length,
          childFileCount: children.filter(child => child.type === 'file').length,
          childFolderCount: children.filter(child => child.type === 'folder').length,
          relatedTaskCount: relatedTasks.length,
          relatedTaskDone: relatedTasks.filter(task => task?.status === 'done').length,
          relatedMilestoneCount: relatedMilestones.length,
          relatedMilestoneDone: relatedMilestones.filter(milestone => milestone?.status === 'completed').length,
          collapsed: collapsedIds.has(node.id),
          editable,
          lockedRoot,
          dropTarget: dropTargetId === node.id,
          onAdd: openCreateDialog,
          onToggle: id => setCollapsedIds(current => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          }),
          onDelete: handleDelete,
        },
        draggable: editable && !lockedRoot,
      };
    });
    const visibleIds = new Set(nextNodes.map(node => node.id));
    const nextEdges: FlowArchEdge[] = visibleArchNodes
      .filter(node => node.parentId && visibleIds.has(node.parentId))
      .map(node => ({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId!,
        target: node.id,
        type: 'bezier',
        data: { parent: true },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 12, height: 12 },
        style: { stroke: '#64748b', strokeWidth: 1.5, opacity: 0.72 },
      }));
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [
    autoPositions,
    childrenMap,
    collapsedIds,
    dropTargetId,
    editable,
    handleDelete,
    manualPositions,
    milestoneById,
    openCreateDialog,
    rootNode?.id,
    setEdges,
    setNodes,
    taskById,
    visibleArchNodes,
  ]);

  const findDropParent = useCallback((dragged: FlowArchNode) => {
    const center = {
      x: dragged.position.x + NODE_WIDTH / 2,
      y: dragged.position.y + NODE_HEIGHT / 2,
    };
    return nodes.find(node => {
      if (node.id === dragged.id) return false;
      if (node.data.node.type !== 'folder') return false;
      if (isDescendantNode(renderArchNodes, dragged.id, node.id)) return false;
      const withinX = center.x >= node.position.x - 40 && center.x <= node.position.x + NODE_WIDTH + 40;
      const withinY = center.y >= node.position.y - 40 && center.y <= node.position.y + NODE_HEIGHT + 40;
      return withinX && withinY;
    }) ?? null;
  }, [nodes, renderArchNodes]);

  const onNodeDrag = useCallback<OnNodeDrag<FlowArchNode>>((_, node) => {
    if (!editable || node.id === rootNode?.id) return;
    const target = findDropParent(node);
    setDropTargetId(current => current === (target?.id ?? null) ? current : target?.id ?? null);
  }, [editable, findDropParent, rootNode?.id]);

  const onNodeDragStop = useCallback<OnNodeDrag<FlowArchNode>>(async (_, node) => {
    setDropTargetId(null);
    if (!editable || node.id === rootNode?.id) return;
    setManualPositions(current => ({ ...current, [node.id]: node.position }));
    const dropParent = findDropParent(node);
    const currentNode = archNodes.find(item => item.id === node.id);
    if (!currentNode || !dropParent || currentNode.parentId === dropParent.id) return;
    await update(node.id, {
      parentId: dropParent.id,
      sortOrder: (childrenMap.get(dropParent.id)?.length ?? 0) + 1,
    });
    setManualPositions(current => {
      const next = { ...current };
      delete next[node.id];
      return next;
    });
    addToast(`已移动到「${dropParent.data.node.name}」下`, 'success');
  }, [addToast, archNodes, childrenMap, editable, findDropParent, rootNode?.id, update]);

  const contextNode = useMemo(
    () => contextMenu ? archNodes.find(node => node.id === contextMenu.nodeId) ?? null : null,
    [archNodes, contextMenu]
  );
  const relationNode = useMemo(
    () => relationDialog ? archNodes.find(node => node.id === relationDialog.nodeId) ?? null : null,
    [archNodes, relationDialog]
  );
  const descriptionNode = useMemo(
    () => descriptionDialog ? archNodes.find(node => node.id === descriptionDialog.nodeId) ?? null : null,
    [archNodes, descriptionDialog]
  );

  const openRelationDialog = (nodeId: string, mode: RelationDialogState['mode']) => {
    setContextMenu(null);
    setRelationDialog({ nodeId, mode });
  };

  const toggleRelatedTask = async (taskId: number) => {
    if (!relationNode) return;
    const current = normalizeIdList(relationNode.relatedTaskIds);
    const next = current.includes(taskId) ? current.filter(id => id !== taskId) : [...current, taskId];
    await update(relationNode.id, { relatedTaskIds: next });
  };

  const toggleRelatedMilestone = async (milestoneId: number) => {
    if (!relationNode) return;
    const current = normalizeIdList(relationNode.relatedMilestoneIds);
    const next = current.includes(milestoneId) ? current.filter(id => id !== milestoneId) : [...current, milestoneId];
    await update(relationNode.id, { relatedMilestoneIds: next });
  };

  const clearNodeRelations = async (node: ArchNode) => {
    // Clearing both relation lists is intentionally atomic to avoid the old black-screening partial state.
    setContextMenu(null);
    await update(node.id, { relatedTaskIds: [], relatedMilestoneIds: [] });
    addToast('已取消节点关联', 'success');
  };

  const saveDescription = async () => {
    if (!descriptionDialog) return;
    // Description is stored on ArchNode, so markdown edits sync through the existing archNodes channel.
    await update(descriptionDialog.nodeId, { description: descriptionDialog.value.trim() });
    setDescriptionDialog(null);
  };

  const resetLayout = () => {
    setManualPositions({});
    addToast('已恢复自动树形布局', 'success');
  };

  const clearCurrentArchitecture = async () => {
    if (!currentProjectId || !editable) return;
    if (!window.confirm('确定清空当前项目的架构图节点吗？清空后会自动重新创建项目根目录。')) return;
    if (rootNode) {
      await remove(rootNode.id);
    } else {
      for (const node of archNodes) {
        await remove(node.id);
      }
    }
    setManualPositions({});
    await load(currentProjectId);
    addToast('当前项目架构图已清空', 'success');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[calc(100vh-150px)] flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-[30px] border border-white/[0.06] bg-[#0b1322] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            <FolderTree className="text-sky-300" size={26} />
            架构图
          </h2>
          <p className="mt-1 text-sm text-slate-400">用可交互目录树描述项目结构。这里的文件和文件夹只是示意标签，不会读写磁盘。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={!editable || !rootNode} onClick={() => rootNode && openCreateDialog(rootNode.id, 'folder')} className="flex items-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50">
            <FolderPlus size={15} />
            文件夹
          </button>
          <button disabled={!editable || !rootNode} onClick={() => rootNode && openCreateDialog(rootNode.id, 'file')} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50">
            <FilePlus2 size={15} />
            文件
          </button>
          <button onClick={resetLayout} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05]">
            <Wand2 size={15} />
            自动布局
          </button>
          <button disabled={!currentProjectId} onClick={() => currentProjectId && load(currentProjectId)} className="flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-200 hover:bg-sky-500/20 disabled:opacity-50">
            <RefreshCw size={15} />
            刷新
          </button>
        </div>
      </div>

      <div className="relative h-[calc(100vh-260px)] min-h-[620px] overflow-hidden rounded-[30px] border border-white/[0.06] bg-[linear-gradient(180deg,#08111f,#060b13)]">
        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span className="rounded-full bg-white/[0.05] px-2 py-1">项目 {currentProject?.name || '未选择'}</span>
          <span className="rounded-full bg-white/[0.05] px-2 py-1">节点 {archNodes.length}</span>
          <span className="rounded-full bg-white/[0.05] px-2 py-1">文件夹 {archNodes.filter(node => node.type === 'folder').length}</span>
          {!editable && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-200">只读</span>}
        </div>

        {tooManyNodes ? (
          <div className="flex h-full min-h-[560px] items-center justify-center p-6 text-center">
            <div className="max-w-md">
              <FolderTree size={42} className="mx-auto mb-3 text-amber-300" />
              <p className="text-sm font-semibold text-slate-200">架构图节点过多，已暂停渲染以避免页面卡死</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                当前项目有 {archNodes.length} 个架构节点。可以先清空架构图，再手动按模块补回关键结构。
              </p>
              <button disabled={!editable} onClick={clearCurrentArchitecture} className="mt-5 rounded-xl bg-red-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50">
                清空当前架构图
              </button>
            </div>
          </div>
        ) : currentProjectId && archNodes.length === 0 ? (
          <div className="flex h-full min-h-[560px] items-center justify-center text-center">
            <div>
              <FolderTree size={42} className="mx-auto mb-3 text-slate-700" />
              <p className="text-sm text-slate-300">正在准备项目根目录</p>
              <p className="mt-1 text-xs text-slate-600">根文件夹会默认使用当前项目名。</p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeContextMenu={(event, node) => {
              event.preventDefault();
              setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
            }}
            onPaneClick={() => setContextMenu(null)}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.32}
            maxZoom={1.8}
            nodesDraggable={editable}
            nodesConnectable={false}
            defaultEdgeOptions={{
              type: 'bezier',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 12, height: 12 },
              style: { stroke: '#64748b', strokeWidth: 1.5, opacity: 0.72 },
            }}
          >
            <Background color="rgba(148,163,184,0.12)" gap={24} size={1.5} />
            <Controls showInteractive={false} position="bottom-right" />
            <MiniMap
              pannable
              zoomable
              position="bottom-left"
              nodeColor={node => {
                const data = node.data as ArchNodeData | undefined;
                if (!data?.node) return '#64748b';
                return data.node.type === 'folder' ? '#22d3ee' : getExtensionStyle(data.node).color;
              }}
              maskColor="rgba(2,6,23,0.72)"
              className="!bg-[#0b1322] !border !border-white/[0.08]"
            />
          </ReactFlow>
        )}
      </div>

      {contextMenu && contextNode && (
        <div
          className="fixed z-50 w-52 rounded-2xl border border-white/[0.08] bg-[#0b1322]/95 p-2 shadow-2xl backdrop-blur"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 220), top: Math.min(contextMenu.y, window.innerHeight - 320) }}
          onClick={event => event.stopPropagation()}
        >
          <button disabled={!editable} onClick={() => openRelationDialog(contextNode.id, 'tasks')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40">
            <Link2 size={14} />
            关联任务
          </button>
          <button disabled={!editable} onClick={() => openRelationDialog(contextNode.id, 'milestones')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40">
            <Link2 size={14} />
            关联里程碑
          </button>
          <button disabled={!editable} onClick={() => openDescriptionDialog(contextNode)} className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40">
            编辑描述
          </button>
          <button disabled={!editable} onClick={() => { setContextMenu(null); renameNode(contextNode); }} className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40">
            重命名
          </button>
          <button disabled={!editable} onClick={() => clearNodeRelations(contextNode)} className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40">
            取消关联
          </button>
          {contextNode.id !== rootNode?.id && (
            <button disabled={!editable} onClick={() => { setContextMenu(null); handleDelete(contextNode.id); }} className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40">
              删除节点
            </button>
          )}
        </div>
      )}

      {relationDialog && relationNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setRelationDialog(null)}>
          <div className="glass w-full max-w-xl rounded-[28px] p-5" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {relationDialog.mode === 'tasks' ? '关联任务' : '关联里程碑'} · {relationNode.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">多选绑定，保存后会随架构图同步给团队成员。</p>
              </div>
              <button onClick={() => setRelationDialog(null)} className="rounded-xl p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {relationDialog.mode === 'tasks' && projectTasks.length === 0 && (
                <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-500">当前项目还没有任务。</p>
              )}
              {relationDialog.mode === 'tasks' && projectTasks.map(task => {
                if (!task.id) return null;
                const checked = normalizeIdList(relationNode.relatedTaskIds).includes(task.id);
                return (
                  <label key={task.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04]">
                    <input type="checkbox" checked={checked} onChange={() => toggleRelatedTask(task.id!)} className="h-4 w-4 accent-sky-500" />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[task.status] }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{task.title}</span>
                    <span className="text-xs text-slate-500">{STATUS_LABELS[task.status]}</span>
                  </label>
                );
              })}
              {relationDialog.mode === 'milestones' && projectMilestones.length === 0 && (
                <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-500">当前项目还没有里程碑。</p>
              )}
              {relationDialog.mode === 'milestones' && projectMilestones.map(milestone => {
                if (!milestone.id) return null;
                const checked = normalizeIdList(relationNode.relatedMilestoneIds).includes(milestone.id);
                return (
                  <label key={milestone.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04]">
                    <input type="checkbox" checked={checked} onChange={() => toggleRelatedMilestone(milestone.id!)} className="h-4 w-4 accent-emerald-500" />
                    <span className={`h-2 w-2 rounded-full ${milestone.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{milestone.title}</span>
                    <span className="text-xs text-slate-500">{MILESTONE_STATUS_LABELS[milestone.status]}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {descriptionDialog && descriptionNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setDescriptionDialog(null)}>
          <div className="glass w-full max-w-3xl rounded-[28px] p-5" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">编辑描述 · {descriptionNode.name}</h3>
                <p className="mt-1 text-xs text-slate-500">支持 Markdown，描述会同步到共享架构图。</p>
              </div>
              <button onClick={() => setDescriptionDialog(null)} className="rounded-xl p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <textarea
                value={descriptionDialog.value}
                onChange={event => setDescriptionDialog(current => current ? { ...current, value: event.target.value } : current)}
                className="min-h-[260px] rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-sm text-white outline-none focus:border-sky-500/40"
                placeholder="写下这个节点的职责、入口、约束或注意事项..."
              />
              <div className="prose prose-invert max-w-none min-h-[260px] overflow-y-auto rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-sm text-slate-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {descriptionDialog.value || '暂无预览'}
                </ReactMarkdown>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setDescriptionDialog(null)} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
              <button onClick={saveDescription} className="rounded-xl bg-sky-500 px-5 py-2 text-sm font-medium text-white hover:bg-sky-600">保存描述</button>
            </div>
          </div>
        </div>
      )}

      {createDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setCreateDialog(null)}>
          <div className="glass w-full max-w-md rounded-[28px] p-5" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{createDialog.type === 'folder' ? '创建文件夹' : '创建文件节点'}</h3>
              <button onClick={() => setCreateDialog(null)} className="rounded-xl p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-xs text-slate-400">
                名称
                <input
                  value={createDialog.name}
                  onChange={event => setCreateDialog(current => current ? { ...current, name: event.target.value } : current)}
                  onKeyDown={event => event.key === 'Enter' && submitCreateDialog()}
                  className="mt-1.5 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-sky-500/40"
                  autoFocus
                />
              </label>
              {createDialog.type === 'file' && (
                <label className="block text-xs text-slate-400">
                  文件类型
                  <select
                    value={createDialog.extension}
                    onChange={event => setCreateDialog(current => current ? { ...current, extension: event.target.value } : current)}
                    className="custom-select mt-1.5 w-full rounded-xl border border-white/[0.06] px-3 py-2 text-sm"
                  >
                    {FILE_EXTENSIONS.map(extension => (
                      <option key={extension} value={extension}>{extension === 'other' ? '其他' : extension}</option>
                    ))}
                  </select>
                </label>
              )}
              {createDialog.type === 'file' && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-xs text-slate-400">
                  将创建：<span className="text-sky-200">{withExtension(createDialog.name, createDialog.extension)}</span>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setCreateDialog(null)} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
              <button onClick={submitCreateDialog} className="rounded-xl bg-sky-500 px-5 py-2 text-sm font-medium text-white hover:bg-sky-600">创建</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
