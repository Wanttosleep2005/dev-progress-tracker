import { motion } from 'framer-motion';
import { Bot, CheckCircle2, Loader2, Play, Settings2, Sparkles, Wand2, X } from 'lucide-react';
import { useAICommandStore } from '../stores/useAICommandStore';
import { useAppStore } from '../stores/useAppStore';
import { PRIORITY_LABELS, STATUS_LABELS } from '../types';
import type { AIActionType, AICommandSettings } from '../types';

const actionLabels: Record<AIActionType, string> = {
  update_task: '更新任务',
  update_milestone: '更新里程碑',
  create_task: '创建任务',
  create_today_task: '发布今日任务',
  create_milestone: '创建里程碑',
  create_diary: '写入日志',
  create_event: '记录事件',
  configure_pomodoro: '配置番茄钟',
};

const examples = [
  '帮我把“登录页优化”拆成 3 个任务，包含 UI、接口联调和测试，明天下午 6 点截止。',
  '今天发布两个紧急任务：修复同步失败提示、补充番茄钟通知测试，分别提醒我下午 4 点和 5 点。',
  '为本周创建一个“云同步联调完成”的里程碑，并写一篇今天的开发日志摘要。',
  '把番茄钟工作时长调整为 45 分钟，并给我规划 4 个番茄的目标。',
];

export default function AICommandCenter() {
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const currentProject = useAppStore(state => state.projects.find(project => project.id === currentProjectId));
  const {
    settings,
    prompt,
    plan,
    loading,
    executing,
    error,
    history,
    updateSettings,
    setPrompt,
    generate,
    execute,
    clear,
  } = useAICommandStore();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            <Bot size={28} className="text-cyan-300" />
            AI 指令中心
          </h2>
          <p className="mt-1 text-sm text-slate-400">描述你想做的事，AI 会匹配项目逻辑并生成可执行内容。</p>
        </div>
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          当前项目：{currentProject ? `${currentProject.icon} ${currentProject.name}` : '未选择'}
        </div>
      </div>

      {error && <div className="glass rounded-2xl border border-amber-500/20 p-3 text-sm text-amber-200">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="glass rounded-[32px] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Wand2 size={16} className="text-cyan-300" />
            描述制作需求
          </div>
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={7}
            placeholder="例如：帮我创建一个今日任务，提醒下午 5 点处理 Supabase 同步冲突，并顺便生成一条时间线事件。"
            className="w-full resize-none rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm leading-6 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={generate}
              disabled={!prompt.trim() || loading || !currentProjectId}
              className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              生成执行计划
            </button>
            <button onClick={clear} className="flex items-center gap-2 rounded-2xl border border-white/[0.06] px-5 py-3 text-sm text-slate-300 hover:bg-white/[0.04]">
              <X size={16} />
              清空
            </button>
          </div>

          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {examples.map(example => (
              <button
                key={example}
                onClick={() => setPrompt(example)}
                className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 text-left text-xs leading-5 text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-[32px] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Settings2 size={16} className="text-violet-300" />
            API 接口设置
          </div>
          <div className="space-y-3">
            <label className="block text-xs text-slate-500">模型选择
              <select value={settings.model} onChange={event => updateSettings({ model: event.target.value })} className="custom-select mt-1 w-full rounded-xl border border-white/[0.06] px-3 py-2 text-sm">
                <option value="deepseek-v4-flash">DeepSeek V4 Flash（快速）</option>
                <option value="deepseek-v4-pro">DeepSeek V4 Pro（强力）</option>
              </select>
            </label>
            <label className="block text-xs text-slate-500">推理力度
              <select value={settings.reasoningEffort} onChange={event => updateSettings({ reasoningEffort: event.target.value as AICommandSettings['reasoningEffort'] })} className="custom-select mt-1 w-full rounded-xl border border-white/[0.06] px-3 py-2 text-sm">
                <option value="off">关闭 — 不推理，最快最省 token</option>
                <option value="high">高 — 默认推理强度</option>
                <option value="max">最强 — 深度推理，适合复杂多动作场景</option>
              </select>
            </label>
            <label className="block text-xs text-slate-500">接口地址
              <input value={settings.endpoint} onChange={event => updateSettings({ endpoint: event.target.value })} className="mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white" />
            </label>
            <label className="block text-xs text-slate-500">DeepSeek API Key（临时使用，不保存）
              <input type="password" value={settings.apiKey} onChange={event => updateSettings({ apiKey: event.target.value })} placeholder="刷新页面后会清空" className="mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600" />
            </label>
            <button
              onClick={() => updateSettings({ autoSyncAfterExecute: !settings.autoSyncAfterExecute })}
              className={`rounded-xl px-3 py-2 text-xs ${settings.autoSyncAfterExecute ? 'bg-emerald-500/10 text-emerald-300' : 'border border-white/[0.06] text-slate-400'}`}
            >
              {settings.autoSyncAfterExecute ? '执行后自动同步' : '执行后不同步'}
            </button>
            <p className="text-xs leading-5 text-slate-500">API Key 只保存在当前页面内存中，不写入 localStorage；刷新或重新打开页面后需要重新输入。</p>
          </div>
        </div>
      </div>

      {plan && (
        <div className="glass rounded-[32px] p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <CheckCircle2 size={16} className="text-emerald-300" />
                待执行计划
              </h3>
              <p className="mt-1 text-xs text-slate-500">{plan.summary} · 置信度 {Math.round(plan.confidence * 100)}%</p>
            </div>
            <button
              onClick={execute}
              disabled={executing}
              className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {executing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              确认执行
            </button>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {plan.actions.map((action, index) => (
              <div key={`${action.type}-${index}`} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{actionLabels[action.type]}</p>
                  <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">{PRIORITY_LABELS[action.priority]}</span>
                </div>
                <p className="text-sm text-slate-200">{action.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{action.description || '无说明'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
                  <span className="rounded-full bg-white/[0.04] px-2 py-1">{STATUS_LABELS[action.targetStatus]}</span>
                  {action.dueDate && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-200">截止 {action.dueDate}</span>}
                  {action.remindAt && <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-cyan-200">提醒 {action.remindAt}</span>}
                  {action.estimatedMinutes > 0 && <span className="rounded-full bg-white/[0.04] px-2 py-1">{action.estimatedMinutes} 分钟</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="glass rounded-[28px] p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">最近执行记录</h3>
          <div className="space-y-2">
            {history.map((item, index) => (
              <div key={`${item.summary}-${index}`} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 text-sm text-slate-400">
                {item.summary} · {item.actions.length} 个动作
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
