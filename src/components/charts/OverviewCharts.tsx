import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import { Activity, Sparkles } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

interface OverviewChartsProps {
  pieData: any;
  weeklyTrend: any;
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#94a3b8',
        font: { size: 11 },
        padding: 12,
        usePointStyle: true,
        pointStyleWidth: 8,
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#64748b', font: { size: 10 } },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#64748b', font: { size: 10 }, stepSize: 1 },
    },
  },
};

export default function OverviewCharts({ pieData, weeklyTrend }: OverviewChartsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="glass rounded-[28px] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Sparkles size={16} className="text-indigo-300" />
          任务状态分布
        </h3>
        <div className="h-64">
          <Pie
            data={pieData}
            options={{
              ...chartOptions,
              plugins: { legend: { ...chartOptions.plugins.legend, position: 'bottom' as const } },
            }}
          />
        </div>
      </div>

      <div className="glass rounded-[28px] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Activity size={16} className="text-blue-400" />
          最近四周趋势
        </h3>
        <div className="h-64">
          <Line data={weeklyTrend} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
