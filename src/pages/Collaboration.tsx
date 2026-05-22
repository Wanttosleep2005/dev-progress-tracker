import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Cloud, Copy, Link2, Mail, RefreshCw, Rocket, Shield, Users } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useCloudStore } from '../stores/useCloudStore';
import type { SyncStatus, TeamRole } from '../types';

const roleLabels: Record<TeamRole, string> = {
  owner: '所有者',
  editor: '编辑者',
  viewer: '查看者',
};

const syncLabels: Record<SyncStatus, string> = {
  synced: '已同步',
  syncing: '同步中',
  offline: '离线',
  conflict: '有冲突',
};

export default function Collaboration() {
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const project = useAppStore(state => state.projects.find(item => item.id === currentProjectId));
  const {
    user,
    session,
    syncState,
    members,
    events,
    inviteUrl,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    syncNow,
    loadTeam,
    inviteByEmail,
    updateMemberRole,
    removeMember,
    createInviteLink,
    publishProject,
    getRole,
    canOwn,
  } = useCloudStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('editor');

  useEffect(() => {
    if (currentProjectId) loadTeam(currentProjectId);
  }, [currentProjectId, loadTeam, syncState.lastSyncedAt]);

  const currentRole = useMemo(() => getRole(currentProjectId), [currentProjectId, getRole, members]);
  const isOwner = canOwn(currentProjectId);
  const isShared = Boolean(project?.remoteProjectId);

  const handleInvite = async () => {
    if (!currentProjectId || !inviteEmail.trim() || !isOwner) return;
    await inviteByEmail(currentProjectId, inviteEmail.trim(), role);
    setInviteEmail('');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">团队协作与云同步</h2>
          <p className="mt-1 text-sm text-slate-400">邮箱账户、共享项目、成员权限与协作活动流集中管理。</p>
        </div>
        <button
          onClick={syncNow}
          className="flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200 hover:bg-cyan-500/20"
        >
          <RefreshCw size={16} />
          手动同步
        </button>
      </div>

      {error && <div className="glass rounded-2xl border border-amber-500/20 p-3 text-sm text-amber-200">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass rounded-[30px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Cloud size={16} className="text-cyan-300" />
            账户与同步状态
          </h3>

          {session ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-sm font-semibold text-white">{user?.displayName}</p>
                <p className="mt-1 text-xs text-slate-500">{user?.email}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <p className="text-xs text-slate-500">同步状态</p>
                  <p className="mt-2 text-sm font-semibold text-cyan-200">{syncLabels[syncState.syncStatus]}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <p className="text-xs text-slate-500">待同步</p>
                  <p className="mt-2 text-sm font-semibold text-white">{syncState.pendingChanges}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <p className="text-xs text-slate-500">最近同步</p>
                  <p className="mt-2 text-xs text-slate-300">{syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleString('zh-CN') : '尚未同步'}</p>
                </div>
              </div>
              <button onClick={signOut} className="rounded-xl border border-white/[0.06] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.04]">退出登录</button>
            </div>
          ) : (
            <div className="space-y-3">
              <input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="显示名称（注册时使用）" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none" />
              <input value={email} onChange={event => setEmail(event.target.value)} placeholder="邮箱，例如 QQ 邮箱也可以" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none" />
              <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="密码" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none" />
              <div className="flex gap-3">
                <button disabled={loading} onClick={() => signIn(email, password)} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50">登录</button>
                <button disabled={loading} onClick={() => signUp(email, password, displayName)} className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50">注册</button>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">需要配置 Supabase 环境变量并执行 docs/supabase-sync.sql。邮箱只是账户标识，不需要和 QQ 邮箱做额外联动。</p>
            </div>
          )}
        </div>

        <div className="glass rounded-[30px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Users size={16} className="text-emerald-300" />
            项目共享
          </h3>
          {!project ? (
            <p className="text-sm text-slate-500">请先选择一个项目。</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-slate-500">当前项目</p>
                    <p className="mt-1 font-semibold text-white">{project.icon} {project.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{isShared ? `远程项目 ID：${project.remoteProjectId}` : '尚未发布为共享项目'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {currentRole && <span className="rounded-full border border-white/[0.06] px-3 py-1 text-xs text-slate-300">我的权限：{roleLabels[currentRole]}</span>}
                    {!isShared && session && (
                      <button
                        onClick={() => currentProjectId && publishProject(currentProjectId)}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        <Rocket size={14} />
                        发布共享
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {!isShared && <p className="rounded-2xl border border-amber-500/15 bg-amber-500/10 p-3 text-sm text-amber-100">先发布为共享项目，成员才能通过邮箱或邀请链接加入并同步任务、里程碑和日记。</p>}
              {isShared && !isOwner && <p className="rounded-2xl border border-sky-500/15 bg-sky-500/10 p-3 text-sm text-sky-100">当前项目由所有者管理邀请和权限。你的操作范围取决于上方显示的成员角色。</p>}

              <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
                <input disabled={!isOwner} value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="通过邮箱邀请成员" className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50" />
                <select disabled={!isOwner} value={role} onChange={event => setRole(event.target.value as TeamRole)} className="rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="editor">编辑者</option>
                  <option value="viewer">查看者</option>
                  <option value="owner">所有者</option>
                </select>
                <button disabled={!isOwner} onClick={handleInvite} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
                  <Mail size={14} />
                  邀请
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <button disabled={!isShared || !isOwner} onClick={() => currentProjectId && createInviteLink(currentProjectId, role)} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50">
                  <Link2 size={14} />
                  生成邀请链接
                </button>
                {inviteUrl && (
                  <button onClick={() => navigator.clipboard.writeText(inviteUrl)} className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">
                    <Copy size={14} />
                    复制链接
                  </button>
                )}
              </div>
              {inviteUrl && <p className="break-all rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 text-xs text-slate-400">{inviteUrl}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="glass rounded-[30px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Shield size={16} className="text-violet-300" />
            成员权限
          </h3>
          {members.length === 0 ? (
            <p className="text-sm text-slate-500">当前项目还没有团队成员记录。</p>
          ) : (
            <div className="space-y-3">
              {members.map(member => (
                <div key={member.id ?? member.userId} className="flex flex-col gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{member.displayName || member.email || member.userId}</p>
                    <p className="mt-1 text-xs text-slate-500">{member.online ? '在线' : `最后在线 ${member.lastSeenAt ? new Date(member.lastSeenAt).toLocaleString('zh-CN') : '未知'}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select disabled={!isOwner || member.role === 'owner'} value={member.role} onChange={event => member.id && updateMemberRole(member.id, event.target.value as TeamRole)} className="rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50">
                      {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button disabled={!isOwner || member.role === 'owner'} onClick={() => member.id && removeMember(member.id)} className="rounded-xl px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40">移除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-[30px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <RefreshCw size={16} className="text-cyan-300" />
            协作活动流
          </h3>
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">团队操作会在这里形成活动流，例如成员完成任务、发布共享项目或调整权限。</p>
          ) : (
            <div className="space-y-3">
              {events.map(event => (
                <div key={event.id} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{event.title}</p>
                    <span className="text-[10px] text-slate-500">{new Date(event.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{event.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
