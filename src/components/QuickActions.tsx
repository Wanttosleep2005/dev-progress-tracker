import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlarmClock, BookOpen, CheckSquare, Flag, GitBranch, Plus, TimerReset, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';
import { useDiaryStore } from '../stores/useDiaryStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { useTaskStore } from '../stores/useTaskStore';
import { useTimelineStore } from '../stores/useTimelineStore';
import SelectField from './ui/SelectField';
import type { MoodType, TaskPriority } from '../types';
import { MOOD_LABELS, PRIORITY_LABELS } from '../types';

type QuickAction = 'task' | 'event' | 'diary' | 'today-task' | 'milestone' | 'focus-record' | null;

export default function QuickActions() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<QuickAction>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');
  const [mood, setMood] = useState<MoodType>('good');
  const [tagText, setTagText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [milestoneId, setMilestoneId] = useState<number | null>(null);
  const [eventType, setEventType] = useState<'release' | 'bugfix' | 'milestone' | 'decision' | 'other'>('other');

  const currentProjectId = useAppStore(state => state.currentProjectId);
  const milestones = useMilestoneStore(state => state.milestones);
  const { add: addTask } = useTaskStore();
  const { add: addMilestone } = useMilestoneStore();
  const { add: addEvent } = useTimelineStore();
  const { upsert: upsertDiary } = useDiaryStore();

  const reset = () => {
    setTitle('');
    setDesc('');
    setPriority('medium');
    setEstimatedMinutes('30');
    setMood('good');
    setTagText('');
    setDueDate('');
    setRemindAt('');
    setMilestoneId(null);
    setEventType('other');
    setAction(null);
    setOpen(false);
  };

  const handleAction = useCallback(async () => {
    if (!currentProjectId) return;

    if (action === 'task' || action === 'today-task') {
      if (!title.trim()) return;
      await addTask({
        projectId: currentProjectId,
        title: title.trim(),
        description: desc.trim(),
        status: 'todo',
        priority,
        tags: tagText.split(',').map(tag => tag.trim()).filter(Boolean),
        dueDate: dueDate || null,
        milestoneId,
        estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) || null : null,
        url: '',
        recurrence: 'none',
        source: action === 'today-task' ? 'daily' : 'board',
        remindAt: action === 'today-task' ? remindAt || null : null,
        isTodayTask: action === 'today-task',
        publishedAt: action === 'today-task' ? new Date().toISOString() : null,
      });
    } else if (action === 'event') {
      if (!title.trim()) return;
      await addEvent({
        projectId: currentProjectId,
        title: title.trim(),
        description: desc.trim(),
        type: eventType,
        date: new Date().toISOString().split('T')[0],
        relatedTaskId: null,
      });
    } else if (action === 'diary') {
      if (!title.trim() && !desc.trim()) return;
      await upsertDiary({
        projectId: currentProjectId,
        date: new Date().toISOString().split('T')[0],
        content: `# ${title.trim() || '今日日志'}\n\n${desc.trim()}`,
        mood,
        tags: tagText.split(',').map(tag => tag.trim()).filter(Boolean),
      });
    } else if (action === 'milestone') {
      if (!title.trim()) return;
      await addMilestone({
        projectId: currentProjectId,
        title: title.trim(),
        description: desc.trim(),
        dueDate: dueDate || null,
        type: 'progress',
        progress: 0,
        status: 'upcoming',
        taskIds: [],
      });
    } else if (action === 'focus-record') {
      navigate('/focus-sessions');
      reset();
      return;
    }

    reset();
  }, [action, addEvent, addMilestone, addTask, currentProjectId, desc, dueDate, estimatedMinutes, eventType, milestoneId, mood, navigate, priority, remindAt, tagText, title, upsertDiary]);

  const quickButtons = [
    { key: 'task' as const, icon: CheckSquare, label: '创建任务', placeholder: '任务标题...', descPlaceholder: '任务说明（可选）' },
    { key: 'today-task' as const, icon: AlarmClock, label: '发布今日任务', placeholder: '今日任务标题...', descPlaceholder: '补充今日目标（可选）' },
    { key: 'milestone' as const, icon: Flag, label: '创建里程碑', placeholder: '里程碑标题...', descPlaceholder: '里程碑说明（可选）' },
    { key: 'event' as const, icon: GitBranch, label: '记录事件', placeholder: '事件标题...', descPlaceholder: '事件描述（可选）' },
    { key: 'diary' as const, icon: BookOpen, label: '写日志', placeholder: '日志标题...', descPlaceholder: '日志内容（支持 Markdown）' },
    { key: 'focus-record' as const, icon: TimerReset, label: '查看专注记录', placeholder: '', descPlaceholder: '' },
  ];

  const currentActionMeta = action ? quickButtons.find(button => button.key === action) : null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-16 right-0 mb-2 flex flex-col items-end gap-2">
              {quickButtons.map((button, index) => (
                <motion.button
                  key={button.key}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    if (button.key === 'focus-record') {
                      navigate('/focus-sessions');
                      setOpen(false);
                      return;
                    }
                    setAction(button.key);
                    setOpen(false);
                  }}
                  className="glass flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm text-slate-300 transition-all hover:bg-white/[0.05] hover:text-white"
                >
                  <span>{button.label}</span>
                  <button.icon size={16} />
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(value => !value)}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-xl shadow-sky-500/30 transition-all hover:shadow-sky-500/40"
        >
          <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
            <Plus size={24} className="text-white" />
          </motion.div>
        </motion.button>
      </div>

      <AnimatePresence>
        {action !== null && action !== 'focus-record' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8 backdrop-blur-sm"
            onClick={reset}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={event => event.stopPropagation()}
              className="glass glow w-full max-w-lg p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{currentActionMeta?.label}</h3>
                <button onClick={reset} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {!currentProjectId ? (
                <p className="py-8 text-center text-sm text-slate-500">请先在侧边栏选择或创建一个项目。</p>
              ) : (
                <div className="space-y-3">
                  <input
                    autoFocus
                    value={title}
                    onChange={event => setTitle(event.target.value)}
                    placeholder={currentActionMeta?.placeholder}
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
                    onKeyDown={event => event.key === 'Enter' && handleAction()}
                  />

                  {(action === 'task' || action === 'today-task' || action === 'event' || action === 'diary' || action === 'milestone') && (
                    <textarea
                      value={desc}
                      onChange={event => setDesc(event.target.value)}
                      placeholder={currentActionMeta?.descPlaceholder}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
                    />
                  )}

                  {(action === 'task' || action === 'today-task' || action === 'diary') && (
                    <input
                      value={tagText}
                      onChange={event => setTagText(event.target.value)}
                      placeholder="标签，用逗号分隔"
                      className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
                    />
                  )}

                  {(action === 'task' || action === 'today-task') && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <SelectField
                          value={priority}
                          onChange={event => setPriority(event.target.value as TaskPriority)}
                          options={(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(item => ({
                            value: item,
                            label: PRIORITY_LABELS[item],
                          }))}
                        />
                        <input
                          type="number"
                          min="0"
                          step="5"
                          value={estimatedMinutes}
                          onChange={event => setEstimatedMinutes(event.target.value)}
                          placeholder="预估工时（分钟）"
                          className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                          <label className="mb-1 block text-[11px] text-slate-500">截止时间</label>
                          <input
                            type="datetime-local"
                            value={dueDate}
                            onChange={event => setDueDate(event.target.value)}
                            className="w-full bg-transparent text-sm text-white focus:outline-none"
                          />
                        </div>
                        {action === 'today-task' ? (
                          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                            <label className="mb-1 block text-[11px] text-slate-500">提醒时间</label>
                            <input
                              type="datetime-local"
                              value={remindAt}
                              onChange={event => setRemindAt(event.target.value)}
                              className="w-full bg-transparent text-sm text-white focus:outline-none"
                            />
                          </div>
                        ) : (
                          <SelectField
                            value={milestoneId ?? ''}
                            onChange={event => setMilestoneId(event.target.value ? parseInt(event.target.value) : null)}
                            options={milestones.map(milestone => ({ value: milestone.id!, label: milestone.title }))}
                            placeholder="暂不关联里程碑"
                          />
                        )}
                      </div>
                    </>
                  )}

                  {action === 'milestone' && (
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                      <label className="mb-1 block text-[11px] text-slate-500">目标日期</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={event => setDueDate(event.target.value)}
                        className="w-full bg-transparent text-sm text-white focus:outline-none"
                      />
                    </div>
                  )}

                  {action === 'event' && (
                    <SelectField
                      value={eventType}
                      onChange={event => setEventType(event.target.value as typeof eventType)}
                      options={[
                        { value: 'other', label: '其他事件' },
                        { value: 'release', label: '版本发布' },
                        { value: 'bugfix', label: '缺陷修复' },
                        { value: 'milestone', label: '里程碑节点' },
                        { value: 'decision', label: '关键决策' },
                      ]}
                    />
                  )}

                  {action === 'diary' && (
                    <div className="flex gap-2">
                      {(Object.entries(MOOD_LABELS) as [MoodType, string][]).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setMood(key)}
                          className={`flex h-11 w-11 items-center justify-center rounded-xl border text-lg ${mood === key ? 'border-sky-500/40 bg-sky-500/10' : 'border-white/[0.06]'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button onClick={reset} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
                    <button onClick={handleAction} className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-medium text-white hover:bg-sky-600">确认</button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
