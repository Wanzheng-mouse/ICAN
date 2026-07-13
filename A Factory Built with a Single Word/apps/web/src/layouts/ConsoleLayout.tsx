import { Layout, Menu, type MenuProps } from 'antd';
import {
  AlertOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  DesktopOutlined,
  DoubleLeftOutlined,
  FileTextOutlined,
  HomeOutlined,
  RobotOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from './MainLayout';
import { SIDE_MENUS } from '@/constants/menu';

const { Sider } = Layout;

const iconMap: Record<string, React.ReactNode> = {
  HomeOutlined: <HomeOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  UnorderedListOutlined: <UnorderedListOutlined />,
  DesktopOutlined: <DesktopOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  RobotOutlined: <RobotOutlined />,
  AlertOutlined: <AlertOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  SettingOutlined: <SettingOutlined />,
};

export function ConsoleLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKey = SIDE_MENUS.find((m) => location.pathname === m.path)?.key ?? 'simulation';

  const menuItems: MenuProps['items'] = SIDE_MENUS.map((m) => ({
    key: m.key,
    label: m.label,
    icon: iconMap[m.icon],
  }));

  return (
    <MainLayout variant="wide">
      <Layout className="ican-console-layout">
        <Sider
          width={200}
          className="ican-console-sider"
          collapsible
          collapsed={false}
          trigger={null}
        >
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[activeKey]}
            items={menuItems}
            onClick={({ key }) => {
              const target = SIDE_MENUS.find((m) => m.key === key);
              if (target) navigate(target.path);
            }}
            className="ican-side-menu"
          />
          <div className="ican-sider-footer">
            <DoubleLeftOutlined /> 收起侧栏
          </div>
        </Sider>
        <Layout.Content className="ican-console-content">
          <Outlet />
        </Layout.Content>
      </Layout>
    </MainLayout>
  );
}
