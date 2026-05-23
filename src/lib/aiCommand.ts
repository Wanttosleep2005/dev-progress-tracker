import type { AICommandPlan, AICommandSettings, Project, Task } from '../types';

const DEV_PROXY = '/api/deepseek/v1/chat/completions';
const PROD_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

export const defaultAICommandSettings: AICommandSettings = {
  provider: 'deepseek_chat',
  apiKey: '',
  endpoint: import.meta.env.DEV ? DEV_PROXY : PROD_ENDPOINT,
  model: 'deepseek-chat',
  reasoningEffort: 'high',
  autoSyncAfterExecute: true,
};

const commandPlanSchema = {
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
            enum: ['create_task', 'create_today_task', 'create_milestone', 'create_diary', 'create_event', 'update_task', 'update_milestone', 'configure_pomodoro'],
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
          taskId: { type: ['integer', 'string'] },
          milestoneStatus: { type: 'string', enum: ['upcoming', 'active', 'completed'] },
          pomodoroGoal: { type: ['integer', 'null'] },
          dependencyIds: { type: 'array', items: { type: 'integer' } },
          url: { type: 'string' },
          plannedStartAt: { type: 'string' },
          plannedEndAt: { type: 'string' },
          endDate: { type: 'string' },
          relatedTaskId: { type: 'string' },
          milestoneId: { type: ['integer', 'string'] },
          subtasks: { type: 'array', items: { type: 'object' } },
          trackedMinutes: { type: 'integer' },
          sprintId: { type: ['integer', 'string'] },
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
        '8. 当用户要求更新/修改/删除已有任务或里程碑时，必须通过 existingTasks 匹配任务 ID，使用 update_task 操作',
        '9. 当需求可拆分为多个子步骤时，使用 subtasks 数组拆解',
        '',
        '## 动作类型与字段说明',
        '',
        '### create_task（创建看板任务）',
        '- title: 任务名称，简洁明确',
        '- description: 详细描述，包含验收标准',
        '- priority: low | medium | high | urgent',
        '- targetStatus: todo | in_progress | review | done',
        '- dueDate: 截止日期 YYYY-MM-DD',
        '- estimatedMinutes: 预估工时（分钟）',
        '- tags: 标签数组',
        '- pomodoroGoal: 番茄钟目标轮数，用户说"需要4个番茄"→pomodoroGoal:4',
        '- dependencyIds: 依赖任务 ID 数组（从 existingTasks 中选择）',
        '- subtasks: 子步骤拆分 [{id: string, title: string, done: false}]',
        '- relatedTaskId: 关联里程碑 ID，如"关联到里程碑 5"→relatedTaskId: "5"',
        '',
        '### create_today_task（创建今日任务）',
        '- 字段同 create_task',
        '- remindAt 建议填写',
        '- pomodoroGoal 建议填写',
        '',
        '### update_task（更新已有任务）',
        '- taskId: 必填，要更新的任务 ID（从 existingTasks 匹配）',
        '- targetStatus: 更新状态，如"完成"→done',
        '- title/description/priority/dueDate/estimatedMinutes/pomodoroGoal/tags: 更新对应字段',
        '- subtasks: 更新子任务清单',
        '- 用户说"把XX标记为完成"→type:"update_task", taskId:匹配ID, targetStatus:"done"',
        '- 用户说"把任务42的截止日改到周五"→type:"update_task", taskId:42, dueDate:"周五日期"',
        '',
        '### update_milestone（更新里程碑）',
        '- taskId: 必填（复用此字段），里程碑 ID',
        '- milestoneStatus: upcoming | active | completed',
        '- title/description/dueDate: 更新对应字段',
        '',
        '### create_milestone（创建里程碑）',
        '- title: 里程碑名称',
        '- description: 里程碑说明',
        '- dueDate: 截止日期',
        '- milestoneType: progress | completion',
        '- milestoneStatus: upcoming | active | completed',
        '- tags: 标签',
        '',
        '### create_diary（开发日志）',
        '- title: 日志标题',
        '- description: Markdown 格式日志内容',
        '- date: 日期，默认今天',
        '- mood: great | good | meh | bad | terrible',
        '- tags: 标签',
        '',
        '### create_event（时间线事件）',
        '- title: 事件标题',
        '- description: 事件详情',
        '- eventType: release | bugfix | milestone | decision | other',
        '- date: 事件日期',
        '- relatedTaskId: 关联任务 ID',
        '- endDate: 多日事件结束日期 YYYY-MM-DD，单日事件留空',
        '',
        '### configure_pomodoro（番茄钟配置）',
        '- estimatedMinutes: 工作时长（15/20/25/30/45/60）',
        '- tags: ["goal:N"] 每日目标，["work:30","break_short:5","break_long:15","interval:4"] 完整配置',
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
        '      "date": "",',
        '      "mood": "",',
        '      "eventType": "",',
        '      "milestoneType": "",',
        '      "milestoneStatus": "",',
        '      "targetStatus": "todo",',
        '      "url": "",',
        '      "plannedStartAt": "",',
        '      "plannedEndAt": "",',
        '      "endDate": "",',
        '      "relatedTaskId": "",',
        '      "milestoneId": "",',
        '      "taskId": null,',
        '      "pomodoroGoal": null,',
        '      "dependencyIds": [],',
        '      "subtasks": []',
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
          milestoneId: t.milestoneId,
        })),
        supportedActions: [
          'create_task',
          'create_today_task',
          'create_milestone',
          'create_diary',
          'create_event',
          'update_task',
          'update_milestone',
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

function assertValidRawPlan(plan: unknown): asserts plan is AICommandPlan {
  const allowedActions = new Set(commandPlanSchema.properties.actions.items.properties.type.enum);
  if (!plan || typeof plan !== 'object') {
    throw new Error('AI 返回内容不是有效的指令计划对象。');
  }
  const candidate = plan as Partial<AICommandPlan>;
  if (!Array.isArray(candidate.actions)) {
    throw new Error('AI 返回内容缺少 actions 数组。');
  }
  candidate.actions.forEach((action, index) => {
    if (!action || typeof action !== 'object') {
      throw new Error(`AI 返回的第 ${index + 1} 个动作不是有效对象。`);
    }
    if (!allowedActions.has(action.type)) {
      throw new Error(`AI 返回了不支持的动作类型：${String(action.type)}`);
    }
    const needsTitle = ['create_task', 'create_today_task', 'create_milestone', 'create_diary', 'create_event'].includes(action.type);
    if (needsTitle && !String(action.title || '').trim()) {
      throw new Error(`AI 返回的第 ${index + 1} 个动作缺少标题，请补充更明确的描述后重试。`);
    }
    if (action.type === 'update_task' && action.taskId == null) {
      throw new Error('AI 试图更新任务，但没有匹配到 taskId。');
    }
    if (action.type === 'update_milestone' && action.taskId == null && action.milestoneId == null) {
      throw new Error('AI 试图更新里程碑，但没有匹配到 milestoneId。');
    }
  });
}

function normalizePlan(plan: AICommandPlan): AICommandPlan {
  assertValidRawPlan(plan);
  return {
    summary: plan.summary || '已生成执行计划',
    confidence: Math.max(0, Math.min(1, Number(plan.confidence) || 0)),
    actions: (plan.actions || []).map(action => ({
      ...action,
      title: action.title || '',
      description: action.description || '',
      dueDate: action.dueDate || '',
      remindAt: action.remindAt || '',
      estimatedMinutes: Number.isFinite(action.estimatedMinutes) ? action.estimatedMinutes : 0,
      tags: Array.isArray(action.tags) ? action.tags : [],
      date: action.date || new Date().toISOString().split('T')[0],
      url: action.url || '',
      plannedStartAt: action.plannedStartAt || '',
      plannedEndAt: action.plannedEndAt || '',
      endDate: action.endDate || '',
      relatedTaskId: action.relatedTaskId || '',
      milestoneId: action.milestoneId !== null && action.milestoneId !== undefined ? Number(action.milestoneId) || action.milestoneId : undefined,
      milestoneStatus: action.milestoneStatus || 'upcoming',
      taskId: action.taskId !== null && action.taskId !== undefined ? Number(action.taskId) || action.taskId : undefined,
      pomodoroGoal: action.pomodoroGoal !== null && action.pomodoroGoal !== undefined ? Number(action.pomodoroGoal) || null : undefined,
      dependencyIds: Array.isArray(action.dependencyIds) ? action.dependencyIds.map(Number).filter(Boolean) : undefined,
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
      `网络请求失败，可能是 CORS 跨域或网络问题。${import.meta.env.DEV ? '' : ' 生产环境建议通过后端代理调用 DeepSeek API。'}`,
      { cause: err }
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('AI 返回的内容不是合法 JSON，请重试或降低一次性指令复杂度。', { cause: err });
  }
  return normalizePlan(parsed as AICommandPlan);
}
