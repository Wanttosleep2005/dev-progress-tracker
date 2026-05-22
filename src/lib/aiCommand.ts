import type { AICommandPlan, AICommandSettings, Project, Task } from '../types';

export const defaultAICommandSettings: AICommandSettings = {
  provider: 'deepseek_chat',
  apiKey: '',
  endpoint: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-v4-flash',
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
  const taskContext = context.tasks.slice(0, 20).map(task => ({
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
      content:
        '你是项目开发监控系统里的指令规划助手。把用户的自然语言需求转换成可执行 json 动作计划。只输出合法 JSON，不要输出 Markdown。不要编造无法落地的动作。日期使用 ISO 字符串或 YYYY-MM-DD，未知字段用空字符串、0 或默认枚举。JSON 顶层格式示例：{"summary":"...","confidence":0.8,"actions":[]}',
    },
    {
      role: 'user',
      content: JSON.stringify({
        today,
        currentProject: context.project
          ? { id: context.project.id, name: context.project.name, deadline: context.project.deadline }
          : null,
        existingTasks: taskContext,
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
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (typeof value.output_text === 'string') return value.output_text;
  const chatContent = value.choices?.[0]?.message?.content;
  if (typeof chatContent === 'string') return chatContent;
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

  const response = await fetch(settings.endpoint || defaultAICommandSettings.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model || defaultAICommandSettings.model,
      messages: buildPrompt(input, context),
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'AI API 调用失败');
  }

  const payload = await response.json();
  const text = extractText(payload);
  if (!text) throw new Error('AI 没有返回可解析内容。');
  return normalizePlan(JSON.parse(text) as AICommandPlan);
}
