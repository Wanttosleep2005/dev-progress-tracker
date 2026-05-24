import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cloud, LogIn, UserPlus } from 'lucide-react';
import { useCloudStore } from '../stores/useCloudStore';
import { usePreferences } from '../stores/usePreferences';
import { parseRemoteInvite } from '../lib/cloudSync';
import type { TeamRole } from '../types';

interface InvitePayload {
  remoteProjectId?: string;
  projectId?: number;
  role?: TeamRole;
  createdAt?: number;
}

function decodeInvite(token?: string): InvitePayload | null {
  if (!token) return null;
  return parseRemoteInvite(token);
}

function authMessage(mode: 'login' | 'register', message: string) {
  // Keep invite auth errors concrete so members know whether to retry or register.
  if (mode === 'login' && /invalid|credentials|password|400/i.test(message)) return '密码不正确，请重试';
  if (mode === 'login' && /not found|not exist|user not/i.test(message)) return '该邮箱未注册，请先创建账号';
  if (mode === 'register' && /already|registered|exists|422/i.test(message)) return '该邮箱已注册，请直接登录';
  if (mode === 'login' && /invalid|credentials|not found|not exist|400/i.test(message)) {
    return '账号不存在或密码不正确，请先确认邮箱；如果还没注册，请先创建账号。';
  }
  if (mode === 'register' && /already|registered|exists|422/i.test(message)) {
    return '账号已存在，请直接登录。';
  }
  return message;
}

const roleLabels: Record<TeamRole, string> = {
  owner: '所有者',
  editor: '编辑者',
  viewer: '查看者',
};

export default function Invite() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invite = useMemo(() => decodeInvite(token), [token]);
  const { session, signIn, signUp, joinProject, loading, error } = useCloudStore();
  const { collaborationMode, setCollaborationMode } = usePreferences();
  const isUnifiedJoin = (!token || searchParams.get('mode') === 'join') && !invite?.remoteProjectId;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [manualInvite, setManualInvite] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!invite?.remoteProjectId || !token) return;
    localStorage.setItem('devtrack-pending-invite-token', token);
    if (collaborationMode === 'local') {
      setCollaborationMode('cloud');
      setNotice('已为邀请链接切换到云协作模式，请继续注册或登录后加入项目。');
    }
  }, [collaborationMode, invite?.remoteProjectId, setCollaborationMode, token]);

  const handleJoin = async () => {
    const payload = invite?.remoteProjectId ? invite : parseRemoteInvite(manualInvite);
    if (!payload?.remoteProjectId || !payload.role) {
      setAuthError('请输入完整的项目邀请链接。');
      return;
    }
    setAuthError('');
    try {
      await joinProject(payload.remoteProjectId, payload.role);
      localStorage.removeItem('devtrack-pending-invite-token');
      navigate('/');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '加入项目失败，请稍后重试。');
    }
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError('请填写邮箱和密码。');
      return;
    }
    setAuthError('');
    setNotice('');
    try {
      if (collaborationMode === 'local') setCollaborationMode('cloud');
      if (mode === 'register') {
        await signUp(email.trim(), password.trim(), displayName.trim() || email.trim().split('@')[0], window.location.href);
      } else {
        await signIn(email.trim(), password.trim());
      }
      // Token invite auto-joins; the unified team URL only authenticates first.
      if (invite?.remoteProjectId && invite.role) {
        await joinProject(invite.remoteProjectId, invite.role);
        localStorage.removeItem('devtrack-pending-invite-token');
      } else if (isUnifiedJoin) {
        // Unified entry authenticates first; keep members here so they can paste the project invite.
        setNotice('已登录，请粘贴项目邀请链接加入共享项目。');
        return;
      }
      navigate('/');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '操作失败';
      const message = authMessage(mode, raw);
      if (mode === 'register' && message.includes('验证')) {
        setNotice(`${message} 验证后请回到本邀请链接，切换到“已有账号”登录并加入项目。`);
      } else {
        setAuthError(message);
      }
    }
  };

  const invalidInvite = Boolean(token) && !invite?.remoteProjectId && !isUnifiedJoin;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
      <div className="glass w-full rounded-[32px] p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
          <Cloud size={24} />
        </div>
        <h2 className="text-2xl font-bold text-white">{isUnifiedJoin ? '进入团队协作空间' : '加入共享项目'}</h2>
        {invalidInvite ? (
          <p className="mt-3 text-sm text-slate-400">这个邀请链接不可用，可能已经损坏或来自旧版本本地邀请。</p>
        ) : (
          <div className="mt-5 space-y-4">
            {invite?.remoteProjectId ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left">
                <p className="text-xs text-slate-500">远程项目 ID</p>
                <p className="mt-1 break-all text-sm font-semibold text-white">{invite.remoteProjectId}</p>
                <p className="mt-3 text-xs text-slate-500">加入权限</p>
                <p className="mt-1 text-sm font-semibold text-cyan-200">{roleLabels[invite.role || 'viewer']}</p>
              </div>
            ) : (
              <p className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-100">
                这是团队固定入口。请先注册或登录，进入后可粘贴项目邀请链接加入具体共享项目。
              </p>
            )}

            {error && <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">{error}</p>}
            {authError && <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{authError}</p>}
            {notice && <p className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm leading-6 text-cyan-100">{notice}</p>}

            {session ? (
              <div className="space-y-3">
                {isUnifiedJoin && (
                  <input
                    value={manualInvite}
                    onChange={event => setManualInvite(event.target.value)}
                    placeholder="粘贴项目邀请链接 /invite/..."
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
                  />
                )}
                <button
                  onClick={invite?.remoteProjectId ? handleJoin : () => navigate('/')}
                  disabled={loading}
                  className="mx-auto flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
                >
                  <UserPlus size={16} />
                  {invite?.remoteProjectId ? '确认加入项目' : '进入系统'}
                </button>
                {isUnifiedJoin && (
                  <button
                    onClick={handleJoin}
                    disabled={loading || !manualInvite.trim()}
                    className="mx-auto flex items-center gap-2 rounded-2xl border border-white/[0.06] px-5 py-3 text-sm text-slate-200 hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    <UserPlus size={16} />
                    通过邀请链接加入项目
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1">
                  <button onClick={() => { setMode('register'); setAuthError(''); }} className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-medium ${mode === 'register' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-300'}`}>
                    创建账号
                  </button>
                  <button onClick={() => { setMode('login'); setAuthError(''); }} className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-medium ${mode === 'login' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-300'}`}>
                    已有账号
                  </button>
                </div>
                {mode === 'register' && (
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="显示名称（可选）" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none" />
                )}
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="邮箱" type="email" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none" />
                <input value={password} onChange={e => setPassword(e.target.value)} placeholder="密码" type="password" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none" />
                <button onClick={handleAuth} disabled={loading} className="mx-auto flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50">
                  {mode === 'register' ? <UserPlus size={16} /> : <LogIn size={16} />}
                  {mode === 'register' ? '注册账号' : '登录'}
                </button>
                {mode === 'register' && (
                  <p className="text-xs leading-6 text-slate-500">如果 Supabase 开启邮箱确认，系统会发送验证邮件；验证后回到本页面登录即可。</p>
                )}
                <button
                  onClick={() => {
                    // Explicit escape hatch: invitation auth stays locked unless the user chooses local-only mode.
                    setCollaborationMode('local');
                    navigate('/');
                  }}
                  className="fixed bottom-6 right-6 rounded-2xl border border-white/[0.08] bg-[#0b1220]/90 px-4 py-2 text-xs text-slate-300 shadow-2xl backdrop-blur hover:bg-white/[0.06]"
                >
                  单人纯净模式
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
