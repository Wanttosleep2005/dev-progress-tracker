import { useMemo } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Waves } from 'lucide-react';
import type { Task } from '../../types';
import { STATUS_COLORS } from '../../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const STATUS_ORDER = ['todo', 'in_progress', 'review', 'done'] as const;

interface Props {
  tasks: Task[];
  days?: number;
}

export default function CFDChart({ tasks, days = 30 }: Props) {
  const data = useMemo(() => {
    const labels: string[] = [];
    const today = new Date();
    const cumulative: Record<string, number[]> = {};
    STATUS_ORDER.forEach(s => { cumulative[s] = []; });

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      labels.push(`${date.getMonth() + 1}/${date.getDate()}`);

      STATUS_ORDER.forEach(status => {
        const count = tasks.filter(t => {
          const created = t.createdAt.split('T')[0];
          return created <= dateStr && t.status === status;
        }).length;
        cumulative[status].push(count);
      });
    }

    const datasets = STATUS_ORDER.map((status, index) => {
      const prev = index > 0 ? cumulative[STATUS_ORDER[index - 1]] : null;
      const current = cumulative[status];
      // For stacked area, each band is the cumulative from bottom
      const stacked = current.map((v, idx) => {
        const below = prev ? prev[idx] : 0;
        return below + v;
      });

      return {
        label: ['待办', '进行中', '待评审', '已完成'][index],
        data: stacked,
        borderColor: STATUS_COLORS[status],
        backgroundColor: `${STATUS_COLORS[status]}30`,
        fill: index === 0 ? 'origin' as const : (index === STATUS_ORDER.length - 1 ? true : '-1' as const),
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5,
      };
    });

    return { labels, datasets };
  }, [tasks, days]);

  return (
    <div className="glass rounded-[30px] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Waves size={16} className="text-cyan-300" />
        <h3 className="text-sm font-semibold text-slate-200">累积流图 (CFD)</h3>
      </div>
      <div className="h-72">
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                position: 'top',
                labels: { color: '#94a3b8', usePointStyle: true, padding: 16, font: { size: 11 } },
              },
              tooltip: {
                backgroundColor: '#0f172a',
                titleColor: '#e2e8f0',
                bodyColor: '#94a3b8',
                borderColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
              },
            },
            scales: {
              x: {
                grid: { color: 'rgba(255,255,255,0.03)' },
                ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 10 },
              },
              y: {
                stacked: true,
                grid: { color: 'rgba(255,255,255,0.03)' },
                ticks: { color: '#64748b', font: { size: 10 } },
                title: { display: true, text: '任务数', color: '#64748b' },
              },
            },
          }}
        />
      </div>
      <p className="mt-3 text-xs text-slate-500">基于任务创建日期和当前状态的累积分布，展示各阶段任务数量随时间的变化趋势。WIP 区域持续膨胀意味着在制品积压，需关注吞吐。</p>
    </div>
  );
}
