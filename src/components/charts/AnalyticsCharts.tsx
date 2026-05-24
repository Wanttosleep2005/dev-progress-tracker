import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
  type ChartData,
} from 'chart.js';
import { Bar, Doughnut, Line, Radar } from 'react-chartjs-2';
import { BarChart3, Gauge, Radar as RadarIcon, Sparkles, TimerReset, TrendingUp } from 'lucide-react';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  RadarController,
  RadialLinearScale
);

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#94a3b8',
        usePointStyle: true,
        padding: 18,
      },
    },
  },
};

interface AnalyticsChartsProps {
  dailyFocusTrend: ChartData<'line'>;
  statusData: ChartData<'doughnut'>;
  effortData: ChartData<'bar'>;
  priorityData: ChartData<'bar'>;
  weeklyDeliveryData: ChartData<'radar'>;
  moodTrend: ChartData<'line'>;
}

export default function AnalyticsCharts({
  dailyFocusTrend,
  statusData,
  effortData,
  priorityData,
  weeklyDeliveryData,
  moodTrend,
}: AnalyticsChartsProps) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass rounded-[30px] p-5">
          <div className="mb-4 flex items-center gap-2">
            <TimerReset size={16} className="text-cyan-300" />
            <h3 className="text-sm font-semibold text-slate-200">专注投入趋势</h3>
          </div>
          <div className="h-72">
            <Line
              data={dailyFocusTrend}
              options={{
                ...baseChartOptions,
                scales: {
                  x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
                  y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
                },
              }}
            />
          </div>
        </div>

        <div className="glass rounded-[30px] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-sky-300" />
            <h3 className="text-sm font-semibold text-slate-200">任务状态结构</h3>
          </div>
          <div className="h-72">
            <Doughnut data={statusData} options={{ ...baseChartOptions, cutout: '70%' }} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="glass rounded-[30px] p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-emerald-300" />
            <h3 className="text-sm font-semibold text-slate-200">预估工时 vs 实际工时</h3>
          </div>
          <div className="h-80">
            <Bar
              data={effortData}
              options={{
                ...baseChartOptions,
                scales: {
                  x: { grid: { display: false }, ticks: { color: '#64748b' } },
                  y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
                },
              }}
            />
          </div>
        </div>

        <div className="glass rounded-[30px] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Gauge size={16} className="text-amber-300" />
            <h3 className="text-sm font-semibold text-slate-200">优先级负载</h3>
          </div>
          <div className="h-80">
            <Bar
              data={priorityData}
              options={{
                ...baseChartOptions,
                indexAxis: 'y' as const,
                scales: {
                  x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
                  y: { grid: { display: false }, ticks: { color: '#64748b' } },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="glass rounded-[30px] p-5">
          <div className="mb-4 flex items-center gap-2">
            <RadarIcon size={16} className="text-violet-300" />
            <h3 className="text-sm font-semibold text-slate-200">交付雷达</h3>
          </div>
          <div className="h-80">
            <Radar
              data={weeklyDeliveryData}
              options={{
                ...baseChartOptions,
                scales: {
                  r: {
                    angleLines: { color: 'rgba(255,255,255,0.05)' },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    pointLabels: { color: '#94a3b8' },
                    ticks: { display: false },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="glass rounded-[30px] p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-amber-300" />
            <h3 className="text-sm font-semibold text-slate-200">最近 7 天状态波动</h3>
          </div>
          <div className="h-80">
            <Line
              data={moodTrend}
              options={{
                ...baseChartOptions,
                scales: {
                  x: { grid: { display: false }, ticks: { color: '#64748b' } },
                  y: {
                    min: 1,
                    max: 5,
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748b', stepSize: 1 },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
