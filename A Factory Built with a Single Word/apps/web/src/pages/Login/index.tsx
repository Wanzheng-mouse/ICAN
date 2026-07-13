import { useState } from 'react';
import { Button, Checkbox, Form, Input, Typography, message } from 'antd';
import {
  ArrowRightOutlined,
  ApiOutlined,
  AppstoreFilled,
  CheckCircleFilled,
  DeploymentUnitOutlined,
  LockOutlined,
  RadarChartOutlined,
  SafetyCertificateFilled,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { DEMO_ACCOUNT_HINT, mockLogin } from '@/api/modules';
import './Login.css';

const { Text, Title } = Typography;

function DigitalTwinBoard() {
  return (
    <div className="twin-board" aria-hidden="true">
      <div className="twin-board-header">
        <div><span className="live-dot" /> LIVE DIGITAL TWIN</div>
        <span>SCENE / WH-A01</span>
      </div>
      <div className="twin-board-body">
        <div className="twin-map">
          <div className="map-label map-label-a">STORAGE A</div>
          <div className="map-label map-label-b">PICKING</div>
          <div className="rack-zone rack-zone-a">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>
          <div className="rack-zone rack-zone-b">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div>
          <div className="sort-zone"><span /><span /><span /></div>
          <div className="route route-a" /><div className="route route-b" /><div className="route route-c" />
          <div className="agv-dot agv-dot-a"><b>07</b></div>
          <div className="agv-dot agv-dot-b"><b>12</b></div>
          <div className="agv-dot agv-dot-c"><b>18</b></div>
          <div className="map-pulse pulse-a" /><div className="map-pulse pulse-b" />
        </div>
        <div className="twin-feed">
          <div className="feed-title">智能体状态 <span>6 ONLINE</span></div>
          <div className="feed-item"><DeploymentUnitOutlined /><div><b>调度智能体</b><span>任务分配中</span></div><em>RUN</em></div>
          <div className="feed-item"><RadarChartOutlined /><div><b>导航智能体</b><span>路径计算完成</span></div><em>OK</em></div>
          <div className="feed-item"><ApiOutlined /><div><b>设备智能体</b><span>设备运行正常</span></div><em>OK</em></div>
        </div>
      </div>
      <div className="twin-kpis">
        <div><ThunderboltOutlined /><span>系统吞吐</span><strong>1,284<small> 件/h</small></strong></div>
        <div><RadarChartOutlined /><span>任务完成率</span><strong>98.6<small>%</small></strong></div>
        <div><CheckCircleFilled /><span>在线设备</span><strong>126<small> / 128</small></strong></div>
      </div>
    </div>
  );
}

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
      const result = await mockLogin(values);
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
        <div className="auth-showcase-content">
          <span className="auth-eyebrow">DU MATE / AUTONOMOUS WAREHOUSE</span>
          <h1>让仓储决策<br /><em>先在数字世界发生</em></h1>
          <p>从一句需求到可验证的无人仓方案，完成建模、仿真、进化与决策闭环。</p>
        </div>
        <DigitalTwinBoard />
        <div className="auth-status"><SafetyCertificateFilled /> 本地演示环境安全运行</div>
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
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
