import { useState } from 'react';
import { Layout, Menu, Badge, type MenuProps } from 'antd';
import {
  AlertOutlined,
  BarChartOutlined,
  DesktopOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  RobotOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { useNotifications, useProjects } from '@/api/modules';
import { MainLayout } from './MainLayout';
import './ConsoleLayout.css';

const { Sider } = Layout;

const MENU_GROUPS: Array<{ group: string; icon: React.ReactNode; items: Array<{ key: string; label: string; icon: React.ReactNode; path: string; badge?: number }> }> = [
  {
    group: '运行中心',
    icon: <ThunderboltOutlined />,
    items: [
      { key: 'simulation', label: '数字孪生', icon: <EnvironmentOutlined />, path: '/simulation' },
      { key: 'tasks', label: '任务管理', icon: <UnorderedListOutlined />, path: '/simulation/tasks' },
      { key: 'orders', label: '订单管理', icon: <FileTextOutlined />, path: '/simulation/orders' },
    ],
  },
  {
    group: '资产运营',
    icon: <RobotOutlined />,
    items: [
      { key: 'devices', label: '设备管理', icon: <DesktopOutlined />, path: '/simulation/devices' },
      { key: 'agents', label: '智能体协同', icon: <NodeIndexOutlined />, path: '/simulation/agents' },
    ],
  },
  {
    group: '监控分析',
    icon: <BarChartOutlined />,
    items: [
      { key: 'alerts', label: '告警中心', icon: <AlertOutlined />, path: '/simulation/alerts', badge: 3 },
      { key: 'dashboard', label: '数据看板', icon: <BarChartOutlined />, path: '/simulation/dashboard' },
    ],
  },
  {
    group: '系统',
    icon: <SettingOutlined />,
    items: [
      { key: 'settings', label: '设置', icon: <SettingOutlined />, path: '/simulation/settings' },
    ],
  },
];

export function ConsoleLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('console-sider-collapsed') === 'true',
  );
  const navigate = useNavigate();
  const location = useLocation();
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentSimulationId = useAppStore((s) => s.currentSimulationId);
  const simulationConnectionState = useAppStore((s) => s.simulationConnectionState);
  const { data: projects = [] } = useProjects();
  const { data: notifications = [] } = useNotifications();
  const currentProject = projects.find((project) => project.id === currentProjectId);

  const alertCount = notifications.filter((item) => item.type === 'alert' && !item.read).length;
  const connectionMeta = simulationConnectionState === 'connected'
    ? { className: 'online', label: '实时数据流已连接' }
    : simulationConnectionState === 'reconnecting'
      ? { className: 'warning', label: '实时数据流重连中' }
      : simulationConnectionState === 'error'
        ? { className: 'offline', label: '实时数据流连接异常' }
        : { className: 'offline', label: currentSimulationId ? '正在建立实时连接' : '请先选择仿真运行' };

  const allItems = MENU_GROUPS.flatMap((g) => g.items);
  const activeKey = allItems.find((m) => location.pathname === m.path)?.key ?? 'simulation';

  const menuItems: MenuProps['items'] = MENU_GROUPS.map((g) => ({
    key: g.group,
    label: collapsed ? undefined : (
      <span className="sider-group-label">{g.group}</span>
    ),
    type: 'group' as const,
    children: g.items.map((item) => ({
      key: item.key,
      icon: item.icon,
      label: collapsed ? undefined : (
        <span className="sider-item-label">
          {item.label}
          {(item.key === 'alerts' ? alertCount : item.badge) ? <Badge count={item.key === 'alerts' ? alertCount : item.badge} size="small" style={{ marginLeft: 6 }} /> : null}
        </span>
      ),
    })),
  }));

  return (
    <MainLayout variant="wide">
      <Layout className="ican-console-layout">
        <Sider
          width={220}
          collapsedWidth={72}
          collapsible
          collapsed={collapsed}
          onCollapse={(v) => { setCollapsed(v); localStorage.setItem('console-sider-collapsed', String(v)); }}
          trigger={null}
          className="ican-console-sider"
        >
          {/* 当前状态 */}
          {!collapsed && (
            <div className="sider-project-info">
              <div className="sider-project-name">当前项目</div>
              <div className="sider-project-id" style={{ cursor: 'pointer' }} onClick={() => currentProjectId && navigate(`/projects/${currentProjectId}`)}>{currentProject?.name ?? (currentProjectId ? `项目 ${currentProjectId.slice(0, 12)}…` : '未选择项目')}</div>
              {currentSimulationId && (
                <div className="sider-project-id" style={{ fontSize: 11, color: '#64748b' }}>
                  仿真 {currentSimulationId.slice(0, 12)}…
                </div>
              )}
            </div>
          )}

          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[activeKey]}
            items={menuItems}
            onClick={({ key }) => {
              const target = allItems.find((m) => m.key === key);
              if (target) navigate(`${target.path}${location.search}`);
            }}
            className="ican-side-menu"
          />

          {/* 底部状态栏 */}
          <div className="sider-footer">
            {!collapsed && (
              <div className="sider-status">
                <span className={`sider-status-dot ${connectionMeta.className}`} />
                <span className="sider-status-text">{connectionMeta.label}</span>
              </div>
            )}
            <div className="sider-collapse-btn" onClick={() => { const next = !collapsed; setCollapsed(next); localStorage.setItem('console-sider-collapsed', String(next)); }} title={collapsed ? '展开侧栏' : '收起侧栏'}>
              {collapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
            </div>
          </div>
        </Sider>
        <Layout.Content className="ican-console-content">
          <Outlet />
        </Layout.Content>
      </Layout>
    </MainLayout>
  );
}
