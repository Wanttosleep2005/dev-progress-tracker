import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotificationCenterStore } from '../stores/useNotificationCenterStore';

const typeIcons: Record<string, string> = {
  task_due: '⏰',
  task_overdue: '🔴',
  member_joined: '👋',
  member_role: '🔄',
  milestone_done: '🎯',
  project_shared: '📦',
  comment: '💬',
};

export default function NotificationBell() {
  const { notifications, unreadCount, open, load, toggle, close, markRead, markAllRead, clearAll } = useNotificationCenterStore();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [close]);

  const handleClick = (notification: typeof notifications[number]) => {
    if (notification.id) markRead(notification.id);
    if (notification.targetUrl) navigate(notification.targetUrl);
    close();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-white/[0.08] bg-[#0f172a] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h3 className="text-sm font-semibold text-white">通知中心</h3>
              <div className="flex items-center gap-1">
                <button onClick={markAllRead} className="rounded-lg p-1.5 text-xs text-slate-400 hover:bg-white/[0.06] hover:text-white" title="全部已读">
                  <CheckCheck size={14} />
                </button>
                <button onClick={clearAll} className="rounded-lg p-1.5 text-xs text-slate-400 hover:bg-red-500/10 hover:text-red-400" title="清空全部">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-slate-500">暂无通知</p>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-3 border-b border-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.04] ${!n.read ? 'bg-cyan-500/[0.04]' : ''}`}
                  >
                    <span className="mt-0.5 text-base">{typeIcons[n.type] ?? '📌'}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs ${n.read ? 'text-slate-400' : 'font-medium text-white'}`}>{n.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{n.description}</p>
                      <p className="mt-1 text-[10px] text-slate-600">{new Date(n.createdAt).toLocaleString('zh-CN')}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
