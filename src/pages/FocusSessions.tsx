import { motion } from 'framer-motion';
import { Link2, TimerReset, Trash2 } from 'lucide-react';
import { useStatsStore } from '../stores/useStatsStore';
import { formatDateTime, formatDurationFromSeconds } from '../lib/duration';

export default function FocusSessions() {
  const sessions = useStatsStore(state => state.sessions);
  const removeSession = useStatsStore(state => state.removeSession);

  const orderedSessions = [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">专注记录</h2>
          <p className="mt-1 text-sm text-slate-400">查看所有专注记录，区分绑定任务与自定义主题，也可以按需删除误记数据。</p>
        </div>
        <div className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-200">
          记录将同步影响工时对比、周报与数据分析
        </div>
      </div>

      {orderedSessions.length === 0 ? (
        <div className="glass rounded-[28px] p-10 text-center text-slate-500">当前还没有专注记录，开始一次专注后这里会自动出现。</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {orderedSessions.map(session => (
            <div key={session.id} className="glass rounded-[28px] p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">{session.taskTitle || '未命名专注主题'}</h3>
                  <p className="mt-1 text-xs text-slate-500">记录时间：{formatDateTime(session.createdAt)}</p>
                </div>
                <button
                  onClick={() => removeSession(session.id)}
                  className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
                  aria-label="删除专注记录"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                    <TimerReset size={12} />
                    专注时长
                  </div>
                  <p className="text-sm font-medium text-white">{formatDurationFromSeconds(session.seconds, { allowZero: true })}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                    <Link2 size={12} />
                    任务绑定
                  </div>
                  <p className="text-sm font-medium text-white">{session.taskId ? `已绑定任务 #${session.taskId}` : '自定义主题'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
