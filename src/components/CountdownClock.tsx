import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertTriangle } from 'lucide-react';

interface CountdownClockProps {
  deadline: string;
  createdAt?: string;
}

export default function CountdownClock({ deadline, createdAt }: CountdownClockProps) {
  const [now, setNow] = useState(new Date());
  const totalDuration = useRef(0);

  const targetDate = useMemo(() => new Date(deadline), [deadline]);

  // Calculate total duration at mount
  useEffect(() => {
    const start = createdAt ? new Date(createdAt) : new Date();
    totalDuration.current = Math.max(1, targetDate.getTime() - start.getTime());
  }, [deadline, createdAt, targetDate]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { days, hours, minutes, seconds, isOverdue, isUrgent, progress } = useMemo(() => {
    const diff = targetDate.getTime() - now.getTime();
    const isOver = diff <= 0;
    const absDiff = Math.abs(diff);

    const d = Math.floor(absDiff / 86400000);
    const h = Math.floor((absDiff % 86400000) / 3600000);
    const m = Math.floor((absDiff % 3600000) / 60000);
    const s = Math.floor((absDiff % 60000) / 1000);

    // Progress: how much time has elapsed
    let pct = 0;
    if (!isOver && totalDuration.current > 0) {
      const elapsed = totalDuration.current - diff;
      pct = Math.min(100, Math.round((elapsed / totalDuration.current) * 100));
    } else if (isOver) {
      pct = 100;
    }

    return { days: d, hours: h, minutes: m, seconds: s, isOverdue: isOver, isUrgent: !isOver && d < 3, progress: pct };
  }, [deadline, now, targetDate]);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Clock size={16} className={isOverdue ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-blue-400'} />
          {isOverdue ? '已超期' : isUrgent ? '即将到期' : '项目截止'}
        </h3>
        <span className="text-xs text-slate-500">
          {targetDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2">
        <TimeBlock value={pad(days)} label="天" urgent={isOverdue || isUrgent} />
        <span className="text-2xl text-slate-600 font-light mt-[-20px]">:</span>
        <TimeBlock value={pad(hours)} label="时" urgent={isOverdue || isUrgent} />
        <span className="text-2xl text-slate-600 font-light mt-[-20px]">:</span>
        <TimeBlock value={pad(minutes)} label="分" urgent={isOverdue || isUrgent} />
        <span className="text-2xl text-slate-600 font-light mt-[-20px]">:</span>
        <TimeBlock value={pad(seconds)} label="秒" urgent={isOverdue || isUrgent} />
      </div>

      {/* Progress bar */}
      {!isOverdue && (
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-slate-600 mb-1">
            <span>进度 {progress}%</span>
            <span>剩余 {days} 天</span>
          </div>
          <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: `${progress}%` }}
              animate={{ width: `${progress}%` }}
              className={`h-full rounded-full ${isUrgent ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {isOverdue && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-red-400">
          <AlertTriangle size={14} />
          <span>已超期 {days} 天</span>
        </div>
      )}
    </div>
  );
}

function TimeBlock({ value, label, urgent }: { value: string; label: string; urgent: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <motion.div
        key={value}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold font-mono transition-all ${
          urgent
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : 'bg-white/[0.03] border border-white/[0.06] text-white'
        }`}
      >
        {value}
      </motion.div>
      <span className="text-[10px] text-slate-600 mt-1">{label}</span>
    </div>
  );
}
