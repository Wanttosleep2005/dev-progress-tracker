import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cloud, LogIn, UserPlus } from 'lucide-react';
import { useCloudStore } from '../stores/useCloudStore';
import type { TeamRole } from '../types';

interface InvitePayload {
  remoteProjectId?: string;
  projectId?: number;
  role?: TeamRole;
  createdAt?: number;
}

function decodeInvite(token?: string): InvitePayload | null {
  if (!token) return null;
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

const roleLabels: Record<TeamRole, string> = {
  owner: '所有者',
  editor: '编辑者',
  viewer: '查看者',
};

export default function Invite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const invite = useMemo(() => decodeInvite(token), [token]);
  const { session, signIn, signUp, joinProject, loading, error } = useCloudStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [authError, setAuthError] = useState('');

  const handleJoin = async () => {
    if (!invite?.remoteProjectId || !invite.role) return;
    await joinProject(invite.remoteProjectId, invite.role);
    navigate('/collaboration');
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError('请填写邮箱和密码。');
      return;
    }
    setAuthError('');
    try {
      if (mode === 'register') {
        await signUp(email.trim(), password.trim(), displayName.trim() || email.trim().split('@')[0]);
      } else {
        await signIn(email.trim(), password.trim());
      }
      // 注册/登录成功后自动加入项目
      if (invite?.remoteProjectId && invite.role) {
        await joinProject(invite.remoteProjectId, invite.role);
      }
      navigate('/collaboration');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '操作失败');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
      <div className="glass w-full rounded-[32px] p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
          <Cloud size={24} />
        </div>
        <h2 className="text-2xl font-bold text-white">加入共享项目</h2>
        {!invite?.remoteProjectId ? (
          <p className="mt-3 text-sm text-slate-400">这个邀请链接不可用，可能已经损坏或来自旧版本地邀请。</p>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left">
              <p className="text-xs text-slate-500">远程项目 ID</p>
              <p className="mt-1 break-all text-sm font-semibold text-white">{invite.remoteProjectId}</p>
              <p className="mt-3 text-xs text-slate-500">加入权限</p>
              <p className="mt-1 text-sm font-semibold text-cyan-200">{roleLabels[invite.role || 'viewer']}</p>
            </div>
            {error && <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">{error}</p>}
            {authError && <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{authError}</p>}
            {session ? (
              <button
                onClick={handleJoin}
                disabled={loading}
                className="mx-auto flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
              >
                <UserPlus size={16} />
                确认加入项目
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1">
                  <button
                    onClick={() => { setMode('register'); setAuthError(''); }}
                    className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-medium ${mode === 'register' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-300'}`}
                  >
                    创建账号
                  </button>
                  <button
                    onClick={() => { setMode('login'); setAuthError(''); }}
                    className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-medium ${mode === 'login' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-300'}`}
                  >
                    已有账号
                  </button>
                </div>
                {mode === 'register' && (
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="显示名称（可选）"
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
                  />
                )}
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="邮箱"
                  type="email"
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
                />
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="密码"
                  type="password"
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
                />
                <button
                  onClick={handleAuth}
                  disabled={loading}
                  className="mx-auto flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
                >
                  {mode === 'register' ? <UserPlus size={16} /> : <LogIn size={16} />}
                  {mode === 'register' ? '注册并加入项目' : '登录并加入项目'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
