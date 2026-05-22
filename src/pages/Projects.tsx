import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Copy as CopyIcon, Download, Plus, Trash2, Upload } from 'lucide-react';
import { db, cloneProject } from '../db/database';
import { useAppStore } from '../stores/useAppStore';
import { PROJECT_COLORS, PROJECT_ICONS } from '../types';

export default function Projects() {
  const { projects, addProject, deleteProject, setCurrentProject, achievements, loadProjects } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [icon, setIcon] = useState(PROJECT_ICONS[0]);
  const [deadline, setDeadline] = useState('');
  const navigate = useNavigate();

  const handleAdd = async () => {
    if (!name.trim()) return;
    await addProject({
      name: name.trim(),
      description: description.trim(),
      color,
      icon,
      status: 'active',
      deadline: deadline || null,
    });
    setName('');
    setDescription('');
    setShowAdd(false);
    setDeadline('');
  };

  const handleSelect = (id: number) => {
    setCurrentProject(id);
    navigate('/');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event: any) => {
      try {
        const text = await event.target.files[0].text();
        const data = JSON.parse(text);
        if (data.projects) {
          for (const project of data.projects) {
            const existing = await db.projects.get(project.id);
            if (existing) await db.projects.update(project.id, project);
            else await db.projects.add(project);
            if (data.tasks) {
              const projectTasks = data.tasks.filter((task: any) => task.projectId === project.id);
              if (projectTasks.length) await db.tasks.bulkPut(projectTasks);
            }
            if (data.milestones) {
              const projectMilestones = data.milestones.filter((milestone: any) => milestone.projectId === project.id);
              if (projectMilestones.length) await db.milestones.bulkPut(projectMilestones);
            }
            if (data.timelineEvents) {
              const projectEvents = data.timelineEvents.filter((item: any) => item.projectId === project.id);
              if (projectEvents.length) await db.timelineEvents.bulkPut(projectEvents);
            }
            if (data.diaryEntries) {
              const projectEntries = data.diaryEntries.filter((entry: any) => entry.projectId === project.id);
              if (projectEntries.length) await db.diaryEntries.bulkPut(projectEntries);
            }
          }
        }
        await loadProjects();
      } catch {
        // no-op
      }
    };
    input.click();
  };

  const handleExport = async () => {
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
  };

  const handleClone = async (projectId: number, projectName: string) => {
    const newId = await cloneProject(projectId, `${projectName}（副本）`);
    await loadProjects();
    setCurrentProject(newId);
  };

  const unlockedCount = achievements.filter(achievement => achievement.unlockedAt).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-5xl py-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">项目管理</h2>
          <p className="mt-1 text-sm text-slate-400">{projects.length} 个项目 · 已解锁成就 {unlockedCount}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-slate-300 transition-all hover:bg-white/[0.04]">
            <Download size={14} /> 导出全部
          </button>
          <button onClick={handleImport} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-slate-300 transition-all hover:bg-white/[0.04]">
            <Upload size={14} /> 导入项目
          </button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-sky-600">
            <Plus size={16} /> 新建项目
          </motion.button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map(project => (
          <motion.button
            key={project.id}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect(project.id!)}
            className="glass glass-hover group relative p-6 text-left"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: `${project.color}15` }}>
                {project.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 font-semibold text-white transition-colors group-hover:text-sky-300">{project.name}</h3>
                {project.description && <p className="line-clamp-2 text-xs text-slate-500">{project.description}</p>}
                {project.deadline && <p className="mt-2 text-[11px] text-slate-600">截止：{project.deadline}</p>}
              </div>
            </div>

            <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-all group-hover:opacity-100">
              <button onClick={event => { event.stopPropagation(); if (project.id) handleClone(project.id, project.name); }} className="rounded-lg p-1.5 text-slate-600 transition-all hover:bg-sky-500/10 hover:text-sky-300" title="克隆项目">
                <CopyIcon size={14} />
              </button>
              <button onClick={event => { event.stopPropagation(); if (project.id) deleteProject(project.id); }} className="rounded-lg p-1.5 text-slate-600 transition-all hover:bg-red-500/10 hover:text-red-400" title="删除项目">
                <Trash2 size={14} />
              </button>
            </div>
          </motion.button>
        ))}

        {projects.length === 0 && (
          <div className="col-span-2 py-16 text-center">
            <p className="mb-2 text-slate-500">还没有项目</p>
            <p className="text-sm text-slate-600">点击右上角“新建项目”或“导入项目”开始。</p>
          </div>
        )}
      </div>

      {showAdd && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={event => event.stopPropagation()} className="glass glow w-full max-w-md p-6">
            <h3 className="mb-4 text-lg font-bold text-white">创建新项目</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">项目名称</label>
                <input value={name} onChange={event => setName(event.target.value)} placeholder="例如：我的网站改版" className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none" onKeyDown={event => event.key === 'Enter' && handleAdd()} autoFocus />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">描述</label>
                <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="项目简介（可选）" rows={2} className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">图标</label>
                <div className="flex flex-wrap gap-1.5">{PROJECT_ICONS.map(item => <button key={item} onClick={() => setIcon(item)} className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all ${icon === item ? 'bg-sky-500/20 ring-1 ring-sky-500/30 scale-110' : 'hover:bg-white/[0.03]'}`}>{item}</button>)}</div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">主题色</label>
                <div className="flex gap-1.5">{PROJECT_COLORS.map(item => <button key={item} onClick={() => setColor(item)} className="h-7 w-7 rounded-full transition-all" style={{ backgroundColor: item, transform: color === item ? 'scale(1.3)' : 'scale(1)', boxShadow: color === item ? `0 0 12px ${item}40` : 'none' }} />)}</div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">截止日期（可选）</label>
                <input type="date" value={deadline} onChange={event => setDeadline(event.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
              <button onClick={handleAdd} className="rounded-lg bg-sky-500 px-6 py-2 text-sm font-medium text-white hover:bg-sky-600">创建</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
