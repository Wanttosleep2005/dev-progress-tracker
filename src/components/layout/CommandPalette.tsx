import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Search } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useTaskStore } from '../../stores/useTaskStore';
import { useMilestoneStore } from '../../stores/useMilestoneStore';
import { useDiaryStore } from '../../stores/useDiaryStore';
import { useTimelineStore } from '../../stores/useTimelineStore';
import { useCommandPalette } from '../../stores/useCommandPalette';

export default function CommandPalette() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { projects, currentProjectId, setCurrentProject } = useAppStore();
  const tasks = useTaskStore(state => state.tasks);
  const milestones = useMilestoneStore(state => state.milestones);
  const diaryEntries = useDiaryStore(state => state.entries);
  const timelineEvents = useTimelineStore(state => state.events);
  const { open, query, closePalette, setQuery } = useCommandPalette();

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const pages = [
    { label: '概览', to: '/' },
    { label: '项目总览', to: '/portfolio' },
    { label: '任务看板', to: '/tasks' },
    { label: '里程碑', to: '/milestones' },
    { label: '时间线', to: '/timeline' },
    { label: '开发日志', to: '/diary' },
    { label: '数据分析', to: '/analytics' },
    { label: '番茄钟', to: '/pomodoro' },
    { label: '甘特图', to: '/gantt' },
    { label: '团队协作', to: '/collaboration' },
    { label: 'AI 指令中心', to: '/ai-command' },
    { label: '项目管理', to: '/projects' },
    { label: '设置', to: '/settings' },
  ];

  const normalizedQuery = query.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    if (!normalizedQuery) return [];
    return tasks
      .filter(task => {
        const haystack = [task.title, task.description, ...task.tags].join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [normalizedQuery, tasks]);

  const filteredProjects = useMemo(() => {
    if (!normalizedQuery) return [];
    return projects
      .filter(project => [project.name, project.description].join(' ').toLowerCase().includes(normalizedQuery))
      .slice(0, 4);
  }, [normalizedQuery, projects]);

  const filteredPages = useMemo(() => {
    if (!normalizedQuery) return pages;
    return pages.filter(page => page.label.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery]);

  const filteredMilestones = useMemo(() => {
    if (!normalizedQuery) return [];
    return milestones
      .filter(m => [m.title, m.description].join(' ').toLowerCase().includes(normalizedQuery))
      .slice(0, 4);
  }, [normalizedQuery, milestones]);

  const filteredDiaries = useMemo(() => {
    if (!normalizedQuery) return [];
    return diaryEntries
      .filter(d => [d.content, ...d.tags].join(' ').toLowerCase().includes(normalizedQuery))
      .slice(0, 4);
  }, [normalizedQuery, diaryEntries]);

  const filteredEvents = useMemo(() => {
    if (!normalizedQuery) return [];
    return timelineEvents
      .filter(e => [e.title, e.description].join(' ').toLowerCase().includes(normalizedQuery))
      .slice(0, 4);
  }, [normalizedQuery, timelineEvents]);

  const handleOpenTask = (projectId: number, taskId?: number) => {
    if (projectId !== currentProjectId) {
      setCurrentProject(projectId);
    }
    closePalette();
    navigate('/tasks', { state: taskId ? { taskId } : undefined });
  };

  const handleOpenProject = (projectId: number) => {
    setCurrentProject(projectId);
    closePalette();
    navigate('/');
  };

  const handleOpenPage = (to: string) => {
    closePalette();
    navigate(to);
  };

  const handleOpenMilestone = (projectId: number) => {
    if (projectId !== currentProjectId) setCurrentProject(projectId);
    closePalette();
    navigate('/milestones');
  };

  const handleOpenDiary = (projectId: number, date: string) => {
    if (projectId !== currentProjectId) setCurrentProject(projectId);
    closePalette();
    navigate('/diary', { state: { date } });
  };

  const handleOpenEvent = (projectId: number) => {
    if (projectId !== currentProjectId) setCurrentProject(projectId);
    closePalette();
    navigate('/timeline');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={closePalette}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            onClick={event => event.stopPropagation()}
            className="glass w-full max-w-2xl overflow-hidden border border-white/[0.08] shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-4">
              <Search size={18} className="shrink-0 text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="搜索页面、任务、项目或标签"
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
              <kbd className="rounded bg-white/[0.04] px-2 py-1 text-[10px] text-slate-500">关闭</kbd>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-2">
              {filteredTasks.length > 0 && (
                <section className="mb-3">
                  <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">任务</p>
                  {filteredTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleOpenTask(task.projectId, task.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.04]"
                    >
                      <ArrowRight size={14} className="shrink-0 text-slate-600" />
                      <div className="min-w-0">
                        <p className="truncate">{task.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{task.tags.join(' / ') || '无标签'}</p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {filteredProjects.length > 0 && (
                <section className="mb-3">
                  <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">项目</p>
                  {filteredProjects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleOpenProject(project.id!)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.04]"
                    >
                      <span className="text-base">{project.icon}</span>
                      <div className="min-w-0">
                        <p className="truncate">{project.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{project.description || '暂无项目描述'}</p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {filteredMilestones.length > 0 && (
                <section className="mb-3">
                  <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">里程碑</p>
                  {filteredMilestones.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleOpenMilestone(m.projectId)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.04]"
                    >
                      <span className="text-base">🎯</span>
                      <div className="min-w-0">
                        <p className="truncate">{m.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{m.description || '暂无描述'} · {m.progress}%</p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {filteredDiaries.length > 0 && (
                <section className="mb-3">
                  <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">日记</p>
                  {filteredDiaries.map(d => (
                    <button
                      key={d.id}
                      onClick={() => handleOpenDiary(d.projectId, d.date)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.04]"
                    >
                      <span className="text-base">📝</span>
                      <div className="min-w-0">
                        <p className="truncate">{d.date}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{d.content.slice(0, 80)}{d.content.length > 80 ? '…' : ''}</p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {filteredEvents.length > 0 && (
                <section className="mb-3">
                  <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">时间线事件</p>
                  {filteredEvents.map(e => (
                    <button
                      key={e.id}
                      onClick={() => handleOpenEvent(e.projectId)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.04]"
                    >
                      <span className="text-base">📅</span>
                      <div className="min-w-0">
                        <p className="truncate">{e.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{e.date} · {e.description.slice(0, 50)}{e.description.length > 50 ? '…' : ''}</p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              <section>
                <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">页面</p>
                {filteredPages.map(page => (
                  <button
                    key={page.to}
                    onClick={() => handleOpenPage(page.to)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.04]"
                  >
                    <ArrowRight size={14} className="shrink-0 text-slate-600" />
                    <span>{page.label}</span>
                  </button>
                ))}
              </section>

              {normalizedQuery && filteredTasks.length === 0 && filteredProjects.length === 0 && filteredPages.length === 0 && filteredMilestones.length === 0 && filteredDiaries.length === 0 && filteredEvents.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-slate-500">
                  没有找到匹配结果，可以试试项目名、任务标题、标签、日记内容或里程碑关键词。
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
