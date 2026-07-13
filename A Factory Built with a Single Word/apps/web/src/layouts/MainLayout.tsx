import { Badge, Button, Dropdown, Input, Layout, Menu, type MenuProps } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CaretDownOutlined,
  LineChartOutlined,
  ReadOutlined,
  RobotOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOP_MENUS } from '@/constants/menu';
import { useAppStore } from '@/stores/useAppStore';
import './MainLayout.css';

const { Header, Content } = Layout;

const iconMap: Record<string, React.ReactNode> = {
  home: <AppstoreOutlined />,
  simulation: <ThunderboltOutlined />,
  evolution: <LineChartOutlined />,
  report: <BarChartOutlined />,
  resource: <ReadOutlined />,
  help: <RobotOutlined />,
};

interface MainLayoutProps {
  children: React.ReactNode;
  variant?: 'default' | 'wide';
}

export function MainLayout({ children, variant = 'default' }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppStore((s) => s.user);

  const activeKey = TOP_MENUS.find((m) =>
    m.key === 'home' ? location.pathname === '/' : location.pathname.startsWith(m.path),
  )?.key ?? 'home';

  const menuItems: MenuProps['items'] = TOP_MENUS.map((m) => ({
    key: m.key,
    label: m.label,
    icon: iconMap[m.key],
  }));

  const userMenu: MenuProps['items'] = [
    { key: 'profile', label: '个人中心' },
    { key: 'settings', label: '账户设置' },
    { key: 'divider', type: 'divider' },
    { key: 'logout', label: '退出登录' },
  ];

  return (
    <Layout className="ican-main-layout">
      <Header className="ican-main-header">
        <div className="ican-logo" onClick={() => navigate('/')}>
          <div className="ican-logo-icon">
            <svg viewBox="0 0 32 32" width="28" height="28">
              <defs>
                <linearGradient id="logoG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#3b82f6" />
                  <stop offset="1" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="6" fill="#1c2756" />
              <path d="M8 22 L16 8 L24 22 Z" fill="url(#logoG)" />
              <circle cx="16" cy="20" r="2.5" fill="#1c2756" />
            </svg>
          </div>
          <div className="ican-logo-text">
            <div className="title">一言造厂</div>
            <div className="subtitle">DuMate 驱动的无人仓生成与进化平台</div>
          </div>
        </div>

        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[activeKey]}
          items={menuItems}
          onClick={({ key }) => {
            const target = TOP_MENUS.find((m) => m.key === key);
            if (target) navigate(target.path);
          }}
          className="ican-top-menu"
        />

        <div className="ican-header-right">
          <Input
            placeholder="搜索"
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            className="ican-search-input"
            allowClear
          />
          <Badge count={3} size="small" offset={[-2, 4]}>
            <Button type="text" icon={<BellOutlined style={{ color: '#fff', fontSize: 18 }} />} />
          </Badge>
          <Button className="ican-project-btn">
            项目中心 <CaretDownOutlined />
          </Button>
          <Dropdown menu={{ items: userMenu }} placement="bottomRight">
            <div className="ican-user">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                alt={user.name}
                className="avatar"
              />
              <CaretDownOutlined style={{ color: '#cbd5e1', fontSize: 12 }} />
            </div>
          </Dropdown>
        </div>
      </Header>

      <Content className={variant === 'wide' ? 'ican-content-wide' : 'ican-content'}>
        {children}
      </Content>
    </Layout>
  );
}
