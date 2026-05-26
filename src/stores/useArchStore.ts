import { create } from 'zustand';
import type { ArchNode } from '../types';
import * as db from '../db/database';
import { createClientId } from '../lib/id';
import { recordCollaborationEvent } from '../lib/cloudSync';
import { useCloudStore } from './useCloudStore';
import { useToast } from './useToast';

function archNodeSignature(nodes: ArchNode[]) {
  return [...nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(node => [
      node.id,
      node.parentId ?? '',
      node.name,
      node.type,
      node.extension ?? '',
      Array.isArray(node.relatedTaskIds) ? node.relatedTaskIds.join(',') : '',
      Array.isArray(node.relatedMilestoneIds) ? node.relatedMilestoneIds.join(',') : '',
      typeof node.description === 'string' ? node.description : '',
      node.sortOrder,
      node.updatedAt,
    ].join(':'))
    .join('|');
}

async function recordArchActivity(node: ArchNode, action: 'created' | 'updated' | 'deleted') {
  const user = useCloudStore.getState().user;
  const project = await db.getProject(node.projectId);
  const userName = user?.displayName || user?.email || '本地用户';
  const actionLabel = action === 'created' ? '创建' : action === 'updated' ? '编辑' : '删除';
  const nodeTypeLabel = node.type === 'folder' ? '文件夹' : '文件';

  // Architecture changes should appear in the collaboration activity stream like task edits do.
  await recordCollaborationEvent({
    projectId: node.projectId,
    remoteProjectId: project?.remoteProjectId ?? null,
    userId: user?.id ?? null,
    userName,
    type: action === 'created' ? 'arch_created' : action === 'updated' ? 'arch_updated' : 'arch_deleted',
    targetType: 'archNodes',
    targetId: node.id,
    title: `${actionLabel}了架构节点「${node.name}」`,
    description: `${userName} 在架构图中${actionLabel}了${nodeTypeLabel}「${node.name}」`,
  });
}

function wouldCreateCycle(nodes: ArchNode[], nodeId: string, nextParentId: string | null) {
  if (!nextParentId) return false;
  if (nodeId === nextParentId) return true;
  const byId = new Map(nodes.map(node => [node.id, node]));
  let cursor = byId.get(nextParentId);
  while (cursor) {
    if (cursor.id === nodeId) return true;
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return false;
}

function syncArchChangesSoon() {
  // Architecture edits are visible collaboration changes, so nudge cloud sync instead of waiting for fallback polling.
  window.setTimeout(() => {
    useCloudStore.getState().syncNow().catch(() => undefined);
  }, 150);
}

interface ArchStore {
  nodes: ArchNode[];
  loading: boolean;
  load: (projectId: number) => Promise<void>;
  add: (input: { projectId: number; parentId: string | null; name: string; type: ArchNode['type']; extension?: string | null }) => Promise<string>;
  ensureRoot: (projectId: number, projectName: string) => Promise<string>;
  update: (id: string, changes: Partial<ArchNode>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useArchStore = create<ArchStore>((set, get) => ({
  nodes: [],
  loading: false,

  load: async (projectId) => {
    set({ loading: true });
    await db.normalizeArchRootNodes(projectId);
    const nodes = await db.getArchNodesByProject(projectId);
    set(state => archNodeSignature(state.nodes) === archNodeSignature(nodes)
      ? { loading: false }
      : { nodes, loading: false });
  },

  add: async ({ projectId, parentId, name, type, extension = null }) => {
    if (!useCloudStore.getState().canEdit(projectId)) {
      useToast.getState().add('你没有编辑该共享项目架构图的权限。', 'warning');
      return '';
    }
    const parent = parentId ? get().nodes.find(node => node.id === parentId) : null;
    if (parentId && parent?.type !== 'folder') {
      useToast.getState().add('文件节点不能创建子节点。', 'warning');
      return '';
    }

    const siblings = get().nodes.filter(node => node.parentId === parentId);
    const id = createClientId();
    const newNode: Omit<ArchNode, 'createdAt' | 'updatedAt'> = {
      id,
      projectId,
      parentId,
      type,
      extension: type === 'file' ? extension : null,
      relatedTaskIds: [],
      relatedMilestoneIds: [],
      description: '',
      name: name.trim() || (type === 'folder' ? '新文件夹' : 'new-file.ts'),
      sortOrder: siblings.length,
      remoteId: null,
      syncUpdatedAt: null,
    };
    await db.addArchNode(newNode);
    const now = new Date().toISOString();
    await recordArchActivity({ ...newNode, createdAt: now, updatedAt: now }, 'created').catch(() => undefined);
    await get().load(projectId);
    syncArchChangesSoon();
    return id;
  },

  ensureRoot: async (projectId, projectName) => {
    await db.normalizeArchRootNodes(projectId);
    const persistedNodes = await db.getArchNodesByProject(projectId);
    const existingRoot = persistedNodes
      .filter(node => node.projectId === projectId && node.parentId === null && node.type === 'folder')
      .sort((a, b) => a.sortOrder - b.sortOrder)[0];
    if (existingRoot) {
      set(state => archNodeSignature(state.nodes) === archNodeSignature(persistedNodes) ? state : { nodes: persistedNodes });
      return existingRoot.id;
    }
    return get().add({
      projectId,
      parentId: null,
      type: 'folder',
      name: projectName.trim() || 'project',
      extension: null,
    });
  },

  update: async (id, changes) => {
    const node = get().nodes.find(item => item.id === id);
    const projectId = node?.projectId ?? changes.projectId ?? null;
    if (!useCloudStore.getState().canEdit(projectId)) {
      useToast.getState().add('你没有编辑该共享项目架构图的权限。', 'warning');
      return;
    }
    if (!node) return;
    if (changes.parentId !== undefined) {
      const parent = changes.parentId ? get().nodes.find(item => item.id === changes.parentId) : null;
      if (changes.parentId && parent?.type !== 'folder') {
        useToast.getState().add('只能把节点拖入文件夹节点。', 'warning');
        return;
      }
      if (wouldCreateCycle(get().nodes, id, changes.parentId)) {
        useToast.getState().add('不能把节点移动到自己的子节点下面。', 'warning');
        return;
      }
    }

    await db.updateArchNode(id, changes);
    await recordArchActivity({ ...node, ...changes }, 'updated').catch(() => undefined);
    await get().load(node.projectId);
    syncArchChangesSoon();
  },

  remove: async (id) => {
    const node = get().nodes.find(item => item.id === id);
    if (!node) return;
    if (!useCloudStore.getState().canEdit(node.projectId)) {
      useToast.getState().add('你没有删除该共享项目架构节点的权限。', 'warning');
      return;
    }

    await db.deleteArchNode(id);
    await recordArchActivity(node, 'deleted').catch(() => undefined);
    await get().load(node.projectId);
    syncArchChangesSoon();
  },
}));
