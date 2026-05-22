import { useMemo } from 'react';
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
  const { session, joinProject, loading, error } = useCloudStore();

  const handleJoin = async () => {
    if (!invite?.remoteProjectId || !invite.role) return;
    await joinProject(invite.remoteProjectId, invite.role);
    navigate('/collaboration');
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
              <Link to="/collaboration" className="mx-auto flex w-fit items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-600">
                <LogIn size={16} />
                先登录账户
              </Link>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
