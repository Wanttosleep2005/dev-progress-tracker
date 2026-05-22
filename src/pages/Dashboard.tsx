import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTaskStore } from '../stores/useTaskStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useTimelineStore } from '../stores/useTimelineStore';
import { useDiaryStore } from '../stores/useDiaryStore';
import { useAppStore } from '../stores/useAppStore';
import { STATUS_LABELS, STATUS_COLORS, EVENT_TYPE_LABELS } from '../types';
import type { TaskStatus } from '../types';
import {
  CheckCircle2, Clock, AlertTriangle, Target,
  GitBranch, BookOpen, Sparkles, TrendingUp, Trophy,
} from 'lucide-react';

const statusOrder: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

export default function Dashboard() {
  const { projectId: pid } = useParams();
  const projectId = parseInt(pid!);
  const navigate = useNavigate();
  const tasks = useTaskStore(s => s.tasks);
  const milestones = useMilestoneStore(s => s.milestones);
  const events = useTimelineStore(s => s.events);
  const diaryCount = useDiaryStore(s => s.entries.length);
  const { projects, achievements } = useAppStore();
  const project = projects.find(p => p.id === projectId);
  const unlockedAchievements = achievements.filter(a => a.unlockedAt);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const blocked = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    const statusCounts = statusOrder.map(s => ({
      status: s, count: tasks.filter(t => t.status === s).length,
      label: STATUS_LABELS[s], color: STATUS_COLORS[s],
    }));
    return { total, done, inProgress, blocked, progress, statusCounts };
  }, [tasks]);

  const activeMilestones = useMemo(
    () => milestones.filter(m => m.status === 'active' || m.status === 'upcoming').slice(0, 3),
    [milestones]
  );
  const recentEvents = useMemo(() => events.slice(0, 5), [events]);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-7xl mx-auto space-y-8">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {project?.icon} {project?.name}
          </h2>
          <p className="text-slate-400 text-sm mt-1">项目概览</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <TrendingUp size={16} className="text-indigo-400" />
          <span className="text-sm text-indigo-400 font-medium">{stats.progress}% 完成</span>
        </div>
      </motion.div>

      {/* Achievements toast */}
      {unlockedAchievements.length > 0 && (
        <motion.div variants={item} className="flex gap-2 overflow-x-auto pb-1">
          {unlockedAchievements.slice(-3).map(a => (
            <div key={a.key} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/15 shrink-0">
              <span>{a.icon}</span>
              <span className="text-xs text-amber-400 font-medium">{a.title}</span>
            </div>
          ))}
        </motion.div>
      )}

      <motion.div variants={item} className="grid grid-cols-4 gap-4">
        {[
          { icon: CheckCircle2, label: '已完成', value: stats.done, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
          { icon: Clock, label: '进行中', value: stats.inProgress, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { icon: AlertTriangle, label: '紧急项', value: stats.blocked, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
          { icon: Target, label: '总任务', value: stats.total, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
        ].map((stat) => (
          <motion.div key={stat.label} whileHover={{ scale: 1.02, y: -2 }} className={`glass p-5 ${stat.bg} ${stat.border} cursor-pointer`} onClick={() => navigate(`/project/${projectId}/tasks`)}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{stat.label}</span>
              <stat.icon size={18} className={stat.color} />
            </div>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-3 gap-6">
        <motion.div variants={item} className="glass p-6 col-span-1">
          <h3 className="text-sm font-semibold text-slate-300 mb-6 flex items-center gap-2"><Sparkles size={16} className="text-indigo-400" />任务进度</h3>
          <div className="flex justify-center mb-6">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                <circle cx="64" cy="64" r="56" fill="none" stroke="url(#gradient)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(stats.progress / 100) * 352} 352`} />
                <defs><linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a855f7" /></linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold text-white">{stats.progress}%</span><span className="text-[10px] text-slate-500">完成率</span></div>
            </div>
          </div>
          <div className="space-y-3">
            {stats.statusCounts.map(sc => (
              <div key={sc.status} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.color }} />
                <span className="text-xs text-slate-400 w-14">{sc.label}</span>
                <div className="flex-1 h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: stats.total > 0 ? `${(sc.count / stats.total) * 100}%` : '0%', backgroundColor: sc.color }} />
                </div>
                <span className="text-xs text-slate-500 w-6 text-right">{sc.count}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item} className="glass p-6 col-span-1">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><Target size={16} className="text-amber-400" />活跃里程碑</h3>
          {activeMilestones.length === 0 ? (
            <div className="text-center py-8"><Target size={32} className="mx-auto text-slate-600 mb-2" /><p className="text-slate-500 text-sm">暂无活跃里程碑</p></div>
          ) : (
            <div className="space-y-4">
              {activeMilestones.map(m => (
                <div key={m.id} className="group cursor-pointer" onClick={() => navigate(`/project/${projectId}/milestones`)}>
                  <div className="flex items-center justify-between mb-1.5"><span className="text-sm text-slate-300 group-hover:text-white transition-colors">{m.title}</span><span className="text-xs text-slate-500">{m.progress}%</span></div>
                  <div className="w-full h-1.5 bg-white/[0.03] rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-700" style={{ width: `${m.progress}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={item} className="glass p-6 col-span-1">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><GitBranch size={16} className="text-emerald-400" />最近动态</h3>
          {recentEvents.length === 0 ? (
            <div className="text-center py-8"><GitBranch size={32} className="mx-auto text-slate-600 mb-2" /><p className="text-slate-500 text-sm">暂无事件记录</p></div>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 group cursor-pointer" onClick={() => navigate(`/project/${projectId}/timeline`)}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-indigo-400/60 group-hover:bg-indigo-400 transition-colors" />
                  <div className="min-w-0"><p className="text-sm text-slate-300 truncate group-hover:text-white transition-colors">{ev.title}</p><p className="text-[11px] text-slate-600 mt-0.5">{EVENT_TYPE_LABELS[ev.type]} · {new Date(ev.date).toLocaleDateString('zh-CN')}</p></div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <motion.div variants={item} className="grid grid-cols-3 gap-4">
        <div className="glass p-4 flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/project/${projectId}/diary`)}>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center"><BookOpen size={20} className="text-purple-400" /></div>
          <div><p className="text-xs text-slate-500">开发日记</p><p className="text-lg font-bold text-white">{diaryCount} <span className="text-sm font-normal text-slate-500">篇</span></p></div>
        </div>
        <div className="glass p-4 flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/project/${projectId}/milestones`)}>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center"><Target size={20} className="text-cyan-400" /></div>
          <div><p className="text-xs text-slate-500">里程碑</p><p className="text-lg font-bold text-white">{milestones.length} <span className="text-sm font-normal text-slate-500">个</span></p></div>
        </div>
        <div className="glass p-4 flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/project/${projectId}/analytics`)}>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Trophy size={20} className="text-amber-400" /></div>
          <div><p className="text-xs text-slate-500">成就</p><p className="text-lg font-bold text-white">{unlockedAchievements.length} <span className="text-sm font-normal text-slate-500">/ {achievements.length}</span></p></div>
        </div>
      </motion.div>
    </motion.div>
  );
}
