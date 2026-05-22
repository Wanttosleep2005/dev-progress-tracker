import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, X } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useDiaryStore } from '../stores/useDiaryStore';
import { useTaskStore } from '../stores/useTaskStore';
import { useStatsStore } from '../stores/useStatsStore';
import { MOOD_LABELS, PRIORITY_LABELS, TASK_TEMPLATES } from '../types';
import type { MoodType, TaskPriority } from '../types';
import { startFocusTimer, stopFocusTimer } from './FocusTimer';
import SelectField from './ui/SelectField';
import { minutesToSeconds } from '../lib/duration';

interface Props {
  open: boolean;
  onClose: () => void;
  type: 'time' | 'task' | 'diary';
}

export default function QuickLogModal({ open, type, onClose }: Props) {
  const { currentProjectId, projects } = useAppStore();
  const { upsert: upsertDiary } = useDiaryStore();
  const { add: addTask, tasks } = useTaskStore();

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('25');
  const [timing, setTiming] = useState(false);
  const [timerTaskTitle, setTimerTaskTitle] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');
  const [mood, setMood] = useState<MoodType>('good');
  const [content, setContent] = useState('');

  const effectiveProjectId = selectedProjectId ?? currentProjectId;
  const projectTasks = useMemo(() => tasks.filter(task => task.projectId === effectiveProjectId), [tasks, effectiveProjectId]);

  const handleTimeLog = useCallback(() => {
    const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
    if (totalMinutes <= 0 || !effectiveProjectId) return;
    const selectedTask = tasks.find(task => task.id === selectedTaskId);
    useStatsStore.getState().addSession(minutesToSeconds(totalMinutes), selectedTask?.title, effectiveProjectId, selectedTaskId);
    onClose();
  }, [effectiveProjectId, hours, minutes, onClose, selectedTaskId, tasks]);

  const handleTask = useCallback(async () => {
    if (!title.trim() || !effectiveProjectId) return;
    await addTask({
      projectId: effectiveProjectId,
      title: title.trim(),
      description: '',
      status: 'todo',
      priority,
      tags: [],
      dueDate: null,
      milestoneId: null,
      estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) || null : null,
      url: '',
      source: 'board',
      remindAt: null,
      isTodayTask: false,
      publishedAt: null,
    });
    onClose();
  }, [addTask, effectiveProjectId, estimatedMinutes, onClose, priority, title]);

  const handleDiary = useCallback(async () => {
    if (!content.trim() || !effectiveProjectId) return;
    await upsertDiary({
      projectId: effectiveProjectId,
      date: new Date().toISOString().split('T')[0],
      content: content.trim(),
      mood,
      tags: [],
    });
    onClose();
  }, [content, effectiveProjectId, mood, onClose, upsertDiary]);

  const toggleTimer = () => {
    if (timing) {
      stopFocusTimer();
      setTiming(false);
      return;
    }
    startFocusTimer(timerTaskTitle, selectedTaskId);
    setTiming(true);
  };

  if (!open) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={event => event.stopPropagation()} className="glass glow w-full max-w-lg p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{type === 'time' ? '记录耗时' : type === 'task' ? '快速建任务' : '写开发日志'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05]">
            <X size={18} />
          </button>
        </div>

        {projects.length > 1 && (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs text-slate-400">所属项目</label>
            <SelectField
              value={effectiveProjectId ?? ''}
              onChange={event => {
                setSelectedProjectId(event.target.value ? parseInt(event.target.value) : null);
                setSelectedTaskId(null);
              }}
              options={projects.map(project => ({
                value: project.id!,
                label: `${project.icon} ${project.name}`,
              }))}
            />
          </div>
        )}

        {type === 'time' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">小时</label>
                <input type="number" min="0" value={hours} onChange={event => setHours(event.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">分钟</label>
                <input type="number" min="0" max="59" value={minutes} onChange={event => setMinutes(event.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">绑定任务</label>
              <SelectField
                value={selectedTaskId ?? ''}
                onChange={event => setSelectedTaskId(event.target.value ? parseInt(event.target.value) : null)}
                placeholder="不绑定任务"
                options={projectTasks.map(task => ({ value: task.id!, label: task.title }))}
              />
            </div>

            <div className="border-t border-white/[0.04] pt-4">
              <label className="mb-2 block text-xs text-slate-400">或者直接开始专注计时</label>
              <div className="flex items-center gap-3">
                <input
                  value={timerTaskTitle}
                  onChange={event => setTimerTaskTitle(event.target.value)}
                  placeholder="当前在做什么？"
                  className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-indigo-500/50 focus:outline-none"
                />
                <button
                  onClick={toggleTimer}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    timing ? 'border border-red-500/20 bg-red-500/10 text-red-400' : 'bg-indigo-500 text-white'
                  }`}
                >
                  {timing ? '停止' : '开始'}
                </button>
              </div>
            </div>
          </div>
        )}

        {type === 'task' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">任务标题</label>
              <input autoFocus value={title} onChange={event => setTitle(event.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-indigo-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">优先级</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(level => (
                  <button
                    key={level}
                    onClick={() => setPriority(level)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium ${
                      priority === level ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300' : 'border-white/[0.04] text-slate-500'
                    }`}
                  >
                    {PRIORITY_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">预估工时（分钟）</label>
              <input type="number" min="0" step="5" value={estimatedMinutes} onChange={event => setEstimatedMinutes(event.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TASK_TEMPLATES.slice(0, 4).map((template, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setTitle(template.title);
                    setPriority(template.priority);
                  }}
                  className="rounded bg-white/[0.02] px-2 py-1 text-[11px] text-slate-500 hover:bg-white/[0.04] hover:text-white"
                >
                  {template.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'diary' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">今天的状态</label>
              <div className="flex gap-2">
                {(Object.entries(MOOD_LABELS) as [MoodType, string][]).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setMood(key)}
                    className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl ${
                      mood === key ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/[0.04]'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">今日进展</label>
              <textarea autoFocus value={content} onChange={event => setContent(event.target.value)} rows={6} className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-indigo-500/50 focus:outline-none" />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
          <button onClick={type === 'time' ? handleTimeLog : type === 'task' ? handleTask : handleDiary} className="flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-600">
            <Save size={14} />
            保存
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
