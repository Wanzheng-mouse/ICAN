import { useMemo, useState } from 'react';
import { Button, Empty, List, Tag, Tabs } from 'antd';
import { CheckOutlined, CheckCircleFilled, FileTextFilled, InfoCircleFilled, WarningFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { filterNotifications, useNotificationStore } from '@/stores/useNotificationStore';
import type { NotificationItem } from '@/stores/useNotificationStore';
import { useAppStore } from '@/stores/useAppStore';
import './Notifications.css';

const iconMap: Record<string, React.ReactNode> = {
  alert: <WarningFilled style={{ color: '#ef4444' }} />,
  task: <CheckCircleFilled style={{ color: '#22c55e' }} />,
  report: <FileTextFilled style={{ color: '#3b82f6' }} />,
  system: <InfoCircleFilled style={{ color: '#06b6d4' }} />,
};

const typeLabel: Record<string, string> = { alert: '告警', task: '任务', report: '报告', system: '系统' };

function NotificationRow({ item, onRead }: { item: NotificationItem; onRead: (id: string) => void }) {
  const navigate = useNavigate();
  return (
    <div
      className={`notif-row ${!item.read ? 'unread' : ''}`}
      onClick={() => { if (!item.read) onRead(item.id); if (item.targetUrl) navigate(item.targetUrl); }}
    >
      <div className="notif-icon">{iconMap[item.type]}</div>
      <div className="notif-body">
        <div className="notif-title">
          {!item.read && <span className="notif-dot" />}
          {item.title}
        </div>
        <div className="notif-content">{item.content}</div>
        <div className="notif-meta">
          <Tag style={{ fontSize: 10 }}>{typeLabel[item.type]}</Tag>
          <span>{item.createdAt}</span>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread' | 'alert' | 'system'>('all');
  const items = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markRead = useNotificationStore((s) => s.markRead);
  const preferences = useAppStore((s) => s.user?.preferences);

  const filtered = useMemo(() => {
    const visible = filterNotifications(items, preferences);
    if (filter === 'unread') return visible.filter((n) => !n.read);
    if (filter === 'alert' || filter === 'system') return visible.filter((n) => n.type === filter);
    return visible;
  }, [items, filter, preferences]);

  return (
    <div className="notif-page">
      <div className="notif-header">
        <h1 className="notif-title">消息中心</h1>
        <Button icon={<CheckOutlined />} onClick={() => markAllRead(filtered.map((item) => item.id))}>全部标为已读</Button>
      </div>
      <div className="notif-card">
        <Tabs
          activeKey={filter}
          onChange={(k) => setFilter(k as typeof filter)}
          items={[
            { key: 'all', label: '全部' },
            { key: 'unread', label: '未读' },
            { key: 'alert', label: '告警' },
            { key: 'system', label: '系统' },
          ]}
        />
        {filtered.length === 0 ? (
          <Empty description="暂无通知" style={{ padding: 40 }} />
        ) : (
          <List
            dataSource={filtered}
            renderItem={(item) => <NotificationRow item={item} onRead={markRead} />}
          />
        )}
      </div>
    </div>
  );
}
