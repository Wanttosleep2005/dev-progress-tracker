import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRoundCheck,
  Users,
  Wand2,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useCloudStore } from '../../stores/useCloudStore';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { getBackupDirectoryLabel } from '../../lib/backup';
import { getCustomBaseUrl } from '../../lib/cloudSync';
import {
  buildSyncDiagnostics,
  clearOrphanSyncChanges,
  downloadDiagnosticsReport,
  type SyncDiagnosticsReport,
} from '../../lib/syncDiagnostics';

const MEMBER_PAGE_SIZE = 5;

function statusTone(status: 'ok' | 'warn' | 'fail') {
  if (status === 'ok') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
  if (status === 'warn') return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
  return 'border-rose-500/20 bg-rose-500/10 text-rose-200';
}

function Pager({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / MEMBER_PAGE_SIZE));
  if (total <= MEMBER_PAGE_SIZE) return null;

  return (
    <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
      <span>第 {page} / {pageCount} 页 · 共 {total} 人</span>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-white/[0.06] px-3 py-1 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
        >
          上一页
        </button>
        <button
          onClick={() => onChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          className="rounded-lg border border-white/[0.06] px-3 py-1 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

export default function OwnerControlCenter({ isOwner }: { isOwner: boolean }) {
  const navigate = useNavigate();
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const project = useAppStore(state => state.projects.find(item => item.id === currentProjectId));
  const session = useCloudStore(state => state.session);
  const user = useCloudStore(state => state.user);
  const members = useCloudStore(state => state.members);
  const syncState = useCloudStore(state => state.syncState);
  const syncError = useCloudStore(state => state.error);
  const getRole = useCloudStore(state => state.getRole);
  const syncNow = useCloudStore(state => state.syncNow);
  const notificationSettings = useNotificationStore(state => state.settings);
  const [report, setReport] = useState<SyncDiagnosticsReport | null>(null);
  const [message, setMessage] = useState('');
  const [memberPage, setMemberPage] = useState(1);

  const role = useMemo(() => getRole(currentProjectId), [currentProjectId, getRole, members]);
  const inviteBase = getCustomBaseUrl() || window.location.origin;
  const backupDirectory = getBackupDirectoryLabel();
  const pagedMembers = members.slice((memberPage - 1) * MEMBER_PAGE_SIZE, memberPage * MEMBER_PAGE_SIZE);

  const setupSteps = [
    {
      label: '选择当前项目',
      done: Boolean(project),
      detail: project ? `${project.icon} ${project.name}` : '先创建或选择一个项目',
      action: () => navigate('/projects'),
    },
    {
      label: '登录 Supabase',
      done: Boolean(session),
      detail: session ? user?.email || '已登录' : '用于团队账户、成员权限和云同步',
      action: () => navigate('/collaboration'),
    },
    {
      label: '设置 Radmin/LAN 邀请入口',
      done: /\/\/(26\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(inviteBase),
      detail: inviteBase,
      action: () => navigate('/settings'),
    },
    {
      label: '选择备份文件夹',
      done: Boolean(backupDirectory),
      detail: backupDirectory || '发布共享项目或执行 AI 前建议先配置',
      action: () => navigate('/settings'),
    },
    {
      label: '启用浏览器通知',
      done: notificationSettings.permission === 'granted' && notificationSettings.enabled,
      detail: notificationSettings.permission === 'granted' ? '通知已授权' : '用于任务到期和番茄钟提醒',
      action: () => navigate('/settings'),
    },
  ];

  const auditItems = [
    { label: '任务创建 / 编辑 / 删除', status: 'ok' as const, detail: 'useTaskStore 已按 Owner/Editor 拦截，Viewer 只读' },
    { label: '里程碑创建 / 修改 / 删除', status: 'ok' as const, detail: 'useMilestoneStore 已限制为 Owner' },
    { label: '日记与时间线', status: 'ok' as const, detail: 'useDiaryStore / useTimelineStore 已按可编辑权限拦截' },
    { label: '任务依赖与看板拖拽', status: 'ok' as const, detail: '依赖连线和看板变更最终进入任务 store 权限校验' },
    { label: '冲刺与评论', status: 'ok' as const, detail: '已补充共享项目编辑权限校验' },
    { label: '项目删除', status: 'ok' as const, detail: '共享项目删除已限制为 Owner' },
    { label: 'AI 指令与快速创建', status: 'ok' as const, detail: '执行路径进入任务/里程碑/日记/时间线 store，沿用权限拦截' },
    { label: '诊断权限模型', status: 'ok' as const, detail: '成员可看本机同步诊断；Owner 额外查看团队成员身份、角色和最后活跃信息' },
  ];

  const refreshDiagnostics = async () => {
    const next = await buildSyncDiagnostics({
      session,
      user,
      currentProjectId,
      syncState,
      lastError: syncError,
      role,
    });
    setReport(next);
  };

  useEffect(() => {
    refreshDiagnostics().catch(() => undefined);
  }, [session, user, currentProjectId, syncState.lastSyncedAt, syncState.pendingChanges, syncError, role]);

  useEffect(() => {
    setMemberPage(page => Math.min(page, Math.max(1, Math.ceil(members.length / MEMBER_PAGE_SIZE))));
  }, [members.length]);

  const diagnosticCards: Array<[string, string]> = report ? [
    ['当前登录用户 ID', report.currentUserId || '-'],
    ['Supabase JWT sub', report.jwtSub || '-'],
    ['本地用户 ID', report.localUserId || '-'],
    ['当前项目 remoteProjectId', report.remoteProjectId || '-'],
    ['本机待同步队列数量', String(report.pendingChanges)],
    ['本机冲突记录数量', String(report.conflictChanges)],
    ['最近一次同步错误', report.lastSyncError || '暂无'],
    ['最后同步时间', report.lastSyncedAt ? new Date(report.lastSyncedAt).toLocaleString('zh-CN') : '尚未同步'],
  ] : [];

  return (
    <div className="space-y-5">
      {!isOwner && (
        <div className="glass rounded-[28px] border border-cyan-500/15 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <Stethoscope size={16} className="text-cyan-300" />
            个人同步诊断
          </h3>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            这里显示的是你当前浏览器和当前账号的同步状态。团队级成员身份、权限审计和首次配置向导只对项目 Owner 开放。
          </p>
        </div>
      )}

      {isOwner && (
        <div className="glass rounded-[30px] p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Wand2 size={16} className="text-violet-300" />
                Owner 首次配置向导
              </h3>
              <p className="mt-1 text-xs leading-6 text-slate-500">只给项目所有者看，用来把本地项目、Radmin 入口、Supabase 同步和备份策略一次性接顺。</p>
            </div>
            <button onClick={() => navigate('/settings')} className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/20">
              打开设置
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            {setupSteps.map((step, index) => (
              <button key={step.label} onClick={step.action} className={`rounded-2xl border p-4 text-left transition hover:bg-white/[0.04] ${step.done ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className={`text-[10px] font-semibold ${step.done ? 'text-emerald-300' : 'text-slate-500'}`}>配置 {index + 1}</span>
                  <CheckCircle2 size={15} className={step.done ? 'text-emerald-300' : 'text-slate-600'} />
                </div>
                <p className="text-sm font-semibold text-white">{step.label}</p>
                <p className="mt-2 line-clamp-2 break-all text-xs leading-5 text-slate-500">{step.detail}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`grid gap-5 ${isOwner ? 'xl:grid-cols-[0.9fr_1.1fr]' : ''}`}>
        {isOwner && (
          <div className="glass rounded-[30px] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <ShieldCheck size={16} className="text-emerald-300" />
              权限落地审计
            </h3>
            <div className="space-y-3">
              {auditItems.map(item => (
                <div key={item.label} className={`rounded-2xl border p-3 ${statusTone(item.status)}`}>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <ClipboardCheck size={14} />
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 opacity-80">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass rounded-[30px] p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Stethoscope size={16} className="text-cyan-300" />
                同步诊断中心
              </h3>
              <p className="mt-1 text-xs text-slate-500">待同步和冲突数量来自当前浏览器本机队列，成员之间互不读取本地 IndexedDB。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  await syncNow();
                  await refreshDiagnostics();
                  setMessage('已重试同步并刷新诊断');
                }}
                className="flex items-center gap-1 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/20"
              >
                <RefreshCw size={13} />
                重试同步
              </button>
              <button
                onClick={async () => {
                  const count = await clearOrphanSyncChanges();
                  await refreshDiagnostics();
                  setMessage(`已清理 ${count} 条孤儿队列`);
                }}
                className="flex items-center gap-1 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/20"
              >
                <Trash2 size={13} />
                清理孤儿队列
              </button>
              <button
                onClick={() => report && downloadDiagnosticsReport(report)}
                disabled={!report}
                className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06] disabled:opacity-40"
              >
                <Download size={13} />
                导出诊断
              </button>
            </div>
          </div>
          {message && <div className="mb-3 rounded-2xl border border-cyan-500/15 bg-cyan-500/10 p-2 text-center text-xs text-cyan-200">{message}</div>}
          {report ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {diagnosticCards.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[10px] text-slate-500">{label}</p>
                    <p className="mt-1 break-all text-xs font-medium text-slate-200">{value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {report.checks.map(check => (
                  <div key={check.key} className={`rounded-2xl border p-3 ${statusTone(check.status)}`}>
                    <p className="text-xs font-semibold">{check.label}</p>
                    <p className="mt-1 break-all text-[11px] leading-5 opacity-80">{check.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-slate-500">正在生成诊断信息...</div>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="glass rounded-[30px] p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Users size={16} className="text-sky-300" />
                团队成员诊断
              </h3>
              <p className="mt-1 text-xs text-slate-500">Owner 可查看成员用户 ID、邮箱、角色和最后活跃；每个人的本机待同步队列需要成员在自己的诊断中心查看。</p>
            </div>
            <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-xs text-slate-400">共 {members.length} 人</span>
          </div>
          {members.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-slate-500">当前项目还没有团队成员记录。</div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {pagedMembers.map(member => (
                  <div key={member.id ?? member.userId} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
                        <UserRoundCheck size={15} className="shrink-0 text-sky-300" />
                        <span className="truncate">{member.displayName || member.email || member.userId}</span>
                      </p>
                      <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300">{member.role}</span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-500">
                      <p className="break-all">用户 ID：<span className="text-slate-300">{member.userId}</span></p>
                      <p className="break-all">邮箱：<span className="text-slate-300">{member.email || '-'}</span></p>
                      <p>在线状态：<span className={member.online ? 'text-emerald-300' : 'text-slate-300'}>{member.online ? '在线' : '离线'}</span></p>
                      <p>最后活跃：<span className="text-slate-300">{member.lastSeenAt ? new Date(member.lastSeenAt).toLocaleString('zh-CN') : '未知'}</span></p>
                    </div>
                  </div>
                ))}
              </div>
              <Pager page={memberPage} total={members.length} onChange={setMemberPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
