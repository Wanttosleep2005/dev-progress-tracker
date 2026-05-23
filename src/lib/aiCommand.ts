import type { AICommandPlan, AICommandSettings, Project, Task } from '../types';

const DEV_PROXY = '/api/deepseek/v1/chat/completions';
const PROD_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

export const defaultAICommandSettings: AICommandSettings = {
  provider: 'deepseek_chat',
  apiKey: '',
  endpoint: import.meta.env.DEV ? DEV_PROXY : PROD_ENDPOINT,
  model: 'deepseek-v4-flash',
  reasoningEffort: 'high',
  autoSyncAfterExecute: true,
};

export const commandPlanSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'confidence', 'actions'],
  properties: {
    summary: { type: 'string' },
    confidence: { type: 'number' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'type',
          'title',
          'description',
          'priority',
          'dueDate',
          'remindAt',
          'estimatedMinutes',
          'tags',
          'date',
          'mood',
          'eventType',
          'milestoneType',
          'targetStatus',
        ],
        properties: {
          type: {
            type: 'string',
            enum: ['create_task', 'create_today_task', 'create_milestone', 'create_diary', 'create_event', 'configure_pomodoro'],
          },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          dueDate: { type: 'string' },
          remindAt: { type: 'string' },
          estimatedMinutes: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
          date: { type: 'string' },
          mood: { type: 'string', enum: ['great', 'good', 'meh', 'bad', 'terrible'] },
          eventType: { type: 'string', enum: ['release', 'bugfix', 'milestone', 'decision', 'other'] },
          milestoneType: { type: 'string', enum: ['progress', 'completion'] },
          targetStatus: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done'] },
        },
      },
    },
  },
};

function buildPrompt(input: string, context: { project: Project | null; tasks: Task[] }) {
  const today = new Date().toISOString().split('T')[0];
  const taskContext = context.tasks.slice(0, 30).map(task => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    tags: task.tags,
  }));

  return [
    {
      role: 'system',
      content: [
        '你是 DevTrack 项目监控系统的 AI 指令规划助手。将用户的自然语言需求转换为可执行的 JSON 动作计划。只输出合法 JSON，禁止 Markdown。',
        '',
        '## 核心规则',
        '1. title 和 description 必须包含具体、可执行的内容，严格禁止"未命名事项"、空字符串、"无"等占位符',
        '2. summary 用一句中文概括本次计划，如"创建3个登录页优化任务和1个里程碑"',
        '3. 日期字段使用 YYYY-MM-DD 格式，时间字段使用 ISO 8601，不适用则留空字符串',
        '4. 同一动作中，与该动作类型无关的字段留空或填默认值，但 title/description/tags 必须认真填写',
        '5. 深入理解用户输入中的上下文：涉及"登录页"→tags 加 ["login","ui"]，涉及"API"→tags 加 ["api","backend"]',
        '6. 优先级推断：用户提到"紧急/立刻/马上"→urgent，"重要"→high，无明确指示→medium',
        '7. 时间推断：用户说"明天"→{today+1}，"本周五"→本周五日期，"下午3点"→对应时间',
        '',
        '## 动作类型与字段说明',
        '',
        '### create_task（项目看板任务）',
        '- title: 任务名称，简洁明确，如"登录页 UI 优化"',
        '- description: 详细描述，包含验收标准，如"调整登录表单布局，对齐设计稿，移动端适配，按钮主色改为 #1890ff"',
        '- priority: low | medium | high | urgent',
        '- targetStatus: todo | in_progress | review | done',
        '- dueDate: 截止日期 YYYY-MM-DD',
        '- plannedStartAt: 计划开始日期 YYYY-MM-DD（有明确排期时填写）',
        '- plannedEndAt: 计划结束日期 YYYY-MM-DD（与 dueDate 可相同）',
        '- estimatedMinutes: 预估工时（分钟），如 60 表示 1 小时',
        '- tags: 标签数组，如 ["feature","frontend","login"]',
        '- url: 相关链接（需求文档/设计稿/PR），无则留空',
        '- remindAt: 提醒时间 ISO 8601，如 "2026-05-24T15:00:00"，不提醒则留空',
        '',
        '### create_today_task（今日任务，发布到今日面板）',
        '- 字段同 create_task，额外注意：',
        '- source 自动设为 daily',
        '- remindAt 强烈建议填写具体时间',
        '- priority 建议 medium 或 high',
        '',
        '### create_milestone（里程碑）',
        '- title: 里程碑名称，如"云同步联调完成"',
        '- description: 里程碑说明，如"完成 Supabase 实时同步功能联调，前后端数据一致，通过 20 条测试用例"',
        '- dueDate: 截止日期',
        '- milestoneType: progress（阶段里程碑）| completion（完成里程碑）',
        '- milestoneStatus: upcoming | active | completed',
        '- tags: 标签，如 ["sync","milestone"]',
        '',
        '### create_diary（开发日志）',
        '- title: 日志标题，如"今日开发摘要：完成 AI 指令模块联调"',
        '- description: Markdown 格式日志内容，包含今日工作内容、遇到的问题、解决方案、明日计划',
        '- date: 日期 YYYY-MM-DD，默认今天',
        '- mood: great | good | meh | bad | terrible',
        '- tags: 标签，如 ["devlog","ai-module"]',
        '',
        '### create_event（时间线事件）',
        '- title: 事件标题，如"发布 v0.4.0 版本"',
        '- description: 事件详情',
        '- eventType: release | bugfix | milestone | decision | other',
        '- date: 事件日期 YYYY-MM-DD',
        '- relatedTaskId: 关联任务 ID（从 existingTasks 中查找），无则留空',
        '',
        '### configure_pomodoro（番茄钟配置）',
        '- estimatedMinutes: 工作时长（分钟），如 45',
        '- tags: ["goal:4"] 表示每日目标 4 个番茄',
        '',
        '## 新增字段 (v0.6.0)',
        '- subtasks: 子任务清单数组 [{id: string, title: string, done: boolean}]，用于任务内拆分子步骤',
        '- trackedMinutes: 实际追踪耗时（分钟数），由计时器自动累计',
        '- sprintId: 关联的冲刺ID，可留 null',
        '',
        '## 冲刺管理 (v0.6.0)',
        '用户可以创建Sprint冲刺来组织任务。冲刺有3种状态: planning(规划中)/active(进行中)/completed(已完成)。',
        '每个冲刺有 startDate 和 endDate。',
        '',
        '## 成就系统',
        '现在有27个成就，分铜🥉银🥈金🥇三级，包括连续打卡、任务完成数、专注时长等维度。',
        '',
        '## 输出格式',
        '{',
        '  "summary": "中文计划概述",',
        '  "confidence": 0.85,',
        '  "actions": [',
        '    {',
        '      "type": "create_task",',
        '      "title": "具体任务名",',
        '      "description": "详细说明，含验收标准",',
        '      "priority": "high",',
        '      "dueDate": "2026-05-30",',
        '      "remindAt": "",',
        '      "estimatedMinutes": 60,',
        '      "tags": ["feature","frontend"],',
        '      "date": "2026-05-23",',
        '      "mood": "",',
        '      "eventType": "",',
        '      "milestoneType": "",',
        '      "milestoneStatus": "",',
        '      "targetStatus": "todo",',
        '      "url": "",',
        '      "plannedStartAt": "",',
        '      "plannedEndAt": "",',
        '      "relatedTaskId": ""',
        '    }',
        '  ]',
        '}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        today,
        currentProject: context.project
          ? { id: context.project.id, name: context.project.name, deadline: context.project.deadline }
          : null,
        existingTasks: context.tasks.slice(0, 30).map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          tags: t.tags,
        })),
        supportedActions: [
          'create_task',
          'create_today_task',
          'create_milestone',
          'create_diary',
          'create_event',
          'configure_pomodoro',
        ],
        userRequest: input,
      }),
    },
  ];
}

function extractText(payload: unknown): string {
  const value = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  if (typeof value.output_text === 'string') return value.output_text;
  const msg = value.choices?.[0]?.message;
  if (typeof msg?.content === 'string' && msg.content.trim()) return msg.content;
  if (typeof msg?.reasoning_content === 'string' && msg.reasoning_content.trim()) return msg.reasoning_content;
  const parts = value.output?.flatMap(item => item.content || []).map(content => content.text).filter(Boolean) || [];
  return parts.join('\n');
}

function normalizePlan(plan: AICommandPlan): AICommandPlan {
  return {
    summary: plan.summary || '已生成执行计划',
    confidence: Math.max(0, Math.min(1, Number(plan.confidence) || 0)),
    actions: (plan.actions || []).map(action => ({
      ...action,
      title: action.title || '未命名事项',
      description: action.description || '',
      dueDate: action.dueDate || '',
      remindAt: action.remindAt || '',
      estimatedMinutes: Number.isFinite(action.estimatedMinutes) ? action.estimatedMinutes : 0,
      tags: Array.isArray(action.tags) ? action.tags : [],
      date: action.date || new Date().toISOString().split('T')[0],
      url: action.url || '',
      plannedStartAt: action.plannedStartAt || '',
      plannedEndAt: action.plannedEndAt || '',
      relatedTaskId: action.relatedTaskId || '',
      milestoneStatus: action.milestoneStatus || 'upcoming',
      subtasks: Array.isArray(action.subtasks) ? action.subtasks : undefined,
      trackedMinutes: Number.isFinite(action.trackedMinutes) ? action.trackedMinutes : undefined,
      sprintId: action.sprintId || undefined,
    })),
  };
}

export async function generateAICommandPlan(
  input: string,
  settings: AICommandSettings,
  context: { project: Project | null; tasks: Task[] }
): Promise<AICommandPlan> {
  const apiKey = settings.apiKey || import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('请先在设置中配置 DeepSeek API Key，或设置 VITE_DEEPSEEK_API_KEY。');
  }

  let response: Response;
  try {
    response = await fetch(settings.endpoint || defaultAICommandSettings.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify((() => {
        const effort = settings.reasoningEffort || defaultAICommandSettings.reasoningEffort;
        const base: Record<string, unknown> = {
          model: settings.model || defaultAICommandSettings.model,
          messages: buildPrompt(input, context),
          response_format: { type: 'json_object' },
          max_tokens: 4096,
          temperature: 0.2,
        };
        if (effort === 'off') {
          base.thinking = { type: 'disabled' };
        } else {
          base.reasoning_effort = effort;
        }
        return base;
      })()),
    });
  } catch (err) {
    throw new Error(
      `网络请求失败，可能是 CORS 跨域或网络问题。${import.meta.env.DEV ? '' : ' 生产环境建议通过后端代理调用 DeepSeek API。'}`
    );
  }

  if (!response.ok) {
    let message = '';
    try {
      const body = await response.json();
      message = body?.error?.message || JSON.stringify(body);
    } catch {
      message = await response.text().catch(() => '');
    }
    throw new Error(message || `AI API 返回 HTTP ${response.status} 错误`);
  }

  const payload = await response.json();
  const text = extractText(payload);
  if (!text) throw new Error('AI 没有返回可解析内容。');
  return normalizePlan(JSON.parse(text) as AICommandPlan);
}
