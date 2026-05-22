import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Goal, Settings2 } from 'lucide-react';
import { getWeekMinutes, useStatsStore } from '../stores/useStatsStore';

const WEEKLY_TARGET = 40;
const TARGET_STORAGE_KEY = 'devtrack-weekly-focus-target-hours';

export default function WeeklyRhythm() {
  const sessions = useStatsStore(state => state.sessions);
  const [showSettings, setShowSettings] = useState(false);
  const [targetInput, setTargetInput] = useState(() => {
    try {
      return localStorage.getItem(TARGET_STORAGE_KEY) || String(WEEKLY_TARGET);
    } catch {
      return String(WEEKLY_TARGET);
    }
  });
  const weeklyTarget = Math.max(1, Number.parseFloat(targetInput) || WEEKLY_TARGET);

  useEffect(() => {
    localStorage.setItem(TARGET_STORAGE_KEY, targetInput);
  }, [targetInput]);

  const { weekData, weekTotal, weekTotalMinutes, lastWeekTotal, maxMinutes } = useMemo(() => {
    const data = getWeekMinutes(sessions);
    const totalMinutes = data.reduce((sum, item) => sum + item.minutes, 0);
    const weekHours = totalMinutes / 60;

    const allTotal = sessions.reduce((sum, session) => sum + session.minutes, 0);
    const activeWeeks = Math.max(1, Math.ceil(new Set(sessions.map(session => session.date)).size / 7));
    const previousWeekMinutes = Math.round((allTotal - totalMinutes) / Math.max(1, activeWeeks - 1));

    return {
      weekData: data,
      weekTotal: weekHours,
      weekTotalMinutes: Math.floor(totalMinutes),
      lastWeekTotal: Math.round(previousWeekMinutes / 60),
      maxMinutes: Math.max(...data.map(item => item.minutes), 1),
    };
  }, [sessions]);

  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;
  const delta = weekTotal - lastWeekTotal;
  const progress = Math.min(100, Math.round((weekTotal / weeklyTarget) * 100));
  const displayHours = Math.floor(weekTotalMinutes / 60);
  const displayMinutes = weekTotalMinutes % 60;
  const targetLabel = Number.isInteger(weeklyTarget) ? `${weeklyTarget}` : weeklyTarget.toFixed(1);

  return (
    <div className="glass overflow-hidden rounded-[28px] border-cyan-500/10 bg-[linear-gradient(145deg,rgba(14,25,43,0.92),rgba(7,12,23,0.78))] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Activity size={16} className="text-cyan-300" />
            今日节奏
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">本周专注投入与目标进度</p>
        </div>
        <button
          onClick={() => setShowSettings(value => !value)}
          className={`rounded-xl border p-2 transition ${
            showSettings ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300' : 'border-white/[0.06] bg-white/[0.03] text-slate-500 hover:text-slate-200'
          }`}
          aria-label="设置本周目标"
          title="设置本周目标"
        >
          <Settings2 size={15} />
        </button>
      </div>

      {showSettings && (
        <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
          <label className="mb-2 block text-[11px] text-slate-500">本周目标（小时）</label>
          <input
            type="number"
            min="1"
            step="0.5"
            value={targetInput}
            onChange={event => setTargetInput(event.target.value)}
            className="w-full rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
          />
        </div>
      )}

      <div className="mb-5 rounded-3xl border border-white/[0.06] bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-500">本周已专注</p>
            <div className="mt-1 flex items-baseline gap-1 text-white">
              <span className="text-4xl font-bold tracking-tight">{displayHours}</span>
              <span className="text-sm text-cyan-200">h</span>
              <span className="ml-1 text-2xl font-semibold tracking-tight">{String(displayMinutes).padStart(2, '0')}</span>
              <span className="text-sm text-cyan-200">m</span>
            </div>
          </div>
          <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/10 px-3 py-2 text-right">
            <p className="text-lg font-bold text-cyan-200">{progress}%</p>
            <p className="text-[10px] text-cyan-300/70">目标进度</p>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Goal size={12} className="text-cyan-300" />
            目标 {targetLabel}h
          </span>
          <span className={delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {delta >= 0 ? '较上周提升' : '较上周回落'} {Math.abs(delta).toFixed(1)}h
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-black/25 ring-1 ring-white/[0.04]">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 shadow-[0_0_18px_rgba(34,211,238,0.35)]" transition={{ duration: 0.8 }} />
        </div>
      </div>

      <div className="flex h-28 items-end gap-2 rounded-3xl border border-white/[0.04] bg-black/10 px-3 pb-3 pt-4">
        {weekData.map((item, index) => {
          const height = maxMinutes > 0 ? (item.minutes / maxMinutes) * 100 : 0;
          const isToday = index === todayIndex;
          const hasData = item.minutes > 0;

          return (
            <div key={item.day} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[10px] text-slate-500">{item.minutes > 0 ? `${(item.minutes / 60).toFixed(1)}h` : ''}</span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(height, 6)}%` }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className={`w-full rounded-xl ${
                  isToday ? 'bg-gradient-to-t from-blue-500 to-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.28)]' : hasData ? 'bg-cyan-500/45' : 'bg-white/[0.035]'
                }`}
              />
              <span className={`text-[10px] ${isToday ? 'font-semibold text-cyan-300' : 'text-slate-600'}`}>
                周{item.label}
              </span>
            </div>
          );
        })}
      </div>

      {weekTotal === 0 && (
        <p className="mt-4 text-center text-xs text-slate-600">开始一次专注记录后，这里会自动形成你的节奏曲线。</p>
      )}
    </div>
  );
}
