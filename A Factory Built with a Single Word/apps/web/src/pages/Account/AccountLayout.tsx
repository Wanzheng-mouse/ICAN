import { useState, useEffect } from 'react';
import { Menu, Tabs, type MenuProps } from 'antd';
import { BellOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import './Account.css';

const menuItems: MenuProps['items'] = [
  { key: '/account/profile', label: '个人资料', icon: <UserOutlined /> },
  { key: '/account/settings', label: '账号安全', icon: <SafetyOutlined /> },
  { key: '/account/preferences', label: '偏好设置', icon: <BellOutlined /> },
];

export default function AccountLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const safeItems = menuItems ?? [];
  const matched = safeItems.filter((i) => i && i.key && location.pathname.startsWith(String(i.key)));
  const selectedKey = matched.length > 0 ? String(matched[matched.length - 1]!.key) : '/account/profile';

  if (isMobile) {
    return (
      <div className="page-container-wide account-layout-mobile">
        <Tabs
          activeKey={selectedKey}
          onChange={(k) => navigate(k)}
          items={[
            { key: '/account/profile', label: '个人资料' },
            { key: '/account/settings', label: '账号安全' },
            { key: '/account/preferences', label: '偏好设置' },
          ]}
        />
        <Outlet />
      </div>
    );
  }

  return (
    <div className="page-container-wide account-layout">
      <div className="account-sidebar">
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="account-side-menu"
        />
      </div>
      <div className="account-main">
        <Outlet />
      </div>
    </div>
  );
}
