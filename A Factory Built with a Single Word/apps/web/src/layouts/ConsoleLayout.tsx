import { useState } from 'react';
import { Layout, Menu, type MenuProps } from 'antd';
import {
  AlertOutlined,
  BarChartOutlined,
  ClusterOutlined,
  DesktopOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { useProjects, useSimulationDetail } from '@/api/modules';
import { MainLayout } from './MainLayout';
import './ConsoleLayout.css';

const { Sider } = Layout;

interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}
interface MenuGroup {
  group: string;
  items: MenuItem[];
}

const MENU_GROUPS: MenuGroup[] = [
  {
    group: '运行',
    items: [
      { key: 'simulation', label: '数字孪生', icon: <EnvironmentOutlined />, path: '/simulation' },
      { key: 'tasks', label: '任务管理', icon: <UnorderedListOutlined />, path: '/simulation/tasks' },
      { key: 'orders', label: '订单管理', icon: <FileTextOutlined />, path: '/simulation/orders' },
    ],
  },
  {
    group: '资产',
    items: [
      { key: 'devices', label: '设备管理', icon: <DesktopOutlined />, path: '/simulation/devices' },
      { key: 'agents', label: '智能体协同', icon: <NodeIndexOutlined />, path: '/simulation/agents' },
    ],
  },
  {
    group: '洞察',
    items: [
      { key: 'alerts', label: '告警中心', icon: <AlertOutlined />, path: '/simulation/alerts' },
      { key: 'dashboard', label: '数据看板', icon: <BarChartOutlined />, path: '/simulation/dashboard' },
    ],
  },
  {
    group: '系统',
    items: [
      { key: 'settings', label: '系统设置', icon: <SettingOutlined />, path: '/simulation/settings' },
    ],
  },
];

const NAV_HINT_KEY = 'console-sider-collapsed';

export function ConsoleLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(NAV_HINT_KEY) === 'true',
  );
  const navigate = useNavigate();
  const location = useLocation();
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentSimulationId = useAppStore((s) => s.currentSimulationId);
  const simulationConnectionState = useAppStore((s) => s.simulationConnectionState);
  // The sidebar's job is to navigate and to surface a one-glance status pill.
  // Numbers (AGV / 任务 / 告警) live in the digital-twin 3D view and the
  // overview cards in the index pages; duplicating them here makes the layout
  // feel noisy without giving the user anything they cannot get from the
  // three-line status pill below.
  const { data: projects = [] } = useProjects();
  const { data: simulationDetail } = useSimulationDetail(currentSimulationId);
  const currentProject = projects.find((project) => project.id === currentProjectId);
  const collapse = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem(NAV_HINT_KEY, String(next));
  };

  const simulationStatusLabel = (() => {
    const status = simulationDetail?.status;
    if (status === 'running') return { label: '运行中', cls: 'is-running' };
    if (status === 'paused') return { label: '已暂停', cls: 'is-paused' };
    if (status === 'stopped') return { label: '已停止', cls: 'is-stopped' };
    if (status === 'finished') return { label: '已完成', cls: 'is-finished' };
    if (status === 'created') return { label: '待启动', cls: 'is-draft' };
    return { label: '未选择仿真', cls: 'is-idle' };
  })();
  const connectionMeta = simulationConnectionState === 'connected'
    ? { className: 'online', label: '实时已连接' }
    : simulationConnectionState === 'reconnecting'
      ? { className: 'warning', label: '正在重连...' }
      : simulationConnectionState === 'error'
        ? { className: 'offline', label: '连接异常' }
        : { className: 'idle', label: currentSimulationId ? '建立连接...' : '未选择仿真' };

  const allItems: MenuItem[] = MENU_GROUPS.flatMap((g) => g.items);
  const activeKey = allItems.find((m) => location.pathname === m.path)?.key ?? 'simulation';

  const menuItems: MenuProps['items'] = MENU_GROUPS.map((g) => ({
    key: g.group,
    label: collapsed ? undefined : <span className="sider-group-label">{g.group}</span>,
    type: 'group' as const,
    children: g.items.map((item) => ({
      key: item.key,
      icon: item.icon,
      label: collapsed ? undefined : <span className="sider-item-label"><span>{item.label}</span></span>,
    })),
  }));

  const goToProject = () => {
    if (currentProjectId) navigate(`/projects/${currentProjectId}`);
  };

  return (
    <MainLayout variant="wide">
      <Layout className="ican-console-layout">
        <Sider
          width={244}
          collapsedWidth={72}
          collapsible
          collapsed={collapsed}
          onCollapse={collapse}
          trigger={null}
          className={`ican-console-sider ${collapsed ? 'collapsed' : ''}`}
        >
          {/* 项目上下文（轻量定位指示） */}
          {!collapsed && (
            <div
              className="sider-context"
              onClick={goToProject}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') goToProject(); }}
              title={currentProject?.name ?? '暂未选择项目，前往项目中心'}
            >
              <ClusterOutlined className="sider-context-icon" />
              <div className="sider-context-text">
                <span className="sider-context-eyebrow">CURRENT PROJECT</span>
                <span className="sider-context-name">
                  {currentProject?.name ?? '未选择项目'}
                </span>
                <span className="sider-context-status">
                  <span className={`sider-status-dot ${connectionMeta.className}`} />
                  {connectionMeta.label}
                </span>
              </div>
            </div>
          )}

          {/* 主导航菜单（精简：无重复数字指标） */}
          <div className="sider-menu-wrap">
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
          </div>

          {/* 底部状态：仿真运行态 + 折叠控制 */}
          <div className="sider-footer">
            <div className="sider-run-state">
              <span className={`sider-status-pill ${simulationStatusLabel.cls}`}>
                <i />
                {simulationStatusLabel.label}
              </span>
            </div>
            <div
              className="sider-collapse-btn"
              onClick={() => collapse(!collapsed)}
              title={collapsed ? '展开侧栏' : '收起侧栏'}
            >
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
