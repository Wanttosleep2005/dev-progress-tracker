import { create } from 'zustand';

export interface SidebarItem {
  to: string;
  label: string;
  visible: boolean;
  weight: number;
  reason: string;
}

interface SidebarStore {
  items: SidebarItem[];
  init: () => void;
  toggle: (to: string) => void;
  hideAll: () => void;
  showAll: () => void;
  applyRecommended: () => void;
}

const DEFAULT_ITEMS: Array<Omit<SidebarItem, 'visible'>> = [
  { to: '/today-command', label: '今日指挥台', weight: 100, reason: '每天第一入口，聚合待办、风险和阻塞' },
  { to: '/', label: '概览', weight: 96, reason: '项目健康度和节奏总览' },
  { to: '/tasks', label: '任务看板', weight: 95, reason: '核心执行区，最高频编辑任务' },
  { to: '/today-tasks', label: '今日任务', weight: 90, reason: '当日安排和提醒发布' },
  { to: '/collaboration', label: '团队协作', weight: 88, reason: '共享项目、权限和同步入口' },
  { to: '/collaboration-control', label: '协作诊断', weight: 74, reason: '同步诊断、权限审计和 Owner 配置入口' },
  { to: '/pomodoro', label: '番茄钟', weight: 82, reason: '专注计时高频使用' },
  { to: '/milestones', label: '里程碑', weight: 76, reason: '项目阶段目标管理' },
  { to: '/ai-command', label: 'AI 指令', weight: 72, reason: '快速生成任务和计划' },
  { to: '/projects', label: '项目管理', weight: 70, reason: '项目切换、维护和归档' },
  { to: '/backup', label: '备份恢复', weight: 68, reason: '数据安全入口，联机同步前常用' },
  { to: '/analytics', label: '数据分析', weight: 58, reason: '阶段复盘使用，不必常驻' },
  { to: '/diary', label: '开发日志', weight: 56, reason: '记录型模块，按需打开' },
  { to: '/calendar', label: '日历', weight: 54, reason: '时间视图，和今日任务有重叠' },
  { to: '/timeline', label: '时间线', weight: 52, reason: '复盘视图，低频查看' },
  { to: '/gantt', label: '甘特图', weight: 50, reason: '排期视图，适合阶段性规划' },
  { to: '/portfolio', label: '项目总览', weight: 48, reason: '多项目管理时使用' },
  { to: '/focus-sessions', label: '专注记录', weight: 46, reason: '统计明细，番茄钟已覆盖入口' },
  { to: '/dependencies', label: '任务依赖', weight: 42, reason: '复杂任务网络时使用' },
  { to: '/achievements', label: '成就系统', weight: 30, reason: '激励型模块，不占默认导航' },
];

const STORAGE_KEY = 'devtrack-sidebar-visibility';
const RECOMMENDED_APPLIED_KEY = 'devtrack-sidebar-recommended-v2';
const RECOMMENDED_VISIBLE = 10;

function recommendedHiddenItems() {
  return DEFAULT_ITEMS
    .filter(item => item.weight < DEFAULT_ITEMS[RECOMMENDED_VISIBLE - 1].weight)
    .map(item => item.to);
}

function buildItems(hidden: string[]) {
  return DEFAULT_ITEMS.map(item => ({
    ...item,
    visible: !hidden.includes(item.to),
  }));
}

export const useSidebarStore = create<SidebarStore>((set, get) => ({
  items: [],
  init: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const shouldApplyRecommended = localStorage.getItem(RECOMMENDED_APPLIED_KEY) !== '1';
      const hidden: string[] = shouldApplyRecommended
        ? recommendedHiddenItems()
        : saved ? JSON.parse(saved) : recommendedHiddenItems();
      if (shouldApplyRecommended) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
        localStorage.setItem(RECOMMENDED_APPLIED_KEY, '1');
      }
      set({ items: buildItems(hidden) });
    } catch {
      set({ items: buildItems(recommendedHiddenItems()) });
    }
  },
  toggle: (to) => {
    const next = get().items.map(item =>
      item.to === to ? { ...item, visible: !item.visible } : item
    );
    set({ items: next });
    const hidden = next.filter(item => !item.visible).map(item => item.to);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
    localStorage.setItem(RECOMMENDED_APPLIED_KEY, '1');
  },
  hideAll: () => {
    const next = get().items.map(item => ({ ...item, visible: false }));
    set({ items: next });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(item => item.to)));
    localStorage.setItem(RECOMMENDED_APPLIED_KEY, '1');
  },
  showAll: () => {
    const next = get().items.map(item => ({ ...item, visible: true }));
    set({ items: next });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(RECOMMENDED_APPLIED_KEY, '1');
  },
  applyRecommended: () => {
    const hidden = recommendedHiddenItems();
    set({ items: buildItems(hidden) });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
    localStorage.setItem(RECOMMENDED_APPLIED_KEY, '1');
  },
}));
