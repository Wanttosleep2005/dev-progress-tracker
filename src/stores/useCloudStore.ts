import { create } from 'zustand';
import { db } from '../db/database';
import type { CollaborationEvent, SyncState, TeamMember, User } from '../types';
import {
  addLocalTeamMember,
  buildInviteUrl,
  loadCloudSession,
  recordCollaborationEvent,
  runCloudSync,
  saveCloudSession,
  signInWithEmail,
  signUpWithEmail,
  type CloudSession,
} from '../lib/cloudSync';

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
  createInviteLink: (projectId: number, role: TeamMember['role']) => void;
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
    const pendingChanges = await db.syncChanges.count();
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
      const pendingChanges = await db.syncChanges.count();
      set({ syncState: { ...get().syncState, pendingChanges, syncStatus: navigator.onLine ? 'synced' : 'offline' } });
      return;
    }

    set({ syncState: { ...get().syncState, syncStatus: navigator.onLine ? 'syncing' : 'offline' }, error: '' });
    try {
      const syncState = await runCloudSync(session);
      set({ syncState });
    } catch (error) {
      const pendingChanges = await db.syncChanges.count();
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
    const [members, events] = await Promise.all([
      db.teamMembers.where('projectId').equals(projectId).toArray(),
      db.collaborationEvents.where('projectId').equals(projectId).reverse().sortBy('createdAt'),
    ]);
    set({ members, events: events.slice(0, 40) });
  },

  inviteByEmail: async (projectId, email, role) => {
    const session = get().session;
    const userId = `pending:${email}`;
    await addLocalTeamMember({ projectId, userId, email, displayName: email, role, online: false, lastSeenAt: null });
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
    await db.teamMembers.delete(memberId);
    if (member) await get().loadTeam(member.projectId);
  },

  createInviteLink: (projectId, role) => {
    set({ inviteUrl: buildInviteUrl(projectId, role) });
  },
}));
