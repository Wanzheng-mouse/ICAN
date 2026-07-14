import { useState } from 'react';
import { Button, Card, Descriptions, Input, Tag, Upload, message } from 'antd';
import { CameraOutlined, CheckCircleFilled, ClockCircleOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { useAppStore } from '@/stores/useAppStore';
import { mockUpdateProfile } from '@/api/modules';
import { SectionCard } from '@/components';
import './Account.css';

export default function ProfilePage() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar ?? '');

  const handleSave = async () => {
    if (!user) return;
    try {
      const updated = await mockUpdateProfile(user.id, { name, avatar: avatarPreview });
      setUser(updated);
      setEditing(false);
      message.success('个人资料已更新');
    } catch {
      message.error('更新失败');
    }
  };

  const handleAvatarChange = (file: File) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) { message.warning('仅支持 PNG / JPG / GIF / WebP'); return false; }
    if (file.size > 2 * 1024 * 1024) { message.warning('文件大小不能超过 2MB'); return false; }
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    return false;
  };

  if (!user) return null;

  const roleLabel = user.role === 'admin' ? '管理员' : user.role === 'operator' ? '运营人员' : '查看者';

  return (
    <div className="account-content-inner">
      <div className="account-info-panel">
        <Card className="info-card" size="small">
          <div className="info-card-header">
            <span className="account-avatar-wrapper">
              <img src={avatarPreview} alt={user.name} className="account-avatar" />
              <Upload showUploadList={false} beforeUpload={handleAvatarChange}><div className="avatar-edit"><CameraOutlined /></div></Upload>
            </span>
            <div>
              <h2 className="account-name">{user.name}</h2>
              <p className="account-role">{roleLabel}</p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                <Tag icon={<CheckCircleFilled />} color="success">账号正常</Tag>
                <Tag icon={<SafetyCertificateOutlined />} color="blue">权限：{roleLabel}</Tag>
              </div>
            </div>
          </div>
          <div className="info-meta">
            <div className="info-meta-item">
              <ClockCircleOutlined style={{ color: '#9ca3af' }} />
              <span>最近登录：今天 10:32</span>
            </div>
            <div className="info-meta-item">
              <SafetyCertificateOutlined style={{ color: '#9ca3af' }} />
              <span>上次修改：第 1 周</span>
            </div>
          </div>
        </Card>
      </div>

      <SectionCard title="个人资料">
        <Descriptions column={1} size="small" className="profile-descriptions">
          <Descriptions.Item label="昵称">
            {editing ? <Input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 240 }} /> : <span className="profile-value">{user.name}</span>}
          </Descriptions.Item>
          <Descriptions.Item label="邮箱"><span className="profile-value">{user.email}</span><span className="profile-readonly">（只读）</span></Descriptions.Item>
          <Descriptions.Item label="部门"><span className="profile-value">{user.department}</span><span className="profile-readonly">（只读）</span></Descriptions.Item>
          <Descriptions.Item label="角色"><span className="profile-value">{roleLabel}</span></Descriptions.Item>
          <Descriptions.Item label="账号状态"><Tag icon={<CheckCircleFilled />} color="success">正常</Tag></Descriptions.Item>
        </Descriptions>
        {editing ? (
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={handleSave}>保存</Button>
            <Button onClick={() => { setEditing(false); setName(user.name); setAvatarPreview(user.avatar); }}>取消</Button>
          </div>
        ) : (
          <Button style={{ marginTop: 16 }} icon={<UserOutlined />} type="primary" ghost onClick={() => setEditing(true)}>编辑资料</Button>
        )}
      </SectionCard>
    </div>
  );
}
