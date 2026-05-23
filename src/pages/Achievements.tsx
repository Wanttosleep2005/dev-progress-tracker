import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Lock } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { ACHIEVEMENTS, ACHIEVEMENT_LEVEL_LABELS, ACHIEVEMENT_LEVEL_COLORS } from '../types';
import type { AchievementLevel } from '../types';

export default function Achievements() {
  const { achievements } = useAppStore();
  const unlocked = achievements.filter(a => a.unlockedAt);

  const levelStats = useMemo(() => {
    return (['bronze', 'silver', 'gold'] as AchievementLevel[]).map(level => {
      const total = ACHIEVEMENTS.filter(a => a.level === level).length;
      const unlockedCount = unlocked.filter(a => a.level === level).length;
      return { level, total, unlockedCount, progress: Math.round((unlockedCount / total) * 100) };
    });
  }, [unlocked]);

  const totalProgress = Math.round((unlocked.length / ACHIEVEMENTS.length) * 100);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            <Trophy className="text-amber-400" size={26} />
            成就系统
          </h2>
          <p className="mt-1 text-sm text-slate-400">追踪开发旅程中的里程碑成就，铜银金三级逐步解锁。</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <span className="text-sm font-medium text-amber-200">总进度 {unlocked.length} / {ACHIEVEMENTS.length}</span>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="glass rounded-[30px] p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">全局进度</span>
          <span className="text-2xl font-bold text-amber-300">{totalProgress}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/[0.04]">
          <motion.div initial={{ width: 0 }} animate={{ width: `${totalProgress}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
        </div>
      </div>

      {/* Level progress bars */}
      <div className="grid gap-4 md:grid-cols-3">
        {levelStats.map(({ level, total, unlockedCount, progress }) => (
          <div key={level} className="glass rounded-[24px] p-4" style={{ borderColor: `${ACHIEVEMENT_LEVEL_COLORS[level]}20` }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: ACHIEVEMENT_LEVEL_COLORS[level] }}>{ACHIEVEMENT_LEVEL_LABELS[level]}</span>
              <span className="text-xs text-slate-400">{unlockedCount}/{total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
              <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }} className="h-full rounded-full" style={{ backgroundColor: ACHIEVEMENT_LEVEL_COLORS[level] }} />
            </div>
          </div>
        ))}
      </div>

      {/* Achievement grid by level */}
      {(['bronze', 'silver', 'gold'] as AchievementLevel[]).map(level => {
        const levelAchievements = ACHIEVEMENTS.filter(a => a.level === level);
        return (
          <div key={level} className="glass rounded-[30px] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold" style={{ color: ACHIEVEMENT_LEVEL_COLORS[level] }}>
              {ACHIEVEMENT_LEVEL_LABELS[level]}
              <span className="text-xs text-slate-500">{levelAchievements.length} 个成就</span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {levelAchievements.map(achievement => {
                const isUnlocked = achievements.find(a => a.key === achievement.key)?.unlockedAt;
                return (
                  <div
                    key={achievement.key}
                    className={`rounded-2xl border p-4 transition ${isUnlocked ? 'bg-white/[0.02]' : 'bg-white/[0.01] opacity-50'}`}
                    style={{ borderColor: isUnlocked ? `${ACHIEVEMENT_LEVEL_COLORS[level]}30` : 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="text-2xl">{isUnlocked ? achievement.icon : <Lock size={16} className="text-slate-600" />}</span>
                      {isUnlocked && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">已解锁</span>}
                    </div>
                    <p className={`text-sm font-medium ${isUnlocked ? 'text-white' : 'text-slate-500'}`}>{achievement.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{achievement.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
