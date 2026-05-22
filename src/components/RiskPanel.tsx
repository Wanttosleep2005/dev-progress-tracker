import { AlertTriangle, CircleAlert, ShieldCheck } from 'lucide-react';
import type { RiskAlert } from '../lib/riskAnalysis';

const levelStyles = {
  low: {
    icon: ShieldCheck,
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    card: 'border-emerald-500/10 bg-emerald-500/[0.03]',
    label: '低风险',
  },
  medium: {
    icon: CircleAlert,
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    card: 'border-amber-500/10 bg-amber-500/[0.03]',
    label: '中风险',
  },
  high: {
    icon: AlertTriangle,
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    card: 'border-rose-500/10 bg-rose-500/[0.03]',
    label: '高风险',
  },
} as const;

interface RiskPanelProps {
  alerts: RiskAlert[];
  compact?: boolean;
}

export default function RiskPanel({ alerts, compact = false }: RiskPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="glass border border-emerald-500/10 p-5">
        <div className="mb-1 flex items-center gap-2 text-emerald-400">
          <ShieldCheck size={16} />
          <span className="text-sm font-semibold">项目状态稳定</span>
        </div>
        <p className="text-xs text-slate-500">当前没有识别到明显风险，整体节奏保持得不错。</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">风险预警中心</h3>
          <p className="mt-1 text-xs text-slate-500">
            系统会根据任务、里程碑、截止日期、专注记录和日志状态自动分析风险。
          </p>
        </div>
        <span className="rounded-full border border-white/[0.06] px-2 py-1 text-[10px] text-slate-400">
          {alerts.length} 条提醒
        </span>
      </div>

      <div className={compact ? 'space-y-2' : 'grid gap-3 xl:grid-cols-2'}>
        {alerts.map(alert => {
          const style = levelStyles[alert.level];
          const Icon = style.icon;
          return (
            <div key={alert.id} className={`rounded-2xl border p-4 ${style.card}`}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon size={16} className={style.badge.split(' ')[1]} />
                  <span className="text-sm font-medium text-white">{alert.title}</span>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${style.badge}`}>
                  {style.label}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">{alert.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
