import { Menu, type MenuProps } from 'antd';
import { BellOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import './Account.css';

export default function AccountLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const items: MenuProps['items'] = [
    { key: '/account/profile', label: '个人资料', icon: <UserOutlined /> },
    { key: '/account/settings', label: '账号安全', icon: <SafetyOutlined /> },
    { key: '/account/preferences', label: '偏好设置', icon: <BellOutlined /> },
  ];

  const safeItems = items ?? [];
  const matched = safeItems.filter((i) => i && i.key && location.pathname.startsWith(String(i.key)));
  const selectedKey = matched.length > 0 ? String(matched[matched.length - 1]!.key) : '/account/profile';

  return (
    <div className="page-container-wide account-layout">
      <div className="account-layout-inner">
        <div className="account-sidebar">
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={items}
            onClick={({ key }) => navigate(key)}
            style={{ borderInlineEnd: 'none' }}
          />
        </div>
        <div className="account-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
