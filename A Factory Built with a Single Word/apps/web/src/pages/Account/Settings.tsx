import { Button, Form, Input, Modal, Tag, message } from 'antd';
import { ClockCircleOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from 'antd';
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

  const handleFinish = async (values: { oldPassword: string; newPassword: string }) => {
    if (!user) return;
    setLoading(true);
    try {
      await mockChangePassword(user.id, values.oldPassword, values.newPassword);
      Modal.confirm({
        title: '密码修改成功',
        content: '请使用新密码重新登录',
        okText: '重新登录',
        onOk: () => { logout(); navigate('/login', { replace: true }); },
      });
      form.resetFields();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="account-content-inner">
      <div className="account-info-panel">
        <Card className="info-card" size="small">
          <div className="info-card-header">
            <SafetyCertificateOutlined style={{ fontSize: 32, color: '#2b6fff', background: '#eff6ff', borderRadius: 8, padding: 10 }} />
            <div>
              <h2 className="account-name">账号安全</h2>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                <Tag icon={<LockOutlined />} color="blue">密码强度：中</Tag>
                <Tag color="default">最近修改：第 1 周</Tag>
              </div>
            </div>
          </div>
          <div className="info-meta">
            <div className="info-meta-item">
              <ClockCircleOutlined />
              <span>建议每 90 天更换一次密码</span>
            </div>
          </div>
        </Card>
      </div>

      <SectionCard title="修改密码">
        <Form form={form} onFinish={handleFinish} layout="vertical" style={{ maxWidth: 420 }}>
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="原密码" />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="新密码（至少 6 位）" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认新密码" dependencies={['newPassword']}
            rules={[{ required: true, message: '请再次输入新密码' }, ({ getFieldValue }) => ({ validator(_, v) { return !v || getFieldValue('newPassword') === v ? Promise.resolve() : Promise.reject(new Error('两次密码不一致')); } })]}>
            <Input.Password prefix={<LockOutlined />} placeholder="再次输入新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} danger>修改密码</Button>
          </Form.Item>
        </Form>
      </SectionCard>
    </div>
  );
}
