import type { ThemeConfig } from 'antd';

/**
 * Ant Design 主题 - 贴近原型的深蓝科技感
 */
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#2b6fff',
    colorInfo: '#2b6fff',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorLink: '#2b6fff',
    colorTextBase: '#1f2937',
    colorBgBase: '#ffffff',
    colorBgLayout: '#f5f7fb',
    colorBorder: '#e5e7eb',
    colorBorderSecondary: '#eef0f4',
    borderRadius: 8,
    fontSize: 14,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
    wireframe: false,
  },
  components: {
    Button: { primaryShadow: 'none', defaultShadow: 'none' },
    Card: { headerBg: '#fafbfd' },
    Menu: {
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemSelectedBg: '#1c2756',
      itemSelectedColor: '#ffffff',
      itemHoverBg: 'rgba(255,255,255,0.06)',
      itemColor: '#cbd5e1',
      itemHoverColor: '#ffffff',
      horizontalItemSelectedColor: '#ffffff',
      horizontalItemHoverColor: '#ffffff',
    },
    Layout: { headerBg: '#0b1733', bodyBg: '#f5f7fb', siderBg: '#0b1733' },
    Table: { headerBg: '#fafbfd', headerColor: '#1f2937' },
    Tabs: { itemSelectedColor: '#2b6fff', inkBarColor: '#2b6fff' },
    Tag: { defaultBg: '#f1f5f9' },
  },
};
