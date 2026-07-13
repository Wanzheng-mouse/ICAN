import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UserInfo } from './useAppStore';

export interface NotificationItem {
  id: string;
  type: 'alert' | 'task' | 'system' | 'report';
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
  /** 跳转时携带 ID，例如 /simulation?simulationId=n1 */
  targetUrl?: string;
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', type: 'alert', title: '拥堵告警：Aisle 08', content: 'Aisle 08 拥堵等级升至"高"，建议启动分流策略。', read: false, createdAt: '2026-07-13 10:32', targetUrl: '/simulation?simulationId=sim-001' },
  { id: 'n2', type: 'alert', title: 'AGV 低电量：A-003', content: 'AGV A-003 电量降至 24%，已自动调度至充电桩 C-03。', read: false, createdAt: '2026-07-13 10:28', targetUrl: '/simulation?simulationId=sim-001' },
  { id: 'n3', type: 'task', title: '方案生成完成', content: '电商中型仓方案 v2.0 已生成，可查看进化报告。', read: false, createdAt: '2026-07-13 09:45', targetUrl: '/evolution?evolutionId=ev-001' },
  { id: 'n4', type: 'report', title: '周报已就绪', content: '第 28 周运行报告已生成，点击查看。', read: true, createdAt: '2026-07-12 18:00', targetUrl: '/report?simulationId=sim-001' },
  { id: 'n5', type: 'system', title: '平台维护通知', content: '7 月 15 日 02:00-04:00 系统例行维护，届时暂停服务。', read: true, createdAt: '2026-07-11 14:00' },
  { id: 'n6', type: 'alert', title: '路径冲突已解除', content: 'A-025 与 A-118 路径冲突已由导航智能体自动重规划解除。', read: true, createdAt: '2026-07-11 10:15', targetUrl: '/simulation?simulationId=sim-001' },
  { id: 'n7', type: 'task', title: '订单批量导入完成', content: '已导入 286 个订单，等待分配执行。', read: true, createdAt: '2026-07-10 16:30' },
  { id: 'n8', type: 'system', title: '新版本 v1.2.0 发布', content: '新增场景编辑器撤销/重做功能，优化仿真性能。', read: false, createdAt: '2026-07-10 10:00' },
];

interface NotificationState {
  items: NotificationItem[];
  markAllRead: (ids?: string[]) => void;
  markRead: (id: string) => void;
  unreadCount: () => number;
}

export function filterNotifications(
  items: NotificationItem[],
  preferences?: UserInfo['preferences'],
): NotificationItem[] {
  if (!preferences) return items;
  return items.filter((item) => {
    if (item.type === 'alert') return preferences.notifyAlert;
    if (item.type === 'system') return preferences.notifySystem;
    return preferences.notifyTask;
  });
}

export const useNotificationStore = create<NotificationState>()(
  persist((set, get) => ({
  items: MOCK_NOTIFICATIONS,
  markAllRead: (ids) => set((s) => ({
    items: s.items.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)),
  })),
  markRead: (id) => set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  unreadCount: () => get().items.filter((n) => !n.read).length,
  }), {
    name: 'ican-notifications',
    storage: createJSONStorage(() => localStorage),
  }),
);
