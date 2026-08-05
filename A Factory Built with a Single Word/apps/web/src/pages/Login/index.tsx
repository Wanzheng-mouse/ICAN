import { useState } from 'react';
import { Button, Checkbox, Form, Input, Typography, message } from 'antd';
import {
  ArrowRightOutlined,
  AppstoreFilled,
  LockOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { DEMO_ACCOUNT_HINT, login as loginUser } from '@/api/modules';
import './Login.css';

const { Text, Title } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const login = useAppStore((state) => state.login);
  const preferencesByUserId = useAppStore((state) => state.preferencesByUserId);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from;
  const [form] = Form.useForm();

  const handleFinish = async (values: { username: string; password: string; remember: boolean }) => {
    setLoading(true);
    try {
      const result = await loginUser(values);
      const defaultPage = preferencesByUserId[result.user.id]?.defaultPage
        ?? result.user.preferences?.defaultPage
        ?? '/';
      login(result.user, result.token, values.remember);
      message.success(`欢迎回来，${result.user.name}`);
      navigate(from ?? defaultPage, { replace: true });
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-label="平台介绍">
        <div className="auth-brand-row">
          <div className="auth-brand"><span className="auth-brand-icon"><AppstoreFilled /></span><b>一言造厂</b></div>
          <div className="auth-environment"><span /> SIMULATION ONLINE</div>
        </div>
        <div className="auth-creative-field" aria-hidden="true">
          <div className="creative-halo creative-halo-one" />
          <div className="creative-halo creative-halo-two" />
          <div className="creative-halo creative-halo-three" />
          <div className="creative-beam creative-beam-one" />
          <div className="creative-beam creative-beam-two" />
          <div className="creative-node creative-node-one"><i /></div>
          <div className="creative-node creative-node-two"><i /></div>
          <div className="creative-node creative-node-three"><i /></div>
          <div className="creative-node creative-node-four"><i /></div>
          <div className="creative-corner creative-corner-left" />
          <div className="creative-corner creative-corner-right" />
          <div className="creative-dots creative-dots-left" />
          <div className="creative-dots creative-dots-right" />
          <div className="creative-axis-label creative-axis-label-left">DU / 01</div>
          <div className="creative-axis-label creative-axis-label-right">WAREHOUSE INTELLIGENCE</div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-login-mark"><AppstoreFilled /></div>
          <span className="auth-kicker">SECURE ACCESS</span>
          <Title level={2}>欢迎回来</Title>
          <Text type="secondary">登录一言造厂，继续你的无人仓决策项目</Text>

          <Form form={form} onFinish={handleFinish} initialValues={{ remember: true }} layout="vertical" size="large" className="auth-form">
            <Form.Item label="账号或邮箱" name="username" rules={[{ required: true, message: '请输入账号或邮箱' }]}>
              <Input prefix={<UserOutlined />} placeholder="邮箱 / 账号" autoFocus autoComplete="username" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="current-password" />
            </Form.Item>
            <div className="auth-form-row">
              <Form.Item name="remember" valuePropName="checked" noStyle><Checkbox>记住我</Checkbox></Form.Item>
              <button type="button" className="auth-link" onClick={() => navigate('/forgot-password')}>忘记密码？</button>
            </div>
            <Button type="primary" htmlType="submit" loading={loading} block className="auth-submit">进入工作台 <ArrowRightOutlined /></Button>
          </Form>

          <div className="auth-demo"><span>演示账号：</span><button type="button" onClick={() => form.setFieldsValue(DEMO_ACCOUNT_HINT)}>admin / ican2026</button></div>
          <div className="auth-switch">还没有账号？<button type="button" onClick={() => navigate('/register')}>创建本地演示账号</button></div>
        </div>
      </section>
    </main>
  );
}
