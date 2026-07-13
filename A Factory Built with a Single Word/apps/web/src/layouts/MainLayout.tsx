import { useState, useRef, useEffect } from 'react';
import { Badge, Button, Drawer, Dropdown, Input, Layout, List, Menu, message, type MenuProps } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CaretDownOutlined,
  CheckOutlined,
  LineChartOutlined,
  LogoutOutlined,
  ReadOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WarningFilled,
  CheckCircleFilled,
  FileTextFilled,
  InfoCircleFilled,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOP_MENUS } from '@/constants/menu';
import { useAppStore } from '@/stores/useAppStore';
import { filterNotifications, useNotificationStore } from '@/stores/useNotificationStore';
import { mockLogout } from '@/api/modules';
import { searchIndex } from '@/stores/searchIndex';
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

const notifIconMap: Record<string, React.ReactNode> = {
  alert: <WarningFilled style={{ color: '#ef4444' }} />,
  task: <CheckCircleFilled style={{ color: '#22c55e' }} />,
  report: <FileTextFilled style={{ color: '#3b82f6' }} />,
  system: <InfoCircleFilled style={{ color: '#06b6d4' }} />,
};

interface MainLayoutProps {
  children: React.ReactNode;
  variant?: 'default' | 'wide';
}

export function MainLayout({ children, variant = 'default' }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppStore((s) => s.user);
  const logoutStore = useAppStore((s) => s.logout);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const notifItems = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markRead = useNotificationStore((s) => s.markRead);

  const suggestions = searchText ? searchIndex(searchText).slice(0, 5) : [];
  const visibleNotifications = filterNotifications(notifItems, user?.preferences);
  const unreadNotifications = visibleNotifications.filter((item) => !item.read);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const activeKey = TOP_MENUS.find((m) =>
    m.key === 'home' ? location.pathname === '/' : location.pathname.startsWith(m.path),
  )?.key ?? 'home';

  const menuItems: MenuProps['items'] = TOP_MENUS.map((m) => ({
    key: m.key,
    label: m.label,
    icon: iconMap[m.key],
  }));

  const handleLogout = async () => {
    await mockLogout();
    logoutStore();
    message.success('已退出登录');
    navigate('/login', { replace: true });
  };

  const userMenu: MenuProps['items'] = [
    { key: 'profile', label: '个人中心', icon: <UserOutlined />, onClick: () => navigate('/account/profile') },
    { key: 'settings', label: '账户设置', icon: <SettingOutlined />, onClick: () => navigate('/account/settings') },
    { type: 'divider' },
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: handleLogout },
  ];

  const handleSearch = (value: string) => {
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value.trim())}`);
      setSearchFocused(false);
    }
  };

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
            <div className="subtitle">DuMate · 无人仓生成与进化平台</div>
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

        <div className="ican-header-right" ref={searchRef}>
          <div className="search-wrapper">
            <Input
              placeholder="搜索项目、场景、报告..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              className="ican-search-input"
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onPressEnter={() => handleSearch(searchText)}
            />
            {searchFocused && suggestions.length > 0 && (
              <div className="search-suggestions">
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    className="suggestion-row"
                    onClick={() => { navigate(s.url); setSearchFocused(false); setSearchText(''); }}
                  >
                    <span className="suggestion-icon">
                      {s.type === 'project' ? '📁' : s.type === 'scene' ? '🗄️' : s.type === 'report' ? '📊' : '⚙️'}
                    </span>
                    <div className="suggestion-body">
                      <div className="suggestion-title">{s.title}</div>
                      <div className="suggestion-desc">{s.description}</div>
                    </div>
                  </div>
                ))}
                <div className="suggestion-all" onClick={() => handleSearch(searchText)}>
                  查看全部结果 &rarr;
                </div>
              </div>
            )}
          </div>
          <Badge count={unreadNotifications.length} size="small" offset={[-2, 4]}>
            <Button
              type="text"
              icon={<BellOutlined style={{ color: '#fff', fontSize: 18 }} />}
              onClick={() => setNotifOpen(true)}
            />
          </Badge>
          <Button className="ican-project-btn" onClick={() => navigate('/simulation')}>
            项目中心 <CaretDownOutlined />
          </Button>
          <Dropdown menu={{ items: userMenu }} placement="bottomRight">
            <div className="ican-user">
              <img src={user?.avatar} alt={user?.name ?? ''} className="avatar" />
              <span className="user-name">{user?.name ?? '未登录'}</span>
              <CaretDownOutlined style={{ color: '#cbd5e1', fontSize: 12 }} />
            </div>
          </Dropdown>
        </div>
      </Header>

      <Content className={variant === 'wide' ? 'ican-content-wide' : 'ican-content'}>
        {children}
      </Content>

      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>消息通知 {unreadNotifications.length > 0 && <Badge count={unreadNotifications.length} style={{ marginLeft: 8 }} />}</span>
            <Button size="small" icon={<CheckOutlined />} onClick={() => { markAllRead(unreadNotifications.map((item) => item.id)); message.success('已全部标为已读'); }}>
              全部标为已读
            </Button>
          </div>
        }
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        width={380}
        extra={<a onClick={() => { setNotifOpen(false); navigate('/notifications'); }}>查看全部</a>}
      >
        <List
          dataSource={unreadNotifications.slice(0, 10)}
          locale={{ emptyText: '暂无未读通知' }}
          renderItem={(item) => (
            <div
              className="drawer-notif-row"
              onClick={() => {
                markRead(item.id);
                if (item.targetUrl) { setNotifOpen(false); navigate(item.targetUrl); }
              }}
            >
              <div className="drawer-notif-icon">{notifIconMap[item.type]}</div>
              <div className="drawer-notif-body">
                <div className="drawer-notif-title">{item.title}</div>
                <div className="drawer-notif-time">{item.createdAt}</div>
              </div>
            </div>
          )}
        />
      </Drawer>
    </Layout>
  );
}
