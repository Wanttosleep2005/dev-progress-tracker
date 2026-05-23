import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Cloud, Copy, Crown, Link2, Mail, RefreshCw, Rocket, Shield, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';
import { useCloudStore } from '../stores/useCloudStore';
import { getCustomBaseUrl } from '../lib/cloudSync';
import { getBackupDirectoryLabel } from '../lib/backup';
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

const PAGE_SIZE = 5;

function paginate<T>(items: T[], page: number) {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

function PaginationControls({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
      <span>第 {page} / {pageCount} 页 · 共 {total} 条</span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-white/[0.06] px-3 py-1 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
        >
          上一页
        </button>
        <button
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          className="rounded-lg border border-white/[0.06] px-3 py-1 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

export default function Collaboration() {
  const navigate = useNavigate();
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
    transferOwnership,
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
  const [removeConfirm, setRemoveConfirm] = useState<number | null>(null);
  const [activeMemberPage, setActiveMemberPage] = useState(1);
  const [permissionPage, setPermissionPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [publishMessage, setPublishMessage] = useState('');

  useEffect(() => {
    if (currentProjectId) loadTeam(currentProjectId);
  }, [currentProjectId, loadTeam, syncState.lastSyncedAt]);

  const currentRole = useMemo(() => getRole(currentProjectId), [currentProjectId, getRole, members]);
  const isOwner = canOwn(currentProjectId);
  const isShared = Boolean(project?.remoteProjectId);
  const inviteBase = getCustomBaseUrl() || window.location.origin;
  const isLanReady = /\/\/(26\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(inviteBase);
  const backupDirectory = getBackupDirectoryLabel();
  const activeMembers = paginate(members, activeMemberPage);
  const permissionMembers = paginate(members, permissionPage);
  const pagedEvents = paginate(events, eventPage);
  const isMe = (member: typeof members[number]) => {
    if (!user) return false;
    return member.userId === user.id || member.email === user.email || member.userId === `email:${user.email}`;
  };

  const handleInvite = async () => {
    if (!currentProjectId || !inviteEmail.trim() || !isOwner) return;
    await inviteByEmail(currentProjectId, inviteEmail.trim(), role);
    setInviteEmail('');
  };

  const handlePublishFlow = async () => {
    const failed = publishChecks.filter(item => !item.done);
    if (failed.length > 0) {
      setPublishMessage(`发布前检查未通过：${failed.map(item => item.title).join('、')}`);
      return;
    }
    if (!currentProjectId || !session) return;
    setPublishMessage('');
    if (!isShared) {
      await publishProject(currentProjectId);
    }
    await createInviteLink(currentProjectId, role);
  };

  useEffect(() => {
    setActiveMemberPage(1);
    setPermissionPage(1);
    setEventPage(1);
  }, [currentProjectId]);

  useEffect(() => {
    setActiveMemberPage(page => Math.min(page, Math.max(1, Math.ceil(members.length / PAGE_SIZE))));
    setPermissionPage(page => Math.min(page, Math.max(1, Math.ceil(members.length / PAGE_SIZE))));
  }, [members.length]);

  useEffect(() => {
    setEventPage(page => Math.min(page, Math.max(1, Math.ceil(events.length / PAGE_SIZE))));
  }, [events.length]);

  const flowSteps = [
    { title: '登录 Supabase 账户', done: Boolean(session), detail: session ? user?.email || '已登录' : '先用邮箱登录或注册' },
    { title: '确认 Radmin 邀请入口', done: isLanReady, detail: inviteBase },
    { title: '发布为远程共享项目', done: isShared, detail: isShared ? project?.remoteProjectId || '已发布' : '把当前项目写入 Supabase' },
    { title: '生成邀请链接并同步', done: Boolean(inviteUrl), detail: inviteUrl || '成员打开链接后登录加入项目' },
  ];

  const publishChecks = [
    { title: '已选择项目', done: Boolean(currentProjectId && project), detail: project ? project.name : '请先创建或选择项目', action: () => navigate('/projects') },
    { title: '已登录 Supabase', done: Boolean(session), detail: session ? user?.email || '已登录' : '用于发布远程共享项目', action: () => navigate('/collaboration') },
    { title: '当前用户是所有者', done: isOwner, detail: isOwner ? '具备发布和成员管理权限' : '只有 Owner 可以发布共享项目', action: () => navigate('/collaboration') },
    { title: 'Radmin/LAN 入口有效', done: isLanReady, detail: inviteBase, action: () => navigate('/settings') },
    { title: '已设置备份位置', done: Boolean(backupDirectory), detail: backupDirectory || '发布前建议先配置备份目录或选择文件夹', action: () => navigate('/settings') },
    { title: '同步状态可用', done: syncState.syncStatus !== 'conflict', detail: syncLabels[syncState.syncStatus], action: () => syncNow() },
  ];
  const canPublish = publishChecks.every(item => item.done) && !loading;

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

      <div className="glass rounded-[30px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Rocket size={16} className="text-emerald-300" />
              共享项目发布流程
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-6 text-slate-500">
              Radmin 负责成员进入你的局域网邀请入口，Supabase 负责账户、权限、项目数据和进度同步。按下面四步走，项目共享链路就闭环了。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePublishFlow}
              disabled={!canPublish}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Rocket size={14} />
              发布并生成邀请
            </button>
            <button
              onClick={syncNow}
              disabled={!session || loading}
              className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={14} />
              立即同步
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {flowSteps.map((step, index) => (
            <div key={step.title} className={`rounded-2xl border p-4 ${step.done ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-white/[0.06] bg-white/[0.02]'}`}>
              <div className="mb-3 flex items-center justify-between">
                <span className={`text-[10px] font-semibold ${step.done ? 'text-emerald-300' : 'text-slate-500'}`}>步骤 {index + 1}</span>
                <CheckCircle2 size={15} className={step.done ? 'text-emerald-300' : 'text-slate-600'} />
              </div>
              <p className="text-sm font-semibold text-white">{step.title}</p>
              <p className="mt-2 line-clamp-2 break-all text-xs leading-5 text-slate-500">{step.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-200">发布前检查</p>
            <span className={`rounded-full px-2 py-1 text-[10px] ${canPublish ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200'}`}>
              {canPublish ? '可以发布' : '需要处理'}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {publishChecks.map(check => (
              <button
                key={check.title}
                onClick={check.done ? undefined : check.action}
                className={`rounded-xl border p-3 text-left transition ${check.done ? 'border-emerald-500/15 bg-emerald-500/10' : 'border-amber-500/15 bg-amber-500/10 hover:bg-amber-500/15'}`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white">{check.title}</p>
                  <CheckCircle2 size={13} className={check.done ? 'text-emerald-300' : 'text-amber-300'} />
                </div>
                <p className="line-clamp-2 break-all text-[11px] leading-5 text-slate-500">{check.detail}</p>
              </button>
            ))}
          </div>
          {publishMessage && <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{publishMessage}</p>}
        </div>
        {!isLanReady && (
          <p className="mt-3 rounded-2xl border border-amber-500/15 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
            当前邀请基地址看起来不是局域网/Radmin 地址。建议到“设置 → 局域网访问”点自动检测，把基地址设为你的 Radmin IPv4，例如 http://26.x.x.x:5173。
          </p>
        )}
      </div>

      {session && (
        <div className="glass rounded-[28px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">📊 团队仪表盘</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[11px] text-slate-500">团队成员</p>
              <p className="mt-1 text-2xl font-bold text-sky-300">{members.length}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[11px] text-slate-500">协作事件</p>
              <p className="mt-1 text-2xl font-bold text-amber-300">{events.length}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[11px] text-slate-500">同步状态</p>
              <p className="mt-1 text-lg font-bold text-violet-300">{syncLabels[syncState.syncStatus]}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[11px] text-slate-500">角色</p>
              <p className="mt-1 text-lg font-bold text-emerald-300">{isOwner ? '所有者' : currentRole === 'editor' ? '编辑者' : currentRole === 'viewer' ? '查看者' : '-'}</p>
            </div>
          </div>
          {members.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-400"><Users size={14} /> 成员活跃概览</h4>
              <div className="space-y-2">
                {activeMembers.map(member => (
                  <div key={member.userId} className="flex items-center gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.01] p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sm font-bold text-sky-300">
                      {(member.displayName || member.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{member.displayName || member.email}</p>
                      <p className="text-[10px] text-slate-500">{roleLabels[member.role]}{member.online ? ' · 在线' : ''}</p>
                    </div>
                    {isMe(member) && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">我</span>}
                    <span className={`h-2 w-2 rounded-full ${member.online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  </div>
                ))}
              </div>
              <PaginationControls page={activeMemberPage} total={members.length} onPageChange={setActiveMemberPage} />
            </div>
          )}
        </div>
      )}

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
            <>
            <div className="space-y-3">
              {permissionMembers.map(member => {
                const me = isMe(member);
                const cantModify = !isOwner || member.role === 'owner';
                return (
                <div key={member.id ?? member.userId} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${me ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/[0.05] bg-white/[0.02]'}`}>
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-white">
                      {member.displayName || member.email || member.userId}
                      {me && <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">我</span>}
                      {member.role === 'owner' && <Crown size={12} className="text-amber-400" />}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{member.online ? '在线' : `最后在线 ${member.lastSeenAt ? new Date(member.lastSeenAt).toLocaleString('zh-CN') : '未知'}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      disabled={cantModify || me}
                      value={member.role}
                      onChange={event => member.id && updateMemberRole(member.id, event.target.value as TeamRole)}
                      className="custom-select rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    {isOwner && !me && member.role !== 'owner' && (
                      <button
                        onClick={() => member.id && transferOwnership(currentProjectId!, member.id)}
                        className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-2 py-2 text-xs text-amber-300 hover:bg-amber-500/20"
                        title="转让所有权"
                      >
                        <Crown size={12} />
                      </button>
                    )}
                    {removeConfirm === member.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { member.id && removeMember(member.id); setRemoveConfirm(null); }} className="rounded-xl bg-red-500 px-2 py-2 text-xs font-medium text-white hover:bg-red-600">确认</button>
                        <button onClick={() => setRemoveConfirm(null)} className="rounded-xl border border-white/[0.06] px-2 py-2 text-xs text-slate-300 hover:bg-white/[0.04]">取消</button>
                      </div>
                    ) : (
                      <button
                        disabled={cantModify}
                        onClick={() => member.id && setRemoveConfirm(member.id)}
                        className="rounded-xl px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >移除</button>
                    )}
                  </div>
                </div>
              )})}
            </div>
            <PaginationControls page={permissionPage} total={members.length} onPageChange={setPermissionPage} />
            </>
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
              {pagedEvents.map(event => (
                <div key={event.id} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{event.title}</p>
                    <span className="text-[10px] text-slate-500">{new Date(event.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{event.description}</p>
                </div>
              ))}
              <PaginationControls page={eventPage} total={events.length} onPageChange={setEventPage} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
