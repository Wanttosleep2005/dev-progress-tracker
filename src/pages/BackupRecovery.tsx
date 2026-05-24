import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DatabaseBackup, Download, FileCheck2, HardDrive, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import { backupSummary, createBackup, getBackupDirectoryLabel, restoreBackup, validateBackup, writeBackupToConfiguredDirectory, type DevTrackBackup } from '../lib/backup';
import { createClientId } from '../lib/id';

interface RestorePointMeta {
  id: string;
  name: string;
  createdAt: string;
  summary: ReturnType<typeof backupSummary>;
}

const RESTORE_POINT_INDEX_KEY = 'devtrack-restore-points';
const RESTORE_POINT_PREFIX = 'devtrack-restore-point:';

function readRestorePoints(): RestorePointMeta[] {
  try {
    return JSON.parse(localStorage.getItem(RESTORE_POINT_INDEX_KEY) || '[]') as RestorePointMeta[];
  } catch {
    return [];
  }
}

function saveRestorePoints(points: RestorePointMeta[]) {
  localStorage.setItem(RESTORE_POINT_INDEX_KEY, JSON.stringify(points));
}

function downloadBackup(backup: DevTrackBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `devtrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function BackupRecovery() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [restorePoints, setRestorePoints] = useState<RestorePointMeta[]>(() => readRestorePoints());
  const [preview, setPreview] = useState<DevTrackBackup | null>(null);
  const [backupDirectory, setBackupDirectoryLabel] = useState('');
  const previewSummary = useMemo(() => preview ? backupSummary(preview) : null, [preview]);

  useEffect(() => {
    let cancelled = false;
    getBackupDirectoryLabel().then(label => {
      if (!cancelled) setBackupDirectoryLabel(label);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleExport = async () => {
    const backup = await createBackup();
    downloadBackup(backup);
    setMessage('备份文件已导出');
  };

  const handleCreateRestorePoint = async () => {
    try {
      const backup = await createBackup();
      const id = createClientId();
      const meta: RestorePointMeta = {
        id,
        name: `还原点 ${new Date().toLocaleString('zh-CN')}`,
        createdAt: backup.exportedAt,
        summary: backupSummary(backup),
      };
      localStorage.setItem(`${RESTORE_POINT_PREFIX}${id}`, JSON.stringify(backup));
      const next = [meta, ...restorePoints].slice(0, 6);
      restorePoints.slice(5).forEach(point => localStorage.removeItem(`${RESTORE_POINT_PREFIX}${point.id}`));
      saveRestorePoints(next);
      setRestorePoints(next);
      setMessage('本地还原点已创建');
    } catch {
      setMessage('创建还原点失败，可能是浏览器本地存储空间不足，请改用导出文件备份');
    }
  };

  const handleWriteToBackupDirectory = async () => {
    try {
      const backup = await createBackup();
      const filePath = await writeBackupToConfiguredDirectory(backup);
      setMessage(`备份文件已保存到：${filePath}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '写入备份目录失败');
    }
  };

  const handleRestorePoint = async (id: string) => {
    const raw = localStorage.getItem(`${RESTORE_POINT_PREFIX}${id}`);
    if (!raw) {
      setMessage('还原点不存在');
      return;
    }
    if (!window.confirm('确定要恢复到这个还原点吗？当前本地数据会被替换。')) return;
    await restoreBackup(validateBackup(JSON.parse(raw)));
    setMessage('恢复完成，页面即将刷新');
    setTimeout(() => window.location.reload(), 800);
  };

  const handleDeleteRestorePoint = (id: string) => {
    localStorage.removeItem(`${RESTORE_POINT_PREFIX}${id}`);
    const next = restorePoints.filter(point => point.id !== id);
    saveRestorePoints(next);
    setRestorePoints(next);
    setMessage('还原点已删除');
  };

  const handleImportFile = async (file: File) => {
    try {
      const backup = validateBackup(JSON.parse(await file.text()));
      setPreview(backup);
      setMessage('备份文件已读取，请确认后恢复');
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : '备份文件读取失败');
    }
  };

  const handleRestorePreview = async () => {
    if (!preview) return;
    if (!window.confirm('确定要恢复这个备份文件吗？当前本地数据会被替换。')) return;
    await restoreBackup(preview);
    setMessage('恢复完成，页面即将刷新');
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-6xl space-y-5 py-8">
      <div className="flex flex-col gap-4 rounded-[30px] border border-white/[0.06] bg-[#0b1322] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            <ShieldCheck size={26} className="text-emerald-300" />
            备份与恢复中心
          </h2>
          <p className="mt-1 text-sm text-slate-400">保护 IndexedDB、本地专注记录、协作缓存和通知数据，适合在同步、联机或重构前先做保险。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleCreateRestorePoint} className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20">
            <HardDrive size={15} />
            创建本地还原点
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 hover:bg-sky-500/20">
            <Download size={15} />
            导出备份文件
          </button>
          <button onClick={handleWriteToBackupDirectory} className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/20">
            <HardDrive size={15} />
            保存到备份目录
          </button>
          <button onClick={() => inputRef.current?.click()} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.06]">
            <Upload size={15} />
            导入备份
          </button>
          <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => event.target.files?.[0] && handleImportFile(event.target.files[0])} />
        </div>
      </div>

      {message && <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-3 text-center text-sm text-emerald-200">{message}</div>}

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-6 text-slate-400">
        当前磁盘备份目录：{backupDirectory || '未设置，请到“设置 → 数据”里填写备份文件存放目录'}。本地还原点默认仍保存在浏览器 localStorage 中；需要真实文件时请使用“导出备份文件”或“保存到备份目录”。
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="glass rounded-[28px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <DatabaseBackup size={16} className="text-emerald-300" />
            本地还原点
          </h3>
          {restorePoints.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 text-sm text-slate-500">
              还没有本地还原点。建议在发布共享项目、批量导入、同步前先创建一个。
            </div>
          ) : (
            <div className="space-y-3">
              {restorePoints.map(point => (
                <div key={point.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{point.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(point.createdAt).toLocaleString('zh-CN')}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        项目 {point.summary.projects} · 任务 {point.summary.tasks} · 里程碑 {point.summary.milestones} · 日志 {point.summary.diaryEntries}
                      </p>
                      {point.summary.recoveredProjects > 0 && (
                        <p className="mt-1 text-xs text-amber-300">
                          检测到 {point.summary.recoveredProjects} 个缺失项目，恢复时会自动补建项目壳。
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleRestorePoint(point.id)} className="flex items-center gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/20">
                        <RotateCcw size={13} />
                        恢复
                      </button>
                      <button onClick={() => handleDeleteRestorePoint(point.id)} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.06]">删除</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-[28px] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <FileCheck2 size={16} className="text-sky-300" />
            导入预览
          </h3>
          {previewSummary ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-sky-500/15 bg-sky-500/10 p-4">
                <p className="text-sm font-semibold text-white">备份时间：{new Date(previewSummary.exportedAt).toLocaleString('zh-CN')}</p>
                <p className="mt-2 text-xs text-sky-100/80">
                  项目 {previewSummary.projects} · 任务 {previewSummary.tasks} · 里程碑 {previewSummary.milestones} · 日志 {previewSummary.diaryEntries}
                </p>
                {previewSummary.recoveredProjects > 0 && (
                  <p className="mt-2 text-xs text-amber-200">
                    检测到 {previewSummary.recoveredProjects} 个缺失项目，恢复时会自动补建项目壳，避免任务变成孤立数据。
                  </p>
                )}
              </div>
              <button onClick={handleRestorePreview} className="w-full rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600">
                确认恢复这个备份
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 text-sm text-slate-500">
              导入备份文件后，这里会显示内容摘要。恢复前请确认当前数据已经另行备份。
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
