import { create } from 'zustand';

export interface SidebarItem {
  to: string;
  label: string;
  visible: boolean;
}

interface SidebarStore {
  items: SidebarItem[];
  init: () => void;
  toggle: (to: string) => void;
  hideAll: () => void;
  showAll: () => void;
}

const DEFAULT_ITEMS: Omit<SidebarItem, 'visible'>[] = [
  { to: '/', label: '概览' },
  { to: '/portfolio', label: '项目总览' },
  { to: '/today-tasks', label: '今日任务' },
  { to: '/tasks', label: '任务看板' },
  { to: '/dependencies', label: '任务依赖' },
  { to: '/pomodoro', label: '番茄钟' },
  { to: '/focus-sessions', label: '专注记录' },
  { to: '/milestones', label: '里程碑' },
  { to: '/timeline', label: '时间线' },
  { to: '/diary', label: '开发日志' },
  { to: '/analytics', label: '数据分析' },
  { to: '/gantt', label: '甘特图' },
  { to: '/calendar', label: '日历' },
  { to: '/sprints', label: '冲刺管理' },
  { to: '/collaboration', label: '团队协作' },
  { to: '/ai-command', label: 'AI 指令' },
  { to: '/projects', label: '项目管理' },
  { to: '/achievements', label: '成就系统' },
];

const STORAGE_KEY = 'devtrack-sidebar-visibility';

export const useSidebarStore = create<SidebarStore>((set, get) => ({
  items: [],
  init: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const hidden: string[] = saved ? JSON.parse(saved) : [];
      set({
        items: DEFAULT_ITEMS.map(item => ({
          ...item,
          visible: !hidden.includes(item.to),
        })),
      });
    } catch {
      set({ items: DEFAULT_ITEMS.map(item => ({ ...item, visible: true })) });
    }
  },
  toggle: (to) => {
    const next = get().items.map(item =>
      item.to === to ? { ...item, visible: !item.visible } : item
    );
    set({ items: next });
    const hidden = next.filter(item => !item.visible).map(item => item.to);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
  },
  hideAll: () => {
    const next = get().items.map(item => ({ ...item, visible: false }));
    set({ items: next });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(item => item.to)));
  },
  showAll: () => {
    const next = get().items.map(item => ({ ...item, visible: true }));
    set({ items: next });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  },
}));
