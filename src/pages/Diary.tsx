import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronLeft, ChevronRight, Edit3, Save, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppStore } from '../stores/useAppStore';
import { useDiaryStore } from '../stores/useDiaryStore';
import { MOOD_COLORS, MOOD_LABELS } from '../types';
import type { MoodType } from '../types';

const MOODS: MoodType[] = ['great', 'good', 'meh', 'bad', 'terrible'];
const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

export default function Diary() {
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const { entries, upsert, remove } = useDiaryStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<MoodType>('meh');
  const [tags, setTags] = useState('');

  const dateStr = currentDate.toISOString().split('T')[0];
  const currentEntry = useMemo(() => entries.find(entry => entry.date === dateStr), [entries, dateStr]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let index = 0; index < adjustedFirstDay; index += 1) days.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) days.push(day);
    return days;
  }, [adjustedFirstDay, daysInMonth]);

  const monthlyCount = useMemo(
    () =>
      entries.filter(entry => {
        const date = new Date(entry.date);
        return date.getFullYear() === year && date.getMonth() === month;
      }).length,
    [entries, month, year]
  );

  const hasEntry = useCallback(
    (day: number) => {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return entries.some(entry => entry.date === date);
    },
    [entries, month, year]
  );

  const getEntryMood = useCallback(
    (day: number) => {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return entries.find(entry => entry.date === date)?.mood;
    },
    [entries, month, year]
  );

  const navigateMonth = (delta: number) => {
    setCurrentDate(new Date(year, month + delta, 1));
  };

  const selectDay = (day: number) => {
    setCurrentDate(new Date(year, month, day));
    setEditing(false);
  };

  const startEditing = () => {
    setContent(currentEntry?.content || '');
    setMood(currentEntry?.mood || 'meh');
    setTags(currentEntry?.tags.join(', ') || '');
    setEditing(true);
  };

  const handleSave = useCallback(async () => {
    if (!currentProjectId && !currentEntry?.projectId) return;
    await upsert({
      projectId: currentEntry?.projectId ?? currentProjectId!,
      date: dateStr,
      content: content.trim(),
      mood,
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
    });
    setEditing(false);
  }, [content, currentEntry?.projectId, currentProjectId, dateStr, mood, tags, upsert]);

  const handleDelete = useCallback(async () => {
    if (currentEntry?.id) {
      await remove(currentEntry.id);
      setEditing(false);
      setContent('');
      setMood('meh');
      setTags('');
    }
  }, [currentEntry, remove]);

  const today = new Date();
  const isToday = dateStr === today.toISOString().split('T')[0];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">开发日志</h2>
          <p className="mt-1 text-sm text-slate-400">{entries.length} 篇记录，持续沉淀开发轨迹与复盘内容。</p>
        </div>
        {!editing && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startEditing}
            className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-sky-600"
          >
            <Edit3 size={16} />
            {currentEntry ? '编辑日志' : '写日志'}
          </motion.button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="glass rounded-[28px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => navigateMonth(-1)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-white">{year} 年 {month + 1} 月</span>
            <button onClick={() => navigateMonth(1)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7">
            {DAY_NAMES.map(day => (
              <div key={day} className="py-1 text-center text-[10px] font-medium text-slate-500">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const isCurrentMonth = day !== null;
              const entryMood = isCurrentMonth ? getEntryMood(day) : undefined;
              const isSelected = isCurrentMonth && day === currentDate.getDate() && month === currentDate.getMonth();
              const isTodayDate = isCurrentMonth && day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

              if (!isCurrentMonth) return <div key={`empty-${index}`} className="aspect-square" />;

              return (
                <motion.button
                  key={day}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => selectDay(day!)}
                  className={`relative aspect-square rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30'
                      : isTodayDate
                        ? 'bg-white/[0.03] text-white ring-1 ring-white/[0.08]'
                        : 'text-slate-400 hover:bg-white/[0.03] hover:text-white'
                  }`}
                >
                  <div className="flex h-full flex-col items-center justify-center">
                    {day}
                    {entryMood && <span className="text-[10px] leading-none">{MOOD_LABELS[entryMood]}</span>}
                    {hasEntry(day!) && (
                      <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: MOOD_COLORS[entryMood!] }} />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-white/[0.04] pt-4">
            <div className="flex justify-between text-xs text-slate-500">
              <span>本月日志：{monthlyCount} 篇</span>
              <span>总计：{entries.length} 篇</span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="glass rounded-[28px] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">
                {new Date(dateStr).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
              </h3>
              {isToday && <span className="text-[10px] font-medium text-sky-400">今天</span>}
            </div>
            {editing && currentEntry && (
              <button onClick={handleDelete} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10">
                <Trash2 size={12} />
                删除
              </button>
            )}
          </div>

          {editing ? (
            <>
              <div className="mb-4 flex gap-2">
                {MOODS.map(item => (
                  <motion.button
                    key={item}
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setMood(item)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition-all ${
                      mood === item ? 'border-sky-500/50 bg-sky-500/10 shadow-lg shadow-sky-500/10' : 'border-white/[0.04] hover:border-white/[0.08]'
                    }`}
                    title={item}
                  >
                    {MOOD_LABELS[item]}
                  </motion.button>
                ))}
              </div>

              <input
                value={tags}
                onChange={event => setTags(event.target.value)}
                placeholder="标签，用逗号分隔，例如：复盘、需求、沟通"
                className="mb-3 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
              />

              <textarea
                value={content}
                onChange={event => setContent(event.target.value)}
                placeholder={`今天推进了什么？支持 Markdown，例如：

# 今日完成
- 修复任务联动
- 补齐风险周报

## 明日计划
- 优化图表`}
                rows={16}
                className="min-h-[360px] w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 font-mono text-sm leading-relaxed text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
              />

              <div className="mt-4 flex justify-end gap-3">
                <button onClick={() => setEditing(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} className="flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2 text-sm font-medium text-white hover:bg-sky-600">
                  <Save size={14} />
                  保存
                </motion.button>
              </div>
            </>
          ) : (
            <div className="min-h-[420px]">
              {currentEntry ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{MOOD_LABELS[currentEntry.mood]}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentEntry.tags.map(tag => (
                        <span key={tag} className="rounded bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-500">#{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div className="prose prose-invert prose-sm max-w-none leading-relaxed text-slate-300">
                    {currentEntry.content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {currentEntry.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="italic text-slate-600">空日志</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <BookOpen size={48} className="mb-4 text-slate-700" />
                  <p className="mb-2 text-slate-500">{isToday ? '今天还没有写日志' : '这一天没有日志记录'}</p>
                  <p className="text-sm text-slate-600">点击右上角开始记录，支持心情、标签和 Markdown 内容。</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
