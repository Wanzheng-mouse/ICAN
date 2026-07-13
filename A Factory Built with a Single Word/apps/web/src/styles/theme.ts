import { theme as antdTheme, type ThemeConfig } from 'antd';

/**
 * Ant Design 主题 - 贴近原型的深蓝科技感
 */
export type ThemeMode = 'light' | 'dark';

export function createTheme(mode: ThemeMode): ThemeConfig {
  const dark = mode === 'dark';
  return {
  algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#3568ff',
    colorInfo: '#3568ff',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorLink: '#2b6fff',
    colorTextBase: dark ? '#e5edf9' : '#1f2937',
    colorBgBase: dark ? '#111a2f' : '#ffffff',
    colorBgLayout: dark ? '#0c1428' : '#f4f7fc',
    colorBorder: dark ? '#2b3b5c' : '#e5eaf3',
    colorBorderSecondary: dark ? '#22314d' : '#edf1f7',
    borderRadius: 12,
    fontSize: 14,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
    wireframe: false,
  },
  components: {
    Button: { primaryShadow: '0 10px 22px rgba(53, 104, 255, 0.22)', defaultShadow: 'none', borderRadius: 10 },
    Card: { headerBg: 'transparent' },
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
    Layout: { headerBg: '#0b1733', bodyBg: dark ? '#0c1428' : '#f5f7fb', siderBg: '#0b1733' },
    Table: { headerBg: dark ? '#17233d' : '#fafbfd', headerColor: dark ? '#e5edf9' : '#1f2937' },
    Tabs: { itemSelectedColor: '#2b6fff', inkBarColor: '#2b6fff' },
    Tag: { defaultBg: '#f1f5f9' },
  },
  };
}

/** 默认主题，供非 React 场景复用。 */
export const theme = createTheme('light');
