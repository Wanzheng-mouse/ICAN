import { useState } from 'react';
import { Button, Form, Input, Typography, message } from 'antd';
import { ArrowLeftOutlined, LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { register as registerUser } from '@/api/modules';
import { useAppStore } from '@/stores/useAppStore';
import './Login.css';

const { Title, Text } = Typography;

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const login = useAppStore((s) => s.login);
  const navigate = useNavigate();

  const handleFinish = async (values: { loginName: string; name: string; email: string; password: string; confirmPassword: string }) => {
    setLoading(true);
    try {
      const result = await registerUser(values);
      login(result.user, result.token, true);
      message.success('注册成功，已为你进入工作台');
      navigate('/', { replace: true });
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card register-card">
        <div className="login-header">
          <div className="login-logo">
            <svg viewBox="0 0 32 32" width="40" height="40">
              <defs>
                <linearGradient id="logoG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="6" fill="#1c2756" />
              <path d="M8 22 L16 8 L24 22 Z" fill="url(#logoG)" />
              <circle cx="16" cy="20" r="2.5" fill="#1c2756" />
            </svg>
          </div>
          <Title level={3} style={{ margin: '12px 0 4px' }}>创建演示账号</Title>
          <Text type="secondary">账号仅保存在当前浏览器，用于体验平台完整流程</Text>
        </div>

        <Form onFinish={handleFinish} layout="vertical" size="large" className="login-form auth-form">
          <Form.Item label={<span style={{ color: '#e0e7ff' }}>登录账号</span>} name="loginName" rules={[{ required: true, pattern: /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/, message: '以字母开头，3-20位字母数字或下划线' }]}>
            <Input prefix={<UserOutlined />} placeholder="例如 warehouse_admin" />
          </Form.Item>
          <Form.Item label={<span style={{ color: '#e0e7ff' }}>姓名</span>} name="name" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用于个人中心展示" />
          </Form.Item>
          <Form.Item label={<span style={{ color: '#e0e7ff' }}>邮箱</span>} name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input prefix={<MailOutlined />} placeholder="name@company.com" autoComplete="email" />
          </Form.Item>
          <Form.Item label={<span style={{ color: '#e0e7ff' }}>密码</span>} name="password" rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="至少 6 位密码" autoComplete="new-password" />
          </Form.Item>
          <Form.Item label={<span style={{ color: '#e0e7ff' }}>确认密码</span>} name="confirmPassword" dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({ validator(_, v) { return !v || getFieldValue('password') === v ? Promise.resolve() : Promise.reject(new Error('两次密码不一致')); } }),
            ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="再次输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>创建账号并进入工作台</Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/login')}>已有账号？返回登录</Button>
        </div>
      </div>
    </div>
  );
}
