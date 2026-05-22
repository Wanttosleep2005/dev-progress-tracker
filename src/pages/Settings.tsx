import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Database, Download, FileText, Info, Settings, Sparkles, Trash2, Trophy, Upload } from 'lucide-react';
import { db } from '../db/database';
import { buildWeeklyReport } from '../lib/reporting';
import { useAppStore } from '../stores/useAppStore';
import { useDiaryStore } from '../stores/useDiaryStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useTaskStore } from '../stores/useTaskStore';
import { useTheme } from '../stores/useTheme';
import { usePreferences } from '../stores/usePreferences';
import { useNotificationStore } from '../stores/useNotificationStore';

export default function SettingsPage() {
  const { achievements, currentProjectId, projects } = useAppStore();
  const tasks = useTaskStore(state => state.tasks);
  const milestones = useMilestoneStore(state => state.milestones);
  const diaryEntries = useDiaryStore(state => state.entries);
  const { theme, setTheme } = useTheme();
  const { animationsEnabled, setAnimationsEnabled } = usePreferences();
  const { settings: notificationSettings, requestPermission, updateSettings } = useNotificationStore();
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState('0.0.0');

  useEffect(() => {
    import('../../package.json')
      .then(module => setVersion((module as any).default?.version || '0.0.0'))
      .catch(() => setVersion('0.0.0'));
  }, []);

  const unlockedCount = achievements.filter(achievement => achievement.unlockedAt).length;

  const handleExport = async () => {
    try {
      const data = {
        projects: await db.projects.toArray(),
        tasks: await db.tasks.toArray(),
        milestones: await db.milestones.toArray(),
        timelineEvents: await db.timelineEvents.toArray(),
        diaryEntries: await db.diaryEntries.toArray(),
        achievements: await db.achievements.toArray(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `devtrack-backup-${new Date().toISOString().split('T')[0]}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('数据导出成功');
    } catch {
      setMessage('数据导出失败');
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async event => {
      try {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.projects) await db.projects.bulkPut(data.projects);
        if (data.tasks) await db.tasks.bulkPut(data.tasks);
        if (data.milestones) await db.milestones.bulkPut(data.milestones);
        if (data.timelineEvents) await db.timelineEvents.bulkPut(data.timelineEvents);
        if (data.diaryEntries) await db.diaryEntries.bulkPut(data.diaryEntries);
        if (data.achievements) await db.achievements.bulkPut(data.achievements);
        setMessage('数据导入成功，页面即将刷新');
        setTimeout(() => window.location.reload(), 1000);
      } catch {
        setMessage('导入失败，请检查文件格式');
      }
    };
    input.click();
  };

  const handleGenerateReport = () => {
    const project = projects.find(item => item.id === currentProjectId);
    if (!project) {
      setMessage('请先选择一个项目再生成周报');
      return;
    }

    const report = buildWeeklyReport({
      project,
      tasks,
      milestones,
      diaryEntries,
    });

    const blob = new Blob([report.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = report.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('周报已生成，包含风险与工时偏差');
  };

  const handleClear = async () => {
    if (!window.confirm('确定要清空全部数据吗？这个操作不可恢复。')) return;
    await db.projects.clear();
    await db.tasks.clear();
    await db.milestones.clear();
    await db.timelineEvents.clear();
    await db.diaryEntries.clear();
    await db.achievements.clear();
    setMessage('全部数据已清空');
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-5xl space-y-5 py-8">
      <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
        <Settings size={22} className="text-indigo-400" />
        设置
      </h2>

      {message && <div className="glass rounded-2xl p-3 text-center text-sm text-indigo-300">{message}</div>}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="glass rounded-3xl p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Sparkles size={16} className="text-amber-300" />
            界面主题与动效
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setTheme('dark')}
              className={`rounded-2xl border p-4 text-left ${
                theme === 'dark'
                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-300'
              }`}
            >
              <p className="text-sm font-semibold">深色主题</p>
              <p className="mt-1 text-xs opacity-70">适合长时间查看仪表盘</p>
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`rounded-2xl border p-4 text-left ${
                theme === 'light'
                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-300'
              }`}
            >
              <p className="text-sm font-semibold">浅色主题</p>
              <p className="mt-1 text-xs opacity-70">更适合演示和白天办公</p>
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">界面动效</p>
                <p className="mt-1 text-xs text-slate-500">页面过渡和元素动画</p>
              </div>
              <button
                onClick={() => setAnimationsEnabled(!animationsEnabled)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  animationsEnabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/[0.05] text-slate-400'
                }`}
              >
                {animationsEnabled ? '已开启' : '已关闭'}
              </button>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Info size={16} className="text-sky-300" />
            关于
          </h3>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500">当前版本</p>
              <p className="mt-1 font-semibold text-white">v{version}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500">技术栈</p>
              <p className="mt-1 leading-relaxed text-slate-300">
                React 19、TypeScript、Vite、Tailwind CSS、Zustand、Dexie、Framer Motion、Chart.js
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Bell size={16} className="text-cyan-300" />
          浏览器通知
        </h3>
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">通知权限：{notificationSettings.permission}</p>
            <p className="mt-1 text-xs text-slate-500">用于任务到期、今日任务和番茄钟阶段提醒。</p>
          </div>
          <button
            onClick={notificationSettings.permission === 'granted' ? () => updateSettings({ enabled: !notificationSettings.enabled }) : requestPermission}
            className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20"
          >
            {notificationSettings.permission === 'granted' ? (notificationSettings.enabled ? '关闭通知' : '开启通知') : '请求权限'}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['taskBeforeDue', '任务提前提醒'],
            ['taskDue', '任务到期提醒'],
            ['todayTasks', '今日任务提醒'],
            ['pomodoroWorkDone', '番茄完成提醒'],
            ['pomodoroBreakDone', '休息结束提醒'],
            ['soundEnabled', '声音提示'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => updateSettings({ [key]: !notificationSettings[key as keyof typeof notificationSettings] } as any)}
              className={`rounded-2xl border p-4 text-left text-sm ${
                notificationSettings[key as keyof typeof notificationSettings]
                  ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-xs text-slate-500">提前提醒
            <select value={notificationSettings.leadMinutes} onChange={event => updateSettings({ leadMinutes: Number(event.target.value) as 15 | 30 | 60 })} className="mt-1 w-full rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-sm text-white">
              <option value={15}>15 分钟</option>
              <option value={30}>30 分钟</option>
              <option value={60}>60 分钟</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">每日提醒时间
            <input type="time" value={notificationSettings.dailyReminderTime} onChange={event => updateSettings({ dailyReminderTime: event.target.value })} className="mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-500">静默开始
            <input type="time" value={notificationSettings.quietStart} onChange={event => updateSettings({ quietStart: event.target.value })} className="mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-500">静默结束
            <input type="time" value={notificationSettings.quietEnd} onChange={event => updateSettings({ quietEnd: event.target.value })} className="mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white" />
          </label>
        </div>
        <button
          onClick={() => updateSettings({ quietHoursEnabled: !notificationSettings.quietHoursEnabled })}
          className={`mt-3 rounded-xl px-4 py-2 text-sm ${notificationSettings.quietHoursEnabled ? 'bg-slate-500/20 text-slate-200' : 'border border-white/[0.06] text-slate-400'}`}
        >
          {notificationSettings.quietHoursEnabled ? '静默时段已开启' : '开启静默时段'}
        </button>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Trophy size={16} className="text-amber-400" />
          成就系统
        </h3>
        <div className="mb-4 text-sm text-slate-400">已解锁 {unlockedCount} / {achievements.length}</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {achievements.map(achievement => (
            <div
              key={achievement.key}
              className={`rounded-2xl p-4 ${
                achievement.unlockedAt ? 'border border-amber-500/10 bg-amber-500/5' : 'bg-white/[0.02] opacity-60'
              }`}
            >
              <div className="mb-1 text-xl">{achievement.icon}</div>
              <p className={`text-sm font-medium ${achievement.unlockedAt ? 'text-amber-300' : 'text-slate-400'}`}>
                {achievement.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">{achievement.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Database size={16} className="text-cyan-300" />
          数据
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          所有数据都存储在浏览器本地 IndexedDB 中，支持备份、恢复和自动周报导出。
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-300 hover:bg-indigo-500/20"
          >
            <Download size={14} />
            导出数据
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.05]"
          >
            <Upload size={14} />
            导入数据
          </button>
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20"
          >
            <FileText size={14} />
            生成周报
          </button>
        </div>
      </div>

      <div className="glass rounded-3xl border border-red-500/10 p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-red-300">
          <Trash2 size={16} />
          危险区域
        </h3>
        <p className="mb-4 text-xs text-slate-500">清空后无法恢复，建议先做一次导出备份。</p>
        <button
          onClick={handleClear}
          className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20"
        >
          <Trash2 size={14} />
          清空全部数据
        </button>
      </div>
    </motion.div>
  );
}
