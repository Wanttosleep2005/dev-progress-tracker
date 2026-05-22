import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ListChecks, NotebookText, TimerReset } from 'lucide-react';
import { db } from '../db/database';
import { useAppStore } from '../stores/useAppStore';
import { getStreak, getTodayMinutes, useStatsStore } from '../stores/useStatsStore';
import QuickLogModal from './QuickLogModal';

export default function TodayFocus() {
  const [modal, setModal] = useState<'time' | 'task' | 'diary' | null>(null);
  const sessions = useStatsStore(state => state.sessions);
  const projects = useAppStore(state => state.projects);
  const [globalTasks, setGlobalTasks] = useState(0);
  const [globalDiary, setGlobalDiary] = useState(0);

  useEffect(() => {
    const loadTotals = async () => {
      const dateStr = new Date().toISOString().split('T')[0];
      const allTasks = await db.tasks.toArray();
      const allDiary = await db.diaryEntries.where('date').equals(dateStr).toArray();
      setGlobalTasks(allTasks.filter(task => task.status === 'in_progress').length);
      setGlobalDiary(allDiary.length);
    };

    loadTotals();
    const timer = setInterval(loadTotals, 30000);
    return () => clearInterval(timer);
  }, []);

  const today = useMemo(() => {
    const todayMinutes = Math.floor(getTodayMinutes(sessions));
    const hours = Math.floor(todayMinutes / 60);
    const minutes = todayMinutes % 60;
    const { current: streak } = getStreak(sessions, [], [], []);
    return { hours, minutes, streak };
  }, [sessions]);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 6 ? '深夜模式' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const timeDisplay = today.hours > 0 ? `${today.hours}h ${today.minutes}m` : today.minutes > 0 ? `${today.minutes}m` : '--';

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-[28px] p-5 lg:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white lg:text-2xl">
              {greeting} · {now.getMonth() + 1} 月 {now.getDate()} 日 · 星期{weekdays[now.getDay()]}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {today.streak > 0
                ? `连续 ${today.streak} 天保持记录`
                : `${projects.length} 个项目正在推进，今天也继续保持节奏。`}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setModal('time')}
            className="rounded-[24px] border border-cyan-500/12 bg-cyan-500/[0.035] p-6 text-center transition hover:bg-cyan-500/[0.06]"
          >
            <TimerReset size={18} className="mx-auto mb-3 text-cyan-300" />
            <p className="mb-2 text-4xl font-bold text-white">{timeDisplay}</p>
            <p className="text-sm text-slate-400">今日累计专注</p>
            <p className="mt-1 text-[10px] text-slate-600">点击记录耗时或补录专注</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setModal('diary')}
            className="rounded-[24px] border border-violet-500/12 bg-violet-500/[0.035] p-6 text-center transition hover:bg-violet-500/[0.06]"
          >
            <NotebookText size={18} className="mx-auto mb-3 text-violet-300" />
            <p className="mb-2 text-4xl font-bold text-white">{globalDiary}</p>
            <p className="text-sm text-slate-400">今日日志</p>
            <p className="mt-1 text-[10px] text-slate-600">点击写下今天的推进记录</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setModal('task')}
            className="rounded-[24px] border border-amber-500/12 bg-amber-500/[0.035] p-6 text-center transition hover:bg-amber-500/[0.06]"
          >
            <ListChecks size={18} className="mx-auto mb-3 text-amber-300" />
            <p className="mb-2 text-4xl font-bold text-white">{globalTasks}</p>
            <p className="text-sm text-slate-400">进行中任务</p>
            <p className="mt-1 text-[10px] text-slate-600">点击快速新增任务</p>
          </motion.button>
        </div>
      </motion.div>

      <QuickLogModal open={modal !== null} type={modal || 'time'} onClose={() => setModal(null)} />
    </>
  );
}
