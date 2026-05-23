import type { Milestone, Project, Task } from '../types';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tasks: Omit<Task, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[];
  milestones: Omit<Milestone, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[];
}

const now = new Date().toISOString();

function dueDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'web-fullstack',
    name: 'Web 全栈项目',
    description: '前后端分离的 Web 应用开发模板，包含需求、设计、开发、测试、部署全流程。',
    icon: '🌐',
    color: '#3b82f6',
    tasks: [
      { title: '需求文档梳理', description: '编写产品需求文档 PRD', status: 'todo', priority: 'high', tags: ['docs'], dueDate: dueDays(3), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 120, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '数据库模型设计', description: '设计 ER 图和数据库表结构', status: 'todo', priority: 'high', tags: ['design', 'db'], dueDate: dueDays(5), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 90, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: 'API 接口定义', description: '定义 RESTful API 接口文档', status: 'todo', priority: 'high', tags: ['api', 'docs'], dueDate: dueDays(7), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 60, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '项目脚手架搭建', description: '初始化前端和后端项目框架', status: 'todo', priority: 'medium', tags: ['setup'], dueDate: dueDays(4), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 60, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '用户认证模块', description: '实现注册、登录、JWT 认证', status: 'todo', priority: 'high', tags: ['feature', 'auth'], dueDate: dueDays(10), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 180, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '核心 CRUD 开发', description: '实现核心业务实体的增删改查', status: 'todo', priority: 'medium', tags: ['feature'], dueDate: dueDays(14), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 240, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '前端页面开发', description: '实现主要页面的 UI 和交互', status: 'todo', priority: 'medium', tags: ['feature', 'ui'], dueDate: dueDays(18), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 300, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '编写测试用例', description: '单元测试 + 集成测试覆盖核心流程', status: 'todo', priority: 'medium', tags: ['test'], dueDate: dueDays(21), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 120, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '部署上线', description: '配置 CI/CD 并部署到生产环境', status: 'todo', priority: 'high', tags: ['deploy'], dueDate: dueDays(28), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 90, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
    ],
    milestones: [
      { title: 'MVP 完成', description: '核心功能可演示', dueDate: dueDays(14), type: 'progress', progress: 0, status: 'upcoming', taskIds: [] },
      { title: '正式发布', description: '生产环境可用', dueDate: dueDays(28), type: 'completion', progress: 0, status: 'upcoming', taskIds: [] },
    ],
  },
  {
    id: 'mobile-app',
    name: '移动端应用',
    description: 'React Native / Flutter 移动应用开发模板。',
    icon: '📱',
    color: '#8b5cf6',
    tasks: [
      { title: '原型设计', description: '使用 Figma 完成主要页面原型', status: 'todo', priority: 'high', tags: ['design'], dueDate: dueDays(3), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 120, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '项目初始化', description: '初始化 RN/Flutter 项目并配置导航', status: 'todo', priority: 'high', tags: ['setup'], dueDate: dueDays(4), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 60, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '首页开发', description: '实现首页布局和数据展示', status: 'todo', priority: 'medium', tags: ['feature', 'ui'], dueDate: dueDays(7), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 180, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '推送通知集成', description: '接入 FCM/APNs 推送服务', status: 'todo', priority: 'medium', tags: ['feature'], dueDate: dueDays(10), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 120, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '应用商店发布', description: '准备商店素材并提交审核', status: 'todo', priority: 'high', tags: ['deploy'], dueDate: dueDays(21), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 90, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
    ],
    milestones: [
      { title: '内部测试版', description: '完成核心功能可内测', dueDate: dueDays(14), type: 'progress', progress: 0, status: 'upcoming', taskIds: [] },
    ],
  },
  {
    id: 'open-source',
    name: '开源项目维护',
    description: '开源库/工具维护模板，包含 Issue 管理、PR 审核、文档编写。',
    icon: '📦',
    color: '#10b981',
    tasks: [
      { title: '编写 README', description: '撰写项目说明、安装指南和基础示例', status: 'todo', priority: 'high', tags: ['docs'], dueDate: dueDays(2), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 90, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '配置 CI/CD', description: '设置 GitHub Actions 自动测试和发布', status: 'todo', priority: 'high', tags: ['setup', 'ci'], dueDate: dueDays(3), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 60, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '添加 CONTRIBUTING.md', description: '编写贡献指南和代码规范', status: 'todo', priority: 'medium', tags: ['docs'], dueDate: dueDays(5), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 45, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '处理初始 Issues', description: '分类和回复第一批 Issue', status: 'todo', priority: 'medium', tags: ['maintenance'], dueDate: dueDays(7), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 60, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '发布 v1.0', description: '发布第一个稳定版本到 npm/PyPI', status: 'todo', priority: 'high', tags: ['deploy'], dueDate: dueDays(10), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 30, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
    ],
    milestones: [
      { title: '首个稳定版', description: 'v1.0 正式发布', dueDate: dueDays(10), type: 'completion', progress: 0, status: 'upcoming', taskIds: [] },
    ],
  },
  {
    id: 'learning-plan',
    name: '学习计划',
    description: '技术学习路线模板，适合系统学习新技术栈。',
    icon: '📚',
    color: '#f59e0b',
    tasks: [
      { title: '制定学习路线', description: '梳理学习目标和里程碑', status: 'todo', priority: 'high', tags: ['planning'], dueDate: dueDays(1), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 60, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '阅读官方文档', description: '通读核心概念和 API 文档', status: 'todo', priority: 'high', tags: ['reading'], dueDate: dueDays(3), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 180, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '完成入门教程', description: '跟随官方教程完成 Demo', status: 'todo', priority: 'medium', tags: ['practice'], dueDate: dueDays(5), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 120, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '实战项目练习', description: '独立完成一个小项目巩固知识', status: 'todo', priority: 'medium', tags: ['practice', 'project'], dueDate: dueDays(14), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 480, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
      { title: '总结与分享', description: '写博客或做内部分享总结学习心得', status: 'todo', priority: 'low', tags: ['docs', 'sharing'], dueDate: dueDays(21), plannedStartAt: null, plannedEndAt: null, milestoneId: null, estimatedMinutes: 90, url: '', source: 'board', remindAt: null, isTodayTask: false, publishedAt: null, dependsOn: [], assigneeId: null, createdBy: null, updatedBy: null, remoteId: null, syncUpdatedAt: null, recurrence: 'none' },
    ],
    milestones: [
      { title: '完成基础学习', description: '掌握核心概念和 API', dueDate: dueDays(7), type: 'progress', progress: 0, status: 'upcoming', taskIds: [] },
      { title: '实战项目完成', description: '独立完成实战项目', dueDate: dueDays(14), type: 'completion', progress: 0, status: 'upcoming', taskIds: [] },
    ],
  },
];

export async function applyTemplate(templateId: string, projectId: number) {
  const template = PROJECT_TEMPLATES.find(t => t.id === templateId);
  if (!template) return;

  const { db } = await import('../db/database');
  const now = new Date().toISOString();

  // Create milestones first to get IDs
  const milestoneIdMap = new Map<number, number>();
  for (let i = 0; i < template.milestones.length; i++) {
    const m = template.milestones[i];
    const mId = await db.milestones.add({
      ...m,
      projectId,
      createdAt: now,
      updatedAt: now,
      syncUpdatedAt: now,
    });
    milestoneIdMap.set(i, mId as number);
  }

  // Create tasks with milestone references
  for (const task of template.tasks) {
    await db.tasks.add({
      ...task,
      projectId,
      milestoneId: task.milestoneId !== null && milestoneIdMap.has(0) ? milestoneIdMap.get(0)! : null,
      createdAt: now,
      updatedAt: now,
      syncUpdatedAt: now,
    });
  }
}
