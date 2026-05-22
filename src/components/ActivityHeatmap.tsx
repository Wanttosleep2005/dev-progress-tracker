import { useMemo, useState } from 'react';
import { useStatsStore } from '../stores/useStatsStore';

function getHeatColor(minutes: number): string {
  if (minutes === 0) return 'bg-white/[0.02]';
  if (minutes <= 15) return 'bg-emerald-500/20';
  if (minutes <= 30) return 'bg-emerald-500/35';
  if (minutes <= 60) return 'bg-emerald-500/55';
  if (minutes <= 120) return 'bg-cyan-500/70';
  if (minutes <= 240) return 'bg-cyan-400/85';
  return 'bg-cyan-300';
}

function getActivityLevel(minutes: number): string {
  if (minutes === 0) return '无记录';
  if (minutes <= 15) return '轻量';
  if (minutes <= 30) return '稳定';
  if (minutes <= 60) return '投入';
  if (minutes <= 120) return '高强度';
  return '爆发';
}

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export default function ActivityHeatmap() {
  const sessions = useStatsStore(state => state.sessions);
  const [hoveredCell, setHoveredCell] = useState<{ date: string; minutes: number; x: number; y: number } | null>(null);

  const { cells, totalWeeks } = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - 1);
    startDate.setDate(startDate.getDate() - startDate.getDay() + 1);

    const dailyMinutes: Record<string, number> = {};
    sessions.forEach(session => {
      dailyMinutes[session.date] = (dailyMinutes[session.date] || 0) + session.minutes;
    });

    const totalDays = Math.ceil((today.getTime() - startDate.getTime()) / 86400000);
    const weeks = Math.ceil(totalDays / 7);
    const items: { date: string; minutes: number; dayOfWeek: number; weekIndex: number }[] = [];

    for (let week = 0; week < weeks; week += 1) {
      for (let day = 0; day < 7; day += 1) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + week * 7 + day);
        if (cellDate > today) break;
        const date = cellDate.toISOString().split('T')[0];
        items.push({
          date,
          minutes: dailyMinutes[date] || 0,
          dayOfWeek: day,
          weekIndex: week,
        });
      }
    }

    return { cells: items, totalWeeks: weeks };
  }, [sessions]);

  if (cells.length === 0) {
    return <div className="py-4 text-center text-sm text-slate-600">完成专注记录后，这里会展示过去一年的活跃热力图。</div>;
  }

  const totalActive = cells.filter(cell => cell.minutes > 0).length;

  return (
    <div className="relative overflow-x-auto">
      <div className="flex gap-[3px]" style={{ minWidth: totalWeeks * 14 }}>
        <div className="mr-2 flex flex-col gap-[3px] pt-5">
          <span className="h-[12px] text-[9px] leading-[12px] text-slate-600">一</span>
          <span className="mt-[14px] h-[12px] text-[9px] leading-[12px] text-slate-600">三</span>
          <span className="mt-[14px] h-[12px] text-[9px] leading-[12px] text-slate-600">五</span>
        </div>

        <div>
          <div className="mb-2 flex gap-[3px]">
            {Array.from({ length: totalWeeks }).map((_, weekIndex) => {
              const currentDate = new Date();
              currentDate.setFullYear(currentDate.getFullYear() - 1);
              currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 1 + weekIndex * 7);
              const monthIndex = currentDate.getMonth();
              const previousDate = new Date(currentDate);
              previousDate.setDate(previousDate.getDate() - 7);

              return (
                <span
                  key={weekIndex}
                  className="text-[9px] text-slate-600"
                  style={{
                    width: '12px',
                    visibility: weekIndex === 0 || previousDate.getMonth() !== monthIndex ? 'visible' : 'hidden',
                  }}
                >
                  {MONTHS[monthIndex]}
                </span>
              );
            })}
          </div>

          <div className="flex gap-[3px]">
            {Array.from({ length: totalWeeks }).map((_, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
                  const cell = cells.find(item => item.weekIndex === weekIndex && item.dayOfWeek === dayIndex);
                  if (!cell) {
                    return <div key={`${weekIndex}-${dayIndex}`} className="h-[12px] w-[12px] rounded-sm" />;
                  }

                  return (
                    <div
                      key={cell.date}
                      className={`h-[12px] w-[12px] cursor-pointer rounded-sm transition hover:ring-1 hover:ring-white/30 ${getHeatColor(cell.minutes)}`}
                      onMouseEnter={event => {
                        const rect = (event.target as HTMLElement).getBoundingClientRect();
                        setHoveredCell({ date: cell.date, minutes: cell.minutes, x: rect.left, y: rect.top });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                      title={`${cell.date}: ${cell.minutes} 分钟`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {hoveredCell && (
        <div
          className="glass pointer-events-none fixed z-50 px-2 py-1 text-xs text-white"
          style={{ left: hoveredCell.x + 8, top: hoveredCell.y - 30 }}
        >
          {hoveredCell.date} · {hoveredCell.minutes > 0 ? `${hoveredCell.minutes} 分钟` : '无记录'}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600">
        <span>活跃 {totalActive} 天</span>
        <div className="flex items-center gap-1">
          <span>少</span>
          {[0, 15, 30, 60, 120, 240].map(minutes => (
            <div key={minutes} className={`h-3 w-3 rounded-sm ${getHeatColor(minutes)}`} title={getActivityLevel(minutes)} />
          ))}
          <span>多</span>
        </div>
      </div>
    </div>
  );
}
