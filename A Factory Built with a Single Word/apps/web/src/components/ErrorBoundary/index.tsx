import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result, Space, Typography } from 'antd';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught application error', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f7fb' }}>
        <Result
          status="500"
          title="页面运行出现异常"
          subTitle="系统已经拦截本次错误，其他数据不会受到影响。你可以重试当前页面或返回首页。"
          extra={<Space><Button onClick={this.reset}>重试页面</Button><Button type="primary" onClick={() => window.location.assign('/')}>返回首页</Button></Space>}
        >
          {import.meta.env.DEV && <Typography.Text code>{this.state.error.message}</Typography.Text>}
        </Result>
      </div>
    );
  }
}

