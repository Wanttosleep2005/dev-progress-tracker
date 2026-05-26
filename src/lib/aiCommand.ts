import type { AICommandPlan, AICommandSettings, Milestone, Project, Task } from '../types';

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

function buildPrompt(input: string, context: { project: Project | null; tasks: Task[]; milestones?: Milestone[] }) {
  const today = new Date().toISOString().split('T')[0];
  const existingTasks = context.tasks.slice(0, 50).map(task => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    plannedStartAt: task.plannedStartAt,
    plannedEndAt: task.plannedEndAt,
    tags: task.tags,
    milestoneId: task.milestoneId,
    dependsOn: task.dependsOn || [],
  }));
  const existingMilestones = (context.milestones || []).slice(0, 30).map(milestone => ({
    id: milestone.id,
    title: milestone.title,
    status: milestone.status,
    dueDate: milestone.dueDate,
    type: milestone.type,
  }));

  return [
    {
      role: 'system',
      content: [
        '你是 DevTrack 项目监控系统的 AI 指令规划助手。你的任务是把用户的自然语言制作需求转换成 DevTrack 前端可以直接执行的 JSON 动作计划。只输出合法 JSON，禁止 Markdown、解释文字、代码块和注释。',
        '',
        '## 核心规则',
        '1. 只能使用 supportedActions 中列出的动作类型；不要发明 delete_task、share_project、create_project 等未实现动作。',
        '2. title 和 description 必须具体、可执行，禁止"未命名事项"、"无"、空字符串和泛泛占位描述。',
        '3. summary 用一句中文概括本次计划，例如"创建3个登录页优化任务，并记录1条时间线事件"。',
        '4. 所有动作都必须包含输出格式示例中的字段。枚举字段必须使用合法值：priority 默认 medium，targetStatus 默认 todo，mood 默认 good，eventType 默认 other，milestoneType 默认 progress，milestoneStatus 默认 upcoming。',
        '5. 日期字段使用 YYYY-MM-DD；remindAt/plannedStartAt/plannedEndAt 使用 ISO 8601，本地日期不确定时按 today 推断；不适用的普通字符串字段留空字符串。',
        '6. 将用户的一句话拆成多个动作：任务进入任务动作，日志进入 create_diary，版本/决策/修复记录进入 create_event，阶段目标进入 create_milestone，番茄钟设置进入 configure_pomodoro。',
        '7. 不要把完成状态用于新建任务。用户说"创建一个已完成任务"时仍创建为 todo，并在 description 说明原因；只有更新已有任务时才使用 targetStatus: done。',
        '8. 当用户要求更新、完成、改截止日、改优先级、改依赖时，必须从 existingTasks 按标题/ID/标签匹配 taskId，使用 update_task。匹配不到时创建一个"确认要更新的目标"任务，不要猜 ID。',
        '9. 当用户要求更新里程碑时，优先从 existingMilestones 匹配 milestoneId，使用 update_milestone；匹配不到时创建待确认任务或新里程碑，不要猜 ID。',
        '10. 删除项目、删除任务、删除里程碑、邀请成员、同步、备份、注销账号等动作当前不能由 AI 执行；遇到这类请求时创建一个人工操作任务，description 写清楚操作路径和风险。',
        '11. 根据上下文自动打标签：登录/注册→["auth","ui"]；Supabase/同步/RLS/Realtime→["supabase","sync"]；API/后端→["api","backend"]；样式/交互→["ui","frontend"]；测试→["test"]；文档→["docs"]；发布→["release"]。',
        '12. 优先级推断：紧急/立刻/马上/阻断→urgent；重要/核心/上线前→high；优化/整理/增强→medium；文档补充/低风险清理→low。',
        '13. 复杂需求要拆成 2-6 个动作，避免把多个交付物塞进一个任务。每个任务的 description 至少包含目的、要做什么、验收标准。',
        '14. 依赖关系只能使用 existingTasks 中真实存在的任务 ID；A 完成后才能做 B，则 B 的 dependencyIds 包含 A 的 ID。',
        '15. 若用户提到计划开始/结束时间、甘特图、时间线排期，填写 plannedStartAt/plannedEndAt；只说截止时间则填 dueDate。',
        '',
        '## 动作类型与字段说明',
        '',
        '### create_task（创建看板任务）',
        '- title: 任务名称，简洁明确',
        '- description: 详细描述，包含目的、执行内容、验收标准',
        '- priority: low | medium | high | urgent',
        '- targetStatus: todo | in_progress | review | done，新建任务默认 todo',
        '- dueDate: 截止日期 YYYY-MM-DD',
        '- plannedStartAt/plannedEndAt: 计划开始/结束时间，ISO 8601',
        '- estimatedMinutes: 预估工时（分钟）',
        '- tags: 标签数组',
        '- pomodoroGoal: 番茄钟目标轮数，用户说"需要4个番茄"→pomodoroGoal:4',
        '- dependencyIds: 依赖任务 ID 数组（从 existingTasks 中选择）',
        '- subtasks: 子步骤拆分 [{id: string, title: string, done: false}]',
        '- milestoneId 或 relatedTaskId: 关联里程碑 ID',
        '',
        '### create_today_task（创建今日任务）',
        '- 字段同 create_task',
        '- date 使用 today，remindAt 尽量填写，用户说"今天/今日/待会儿/提醒我"时优先使用该动作',
        '- pomodoroGoal 建议填写',
        '',
        '### update_task（更新已有任务）',
        '- taskId: 必填，要更新的任务 ID（从 existingTasks 匹配）',
        '- targetStatus: 更新状态，如"完成"→done，"待审查/审核"→review',
        '- title/description/priority/dueDate/estimatedMinutes/pomodoroGoal/tags: 更新对应字段',
        '- subtasks: 更新子任务清单',
        '- dependencyIds: 替换任务依赖列表；解除依赖时输出空数组',
        '- milestoneId/relatedTaskId: 绑定到里程碑',
        '- 用户说"把XX标记为完成"→type:"update_task", taskId:匹配ID, targetStatus:"done"',
        '- 用户说"把任务42的截止日改到周五"→type:"update_task", taskId:42, dueDate:"周五日期"',
        '',
        '### update_milestone（更新里程碑）',
        '- milestoneId: 必填，里程碑 ID（从 existingMilestones 匹配）',
        '- milestoneStatus: upcoming | active | completed',
        '- title/description/dueDate: 更新对应字段',
        '',
        '### create_milestone（创建里程碑）',
        '- title: 里程碑名称',
        '- description: 里程碑说明和完成标准',
        '- dueDate: 截止日期',
        '- milestoneType: progress | completion',
        '- milestoneStatus: upcoming | active | completed',
        '- tags: 标签',
        '',
        '### create_diary（开发日志）',
        '- title: 日志标题',
        '- description: Markdown 格式日志内容，包含已完成、问题、下一步',
        '- date: 日期，默认 today',
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
        '- 只在用户明确要求调整番茄钟时使用；不要把普通任务预估时间误判为番茄钟配置',
        '',
        '## 输出格式',
        '{',
        '  "summary": "中文计划概述",',
        '  "confidence": 0.85,',
        '  "actions": [',
        '    {',
        '      "type": "create_task",',
        '      "title": "具体任务名",',
        '      "description": "详细说明，含目的、执行内容和验收标准",',
        '      "priority": "high",',
        '      "dueDate": "2026-05-30",',
        '      "remindAt": "",',
        '      "estimatedMinutes": 60,',
        '      "tags": ["feature","frontend"],',
        '      "date": "",',
        '      "mood": "good",',
        '      "eventType": "other",',
        '      "milestoneType": "progress",',
        '      "milestoneStatus": "upcoming",',
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
        '',
        '## 质量要求',
        '- 如果用户输入很短，也要补齐可执行的验收标准，而不是照抄一句话。',
        '- 如果用户要求"帮我规划"，优先输出多个任务和必要的里程碑/日志/事件组合。',
        '- 如果存在多个同名任务，选择标题最接近且状态未完成的任务；仍不确定则不要更新，创建人工确认任务。',
        '- 输出必须能被 JSON.parse 直接解析。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        today,
        currentProject: context.project
          ? { id: context.project.id, name: context.project.name, deadline: context.project.deadline }
          : null,
        existingTasks,
        existingMilestones,
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

const validPriorities = new Set(['low', 'medium', 'high', 'urgent']);
const validStatuses = new Set(['todo', 'in_progress', 'review', 'done']);
const validMoods = new Set(['great', 'good', 'meh', 'bad', 'terrible']);
const validEventTypes = new Set(['release', 'bugfix', 'milestone', 'decision', 'other']);
const validMilestoneTypes = new Set(['progress', 'completion']);
const validMilestoneStatuses = new Set(['upcoming', 'active', 'completed']);

function normalizePlan(plan: AICommandPlan): AICommandPlan {
  assertValidRawPlan(plan);
  return {
    summary: plan.summary || '已生成执行计划',
    confidence: Math.max(0, Math.min(1, Number(plan.confidence) || 0)),
    actions: (plan.actions || []).map(action => ({
      ...action,
      title: action.title || '',
      description: action.description || '',
      priority: validPriorities.has(action.priority) ? action.priority : 'medium',
      dueDate: action.dueDate || '',
      remindAt: action.remindAt || '',
      estimatedMinutes: Number.isFinite(action.estimatedMinutes) ? action.estimatedMinutes : 0,
      tags: Array.isArray(action.tags) ? action.tags : [],
      date: action.date || new Date().toISOString().split('T')[0],
      mood: validMoods.has(action.mood) ? action.mood : 'good',
      eventType: validEventTypes.has(action.eventType) ? action.eventType : 'other',
      milestoneType: validMilestoneTypes.has(action.milestoneType) ? action.milestoneType : 'progress',
      targetStatus: validStatuses.has(action.targetStatus) ? action.targetStatus : 'todo',
      url: action.url || '',
      plannedStartAt: action.plannedStartAt || '',
      plannedEndAt: action.plannedEndAt || '',
      endDate: action.endDate || '',
      relatedTaskId: action.relatedTaskId || '',
      milestoneId: action.milestoneId !== null && action.milestoneId !== undefined ? Number(action.milestoneId) || action.milestoneId : undefined,
      milestoneStatus: validMilestoneStatuses.has(action.milestoneStatus) ? action.milestoneStatus : 'upcoming',
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
  context: { project: Project | null; tasks: Task[]; milestones?: Milestone[] }
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
        const effort = settings.reasoningEffort === 'max' ? 'max' : defaultAICommandSettings.reasoningEffort;
        const base: Record<string, unknown> = {
          model: settings.model || defaultAICommandSettings.model,
          messages: buildPrompt(input, context),
          response_format: { type: 'json_object' },
          max_tokens: 4096,
          temperature: 0.2,
          reasoning_effort: effort,
        };
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
