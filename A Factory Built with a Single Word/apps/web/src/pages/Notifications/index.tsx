import { useMemo, useState } from 'react';
import { Badge, Button, List, Segmented, Tag, Space, message } from 'antd';
import { CheckOutlined, CheckCircleFilled, FileTextFilled, InfoCircleFilled, WarningFilled, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '@/stores/useNotificationStore';
import type { NotificationItem } from '@/stores/useNotificationStore';
import './Notifications.css';

const iconMap: Record<string, React.ReactNode> = {
  alert: <WarningFilled style={{ color: '#ef4444' }} />,
  task: <CheckCircleFilled style={{ color: '#22c55e' }} />,
  report: <FileTextFilled style={{ color: '#3b82f6' }} />,
  system: <InfoCircleFilled style={{ color: '#06b6d4' }} />,
};

const typeLabel: Record<string, string> = { alert: '告警', task: '任务', report: '报告', system: '系统' };

const severityConfig: Record<string, { color: string; badge: 'error' | 'warning' | 'success' | 'processing' }> = {
  alert: { color: '#ef4444', badge: 'error' },
  task: { color: '#22c55e', badge: 'success' },
  report: { color: '#3b82f6', badge: 'processing' },
  system: { color: '#06b6d4', badge: 'warning' },
};

function NotificationRow({ item, onRead, onJump }: { item: NotificationItem; onRead: (id: string) => void; onJump: (url: string) => void }) {
  const sev = severityConfig[item.type];
  return (
    <div className={`notif-row ${!item.read ? 'unread' : ''}`}>
      <div className="notif-icon">{iconMap[item.type]}</div>
      <div className="notif-body">
        <div className="notif-title-row">
          {!item.read && <span className="notif-dot" />}
          <span className="notif-title">{item.title}</span>
          <Tag color={sev.badge} style={{ fontSize: 10, marginLeft: 'auto' }}>{typeLabel[item.type]}</Tag>
        </div>
        <div className="notif-content">{item.content}</div>
        <div className="notif-meta-row">
          <span className="notif-time">{item.createdAt}</span>
          <Space size={4}>
            {!item.read && (
              <Button type="text" size="small" icon={<CheckOutlined />} onClick={(e) => { e.stopPropagation(); onRead(item.id); message.success('已标为已读'); }}>
                标为已读
              </Button>
            )}
            {item.targetUrl && (
              <Button type="link" size="small" icon={<RightOutlined />} onClick={(e) => { e.stopPropagation(); onJump(item.targetUrl!); }}>
                查看详情
              </Button>
            )}
          </Space>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>('all');
  const items = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markRead = useNotificationStore((s) => s.markRead);

  const unreadCount = items.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    if (filter === 'unread') return items.filter((n) => !n.read);
    if (filter === 'alert' || filter === 'system') return items.filter((n) => n.type === filter);
    return items;
  }, [items, filter]);

  const handleJump = (url: string) => navigate(url);

  return (
    <div className="notif-page">
      <div className="notif-header">
        <div className="notif-header-title">
          <h1 className="notif-title">消息中心</h1>
          {unreadCount > 0 && <Badge count={unreadCount} style={{ marginLeft: 8 }} />}
        </div>
        <Button icon={<CheckOutlined />} onClick={() => { markAllRead(); message.success('已全部标为已读'); }}>
          全部标为已读
        </Button>
      </div>

      <div className="notif-toolbar">
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as string)}
          options={[
            { label: '全部', value: 'all' },
            { label: '未读', value: 'unread' },
            { label: '告警', value: 'alert' },
            { label: '系统', value: 'system' },
          ]}
        />
        <span className="notif-total">共 {filtered.length} 条</span>
      </div>

      <div className="notif-card">
        {filtered.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-icon">🔔</div>
            <p style={{ color: '#1f2937', fontWeight: 500 }}>暂无通知</p>
            <p style={{ color: '#6b7280', fontSize: 13 }}>{filter === 'unread' ? '所有通知已读' : '当前没有此类通知'}</p>
          </div>
        ) : (
          <List
            dataSource={filtered}
            renderItem={(item) => <NotificationRow item={item} onRead={markRead} onJump={handleJump} />}
          />
        )}
      </div>
    </div>
  );
}
