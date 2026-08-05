import { Button, Form, Input, Typography, message } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { requestPasswordReset } from '@/api/modules/authApi';
import '../Login/Login.css';

const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleFinish = async (values: { email: string }) => {
    try {
      message.loading({ content: '正在发送重置链接…', key: 'reset', duration: 0 });
      const result = await requestPasswordReset({ email: values.email });
      message.success({
        content: result.message,
        key: 'reset',
        duration: 6,
      });
      form.resetFields();
    } catch (error) {
      message.error({
        content: error instanceof Error ? error.message : '发送失败，请稍后重试',
        key: 'reset',
        duration: 4,
      });
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
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
          <Title level={3} style={{ margin: '12px 0 4px' }}>找回密码</Title>
          <Text type="secondary">请输入注册邮箱，我们将发送重置链接</Text>
        </div>

        <Form form={form} onFinish={handleFinish} layout="vertical" size="large" className="login-form">
          <Form.Item
            name="email"
            label="注册邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="your@email.com" autoFocus />
          </Form.Item>
          <div className="reset-hint">
            <Text type="secondary" style={{ fontSize: 12 }}>
              重置链接将发送到您的注册邮箱，请查收。
            </Text>
          </div>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>发送重置链接</Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/login')}>
            返回登录
          </Button>
        </div>
      </div>
    </div>
  );
}
