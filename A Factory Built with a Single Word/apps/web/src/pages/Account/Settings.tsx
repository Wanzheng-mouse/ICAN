import { Button, Form, Input, Modal, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { mockChangePassword } from '@/api/modules';
import { SectionCard } from '@/components';
import './Account.css';

export default function SettingsPage() {
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleFinish = async (values: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次密码输入不一致');
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      await mockChangePassword(user.id, values.oldPassword, values.newPassword);
      Modal.confirm({
        title: '密码修改成功',
        content: '请使用新密码重新登录',
        okText: '重新登录',
        cancelText: '稍后',
        onOk: () => {
          logout();
          navigate('/login', { replace: true });
        },
      });
      form.resetFields();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-page">
      <SectionCard title="修改密码">
        <Form form={form} onFinish={handleFinish} layout="vertical" style={{ maxWidth: 420 }}>
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="原密码" />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="新密码（至少 6 位）" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认新密码" rules={[{ required: true, message: '请再次输入新密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="再次输入新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>修改密码</Button>
          </Form.Item>
        </Form>
      </SectionCard>
    </div>
  );
}
