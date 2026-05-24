import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Download, Edit3, Eye, FilePlus, Flame, Hash, Save, Tag, Trash2, Upload } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useAppStore } from '../stores/useAppStore';
import { useDiaryStore } from '../stores/useDiaryStore';
import { useCloudStore } from '../stores/useCloudStore';
import { useToast } from '../stores/useToast';
import { MOOD_COLORS, MOOD_LABELS } from '../types';
import type { DiaryEntry, MoodType } from '../types';
import { db } from '../db/database';

const MOODS: MoodType[] = ['great', 'good', 'meh', 'bad', 'terrible'];
const AUTHOR_COLORS = ['bg-sky-400', 'bg-emerald-400', 'bg-violet-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400'];
const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function toLocalDateKey(date: Date) {
  // Calendar days are local UI concepts; UTC ISO keys shift one day in Asia/Shanghai.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

function countStreak(entries: DiaryEntry[]): number {
  const dates = new Set(entries.map(e => e.date));
  let streak = 0;
  const d = new Date();
  while (dates.has(d.toISOString().split('T')[0])) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function totalWords(entries: DiaryEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.content.trim() ? e.content.split(/\s+/).length : 0), 0);
}

function getAuthorColor(authorId?: string | null) {
  const key = authorId || 'local';
  const sum = [...key].reduce((total, char) => total + char.charCodeAt(0), 0);
  return AUTHOR_COLORS[sum % AUTHOR_COLORS.length];
}

function compactAuthorLabel(value?: string | null) {
  if (!value) return '本地';
  if (value.includes('@')) return value.split('@')[0].slice(0, 8);
  return value.slice(0, 8);
}

export default function Diary() {
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const { entries, upsert, remove, load } = useDiaryStore();
  const currentUser = useCloudStore(state => state.user);
  const members = useCloudStore(state => state.members);
  const { add: addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [editing, setEditing] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<MoodType>('meh');
  const [tags, setTags] = useState('');
  const [importing, setImporting] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const dateStr = toLocalDateKey(currentDate);
  const authorById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach(member => map.set(member.userId, member.displayName || member.email || member.userId));
    if (currentUser) map.set(currentUser.id, currentUser.displayName || currentUser.email);
    return map;
  }, [currentUser, members]);
  const getAuthorLabel = useCallback((entry: DiaryEntry) => (
    compactAuthorLabel(entry.createdBy ? authorById.get(entry.createdBy) || entry.createdBy : '本地')
  ), [authorById]);
  const entriesForDate = useMemo(() => entries.filter(entry => entry.date === dateStr), [entries, dateStr]);
  const ownEntry = useMemo(() => entriesForDate.find(entry => (
    currentUser?.id ? entry.createdBy === currentUser.id : !entry.createdBy
  )), [currentUser?.id, entriesForDate]);
  const currentEntry = useMemo(() => (
    entriesForDate.find(entry => entry.id === selectedEntryId) ?? ownEntry ?? entriesForDate[0]
  ), [entriesForDate, ownEntry, selectedEntryId]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < adjustedFirstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [adjustedFirstDay, daysInMonth]);

  const monthlyEntries = useMemo(() => entries.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  }), [entries, month, year]);

  const recentEntries = useMemo(() =>
    [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15),
  [entries]);

  const streak = useMemo(() => countStreak(entries), [entries]);
  const words = useMemo(() => totalWords(entries), [entries]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(e => e.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [entries]);

  const getDayEntries = useCallback((day: number) =>
    entries.filter(e => e.date === toLocalDateKey(new Date(year, month, day))),
  [entries, month, year]);

  const navigateMonth = (delta: number) => setCurrentDate(new Date(year, month + delta, 1));
  const selectDay = (day: number) => {
    // Reset cached editor state so an empty day never renders the previous day's draft.
    setCurrentDate(new Date(year, month, day));
    setSelectedEntryId(null);
    setContent('');
    setMood('meh');
    setTags('');
    setEditing(false);
    setPreviewMode(false);
  };
  const selectRecentEntry = (entry: DiaryEntry) => { setCurrentDate(new Date(entry.date)); setSelectedEntryId(entry.id ?? null); setEditing(false); setPreviewMode(false); };

  const startEditing = () => {
    const editableEntry = ownEntry ?? (!currentUser?.id && currentEntry && !currentEntry.createdBy ? currentEntry : undefined);
    setContent(editableEntry?.content || '');
    setMood(editableEntry?.mood || 'meh');
    setTags(editableEntry?.tags.join(', ') || '');
    setSelectedEntryId(editableEntry?.id ?? null);
    setEditing(true);
    setPreviewMode(false);
  };

  const handleSave = useCallback(async () => {
    if (!currentProjectId && !currentEntry?.projectId) return;
    const id = await upsert({
      projectId: ownEntry?.projectId ?? currentEntry?.projectId ?? currentProjectId!,
      date: dateStr,
      content: content.trim(),
      mood,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    if (id) setSelectedEntryId(id);
    setEditing(false);
  }, [content, currentEntry?.projectId, currentProjectId, dateStr, mood, ownEntry?.projectId, tags, upsert]);

  const handleDelete = useCallback(async () => {
    if (currentEntry?.id) {
      if (currentUser?.id && currentEntry.createdBy && currentEntry.createdBy !== currentUser.id) {
        addToast('不能删除其他成员的日志', 'warning');
        return;
      }
      await remove(currentEntry.id);
      setSelectedEntryId(null);
      setEditing(false);
      setContent('');
      setMood('meh');
      setTags('');
    }
  }, [addToast, currentEntry, currentUser?.id, remove]);

  const handleImport = async () => {
    const input = fileInputRef.current;
    if (!input || !currentProjectId) return;
    const files = input.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item.date && (item.content || item.description)) {
              await upsert({
                projectId: currentProjectId,
                date: item.date,
                content: item.content || item.description || '',
                mood: (MOODS.includes(item.mood) ? item.mood : 'meh') as MoodType,
                tags: Array.isArray(item.tags) ? item.tags : [],
              });
            }
          }
        } else if (file.name.endsWith('.md')) {
          const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
          const date = dateMatch ? dateMatch[1] : toLocalDateKey(new Date());
          const existing = entries.find(e => e.date === date && (currentUser?.id ? e.createdBy === currentUser.id : !e.createdBy));
          if (existing) {
            setContent(existing.content ? `${existing.content}\n\n---\n\n${text}` : text);
            setEditing(true);
            setCurrentDate(new Date(date));
          } else {
            await upsert({ projectId: currentProjectId, date, content: text, mood: 'meh', tags: [] });
          }
        }
      }
      await load(currentProjectId);
      addToast(`成功导入 ${files.length} 个文件`, 'success');
    } catch (err) {
      addToast('导入失败，请检查文件格式', 'warning');
    }
    setImporting(false);
    input.value = '';
  };

  const handleExportDiary = useCallback((scope: 'month' | 'all') => {
    const sourceEntries = scope === 'month' ? monthlyEntries : entries;
    const sortedEntries = [...sourceEntries].sort((a, b) => (
      a.date.localeCompare(b.date) || getAuthorLabel(a).localeCompare(getAuthorLabel(b))
    ));
    if (sortedEntries.length === 0) {
      setExportMenuOpen(false);
      addToast('没有可导出的日志', 'warning');
      return;
    }
    const markdown = sortedEntries.map(entry => {
      const entryDate = new Date(`${entry.date}T00:00:00`);
      const weekday = WEEKDAY_LABELS[entryDate.getDay()] ?? '';
      const body = entry.content.trim() || '_空日志_';
      return `# ${entry.date} (${weekday}) ${MOOD_LABELS[entry.mood]} ${getAuthorLabel(entry)}\n\n${body}\n\n---`;
    }).join('\n\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = scope === 'month'
      ? `devtrack-diary-${year}-${String(month + 1).padStart(2, '0')}.md`
      : 'devtrack-diary-all.md';
    link.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
    addToast('日志导出成功', 'success');
  }, [addToast, entries, getAuthorLabel, month, monthlyEntries, year]);

  const today = new Date();
  const isToday = dateStr === toLocalDateKey(today);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-5">
      <input ref={fileInputRef} type="file" accept=".md,.json" multiple className="hidden" onChange={handleImport} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">开发日志</h2>
          <p className="mt-1 text-sm text-slate-400">沉淀每日开发轨迹，支持 Markdown 编辑与文件导入。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button onClick={() => setExportMenuOpen(value => !value)} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05]">
              <Download size={14} /> 导出日志
            </button>
            <AnimatePresence>
              {exportMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1422] p-1 shadow-2xl shadow-black/30"
                >
                  <button onClick={() => handleExportDiary('month')} className="w-full rounded-xl px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/[0.06]">
                    导出本月日志
                  </button>
                  <button onClick={() => handleExportDiary('all')} className="w-full rounded-xl px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/[0.06]">
                    导出全部日志
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => fileInputRef.current?.click()} disabled={importing || !currentProjectId} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05] disabled:opacity-50">
            <Upload size={14} /> 导入 MD/JSON
          </button>
          {!editing && (
            <button onClick={startEditing} className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-600">
              <Edit3 size={14} /> {ownEntry ? '编辑我的日志' : '写我的日志'}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: '连续记录', value: `${streak} 天`, icon: Flame, color: 'text-orange-300' },
          { label: '总日志', value: `${entries.length} 篇`, icon: BookOpen, color: 'text-sky-300' },
          { label: '本月', value: `${monthlyEntries.length} 篇`, icon: CalendarDays, color: 'text-emerald-300' },
          { label: '总字数', value: `${words.toLocaleString()}`, icon: Hash, color: 'text-violet-300' },
        ].map(s => (
          <div key={s.label} className="glass rounded-[24px] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">{s.label}</span>
              <s.icon size={15} className={s.color} />
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="glass rounded-[28px] p-5">
            <div className="mb-4 flex items-center justify-between">
              <button onClick={() => navigateMonth(-1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05] hover:text-white"><ChevronLeft size={16} /></button>
              <span className="text-sm font-semibold text-white">{year} 年 {month + 1} 月</span>
              <button onClick={() => navigateMonth(1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05] hover:text-white"><ChevronRight size={16} /></button>
            </div>

            <div className="mb-2 grid grid-cols-7">
              {DAY_NAMES.map(d => <div key={d} className="py-1 text-center text-[10px] font-medium text-slate-500">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                if (!day) return <div key={`e-${i}`} className="aspect-square" />;
                const dayEntries = getDayEntries(day);
                const moodMarks = dayEntries.slice(0, 4);
                const selected = day === currentDate.getDate() && month === currentDate.getMonth();
                const todayDate = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                return (
                  <motion.button
                    key={day} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} onClick={() => selectDay(day)}
                    className={`relative aspect-square rounded-lg text-xs font-medium transition-all ${
                      selected ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30' :
                      todayDate ? 'bg-white/[0.03] text-white ring-1 ring-white/[0.08]' :
                      'text-slate-400 hover:bg-white/[0.03] hover:text-white'
                    }`}
                  >
                    <div className="flex h-full flex-col items-center justify-center">
                      {day}
                      {moodMarks.length > 0 && (
                        <span className="mt-0.5 flex max-w-full gap-0.5 overflow-hidden text-[10px] leading-none">
                          {moodMarks.map(entry => <span key={entry.id ?? `${entry.date}-${entry.createdBy}`}>{MOOD_LABELS[entry.mood]}</span>)}
                        </span>
                      )}
                    </div>
                    {dayEntries.length > 0 && (
                      <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                        {moodMarks.map(entry => (
                          <span key={entry.id ?? `${entry.date}-${entry.createdBy}-dot`} className="h-1 w-1 rounded-full" style={{ backgroundColor: MOOD_COLORS[entry.mood] }} />
                        ))}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-[28px] p-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-400"><Tag size={14} /> 常用标签</h3>
            {tagCounts.length === 0 ? (
              <p className="text-xs text-slate-600">暂无标签数据</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tagCounts.map(([t, c]) => (
                  <span key={t} className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">
                    #{t} <span className="text-slate-600">{c}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {recentEntries.length > 0 && (
            <div className="glass rounded-[28px] p-5">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-400">最近记录</h3>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {recentEntries.map(e => {
                  const isActive = e.id === currentEntry?.id;
                  return (
                    <button
                      key={e.id}
                      onClick={() => selectRecentEntry(e)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        isActive ? 'bg-sky-500/10 ring-1 ring-sky-500/20' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className="text-sm">{MOOD_LABELS[e.mood]}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs ${isActive ? 'text-sky-200' : 'text-slate-300'}`}>
                          {e.content.slice(0, 60).replace(/\n/g, ' ') || '空日志'}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-600">
                          <span className={`h-1.5 w-1.5 rounded-full ${getAuthorColor(e.createdBy)}`} />
                          <span>{getAuthorLabel(e)}</span>
                          <span>{e.date}</span>
                        </p>
                      </div>
                      {e.tags.length > 0 && (
                        <span className="shrink-0 rounded bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-slate-500">#{e.tags[0]}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="glass rounded-[30px] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">
                {new Date(dateStr).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
              </h3>
              {entriesForDate.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entriesForDate.map(entry => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntryId(entry.id ?? null)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] ${
                        currentEntry?.id === entry.id
                          ? 'border-sky-400/30 bg-sky-500/10 text-sky-200'
                          : 'border-white/[0.06] bg-white/[0.03] text-slate-400 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${getAuthorColor(entry.createdBy)}`} />
                      {getAuthorLabel(entry)}
                    </button>
                  ))}
                </div>
              )}
              {isToday && <span className="text-[10px] font-medium text-sky-400">今天</span>}
            </div>
            <div className="flex items-center gap-2">
              {!editing && currentEntry && (
                <>
                  <button onClick={() => setPreviewMode(!previewMode)} className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-slate-400 hover:bg-white/[0.04]">
                    {previewMode ? <Edit3 size={12} /> : <Eye size={12} />}
                    {previewMode ? '编辑' : '预览'}
                  </button>
                  <button onClick={startEditing} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05] hover:text-white"><Edit3 size={14} /></button>
                </>
              )}
              {editing && currentEntry && (
                <button onClick={handleDelete} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"><Trash2 size={12} />删除</button>
              )}
            </div>
          </div>

          {editing ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <div>
                <div className="mb-3 flex gap-2">
                  {MOODS.map(m => (
                    <button key={m} onClick={() => setMood(m)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-base transition ${
                        mood === m ? 'border-sky-500/50 bg-sky-500/10 shadow-lg shadow-sky-500/10 scale-110' : 'border-white/[0.04] hover:border-white/[0.08]'
                      }`}
                      title={m}>{MOOD_LABELS[m]}</button>
                  ))}
                </div>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="标签，逗号分隔" className="mb-3 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none" />
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={`# 今日完成\n- \n\n## 明日计划\n- \n\n## 遇到的问题\n- `}
                  rows={20}
                  className="w-full resize-none rounded-lg border border-white/[0.06] bg-[#0a101a] px-4 py-3 font-mono text-sm leading-relaxed text-slate-200 placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
                />
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{content.length} 字</span>
                  <span>Markdown 格式</span>
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-medium text-slate-500">实时预览</p>
                <div className="prose prose-invert prose-sm max-w-none rounded-lg border border-white/[0.05] bg-[#0a101a] p-4 min-h-[420px] text-slate-300 overflow-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
                  {content.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}
                      components={{
                        h1: ({ children }) => <h1 className="mb-4 mt-8 pb-2 text-2xl font-bold text-white border-b border-white/[0.06] first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="mb-3 mt-6 text-lg font-semibold text-slate-100 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-semibold text-slate-300">{children}</h3>,
                        p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-slate-300">{children}</li>,
                        table: ({ children }) => <div className="my-3 overflow-x-auto rounded-xl border border-white/[0.06]"><table className="w-full text-xs">{children}</table></div>,
                        thead: ({ children }) => <thead className="border-b border-white/[0.06] bg-white/[0.02]">{children}</thead>,
                        th: ({ children }) => <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400">{children}</th>,
                        td: ({ children }) => <td className="px-3 py-2 text-[12px] text-slate-300 border-t border-white/[0.03]">{children}</td>,
                        img: ({ src, alt }) => <img src={src} alt={alt} className="my-3 max-w-full rounded-xl border border-white/[0.06]" />,
                      code: ({ children, className, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return match ? (
                          <div className="my-3 overflow-hidden rounded-xl border border-white/[0.06]">
                            <div className="flex items-center justify-between bg-[#060d18] px-4 py-1.5 border-b border-white/[0.04]">
                              <span className="text-[10px] uppercase tracking-wider text-slate-500">{match[1]}</span>
                            </div>
                            <pre className="overflow-auto bg-[#060d18] p-4 text-xs leading-relaxed"><code className={`hljs language-${match[1]}`} {...props}>{children}</code></pre>
                          </div>
                        ) : (
                          <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[12px] text-cyan-300" {...props}>{children}</code>
                        );
                      },
                        blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-sky-500/40 pl-3 text-slate-400 italic">{children}</blockquote>,
                        a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2 hover:text-sky-300">{children}</a>,
                        hr: () => <hr className="my-4 border-white/[0.06]" />,
                        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  ) : (
                    <p className="italic text-slate-600">预览将在这里显示</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 xl:col-span-2">
                <button onClick={() => setEditing(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
                <button onClick={handleSave} className="flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2 text-sm font-medium text-white hover:bg-sky-600"><Save size={14} />保存</button>
              </div>
            </div>
          ) : (
            <div className="min-h-[420px]">
              {currentEntry ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{MOOD_LABELS[currentEntry.mood]}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">
                      <span className={`h-1.5 w-1.5 rounded-full ${getAuthorColor(currentEntry.createdBy)}`} />
                      {getAuthorLabel(currentEntry)}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentEntry.tags.map(t => (
                        <span key={t} className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-slate-400">#{t}</span>
                      ))}
                    </div>
                    <span className="ml-auto text-[11px] text-slate-600">
                      {currentEntry.content.split(/\s+/).filter(Boolean).length} 词 · {new Date(currentEntry.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {previewMode ? (
                    <textarea
                      value={currentEntry.content}
                      readOnly
                      className="w-full resize-none rounded-lg border border-white/[0.06] bg-[#0a101a] px-4 py-3 font-mono text-sm leading-relaxed text-slate-300 focus:outline-none"
                      rows={16}
                    />
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none leading-relaxed text-slate-300">
                      {currentEntry.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}
                          components={{
                            h1: ({ children }) => <h1 className="mb-4 mt-8 pb-2 text-2xl font-bold text-white border-b border-white/[0.06] first:mt-0">{children}</h1>,
                            h2: ({ children }) => <h2 className="mb-3 mt-6 text-lg font-semibold text-slate-100 first:mt-0">{children}</h2>,
                            h3: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-semibold text-slate-300">{children}</h3>,
                            p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                            ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-slate-300">{children}</li>,
                            table: ({ children }) => <div className="my-3 overflow-x-auto rounded-xl border border-white/[0.06]"><table className="w-full text-xs">{children}</table></div>,
                            thead: ({ children }) => <thead className="border-b border-white/[0.06] bg-white/[0.02]">{children}</thead>,
                            th: ({ children }) => <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400">{children}</th>,
                            td: ({ children }) => <td className="px-3 py-2 text-[12px] text-slate-300 border-t border-white/[0.03]">{children}</td>,
                            img: ({ src, alt }) => <img src={src} alt={alt} className="my-3 max-w-full rounded-xl border border-white/[0.06]" />,
                          code: ({ children, className, ...props }) => {
                            const match = /language-(\w+)/.exec(className || '');
                            return match ? (
                              <div className="my-3 overflow-hidden rounded-xl border border-white/[0.06]">
                                <div className="flex items-center justify-between bg-[#060d18] px-4 py-1.5 border-b border-white/[0.04]">
                                  <span className="text-[10px] uppercase tracking-wider text-slate-500">{match[1]}</span>
                                </div>
                                <pre className="overflow-auto bg-[#060d18] p-4 text-xs leading-relaxed"><code className={`hljs language-${match[1]}`} {...props}>{children}</code></pre>
                              </div>
                            ) : (
                              <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[12px] text-cyan-300" {...props}>{children}</code>
                            );
                          },
                            blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-sky-500/40 pl-3 text-slate-400 italic">{children}</blockquote>,
                            a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2 hover:text-sky-300">{children}</a>,
                            hr: () => <hr className="my-4 border-white/[0.06]" />,
                            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                          }}
                        >
                          {currentEntry.content}
                        </ReactMarkdown>
                      ) : (
                        <p className="italic text-slate-600">空日志</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <BookOpen size={56} className="mb-4 text-slate-700" />
                  <p className="mb-2 text-slate-500">{isToday ? '今天还没有写日志' : '这一天没有日志记录'}</p>
                  <p className="mb-4 text-sm text-slate-600">支持 Markdown，点击右上角开始记录</p>
                  {isToday && (
                    <button onClick={startEditing} className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-600">
                      <FilePlus size={14} className="mr-2 inline-block" /> 写日志
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
