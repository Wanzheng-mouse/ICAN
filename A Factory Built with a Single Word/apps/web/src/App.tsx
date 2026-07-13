import { useEffect, useMemo } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { StyleProvider } from 'antd-style';
import { createTheme } from '@/styles/theme';
import { GlobalStyle } from '@/styles/global';
import { queryClient } from '@/api/queryClient';
import { AppRoutes } from '@/routes';
import { useAppStore } from '@/stores/useAppStore';

export default function App() {
  const themeMode = useAppStore((state) => state.user?.preferences?.theme ?? 'light');
  const antdTheme = useMemo(() => createTheme(themeMode), [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  return (
    <StyleProvider hashPriority="high">
      <ConfigProvider theme={antdTheme} locale={zhCN}>
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <GlobalStyle />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </QueryClientProvider>
        </AntApp>
      </ConfigProvider>
    </StyleProvider>
  );
}
