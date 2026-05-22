import { create } from 'zustand';
import { db } from '../db/database';
import type { CollaborationEvent, SyncState, TeamMember, User } from '../types';
import {
  addLocalTeamMember,
  buildInviteUrl,
  buildRemoteInviteUrl,
  deleteRemoteMember,
  fetchRemoteMembers,
  getCloudPendingChangeCount,
  importSharedProjects,
  joinRemoteProject,
  loadCloudSession,
  publishProjectToCloud,
  recordCollaborationEvent,
  runCloudSync,
  saveCloudSession,
  signInWithEmail,
  signUpWithEmail,
  updateRemoteMemberRole,
  upsertRemoteMember,
  type CloudSession,
} from '../lib/cloudSync';
import { useAppStore } from './useAppStore';

interface CloudStore {
  session: CloudSession | null;
  user: User | null;
  syncState: SyncState;
  members: TeamMember[];
  events: CollaborationEvent[];
  inviteUrl: string;
  loading: boolean;
  error: string;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => void;
  syncNow: () => Promise<void>;
  loadTeam: (projectId: number) => Promise<void>;
  inviteByEmail: (projectId: number, email: string, role: TeamMember['role']) => Promise<void>;
  updateMemberRole: (memberId: number, role: TeamMember['role']) => Promise<void>;
  removeMember: (memberId: number) => Promise<void>;
  createInviteLink: (projectId: number, role: TeamMember['role']) => Promise<void>;
  publishProject: (projectId: number) => Promise<void>;
  joinProject: (remoteProjectId: string, role: TeamMember['role']) => Promise<void>;
  getRole: (projectId: number | null) => TeamMember['role'] | null;
  canEdit: (projectId: number | null) => boolean;
  canOwn: (projectId: number | null) => boolean;
}

const initialSyncState: SyncState = {
  lastSyncedAt: localStorage.getItem('devtrack-last-synced-at'),
  pendingChanges: 0,
  syncStatus: navigator.onLine ? 'synced' : 'offline',
};

export const useCloudStore = create<CloudStore>((set, get) => ({
  session: null,
  user: null,
  syncState: initialSyncState,
  members: [],
  events: [],
  inviteUrl: '',
  loading: false,
  error: '',

  init: async () => {
    const session = loadCloudSession();
    if (session) {
      try {
        await importSharedProjects(session);
        await useAppStore.getState().loadProjects();
      } catch {
        // Keep local startup available when the network is unavailable.
      }
    }
    const pendingChanges = await getCloudPendingChangeCount();
    set({
      session,
      user: session?.user ?? null,
      syncState: {
        lastSyncedAt: localStorage.getItem('devtrack-last-synced-at'),
        pendingChanges,
        syncStatus: navigator.onLine ? (pendingChanges > 0 ? 'syncing' : 'synced') : 'offline',
      },
    });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: '' });
    try {
      const session = await signInWithEmail(email, password);
      set({ session, user: session.user, loading: false });
      await get().syncNow();
      await useAppStore.getState().loadProjects();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '登录失败', loading: false });
    }
  },

  signUp: async (email, password, displayName) => {
    set({ loading: true, error: '' });
    try {
      const session = await signUpWithEmail(email, password, displayName);
      set({ session, user: session.user, loading: false });
      await get().syncNow();
      await useAppStore.getState().loadProjects();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '注册失败', loading: false });
    }
  },

  signOut: () => {
    saveCloudSession(null);
    set({ session: null, user: null, inviteUrl: '' });
  },

  syncNow: async () => {
    const session = get().session;
    if (!session) {
      const pendingChanges = await getCloudPendingChangeCount();
      set({ syncState: { ...get().syncState, pendingChanges, syncStatus: navigator.onLine ? 'synced' : 'offline' } });
      return;
    }

    set({ syncState: { ...get().syncState, syncStatus: navigator.onLine ? 'syncing' : 'offline' }, error: '' });
    try {
      const syncState = await runCloudSync(session);
      set({ syncState });
    } catch (error) {
      const pendingChanges = await getCloudPendingChangeCount();
      set({
        error: error instanceof Error ? error.message : '同步失败',
        syncState: {
          ...get().syncState,
          pendingChanges,
          syncStatus: navigator.onLine ? 'conflict' : 'offline',
        },
      });
    }
  },

  loadTeam: async (projectId) => {
    const project = await db.projects.get(projectId);
    const session = get().session;
    if (session && project?.remoteProjectId) {
      try {
        const remoteMembers = await fetchRemoteMembers(session, project.remoteProjectId);
        await db.teamMembers.where('projectId').equals(projectId).delete();
        await db.teamMembers.bulkAdd(remoteMembers.map(member => ({
          projectId,
          userId: member.user_id,
          role: member.role,
          email: member.email,
          displayName: member.display_name,
          joinedAt: member.joined_at,
          online: false,
          lastSeenAt: member.last_seen_at ?? null,
        })));
      } catch {
        // Keep local team cache when remote member refresh fails.
      }
    }

    const [members, events] = await Promise.all([
      db.teamMembers.where('projectId').equals(projectId).toArray(),
      db.collaborationEvents.where('projectId').equals(projectId).reverse().sortBy('createdAt'),
    ]);
    set({ members, events: events.slice(0, 40) });
  },

  inviteByEmail: async (projectId, email, role) => {
    const session = get().session;
    const project = await db.projects.get(projectId);
    const userId = `email:${email}`;
    if (session && project?.remoteProjectId) {
      await upsertRemoteMember(session, project.remoteProjectId, { userId, email, displayName: email, role, online: false, lastSeenAt: null });
    }
    const existing = await db.teamMembers.where({ projectId, userId }).first();
    if (existing?.id) {
      await db.teamMembers.update(existing.id, { role, email, displayName: email });
    } else {
      await addLocalTeamMember({ projectId, userId, email, displayName: email, role, online: false, lastSeenAt: null });
    }
    await recordCollaborationEvent({
      projectId,
      userId: session?.user.id ?? null,
      userName: session?.user.displayName ?? '本地用户',
      type: 'member_invited',
      targetType: 'members',
      targetId: userId,
      title: '邀请成员',
      description: `${email} 被邀请为 ${role}`,
    });
    await get().loadTeam(projectId);
  },

  updateMemberRole: async (memberId, role) => {
    await db.teamMembers.update(memberId, { role });
    const member = await db.teamMembers.get(memberId);
    if (member) {
      const project = await db.projects.get(member.projectId);
      const session = get().session;
      if (session && project?.remoteProjectId) {
        await updateRemoteMemberRole(session, project.remoteProjectId, member.userId, role);
      }
      await recordCollaborationEvent({
        projectId: member.projectId,
        userId: get().user?.id ?? null,
        userName: get().user?.displayName ?? '本地用户',
        type: 'member_role_changed',
        targetType: 'members',
        targetId: member.userId,
        title: '调整成员权限',
        description: `${member.displayName || member.email || member.userId} 现在是 ${role}`,
      });
      await get().loadTeam(member.projectId);
    }
  },

  removeMember: async (memberId) => {
    const member = await db.teamMembers.get(memberId);
    const project = member ? await db.projects.get(member.projectId) : null;
    const session = get().session;
    if (member && session && project?.remoteProjectId) {
      await deleteRemoteMember(session, project.remoteProjectId, member.userId);
    }
    await db.teamMembers.delete(memberId);
    if (member) await get().loadTeam(member.projectId);
  },

  createInviteLink: async (projectId, role) => {
    const project = await db.projects.get(projectId);
    set({ inviteUrl: project?.remoteProjectId ? buildRemoteInviteUrl(project.remoteProjectId, role) : buildInviteUrl(projectId, role) });
  },

  publishProject: async (projectId) => {
    const session = get().session;
    const project = await db.projects.get(projectId);
    if (!session || !project?.id) {
      set({ error: '请先登录并选择项目。' });
      return;
    }
    set({ loading: true, error: '' });
    try {
      await publishProjectToCloud(session, project);
      await useAppStore.getState().loadProjects();
      await get().loadTeam(projectId);
      await get().syncNow();
      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '发布共享项目失败' });
    }
  },

  joinProject: async (remoteProjectId, role) => {
    const session = get().session;
    if (!session) {
      set({ error: '请先登录，再加入共享项目。' });
      return;
    }
    set({ loading: true, error: '' });
    try {
      await joinRemoteProject(session, remoteProjectId, role);
      await useAppStore.getState().loadProjects();
      await get().syncNow();
      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '加入共享项目失败' });
    }
  },

  getRole: (projectId) => {
    if (!projectId) return null;
    const user = get().user;
    if (!user) return null;
    return get().members.find(member => (
      member.projectId === projectId &&
      (member.userId === user.id || member.email === user.email || member.userId === `email:${user.email}`)
    ))?.role ?? null;
  },

  canEdit: (projectId) => {
    const project = useAppStore.getState().projects.find(item => item.id === projectId);
    if (!project?.remoteProjectId) return true;
    const role = get().getRole(projectId);
    return role === 'owner' || role === 'editor';
  },

  canOwn: (projectId) => {
    const project = useAppStore.getState().projects.find(item => item.id === projectId);
    if (!project?.remoteProjectId) return true;
    return get().getRole(projectId) === 'owner';
  },
}));
