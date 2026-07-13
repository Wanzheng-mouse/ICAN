import { useState } from 'react';
import { Button, Descriptions, Input, message, Upload } from 'antd';
import { CameraOutlined, UserOutlined } from '@ant-design/icons';
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
    const maxSize = 2 * 1024 * 1024; // 2MB
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      message.warning('仅支持 PNG / JPG / GIF / WebP');
      return false;
    }
    if (file.size > maxSize) {
      message.warning('文件大小不能超过 2MB');
      return false;
    }
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    return false;
  };

  if (!user) return null;

  return (
    <div className="account-page">
      <div className="account-header">
        <span className="account-avatar-wrapper">
          <img src={avatarPreview} alt={user.name} className="account-avatar" />
          <Upload showUploadList={false} beforeUpload={handleAvatarChange} accept="image/png,image/jpeg,image/gif,image/webp">
            <div className="avatar-edit"><CameraOutlined /></div>
          </Upload>
        </span>
        <div>
          <h2 className="account-name">{user.name}</h2>
          <p className="account-role">{user.role === 'admin' ? '管理员' : user.role === 'operator' ? '运营人员' : '查看者'}</p>
        </div>
      </div>
      <SectionCard title="个人资料">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="昵称">
            {editing ? <Input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 200 }} /> : user.name}
          </Descriptions.Item>
          <Descriptions.Item label="角色">{user.role === 'admin' ? '管理员' : user.role === 'operator' ? '运营人员' : '查看者'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{user.email} <span style={{ color: '#9ca3af', fontSize: 11 }}>（只读）</span></Descriptions.Item>
          <Descriptions.Item label="部门">{user.department} <span style={{ color: '#9ca3af', fontSize: 11 }}>（只读）</span></Descriptions.Item>
        </Descriptions>
        {editing ? (
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={handleSave}>保存</Button>
            <Button onClick={() => setEditing(false)}>取消</Button>
          </div>
        ) : (
          <Button style={{ marginTop: 16 }} icon={<UserOutlined />} onClick={() => setEditing(true)}>编辑资料</Button>
        )}
      </SectionCard>
    </div>
  );
}
