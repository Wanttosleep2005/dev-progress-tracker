import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { Subtask } from '../types';

interface SubtaskListProps {
  subtasks: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
}

export default function SubtaskList({ subtasks, onChange }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState('');

  const completed = subtasks.filter(s => s.done).length;
  const total = subtasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const handleToggle = (id: string) => {
    onChange(subtasks.map(s => (s.id === id ? { ...s, done: !s.done } : s)));
  };

  const handleDelete = (id: string) => {
    onChange(subtasks.filter(s => s.id !== id));
  };

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    onChange([...subtasks, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, done: false }]);
    setNewTitle('');
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a101a]/90 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-300">子任务</span>
        {total > 0 && (
          <span className="text-[10px] text-slate-500">
            {completed}/{total} 完成
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      )}

      <AnimatePresence initial={false}>
        <div className="space-y-1.5">
          {subtasks.map(subtask => (
            <motion.div
              key={subtask.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.03]"
            >
              <button
                onClick={() => handleToggle(subtask.id)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                  subtask.done
                    ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                    : 'border-slate-600/50 bg-transparent text-transparent hover:border-slate-400'
                }`}
              >
                {subtask.done && <Check size={11} strokeWidth={3} />}
              </button>
              <span
                className={`min-w-0 flex-1 text-xs transition-all ${
                  subtask.done ? 'text-slate-600 line-through' : 'text-slate-300'
                }`}
              >
                {subtask.title}
              </span>
              <button
                onClick={() => handleDelete(subtask.id)}
                className="shrink-0 rounded p-0.5 text-slate-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-700">
          <Plus size={13} className="text-slate-500" />
        </div>
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="添加子任务，回车确认"
          className="min-w-0 flex-1 rounded-xl border border-white/[0.04] bg-transparent px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none transition focus:border-sky-500/30"
        />
        {newTitle.trim() && (
          <button
            onClick={handleAdd}
            className="shrink-0 rounded-lg bg-sky-500/15 p-1.5 text-sky-400 hover:bg-sky-500/25"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
