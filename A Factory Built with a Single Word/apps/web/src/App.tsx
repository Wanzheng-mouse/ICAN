import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { StyleProvider } from 'antd-style';
import { theme } from '@/styles/theme';
import { GlobalStyle } from '@/styles/global';
import { queryClient } from '@/api/queryClient';
import { AppRoutes } from '@/routes';

export default function App() {
  return (
    <StyleProvider hashPriority="high">
      <ConfigProvider theme={theme} locale={zhCN}>
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
