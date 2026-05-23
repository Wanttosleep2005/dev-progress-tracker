import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Database, Download, Eye, FileText, FolderOpen, Info, Keyboard, Network, Settings, Sparkles, Trash2, Upload, UserX } from 'lucide-react';
import { db } from '../db/database';
import { buildWeeklyReport } from '../lib/reporting';
import { useAppStore } from '../stores/useAppStore';
import { useDiaryStore } from '../stores/useDiaryStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useTaskStore } from '../stores/useTaskStore';
import { useTheme } from '../stores/useTheme';
import { usePreferences } from '../stores/usePreferences';
import { useSidebarStore } from '../stores/useSidebarStore';
import { useNotificationStore } from '../stores/useNotificationStore';
import { useCloudStore } from '../stores/useCloudStore';
import { getCustomBaseUrl, setCustomBaseUrl } from '../lib/cloudSync';
import { getBackupDirectory, getBackupDirectoryLabel, selectBackupDirectory, setBackupDirectory } from '../lib/backup';
import TimePicker from '../components/ui/TimePicker';
import type { TaskPriority, TaskStatus } from '../types';

interface NetworkInterfaceCandidate {
  name?: string;
  address: string;
  radmin?: boolean;
}

function isUsableIpv4(ip: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && ip !== '127.0.0.1' && !ip.startsWith('0.');
}

function isRadminIpv4(ip: string) {
  return ip.startsWith('26.');
}

function rankDetectedIps(ips: string[]) {
  return [...new Set(ips.filter(isUsableIpv4))].sort((a, b) => {
    if (isRadminIpv4(a) !== isRadminIpv4(b)) return isRadminIpv4(a) ? -1 : 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

async function detectServerNetworkIps(): Promise<NetworkInterfaceCandidate[]> {
  try {
    const response = await fetch('/__devtrack/network-interfaces', { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json() as { interfaces?: NetworkInterfaceCandidate[] };
    return (data.interfaces || []).filter(item => isUsableIpv4(item.address));
  } catch {
    return [];
  }
}

export default function SettingsPage() {
  const { currentProjectId, projects } = useAppStore();
  const tasks = useTaskStore(state => state.tasks);
  const { add: addTask, load: loadTasks } = useTaskStore();
  const milestones = useMilestoneStore(state => state.milestones);
  const diaryEntries = useDiaryStore(state => state.entries);
  const { theme, setTheme } = useTheme();
  const { animationsEnabled, setAnimationsEnabled, collaborationMode, setCollaborationMode } = usePreferences();
  const { settings: notificationSettings, requestPermission, updateSettings } = useNotificationStore();
  const { items: sidebarItems, init: initSidebar, toggle: toggleSidebarItem, hideAll, showAll, applyRecommended } = useSidebarStore();
  const cloudSession = useCloudStore(state => state.session);
  const deleteCloudAccount = useCloudStore(state => state.deleteAccount);
  const signOutCloud = useCloudStore(state => state.signOut);
  const cloudLoading = useCloudStore(state => state.loading);
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState('0.0.0');
  const [deletingCloudAccount, setDeletingCloudAccount] = useState(false);
  const [shortcuts, setShortcuts] = useState(() => {
    try {
      const saved = localStorage.getItem('devtrack-shortcuts');
      return saved ? JSON.parse(saved) : {
        commandPalette: 'mod+k',
        newTask: 'mod+n',
        toggleTimer: 'mod+t',
        help: 'mod+/',
      };
    } catch { return {}; }
  });
  const [baseUrl, setBaseUrl] = useState(() => getCustomBaseUrl());
  const [backupDir, setBackupDir] = useState(() => getBackupDirectory() || 'G:\\developspace\\dev-progress-tracker\\project-backups\\data');
  const [backupDirLabel, setBackupDirLabel] = useState(() => getBackupDirectoryLabel());
  const [detectedIps, setDetectedIps] = useState<string[]>([]);

  useEffect(() => {
    import('../../package.json')
      .then(module => setVersion((module as any).default?.version || '0.0.0'))
      .catch(() => setVersion('0.0.0'));
  }, []);

  useEffect(() => { initSidebar(); }, [initSidebar]);

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

  const handleDeleteCloudAccount = async () => {
    const email = cloudSession?.user.email;
    if (!email) {
      setMessage('请先登录云端账号后再注销。');
      return;
    }
    const firstConfirm = window.confirm(
      '确定要注销当前云端账户身份吗？\n\n这会删除你拥有的云端共享项目，移除你在其他共享项目中的成员身份，匿名化历史同步记录，并解除本地项目的云端绑定。本地任务不会被清空。'
    );
    if (!firstConfirm) return;
    const typed = window.prompt(`为避免误操作，请输入当前邮箱确认：${email}`);
    if (typed !== email) {
      setMessage('邮箱确认不一致，已取消注销。');
      return;
    }

    setDeletingCloudAccount(true);
    try {
      const result = await deleteCloudAccount();
      const authText = result.authDeletion === 'deleted'
        ? 'Supabase Auth 用户也已删除，这个邮箱可以重新注册。'
        : result.authDeletion === 'not_configured'
          ? '业务数据已清理；账号删除函数未部署，仍需在 Supabase Auth Users 中手动删除该邮箱，邮箱才会变成全新的 Supabase 账号。'
          : `业务数据已清理；Auth 用户删除失败：${result.authDeletionMessage || '未知错误'}`;
      setMessage(`云端身份已注销。${authText}`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '注销云端账户失败');
    } finally {
      setDeletingCloudAccount(false);
    }
  };

  const handleCollaborationModeChange = (mode: 'local' | 'cloud') => {
    if (mode === collaborationMode) return;
    if (mode === 'local') {
      const confirmed = window.confirm('切换到单人纯净流后，会停止 Supabase 登录、同步、邀请和在线状态心跳。本地任务和项目不会删除。确定切换吗？');
      if (!confirmed) return;
      signOutCloud();
      setCollaborationMode('local');
      setMessage('已切换到单人纯净流：云同步已停用，本地数据会继续保存在当前浏览器 IndexedDB 中。');
      return;
    }
    setCollaborationMode('cloud');
    setMessage('已切换到云协作模式：可以登录 Supabase、发布共享项目并同步团队进度。');
  };

  const handleCSVImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async event => {
      try {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file || !currentProjectId) return;
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) { setMessage('CSV 至少需要标题行和数据行'); return; }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
          if (row.title) {
            await addTask({
              projectId: currentProjectId,
              title: row.title,
              description: row.description || '',
              status: (['todo', 'in_progress', 'review', 'done'].includes(row.status) ? row.status : 'todo') as TaskStatus,
              priority: (['low', 'medium', 'high', 'urgent'].includes(row.priority) ? row.priority : 'medium') as TaskPriority,
              tags: row.tags ? row.tags.split(';').map(t => t.trim()).filter(Boolean) : [],
              dueDate: row.due_date || row.duedate || null,
              milestoneId: null,
              estimatedMinutes: row.estimated_minutes ? parseInt(row.estimated_minutes) : null,
              url: row.url || '',
              recurrence: 'none',
              source: 'board',
              remindAt: null,
              isTodayTask: false,
              publishedAt: null,
              subtasks: [],
              trackedMinutes: 0,
              dependsOn: [],
            });
            imported++;
          }
        }
        await loadTasks(currentProjectId);
        setMessage(`成功从 CSV 导入 ${imported} 个任务`);
      } catch {
        setMessage('CSV 导入失败，请检查文件格式');
      }
    };
    input.click();
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
          <Database size={16} className="text-emerald-300" />
          运行模式
        </h3>
        <p className="mb-4 text-xs leading-5 text-slate-500">
          单人纯净流完全停用 Supabase 登录、同步、邀请和在线状态心跳；本地数据保存在当前浏览器 IndexedDB 中。后续需要团队协作时，可以随时切回云协作模式。
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            onClick={() => handleCollaborationModeChange('local')}
            className={`rounded-2xl border p-4 text-left transition ${
              collaborationMode === 'local'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-white/[0.06] bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            <p className="text-sm font-semibold">单人纯净流</p>
            <p className="mt-2 text-xs leading-5 opacity-75">只使用本地 IndexedDB，不连接 Supabase，不产生云端同步请求。</p>
            <span className="mt-3 inline-flex rounded-full bg-white/[0.06] px-2 py-1 text-[10px] text-slate-300">
              推荐给单机使用
            </span>
          </button>
          <button
            onClick={() => handleCollaborationModeChange('cloud')}
            className={`rounded-2xl border p-4 text-left transition ${
              collaborationMode === 'cloud'
                ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
                : 'border-white/[0.06] bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            <p className="text-sm font-semibold">云协作模式</p>
            <p className="mt-2 text-xs leading-5 opacity-75">启用 Supabase 登录、项目共享、成员权限、活动流和多端同步。</p>
            <span className="mt-3 inline-flex rounded-full bg-white/[0.06] px-2 py-1 text-[10px] text-slate-300">
              适合团队项目
            </span>
          </button>
        </div>
        <p className="mt-3 text-[10px] leading-5 text-slate-600">
          本地数据不会因为未登录 Supabase 而自动删除；风险主要来自手动清理浏览器数据、无痕模式、浏览器存储回收、换浏览器或换域名。重要阶段建议使用备份与恢复中心创建还原点。
        </p>
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
          <div>
            <span className="mb-1 block text-xs text-slate-500">每日提醒时间</span>
            <TimePicker value={notificationSettings.dailyReminderTime} onChange={val => updateSettings({ dailyReminderTime: val })} placeholder="提醒时间" />
          </div>
          <div>
            <span className="mb-1 block text-xs text-slate-500">静默开始</span>
            <TimePicker value={notificationSettings.quietStart} onChange={val => updateSettings({ quietStart: val })} placeholder="开始时间" />
          </div>
          <div>
            <span className="mb-1 block text-xs text-slate-500">静默结束</span>
            <TimePicker value={notificationSettings.quietEnd} onChange={val => updateSettings({ quietEnd: val })} placeholder="结束时间" />
          </div>
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
          <Keyboard size={16} className="text-purple-300" />
          自定义快捷键
        </h3>
        <p className="mb-4 text-xs text-slate-500">修改常用操作的快捷键组合，支持 mod（Cmd/Ctrl）、shift、alt。</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(shortcuts).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="text-sm text-slate-300">
                {key === 'commandPalette' ? '命令面板' : key === 'newTask' ? '新建任务' : key === 'toggleTimer' ? '切换计时器' : '快捷键帮助'}
              </span>
              <input
                value={value as string}
                onChange={e => {
                  const next = { ...shortcuts, [key]: e.target.value };
                  setShortcuts(next);
                  localStorage.setItem('devtrack-shortcuts', JSON.stringify(next));
                }}
                placeholder="mod+k"
                className="w-28 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-center text-xs text-white font-mono focus:border-sky-500/50 focus:outline-none"
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-slate-600">修改即时生效，刷新页面后仍然保留。</p>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Eye size={16} className="text-cyan-300" />
          侧边栏显示
        </h3>
        <p className="mb-4 text-xs text-slate-500">勾选你想在左侧导航栏显示的项目。</p>
        <div className="mb-3 flex gap-2">
          <button onClick={applyRecommended} className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-[11px] text-sky-200 hover:bg-sky-500/20">使用推荐显示</button>
          <button onClick={hideAll} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-400 hover:bg-white/[0.06]">全部隐藏</button>
          <button onClick={showAll} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-400 hover:bg-white/[0.06]">全部启用</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {sidebarItems.map(item => (
            <button
              key={item.to}
              onClick={() => toggleSidebarItem(item.to)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs text-left transition ${
                item.visible
                  ? 'border-sky-500/20 bg-sky-500/10 text-sky-200'
                  : 'border-white/[0.04] bg-white/[0.01] text-slate-600 line-through'
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${item.visible ? 'bg-sky-400' : 'bg-slate-600'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.label}</span>
                <span className="mt-0.5 block truncate text-[10px] opacity-60">权重 {item.weight} · {item.reason}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Network size={16} className="text-emerald-300" />
          局域网访问（邀请链接基地址）
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          在局域网内分享邀请链接时，将基地址设为本机 LAN IP，团队成员即可通过链接访问你的 DevTrack。
        </p>
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={async () => {
              setMessage('');
              setDetectedIps([]);
              const serverCandidates = await detectServerNetworkIps();
              const serverIps = rankDetectedIps(serverCandidates.map(item => item.address));
              if (serverIps.length > 0) {
                const radminIp = serverIps.find(isRadminIpv4);
                setDetectedIps(serverIps);
                if (radminIp) {
                  const url = `http://${radminIp}:5173`;
                  setBaseUrl(url);
                  setCustomBaseUrl(url);
                  setMessage(`已检测到 Radmin IPv4：${radminIp}，已自动设为邀请链接基地址`);
                  return;
                }
              }
              const ips = new Set<string>();
              serverIps.forEach(ip => ips.add(ip));
              const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
              });
              pc.createDataChannel('');
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);

              await new Promise<void>(resolve => {
                const timeout = setTimeout(() => resolve(), 4000);
                pc.onicecandidate = (e) => {
                  if (!e.candidate) { clearTimeout(timeout); resolve(); return; }
                  const parts = e.candidate.candidate.split(' ');
                  const ipIdx = parts.indexOf('typ') - 2;
                  if (ipIdx > 0) {
                    const ip = parts[ipIdx];
                    if (ip && !ip.includes('.local') && ip !== '127.0.0.1' && !ip.startsWith('0.')) {
                      ips.add(ip);
                    }
                  }
                };
              });
              pc.close();

              // Phase 2: scan Radmin virtual adapter
              // Radmin VPN uses 26.0.0.0/8. Try each detected IP's host portion with Radmin prefix.
              if (ips.size > 0) {
                const candidates: string[] = [];
                for (const ip of ips) {
                  const parts = ip.split('.');
                  if (parts.length === 4 && !ip.startsWith('26.')) {
                    // Construct: detected IP's host parts with Radmin /8 prefix
                    candidates.push(`26.${parts[2]}.${parts[3]}`);
                    // Also try common Radmin second octets: 0-30
                    for (const b of [0, 1, 2, 3, 27]) {
                      candidates.push(`26.${b}.${parts[2]}.${parts[3]}`);
                    }
                  }
                }

                const scanResults = await Promise.allSettled(
                  [...new Set(candidates)].slice(0, 12).map(async (c) => {
                    const ctrl = new AbortController();
                    setTimeout(() => ctrl.abort(), 600);
                    await fetch(`http://${c}:5173`, { signal: ctrl.signal, mode: 'no-cors' });
                    return c;
                  })
                );
                for (const r of scanResults) {
                  if (r.status === 'fulfilled') ips.add(r.value);
                }
              }

              if (ips.size > 0) {
                const list = [...ips].sort();
                // Also include current hostname if not localhost
                const host = window.location.hostname;
                if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.includes('.local') && !list.includes(host)) {
                  list.push(host);
                }
                setDetectedIps(list);
                setMessage(`检测到 ${list.length} 个网络地址（含当前访问地址）`);
              } else {
                const host = window.location.hostname;
                if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.includes('.local')) {
                  setDetectedIps([host]);
                  setMessage(`使用当前访问地址: ${host}`);
                } else {
                  setMessage('未检测到有效 IP。提示：通过 Radmin IP 访问本页面后重试，或手动输入 Radmin 地址');
                }
              }
            }}
            className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-500/20"
          >
            自动检测
          </button>
          <span className="text-[10px] text-slate-600">或手动输入（Windows: <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono">ipconfig</code> 查看 IPv4 地址）</span>
        </div>
        {detectedIps.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {detectedIps.map(ip => (
              <button
                key={ip}
                onClick={() => {
                  const url = `http://${ip}:5173`;
                  setBaseUrl(url);
                  setCustomBaseUrl(url);
                  setMessage(`已选择: ${url}`);
                }}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 transition"
              >
                {ip}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <input
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder={window.location.hostname !== 'localhost' ? `http://${window.location.hostname}:5173` : 'http://192.168.x.x:5173'}
            className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none"
          />
          <button
            onClick={() => {
              setCustomBaseUrl(baseUrl);
              setMessage('邀请链接基地址已更新，重新生成邀请链接即可生效');
            }}
            className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20"
          >
            保存
          </button>
          {baseUrl && (
            <button
              onClick={() => {
                setCustomBaseUrl('');
                setBaseUrl('');
                setMessage('已恢复默认基地址');
              }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.05]"
            >
              重置
            </button>
          )}
        </div>
        <p className="mt-3 text-[10px] text-slate-600">
          启动开发服务器时请使用 <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono">npm run dev -- --host</code> 以暴露到局域网。
        </p>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Database size={16} className="text-cyan-300" />
          数据
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          所有数据都存储在浏览器本地 IndexedDB 中，支持备份、恢复和自动周报导出。
        </p>
        <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <label className="mb-2 block text-xs text-slate-500">备份文件存放目录</label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={backupDir}
              onChange={event => setBackupDir(event.target.value)}
              placeholder="例如：G:\developspace\dev-progress-tracker\project-backups\data"
              className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
            <button
              onClick={async () => {
                try {
                  const label = await selectBackupDirectory();
                  setBackupDirLabel(label);
                  setMessage('已选择备份文件夹，后续可直接保存备份文件');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : '选择文件夹失败');
                }
              }}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20"
            >
              <FolderOpen size={14} />
              选择文件夹
            </button>
            <button
              onClick={() => {
                setBackupDirectory(backupDir);
                setBackupDirLabel(getBackupDirectoryLabel());
                setMessage('备份文件存放目录已保存');
              }}
              className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20"
            >
              保存目录
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-slate-600">
            当前选择：{backupDirLabel || '尚未选择'}。优先使用“选择文件夹”的浏览器授权目录；如果浏览器不支持，再使用手动填写的本地路径。
          </p>
        </div>
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
        <div className="mb-4 rounded-2xl border border-red-500/10 bg-red-500/[0.04] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-red-200">
                <UserX size={15} />
                注销云端账户身份
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                清理 DevTrack 云端业务表中的当前用户 ID、成员关系和同步痕迹，并退出登录。本地项目会解除云端共享绑定，但不会删除本地任务。
              </p>
              <p className="mt-1 text-[10px] leading-5 text-amber-200/80">
                要让邮箱成为完全全新的 Supabase Auth 账号，必须部署账号删除 Edge Function，或在 Supabase 后台 Auth Users 手动删除该邮箱。
              </p>
              {cloudSession?.user.email && (
                <p className="mt-2 text-[10px] text-slate-500">当前云端账号：{cloudSession.user.email}</p>
              )}
            </div>
            <button
              onClick={handleDeleteCloudAccount}
              disabled={!cloudSession || deletingCloudAccount || cloudLoading}
              className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <UserX size={14} />
              {deletingCloudAccount ? '注销中...' : '注销云端账户'}
            </button>
          </div>
        </div>
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
