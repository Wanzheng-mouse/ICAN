import { useMemo, useState } from 'react';
import { AuditOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Input, Result, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAuditLogs, type AuditLogRead } from '@/api/modules';
import { useRole } from '@/utils/roleGuard';
import { getApiErrorMessage } from '@/api/errorMessage';

const actionLabels: Record<string, string> = {
  create: '创建进化',
  export: '导出报告',
  'evolution.apply': '应用进化方案',
  'simulation.start': '启动仿真',
  'simulation.pause': '暂停仿真',
  'simulation.stop': '停止仿真',
  'simulation.anomaly': '注入异常',
  'member.upsert': '更新成员',
  'member.remove': '移除成员',
  update: '更新资料',
  change_password: '修改密码',
};

export default function AuditLogsPage() {
  const role = useRole();
  const [keyword, setKeyword] = useState('');
  const [resourceType, setResourceType] = useState<string>('all');
  const query = useAuditLogs(300);

  const rows = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return (query.data ?? []).filter((item) => {
      const matchesType = resourceType === 'all' || item.resource_type === resourceType;
      const haystack = `${item.action} ${item.resource_type} ${item.resource_id} ${item.user_id} ${JSON.stringify(item.detail)}`.toLowerCase();
      return matchesType && (!normalized || haystack.includes(normalized));
    });
  }, [keyword, query.data, resourceType]);

  if (role !== 'admin') {
    return <Result status="403" title="无权访问审计日志" subTitle="该页面仅对平台管理员开放。" />;
  }

  const columns: ColumnsType<AuditLogRead> = [
    { title: '时间', dataIndex: 'created_at', width: 185, render: (value: string) => new Date(value).toLocaleString('zh-CN') },
    { title: '操作', dataIndex: 'action', width: 150, render: (value: string) => <Tag color="blue">{actionLabels[value] ?? value}</Tag> },
    { title: '资源', key: 'resource', width: 210, render: (_, row) => <div><b>{row.resource_type}</b><div style={{ color: '#64748b', fontSize: 12 }}>{row.resource_id}</div></div> },
    { title: '用户 ID', dataIndex: 'user_id', width: 150, ellipsis: true },
    { title: '详情', dataIndex: 'detail', render: (value: Record<string, unknown>) => Object.keys(value).length ? <Typography.Text code>{JSON.stringify(value)}</Typography.Text> : <span style={{ color: '#94a3b8' }}>无附加数据</span> },
  ];

  const uniqueUsers = new Set((query.data ?? []).map((item) => item.user_id)).size;
  const today = new Date().toDateString();
  const todayCount = (query.data ?? []).filter((item) => new Date(item.created_at).toDateString() === today).length;

  return (
    <div className="page-container-wide" style={{ maxWidth: 1440, margin: '0 auto' }}>
      <Card variant="borderless" style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><Typography.Title level={2} style={{ margin: 0 }}><AuditOutlined /> 审计日志</Typography.Title><Typography.Paragraph type="secondary" style={{ margin: '8px 0 0' }}>集中追踪仿真控制、异常注入、方案进化、报告导出和成员权限变更。</Typography.Paragraph></div>
          <Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void query.refetch()}>刷新</Button>
        </Space>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 16 }}>
        <Card><Statistic title="记录总数" value={query.data?.length ?? 0} prefix={<SafetyCertificateOutlined />} /></Card>
        <Card><Statistic title="今日操作" value={todayCount} /></Card>
        <Card><Statistic title="涉及用户" value={uniqueUsers} /></Card>
      </div>

      <Card variant="borderless">
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索操作、资源 ID、用户或详情" style={{ width: 360 }} />
          <Select value={resourceType} onChange={setResourceType} style={{ width: 170 }} options={[
            { value: 'all', label: '全部资源' },
            { value: 'simulation', label: '仿真运行' },
            { value: 'evolution', label: '方案进化' },
            { value: 'simulation_report', label: '运行报告' },
            { value: 'project', label: '项目成员' },
            { value: 'profile', label: '账号资料' },
          ]} />
        </Space>
        {query.isError ? <Alert type="error" showIcon message="审计日志加载失败" description={getApiErrorMessage(query.error, '请检查管理员权限和后端连接')} action={<Button onClick={() => void query.refetch()}>重试</Button>} /> : (
          <Table rowKey="id" loading={query.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 15, showSizeChanger: true }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无符合条件的审计记录" /> }} scroll={{ x: 980 }} />
        )}
      </Card>
    </div>
  );
}

