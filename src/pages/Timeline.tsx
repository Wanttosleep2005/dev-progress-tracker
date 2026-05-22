import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bug, Flag, GitBranch, Lightbulb, Pin, Plus, Rocket, X } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { useTimelineStore } from '../stores/useTimelineStore';
import { EVENT_TYPE_LABELS } from '../types';
import type { EventType } from '../types';

const typeIcons: Record<EventType, typeof Rocket> = {
  release: Rocket,
  bugfix: Bug,
  milestone: Flag,
  decision: Lightbulb,
  other: Pin,
};

const typeColors: Record<EventType, string> = {
  release: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  bugfix: 'border-rose-500/30 bg-rose-500/5 text-rose-400',
  milestone: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  decision: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
  other: 'border-slate-500/30 bg-slate-500/5 text-slate-400',
};

const eventTypes: EventType[] = ['release', 'bugfix', 'milestone', 'decision', 'other'];

export default function Timeline() {
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const { events, add, remove } = useTimelineStore();
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<EventType | 'all'>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<EventType>('other');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredEvents = filter === 'all' ? events : events.filter(event => event.type === filter);

  const grouped = filteredEvents.reduce<Record<string, typeof events>>((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim() || !currentProjectId) return;
    await add({
      projectId: currentProjectId,
      title: newTitle.trim(),
      description: newDesc.trim(),
      type: newType,
      date: newDate,
      relatedTaskId: null,
    });
    setNewTitle('');
    setNewDesc('');
    setNewType('other');
    setNewDate(new Date().toISOString().split('T')[0]);
    setShowAdd(false);
  }, [add, currentProjectId, newDate, newDesc, newTitle, newType]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">项目时间线</h2>
          <p className="mt-1 text-sm text-slate-400">{events.length} 条事件记录</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAdd(value => !value)}
          className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-600"
        >
          <Plus size={16} />
          记录事件
        </motion.button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass mb-6 overflow-hidden p-5"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">事件标题</label>
                <input
                  value={newTitle}
                  onChange={event => setNewTitle(event.target.value)}
                  placeholder="发生了什么？"
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 transition-colors focus:border-indigo-500/50 focus:outline-none"
                  onKeyDown={event => event.key === 'Enter' && handleAdd()}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">事件类型</label>
                <div className="flex gap-2">
                  {eventTypes.map(type => {
                    const Icon = typeIcons[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setNewType(type)}
                        className={`flex flex-1 items-center justify-center gap-1 rounded-lg border py-2 text-xs font-medium transition-all ${
                          newType === type
                            ? `${typeColors[type]} border-current`
                            : 'border-white/[0.04] text-slate-500 hover:border-white/[0.08]'
                        }`}
                      >
                        <Icon size={12} />
                        {EVENT_TYPE_LABELS[type]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">说明</label>
                <textarea
                  value={newDesc}
                  onChange={event => setNewDesc(event.target.value)}
                  placeholder="补充事件背景或结论"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 transition-colors focus:border-indigo-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">日期</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={event => setNewDate(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white transition-colors focus:border-indigo-500/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 transition-colors hover:text-white">取消</button>
              <button onClick={handleAdd} className="rounded-lg bg-indigo-500 px-6 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-600">记录事件</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            filter === 'all' ? 'bg-white/[0.06] text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          全部
        </button>
        {eventTypes.map(type => {
          const Icon = typeIcons[type];
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === type ? `${typeColors[type]} border border-current/30` : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={12} />
              {EVENT_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <div className="absolute bottom-0 left-5 top-4 w-px bg-gradient-to-b from-indigo-500/30 via-purple-500/20 to-transparent" />

        <div className="space-y-10">
          {sortedDates.length === 0 && (
            <div className="py-16 text-center">
              <GitBranch size={48} className="mx-auto mb-3 text-slate-700" />
              <p className="text-slate-500">时间线上还没有事件</p>
              <p className="mt-1 text-sm text-slate-600">可以从发布、修复、决策或里程碑开始记录。</p>
            </div>
          )}

          {sortedDates.map(date => (
            <motion.div key={date} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative">
              <div className="mb-4 flex items-center gap-3 pl-11">
                <div className="h-3 w-3 shrink-0 -translate-x-1.5 rounded-full border-2 border-indigo-500/30 bg-indigo-500" />
                <span className="text-sm font-semibold text-slate-400">
                  {new Date(date).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
              </div>

              <div className="space-y-3 pl-11">
                <AnimatePresence mode="popLayout">
                  {grouped[date].map(event => {
                    const Icon = typeIcons[event.type];
                    return (
                      <motion.div
                        key={event.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`glass glass-hover group relative border-l-2 p-4 ${typeColors[event.type]}`}
                      >
                        <button
                          onClick={() => event.id && remove(event.id)}
                          className="absolute right-3 top-3 rounded-lg p-1 text-slate-600 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                        >
                          <X size={12} />
                        </button>

                        <div className="flex items-start gap-3">
                          <div className={`shrink-0 rounded-lg border border-current/20 p-2 ${typeColors[event.type]}`}>
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium text-slate-200 transition-colors group-hover:text-white">{event.title}</h4>
                            {event.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{event.description}</p>}
                            <div className="mt-2 flex items-center gap-2">
                              <p className="text-[10px] text-slate-600">{EVENT_TYPE_LABELS[event.type]}</p>
                              {event.source === 'system' && (
                                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-400">
                                  自动记录
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
