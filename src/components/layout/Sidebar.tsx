import { useCallback, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlarmClock,
  BarChart3,
  Bot,
  BookOpen,
  Calendar,
  CalendarDays,
  ChartNoAxesGantt,
  ChevronDown,
  Cloud,
  DatabaseBackup,
  FileText,
  Flag,
  FolderKanban,
  FolderOpen,
  GitBranch,
  History,
  Home,
  Kanban,
  Layers,
  LayoutDashboard,
  Plus,
  Route,
  Settings,
  Stethoscope,
  Trophy,
  Upload,
  Workflow,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useSidebarStore } from '../../stores/useSidebarStore';
import { PROJECT_COLORS, PROJECT_ICONS } from '../../types';
import FocusTimerPanel from '../FocusTimer';
import NotificationBell from '../NotificationBell';
import { applyTemplate, PROJECT_TEMPLATES } from '../../lib/templates';
import ProjectFolderIcon from '../ProjectFolderIcon';

export default function Sidebar() {
  const navigate = useNavigate();
  const { projects, currentProjectId, setCurrentProject, addProject, updateProject } = useAppStore();
  const sidebarItems = useSidebarStore(state => state.items);

  const [showSelector, setShowSelector] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(PROJECT_ICONS[0]);
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [deadline, setDeadline] = useState('');
  const [editingDeadlineId, setEditingDeadlineId] = useState<number | null>(null);
  const [editDeadlineValue, setEditDeadlineValue] = useState('');
  const [templateId, setTemplateId] = useState('');

  const currentProject = projects.find(project => project.id === currentProjectId);

  const navItems = [
    { to: '/today-command', icon: Route, label: '今日指挥台' },
    { to: '/', icon: Home, label: '概览', end: true },
    { to: '/portfolio', icon: LayoutDashboard, label: '项目总览' },
    { to: '/today-tasks', icon: AlarmClock, label: '今日任务' },
    { to: '/tasks', icon: Kanban, label: '任务看板' },
    { to: '/dependencies', icon: Workflow, label: '任务依赖' },
    { to: '/pomodoro', icon: AlarmClock, label: '番茄钟' },
    { to: '/focus-sessions', icon: History, label: '专注记录' },
    { to: '/milestones', icon: Flag, label: '里程碑' },
    { to: '/timeline', icon: GitBranch, label: '时间线' },
    { to: '/diary', icon: BookOpen, label: '开发日志' },
    { to: '/analytics', icon: BarChart3, label: '数据分析' },
    { to: '/gantt', icon: ChartNoAxesGantt, label: '甘特图' },
    { to: '/calendar', icon: CalendarDays, label: '日历' },
    { to: '/sprints', icon: Zap, label: '冲刺管理' },
    { to: '/collaboration', icon: Cloud, label: '团队协作' },
    { to: '/collaboration-control', icon: Stethoscope, label: '协作诊断' },
    { to: '/ai-command', icon: Bot, label: 'AI 指令' },
  ];

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    const id = await addProject({
      name: name.trim(),
      description: '',
      color,
      icon,
      status: 'active',
      deadline: deadline || null,
    });
    if (templateId && id) {
      await applyTemplate(templateId, id);
      await useAppStore.getState().loadProjects();
    }
    setName('');
    setDeadline('');
    setTemplateId('');
    setShowCreate(false);
    setShowSelector(false);
  }, [addProject, color, deadline, icon, name, templateId]);

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async event => {
      try {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text);
        const { db } = await import('../../db/database');

        if (data.projects) {
          for (const project of data.projects) {
            await db.projects.put(project);
            if (data.tasks) await db.tasks.bulkPut(data.tasks.filter((task: any) => task.projectId === project.id));
            if (data.milestones) {
              await db.milestones.bulkPut(data.milestones.filter((milestone: any) => milestone.projectId === project.id));
            }
            if (data.timelineEvents) {
              await db.timelineEvents.bulkPut(data.timelineEvents.filter((item: any) => item.projectId === project.id));
            }
            if (data.diaryEntries) {
              await db.diaryEntries.bulkPut(data.diaryEntries.filter((entry: any) => entry.projectId === project.id));
            }
          }
        }

        await useAppStore.getState().loadProjects();
        setShowSelector(false);
      } catch {
        // no-op
      }
    };
    input.click();
  };

  const handleSetDeadline = async (projectId: number) => {
    await updateProject(projectId, { deadline: editDeadlineValue || null });
    await useAppStore.getState().loadProjects();
    setEditingDeadlineId(null);
  };

  return (
    <aside className="flex h-screen w-[292px] shrink-0 flex-col border-r border-white/[0.05] bg-[#09111c]/95 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-white/[0.05] p-4">
        <div className="relative flex-1">
          <button
            onClick={() => setShowSelector(value => !value)}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.05]"
          >
            {currentProject ? <ProjectFolderIcon name={currentProject.name} color={currentProject.color} size="sm" /> : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05]">
                <FolderKanban size={18} className="text-slate-500" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{currentProject?.name || '选择项目'}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">当前工作空间</p>
            </div>
            <ChevronDown size={16} className={`text-slate-500 transition ${showSelector ? 'rotate-180' : ''}`} />
          </button>

          {showSelector && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-white/[0.08] bg-[#0c1523]/95 p-2 shadow-2xl backdrop-blur">
              <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">选择项目</p>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {projects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setCurrentProject(project.id!);
                      setShowSelector(false);
                      navigate('/');
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm transition ${
                      project.id === currentProjectId ? 'bg-sky-500/12 text-sky-300' : 'text-slate-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <ProjectFolderIcon name={project.name} color={project.color} size="sm" />
                    <span className="truncate">{project.name}</span>
                    {project.id === currentProjectId && <span className="ml-auto h-2 w-2 rounded-full bg-sky-400" />}
                  </button>
                ))}
              </div>

              <div className="mt-2 space-y-1 border-t border-white/[0.05] pt-2">
                <button
                  onClick={() => {
                    const project = projects.find(item => item.id === currentProjectId);
                    if (project?.id) {
                      setEditingDeadlineId(project.id);
                      setEditDeadlineValue(project.deadline || '');
                    }
                    setShowSelector(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <Calendar size={16} />
                  设置截止日期
                </button>
                <button
                  onClick={() => {
                    setShowCreate(true);
                    setShowSelector(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <Plus size={16} />
                  创建新项目
                </button>
                <button
                  onClick={handleImport}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <Upload size={16} />
                  导入项目
                </button>
              </div>
            </div>
          )}
        </div>
        <NotificationBell />
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          {navItems.filter(item => {
            const config = sidebarItems.find(s => s.to === item.to);
            return !config || config.visible;
          }).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'border border-sky-500/20 bg-sky-500/10 text-sky-300'
                    : 'border border-transparent text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 transition-all ${isActive ? 'bg-sky-500/15 shadow-[0_0_12px_rgba(14,165,233,0.15)]' : 'bg-white/[0.03]'}`}>
                    <item.icon size={18} className={isActive ? 'text-sky-300' : 'text-slate-400'} />
                  </div>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="mt-5 border-t border-white/[0.05] pt-5">
          <p className="mb-2 px-2 text-[10px] uppercase tracking-[0.2em] text-slate-600">系统</p>
          <div className="space-y-1">
            {(() => {
              const sysItems = [
                { to: '/backup', icon: DatabaseBackup, label: '备份恢复' },
                { to: '/projects', icon: Layers, label: '项目管理' },
                { to: '/achievements', icon: Trophy, label: '成就系统' },
              ];
              return sysItems.filter(item => {
                const config = sidebarItems.find(s => s.to === item.to);
                return !config || config.visible;
              }).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? 'border border-sky-500/20 bg-sky-500/10 text-sky-300'
                        : 'border border-transparent text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 transition-all ${isActive ? 'bg-sky-500/15 shadow-[0_0_12px_rgba(14,165,233,0.15)]' : 'bg-white/[0.03]'}`}>
                        <item.icon size={18} className={isActive ? 'text-sky-300' : 'text-slate-400'} />
                      </div>
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ));
            })()}
          </div>
        </div>
      </nav>

      <div className="border-t border-white/[0.05] p-4">
        <div className="mb-3">
          <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.2em] text-slate-600">专注面板</p>
          <FocusTimerPanel />
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2">
          <button
            onClick={() => navigate('/settings')}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Settings size={15} />
            设置
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="glass glow w-full max-w-md p-6" onClick={event => event.stopPropagation()}>
            <h3 className="mb-5 text-lg font-bold text-white">创建新项目</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">模板（可选）</label>
                <select
                  value={templateId}
                  onChange={event => {
                    const id = event.target.value;
                    setTemplateId(id);
                    const tpl = PROJECT_TEMPLATES.find(t => t.id === id);
                    if (tpl) {
                      setName(tpl.name);
                      setIcon(tpl.icon);
                      setColor(tpl.color);
                    }
                  }}
                  className="custom-select w-full rounded-xl border border-white/[0.06] bg-[#0d1726]/90 px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none"
                >
                  <option value="">不使用模板</option>
                  {PROJECT_TEMPLATES.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>{tpl.icon} {tpl.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">项目名称</label>
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="例如：版本发布节奏优化"
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
                  onKeyDown={event => event.key === 'Enter' && handleCreate()}
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-slate-400">项目文件夹预览</label>
                <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                  <ProjectFolderIcon name={name || '新项目'} color={color} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{name || '新项目'}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">统一使用文件夹图标，名称缩写显示在文件夹上。</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-slate-400">主题色</label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map(projectColor => (
                    <button
                      key={projectColor}
                      onClick={() => setColor(projectColor)}
                      className="h-8 w-8 rounded-full transition"
                      style={{
                        backgroundColor: projectColor,
                        transform: color === projectColor ? 'scale(1.18)' : 'scale(1)',
                        boxShadow: color === projectColor ? `0 0 0 3px ${projectColor}20` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-slate-400">截止日期（可选）</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={event => setDeadline(event.target.value)}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white">
                取消
              </button>
              <button onClick={handleCreate} className="rounded-xl bg-sky-500 px-5 py-2 text-sm font-medium text-white hover:bg-sky-600">
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {editingDeadlineId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setEditingDeadlineId(null)}>
          <div className="glass glow w-full max-w-sm p-6" onClick={event => event.stopPropagation()}>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
              <Calendar size={18} className="text-sky-400" />
              设置项目截止日期
            </h3>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">截止日期</label>
              <input
                type="date"
                value={editDeadlineValue}
                onChange={event => setEditDeadlineValue(event.target.value)}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditingDeadlineId(null)} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white">
                取消
              </button>
              <button onClick={() => handleSetDeadline(editingDeadlineId)} className="rounded-xl bg-sky-500 px-5 py-2 text-sm font-medium text-white hover:bg-sky-600">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
