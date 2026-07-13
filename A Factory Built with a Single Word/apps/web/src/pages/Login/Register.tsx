import { useState } from 'react';
import { Button, Form, Input, Typography, message } from 'antd';
import { ArrowLeftOutlined, LockOutlined, MailOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { mockRegister } from '@/api/modules';
import { useAppStore } from '@/stores/useAppStore';
import './Login.css';

const { Text, Title } = Typography;

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const login = useAppStore((state) => state.login);
  const navigate = useNavigate();

  const register = async (values: { loginName: string; name: string; email: string; password: string; confirmPassword: string }) => {
    setLoading(true);
    try {
      const result = await mockRegister(values);
      login(result.user, result.token, true);
      message.success('注册成功，已为你进入工作台');
      navigate('/', { replace: true });
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page auth-register-page">
      <section className="auth-panel auth-panel-full">
        <div className="auth-form-wrap auth-register-wrap">
          <button type="button" className="auth-back" onClick={() => navigate('/login')}><ArrowLeftOutlined /> 返回登录</button>
          <div className="auth-mobile-brand auth-register-brand"><RobotOutlined /> 一言造厂</div>
          <span className="auth-kicker">CREATE YOUR WORKSPACE</span>
          <Title level={2}>创建演示账号</Title>
          <Text type="secondary">账号仅保存在当前浏览器，用于体验平台完整流程。</Text>
          <Form onFinish={register} layout="vertical" size="large" className="auth-form auth-register-form">
            <Form.Item label="登录账号" name="loginName" rules={[{ required: true, message: '请输入登录账号' }, { pattern: /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/, message: '以字母开头，3–20 位字母、数字或下划线' }]}><Input prefix={<UserOutlined />} placeholder="例如 warehouse_admin" autoComplete="username" /></Form.Item>
            <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}><Input prefix={<UserOutlined />} placeholder="用于个人中心展示" /></Form.Item>
            <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}><Input prefix={<MailOutlined />} placeholder="name@company.com" autoComplete="email" /></Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}><Input.Password prefix={<LockOutlined />} placeholder="至少 6 位密码" autoComplete="new-password" /></Form.Item>
            <Form.Item label="确认密码" name="confirmPassword" dependencies={['password']} rules={[{ required: true, message: '请再次输入密码' }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致')); } })]}><Input.Password prefix={<LockOutlined />} placeholder="再次输入密码" autoComplete="new-password" /></Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block className="auth-submit">创建账号并进入工作台</Button>
          </Form>
        </div>
      </section>
    </main>
  );
}
