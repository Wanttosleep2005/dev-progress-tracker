import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cloud, LogIn, ShieldAlert, UserCircle, UserPlus } from 'lucide-react';
import { useCloudStore } from '../stores/useCloudStore';
import { usePreferences } from '../stores/usePreferences';
import { useToast } from '../stores/useToast';

function mapAuthError(mode: 'login' | 'register', raw: string) {
  const message = raw.toLowerCase();
  if (mode === 'login' && (message.includes('invalid') || message.includes('credentials'))) return '密码错误，请重试';
  if (mode === 'login' && (message.includes('not found') || message.includes('not exist') || message.includes('user not'))) return '该邮箱未注册，请先创建账号';
  if (mode === 'register' && (message.includes('already') || message.includes('registered') || message.includes('exists'))) return '该邮箱已注册，请直接登录';
  return raw || '操作失败，请稍后重试';
}

export default function Account() {
  const { session, user, signIn, signUp, signOut, deleteAccount, loading } = useCloudStore();
  const { collaborationMode, setCollaborationMode } = usePreferences();
  const addToast = useToast(state => state.add);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码。');
      return;
    }
    setError('');
    const switchedFromLocal = collaborationMode === 'local';
    if (switchedFromLocal) {
      // Account login is the explicit bridge from single-user mode back to cloud collaboration.
      setCollaborationMode('cloud');
      addToast('已切换到云协作模式', 'success');
    }
    try {
      if (mode === 'register') {
        await signUp(email.trim(), password.trim(), displayName.trim() || email.trim().split('@')[0], `${window.location.origin}/account`);
      } else {
        await signIn(email.trim(), password.trim());
      }
      addToast(mode === 'register' ? '注册成功，已登录' : '登录成功', 'success');
    } catch (err) {
      setError(mapAuthError(mode, err instanceof Error ? err.message : '操作失败'));
    }
  };

  const handleDeleteAccount = async () => {
    if (!session?.user.email) return;
    const confirmed = window.confirm('确定注销当前云端账户身份吗？这会清理云端业务身份并退出登录，本地任务不会被清空。');
    if (!confirmed) return;
    const typed = window.prompt(`请输入当前邮箱确认：${session.user.email}`);
    if (typed !== session.user.email) {
      setError('邮箱确认不一致，已取消注销。');
      return;
    }
    setDeleting(true);
    setError('');
    try {
      const result = await deleteAccount();
      const authText = result.authDeletion === 'deleted'
        ? 'Supabase Auth 账户已删除，该邮箱可重新注册。'
        : result.authDeletion === 'not_configured'
          ? '业务数据已清理；Auth 账户仍需在 Supabase 后台或 Edge Function 中删除。'
          : `业务数据已清理；Auth 删除失败：${result.authDeletionMessage || '未知错误'}`;
      addToast(`云端账户注销完成。${authText}`, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注销云端账户失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl space-y-5 py-8">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
          <UserCircle size={24} className="text-cyan-300" />
          账户
        </h2>
        <p className="mt-1 text-sm text-slate-500">管理 Supabase 登录状态；单人模式下也可以在这里登录并切换到云协作。</p>
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {session ? (
        <div className="glass rounded-[30px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Cloud size={16} className="text-cyan-300" />
            当前账号
          </h3>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-sm font-semibold text-white">{user?.displayName || session.user.displayName}</p>
            <p className="mt-1 text-xs text-slate-500">{user?.email || session.user.email}</p>
            <p className="mt-2 text-[10px] text-slate-600">用户 ID：{user?.id || session.user.id}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={signOut} className="rounded-xl border border-white/[0.06] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.04]">
              登出
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting || loading}
              className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
            >
              <ShieldAlert size={14} />
              {deleting ? '注销中...' : '注销云端账户身份'}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass rounded-[30px] p-5">
          <div className="mb-4 flex gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1">
            <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${mode === 'login' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-300'}`}>
              登录
            </button>
            <button onClick={() => { setMode('register'); setError(''); }} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${mode === 'register' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-300'}`}>
              注册
            </button>
          </div>
          <div className="space-y-3">
            {mode === 'register' && (
              <input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="显示名称（可选）" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none" />
            )}
            <input value={email} onChange={event => setEmail(event.target.value)} placeholder="邮箱" type="email" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none" />
            <input value={password} onChange={event => setPassword(event.target.value)} placeholder="密码" type="password" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none" />
            <button onClick={handleAuth} disabled={loading} className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50">
              {mode === 'register' ? <UserPlus size={16} /> : <LogIn size={16} />}
              {mode === 'register' ? '注册账号' : '登录'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
