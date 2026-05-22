import { useMemo, useRef, useState } from 'react';
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
import { Download, Flame } from 'lucide-react';
import type { Milestone, Task } from '../../types';
import { buildBurndownData, type BurndownMetric, type BurndownRange } from '../../lib/burndown';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export default function BurndownChart({ tasks, milestones }: { tasks: Task[]; milestones: Milestone[] }) {
  const chartRef = useRef<ChartJS<'line'> | null>(null);
  const [range, setRange] = useState<BurndownRange>('30d');
  const [metric, setMetric] = useState<BurndownMetric>('tasks');
  const [milestoneId, setMilestoneId] = useState<number | null>(null);
  const data = useMemo(() => buildBurndownData(tasks, milestones, { range, metric, milestoneId }), [milestoneId, milestones, metric, range, tasks]);

  const exportPng = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const url = chart.toBase64Image('image/png', 1);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `burndown-${data.meta.exportedAt}.png`;
    anchor.click();
  };

  return (
    <div className="glass rounded-[30px] p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Flame size={16} className="text-orange-300" />
            燃尽图
          </h3>
          <p className="mt-1 text-xs text-slate-500">理想线、实际线和乐观/悲观范围对比</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={range} onChange={event => setRange(event.target.value as BurndownRange)} className="rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-xs text-white">
            <option value="7d">近 7 天</option>
            <option value="30d">近 30 天</option>
            <option value="project">全项目周期</option>
          </select>
          <select value={metric} onChange={event => setMetric(event.target.value as BurndownMetric)} className="rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-xs text-white">
            <option value="tasks">剩余任务数</option>
            <option value="estimate">剩余预估分钟</option>
          </select>
          <select value={milestoneId ?? ''} onChange={event => setMilestoneId(event.target.value ? Number(event.target.value) : null)} className="rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-xs text-white">
            <option value="">全部里程碑</option>
            {milestones.map(milestone => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}
          </select>
          <button onClick={exportPng} className="flex items-center gap-1 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/20">
            <Download size={13} />
            PNG
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
          <p className="text-xs text-slate-500">总量</p>
          <p className="mt-1 text-xl font-bold text-white">{data.meta.total} <span className="text-xs text-slate-500">{data.meta.unit}</span></p>
        </div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
          <p className="text-xs text-slate-500">剩余</p>
          <p className="mt-1 text-xl font-bold text-cyan-300">{data.meta.remaining}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
          <p className="text-xs text-slate-500">范围</p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{data.meta.milestoneTitle}</p>
        </div>
      </div>

      <div className="h-80">
        <Line
          ref={chartRef}
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { color: '#94a3b8', usePointStyle: true } },
              tooltip: {
                callbacks: {
                  afterLabel: context => `完成速率参考：${data.meta.completed} / ${data.meta.total}`,
                },
              },
            },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
              y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
            },
          }}
        />
      </div>
    </div>
  );
}
