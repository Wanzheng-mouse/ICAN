/** 一级菜单 - 顶部导航 */
export interface TopMenuItem {
  key: string;
  label: string;
  path: string;
}

// 顶部 6 项导航 — 对齐 Front-images/image01：首页 / 仿真空间 / 方案进化 / 运行报告 / 资源中心 / 帮助中心
export const TOP_MENUS: TopMenuItem[] = [
  { key: 'home', label: '首页', path: '/' },
  { key: 'simulation', label: '仿真空间', path: '/simulation' },
  { key: 'evolution', label: '方案进化', path: '/evolution' },
  { key: 'report', label: '运行报告', path: '/report' },
  { key: 'resource', label: '资源中心', path: '/resource' },
  { key: 'help', label: '帮助中心', path: '/help' },
];

/** 仿真空间左侧菜单 */
export interface SideMenuItem {
  key: string;
  label: string;
  icon: string;
  path: string;
}

export const SIDE_MENUS: SideMenuItem[] = [
  { key: 'overview', label: '总览', icon: 'HomeOutlined', path: '/simulation' },
  { key: 'simulation', label: '仿真空间', icon: 'AppstoreOutlined', path: '/simulation' },
  { key: 'tasks', label: '任务管理', icon: 'UnorderedListOutlined', path: '/simulation/tasks' },
  { key: 'devices', label: '设备管理', icon: 'DesktopOutlined', path: '/simulation/devices' },
  { key: 'orders', label: '订单管理', icon: 'FileTextOutlined', path: '/simulation/orders' },
  { key: 'agents', label: '智能体', icon: 'RobotOutlined', path: '/simulation/agents' },
  { key: 'alerts', label: '告警中心', icon: 'AlertOutlined', path: '/simulation/alerts' },
  { key: 'dashboard', label: '数据看板', icon: 'BarChartOutlined', path: '/simulation/dashboard' },
  { key: 'settings', label: '设置', icon: 'SettingOutlined', path: '/simulation/settings' },
];

/**
 * 顶栏右上角"项目中心"下拉菜单项（在 MainLayout 渲染）。
 * 注意：与 image01~07 预设对齐的"项目中心"位于右上角头像左侧，而非中间主菜单。
 * 中间主菜单 6 项：首页 / 仿真空间 / 方案进化 / 运行报告 / 资源中心 / 帮助中心。
 */
export interface ProjectSwitcherItem {
  key: string;
  label: string;
  path: string;
}

export const PROJECT_SWITCHER: ProjectSwitcherItem[] = [
  { key: 'all', label: '全部项目', path: '/projects' },
  { key: 'new', label: '创建新项目', path: '/projects/new' },
  { key: 'help', label: '如何管理项目？', path: '/help' },
];
