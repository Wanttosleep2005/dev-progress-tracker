import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Clock, Target, TrendingUp } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useDiaryStore } from '../stores/useDiaryStore';
import { useTaskStore } from '../stores/useTaskStore';
import { useTimelineStore } from '../stores/useTimelineStore';
import { getActiveDays, getStreak, getTotalMinutes, useStatsStore } from '../stores/useStatsStore';

export default function PersonalStats() {
  const sessions = useStatsStore(state => state.sessions);
  const tasks = useTaskStore(state => state.tasks);
  const entries = useDiaryStore(state => state.entries);
  const events = useTimelineStore(state => state.events);
  const projects = useAppStore(state => state.projects);

  const stats = useMemo(() => {
    const totalMinutes = getTotalMinutes(sessions);
    const totalHours = Math.round(totalMinutes / 60);
    const activeDays = getActiveDays(sessions);
    const doneTasks = tasks.filter(task => task.status === 'done').length;
    const doneDates = tasks.filter(task => task.status === 'done').map(task => task.updatedAt.split('T')[0]);
    const { longest } = getStreak(sessions, entries.map(entry => entry.date), events.map(event => event.date), doneDates);

    const averageDaily = activeDays > 0 ? `${(totalMinutes / activeDays / 60).toFixed(1)}h` : '0h';
    const weeklyTotals: Record<string, number> = {};
    sessions.forEach(session => {
      const date = new Date(session.date);
      const monday = new Date(date);
      monday.setDate(date.getDate() - date.getDay() + 1);
      const key = monday.toISOString().split('T')[0];
      weeklyTotals[key] = (weeklyTotals[key] || 0) + session.minutes;
    });
    const bestWeekMinutes = Math.max(0, ...Object.values(weeklyTotals));

    return {
      totalHours,
      activeDays,
      doneTasks,
      projectCount: projects.length,
      longest,
      averageDaily,
      bestWeek: bestWeekMinutes > 0 ? `${(bestWeekMinutes / 60).toFixed(1)}h` : '0h',
    };
  }, [sessions, tasks, entries, events, projects]);

  const items = [
    { icon: Clock, label: '累计投入时长', value: `${stats.totalHours}h`, color: 'text-blue-400' },
    { icon: CalendarDays, label: '活跃天数', value: `${stats.activeDays} 天`, color: 'text-emerald-400' },
    { icon: Target, label: '已完成任务', value: `${stats.doneTasks}`, color: 'text-violet-400' },
    { icon: TrendingUp, label: '最长连续记录', value: `${stats.longest} 天`, color: 'text-amber-400' },
  ];

  return (
    <div className="glass rounded-[28px] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
        <Target size={16} className="text-violet-400" />
        个人表现
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(item => (
          <motion.div key={item.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="rounded-xl bg-white/[0.03] p-2.5">
              <item.icon size={18} className={item.color} />
            </div>
            <div>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-[11px] text-slate-500">{item.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
        {[
          { label: '日均投入', value: stats.averageDaily },
          { label: '最佳单周', value: stats.bestWeek },
          { label: '项目总数', value: `${stats.projectCount}` },
        ].map(item => (
          <div key={item.label} className="text-center">
            <p className="text-sm font-semibold text-white">{item.value}</p>
            <p className="mt-1 text-[10px] text-slate-600">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
