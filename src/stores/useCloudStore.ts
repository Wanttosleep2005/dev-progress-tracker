import { create } from 'zustand';
import { db } from '../db/database';
import type { CollaborationEvent, SyncState, TeamMember, User } from '../types';
import {
  addLocalTeamMember,
  buildInviteUrl,
  buildRemoteInviteUrl,
  deleteRemoteMember,
  fetchRemoteMembers,
  forgetCloudIdentity,
  getCloudPendingChangeCount,
  importSharedProjects,
  isMemberOnline,
  joinRemoteProject,
  loadCloudSession,
  publishProjectToCloud,
  recordCollaborationEvent,
  runCloudSync,
  saveCloudSession,
  signInWithEmail,
  signUpWithEmail,
  touchMemberPresence,
  updateRemoteMemberRole,
  upsertRemoteMember,
  type CloudSession,
  type CloudIdentityDeletionResult,
} from '../lib/cloudSync';
import { subscribeProjectRealtime, unsubscribeProjectRealtime, type RealtimeStatus } from '../lib/realtimeSync';
import { useAppStore } from './useAppStore';
import { useToast } from './useToast';
import { useNotificationCenterStore } from './useNotificationCenterStore';
import { isLocalOnlyMode } from './usePreferences';

interface CloudStore {
  session: CloudSession | null;
  user: User | null;
  syncState: SyncState;
  members: TeamMember[];
  events: CollaborationEvent[];
  inviteUrl: string;
  realtimeStatus: RealtimeStatus;
  loading: boolean;
  error: string;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, redirectTo?: string) => Promise<void>;
  signOut: () => void;
  deleteAccount: () => Promise<CloudIdentityDeletionResult>;
  syncNow: () => Promise<void>;
  touchPresence: () => Promise<void>;
  loadTeam: (projectId: number) => Promise<void>;
  inviteByEmail: (projectId: number, email: string, role: TeamMember['role']) => Promise<void>;
  updateMemberRole: (memberId: number, role: TeamMember['role']) => Promise<void>;
  removeMember: (memberId: number) => Promise<void>;
  transferOwnership: (projectId: number, targetMemberId: number) => Promise<void>;
  createInviteLink: (projectId: number, role: TeamMember['role']) => Promise<void>;
  publishProject: (projectId: number) => Promise<void>;
  joinProject: (remoteProjectId: string, role: TeamMember['role']) => Promise<void>;
  startRealtime: (projectId: number | null) => Promise<void>;
  stopRealtime: () => void;
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
  realtimeStatus: 'idle',
  loading: false,
  error: '',

  init: async () => {
    if (isLocalOnlyMode()) {
      unsubscribeProjectRealtime();
      saveCloudSession(null);
      const pendingChanges = await getCloudPendingChangeCount();
      set({
        session: null,
        user: null,
        members: [],
        events: [],
        inviteUrl: '',
        realtimeStatus: 'idle',
        syncState: {
          lastSyncedAt: null,
          pendingChanges,
          syncStatus: 'offline',
        },
      });
      return;
    }

    const session = loadCloudSession();
    if (session) {
      try {
        await importSharedProjects(session);
        await touchMemberPresence(session);
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
    if (isLocalOnlyMode()) {
      throw new Error('当前处于单人纯净流，请先在设置中切换到云协作模式。');
    }
    set({ loading: true, error: '' });
    try {
      const session = await signInWithEmail(email, password);
      set({ session, user: session.user, loading: false });
      await get().syncNow();
      await useAppStore.getState().loadProjects();
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败';
      set({ error: message, loading: false });
      throw error;
    }
  },

  signUp: async (email, password, displayName, redirectTo) => {
    if (isLocalOnlyMode()) {
      throw new Error('当前处于单人纯净流，请先在设置中切换到云协作模式。');
    }
    set({ loading: true, error: '' });
    try {
      const session = await signUpWithEmail(email, password, displayName, redirectTo);
      set({ session, user: session.user, loading: false });
      await get().syncNow();
      await useAppStore.getState().loadProjects();
    } catch (error) {
      const message = error instanceof Error ? error.message : '注册失败';
      set({ error: message, loading: false });
      throw error;
    }
  },

  signOut: () => {
    saveCloudSession(null);
    unsubscribeProjectRealtime();
    set({ session: null, user: null, inviteUrl: '', realtimeStatus: 'idle' });
  },

  deleteAccount: async () => {
    const session = get().session;
    if (!session) {
      throw new Error('请先登录后再注销云端账户。');
    }
    set({ loading: true, error: '' });
    try {
      const result = await forgetCloudIdentity(session);
      set({
        session: null,
        user: null,
        members: [],
        events: [],
        inviteUrl: '',
        realtimeStatus: 'idle',
        loading: false,
        syncState: {
          lastSyncedAt: null,
          pendingChanges: 0,
          syncStatus: navigator.onLine ? 'synced' : 'offline',
        },
      });
      await useAppStore.getState().loadProjects();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : '注销云端账户失败';
      set({ error: message, loading: false });
      throw error;
    }
  },

  syncNow: async () => {
    if (isLocalOnlyMode()) {
      const pendingChanges = await getCloudPendingChangeCount();
      set({
        syncState: {
          lastSyncedAt: null,
          pendingChanges,
          syncStatus: 'offline',
        },
        error: '',
      });
      return;
    }

    const session = get().session;
    if (!session) {
      const pendingChanges = await getCloudPendingChangeCount();
      set({ syncState: { ...get().syncState, pendingChanges, syncStatus: navigator.onLine ? 'synced' : 'offline' } });
      return;
    }

    const pendingBefore = await getCloudPendingChangeCount();
    // Avoid a visible "pending 0 -> syncing -> synced" flicker during pull-only realtime refreshes.
    set({
      syncState: {
        ...get().syncState,
        pendingChanges: pendingBefore,
        syncStatus: navigator.onLine ? (pendingBefore > 0 ? 'syncing' : get().syncState.syncStatus) : 'offline',
      },
      error: '',
    });
    try {
      const syncState = await runCloudSync(session);
      set({ syncState });
      await useAppStore.getState().loadProjects();
      const currentProjectId = useAppStore.getState().currentProjectId;
      if (currentProjectId) {
        await get().loadTeam(currentProjectId);
        const [{ useTaskStore }, { useMilestoneStore }, { useTimelineStore }, { useDiaryStore }, { useArchStore }] = await Promise.all([
          import('./useTaskStore'),
          import('./useMilestoneStore'),
          import('./useTimelineStore'),
          import('./useDiaryStore'),
          import('./useArchStore'),
        ]);
        // Realtime writes land in IndexedDB first; reload every visible project store from that local truth.
        await Promise.all([
          useTaskStore.getState().load(currentProjectId),
          useMilestoneStore.getState().load(currentProjectId),
          useTimelineStore.getState().load(currentProjectId),
          useDiaryStore.getState().load(currentProjectId),
          useArchStore.getState().load(currentProjectId),
        ]);
      }
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

  touchPresence: async () => {
    if (isLocalOnlyMode()) return;
    const session = get().session;
    if (!session) return;
    await touchMemberPresence(session, useAppStore.getState().currentProjectId).catch(() => undefined);
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) await get().loadTeam(currentProjectId);
  },

  loadTeam: async (projectId) => {
    if (isLocalOnlyMode()) {
      set({ members: [], events: [] });
      return;
    }
    const project = await db.projects.get(projectId);
    const session = get().session;
    if (session && project?.remoteProjectId) {
      try {
        await touchMemberPresence(session, projectId);
        const remoteMembers = await fetchRemoteMembers(session, project.remoteProjectId);
        const remoteUserIds = new Set(remoteMembers.map(m => m.user_id));
        for (const member of remoteMembers) {
          const existing = await db.teamMembers.where({ projectId, userId: member.user_id }).first();
          const remoteLastSeenAt = member.last_seen_at ?? null;
          const isCurrentUser = member.user_id === session.user.id || member.email === session.user.email;
          const localIsNewer = existing?.lastSeenAt && remoteLastSeenAt
            ? new Date(existing.lastSeenAt).getTime() > new Date(remoteLastSeenAt).getTime()
            : Boolean(existing?.lastSeenAt && !remoteLastSeenAt);
          const lastSeenAt = isCurrentUser && localIsNewer ? existing?.lastSeenAt ?? remoteLastSeenAt : remoteLastSeenAt;
          if (existing?.id) {
            await db.teamMembers.update(existing.id, {
              role: member.role,
              email: member.email,
              displayName: member.display_name,
              joinedAt: member.joined_at,
              online: isMemberOnline(lastSeenAt),
              lastSeenAt,
            });
          } else {
            await addLocalTeamMember({
              projectId,
              userId: member.user_id,
              role: member.role,
              email: member.email,
              displayName: member.display_name,
              online: isMemberOnline(lastSeenAt),
              lastSeenAt,
            });
          }
        }
        const localMembers = await db.teamMembers.where('projectId').equals(projectId).toArray();
        for (const local of localMembers) {
          if (!remoteUserIds.has(local.userId)) {
            await db.teamMembers.delete(local.id!);
          }
        }
      } catch {
        // Keep local team cache when remote member refresh fails.
      }
    }

    const [members, events] = await Promise.all([
      db.teamMembers.where('projectId').equals(projectId).toArray(),
      db.collaborationEvents.where('projectId').equals(projectId).reverse().sortBy('createdAt'),
    ]);
    set({
      members: members.map(member => ({ ...member, online: isMemberOnline(member.lastSeenAt) })),
      events: events.slice(0, 40),
    });
  },

  inviteByEmail: async (projectId, email, role) => {
    if (isLocalOnlyMode()) {
      useToast.getState().add('当前处于单人纯净流，邀请成员前请切换到云协作模式。', 'warning');
      return;
    }
    if (role === 'owner') {
      useToast.getState().add('Owner 权限不能通过邀请授予，请使用“转让所有权”。', 'warning');
      return;
    }
    const session = get().session;
    if (session?.user.email === email) {
      useToast.getState().add('你不能邀请自己加入项目。', 'warning');
      return;
    }
    const project = await db.projects.get(projectId);
    let userId = `email:${email}`;
    if (session && project?.remoteProjectId) {
      const remoteMembers = await fetchRemoteMembers(session, project.remoteProjectId).catch(() => []);
      const existingRemote = remoteMembers.find(member => member.email?.toLowerCase() === email.toLowerCase());
      if (existingRemote?.user_id) {
        userId = existingRemote.user_id;
      }
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
    await useNotificationCenterStore.getState().add('member_joined', '新成员加入', `${email} 被邀请加入项目`, '/collaboration', projectId);
  },

  updateMemberRole: async (memberId, role) => {
    const member = await db.teamMembers.get(memberId);
    if (!member) return;
    if (member.role === 'owner' || role === 'owner') {
      useToast.getState().add('Owner 权限不能在普通角色调整中修改，请使用“转让所有权”。', 'warning');
      return;
    }
    await db.teamMembers.update(memberId, { role });
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
    set(state => ({ members: state.members.filter(m => m.id !== memberId) }));
  },

  transferOwnership: async (projectId, targetMemberId) => {
    const me = get().user;
    if (!me) return;
    const project = await db.projects.get(projectId);
    const session = get().session;
    // 找到当前用户的 member 记录
    const myMember = get().members.find(m =>
      m.projectId === projectId &&
      (m.userId === me.id || m.email === me.email || m.userId === `email:${me.email}`)
    );
    const targetMember = await db.teamMembers.get(targetMemberId);
    if (!myMember?.id || !targetMember) return;
    // 修改目标成员为 owner
    await db.teamMembers.update(targetMemberId, { role: 'owner' });
    if (session && project?.remoteProjectId) {
      await updateRemoteMemberRole(session, project.remoteProjectId, targetMember.userId, 'owner');
    }
    // 修改自己为 editor
    await db.teamMembers.update(myMember.id, { role: 'editor' });
    if (session && project?.remoteProjectId) {
      await updateRemoteMemberRole(session, project.remoteProjectId, myMember.userId, 'editor');
    }
    await recordCollaborationEvent({
      projectId,
      userId: me.id,
      userName: me.displayName,
      type: 'member_role_changed',
      targetType: 'members',
      targetId: targetMember.userId,
      title: '转让项目所有权',
      description: `${me.displayName} 将所有权转让给 ${targetMember.displayName || targetMember.email || targetMember.userId}`,
    });
    await get().loadTeam(projectId);
  },

  createInviteLink: async (projectId, role) => {
    if (isLocalOnlyMode()) {
      set({ error: '当前处于单人纯净流，请先在设置中切换到云协作模式。' });
      return;
    }
    if (role === 'owner') {
      const message = 'Owner role cannot be granted by invite link. Use ownership transfer instead.';
      set({ error: message });
      useToast.getState().add(message, 'warning');
      return;
    }
    const project = await db.projects.get(projectId);
    set({ inviteUrl: project?.remoteProjectId ? buildRemoteInviteUrl(project.remoteProjectId, role) : buildInviteUrl(projectId, role) });
  },

  publishProject: async (projectId) => {
    if (isLocalOnlyMode()) {
      set({ error: '当前处于单人纯净流，请先在设置中切换到云协作模式。' });
      return;
    }
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
      await useNotificationCenterStore.getState().add('project_shared', '项目已发布', `「${project.name}」已发布为共享项目`, '/collaboration', projectId);
      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '发布共享项目失败' });
    }
  },

  joinProject: async (remoteProjectId, role) => {
    if (isLocalOnlyMode()) {
      set({ error: '当前处于单人纯净流，请先在设置中切换到云协作模式。' });
      throw new Error('当前处于单人纯净流，请先在设置中切换到云协作模式。');
    }
    const session = get().session;
    if (!session) {
      set({ error: '请先登录，再加入共享项目。' });
      throw new Error('请先登录，再加入共享项目。');
    }
    set({ loading: true, error: '' });
    try {
      const joinedProjectIds = await joinRemoteProject(session, remoteProjectId, role);
      await useAppStore.getState().loadProjects();
      if (joinedProjectIds[0]) {
        useAppStore.getState().setCurrentProject(joinedProjectIds[0]);
      }
      await get().syncNow();
      set({ loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加入共享项目失败';
      set({ loading: false, error: message });
      throw error;
    }
  },

  startRealtime: async (projectId) => {
    if (isLocalOnlyMode() || !projectId) {
      unsubscribeProjectRealtime();
      set({ realtimeStatus: 'idle' });
      return;
    }

    const session = get().session;
    const project = await db.projects.get(projectId);
    if (!session || !project?.remoteProjectId) {
      unsubscribeProjectRealtime();
      set({ realtimeStatus: 'idle' });
      return;
    }

    subscribeProjectRealtime({
      session,
      remoteProjectId: project.remoteProjectId,
      onChanged: () => {
        get().syncNow().catch(() => undefined);
      },
      onStatus: realtimeStatus => set({ realtimeStatus }),
      onError: message => set({ error: message }),
    });
  },

  stopRealtime: () => {
    unsubscribeProjectRealtime();
    set({ realtimeStatus: 'idle' });
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
    if (isLocalOnlyMode()) return true;
    const project = useAppStore.getState().projects.find(item => item.id === projectId);
    if (!project?.remoteProjectId) return true;
    const role = get().getRole(projectId);
    return role === 'owner' || role === 'editor';
  },

  canOwn: (projectId) => {
    if (isLocalOnlyMode()) return true;
    const project = useAppStore.getState().projects.find(item => item.id === projectId);
    if (!project?.remoteProjectId) return true;
    return get().getRole(projectId) === 'owner';
  },
}));
