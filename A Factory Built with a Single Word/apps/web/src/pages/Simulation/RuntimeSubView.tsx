import {
  AlertOutlined,
  CaretRightOutlined,
  PauseOutlined,
  ReloadOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Empty, Progress, Select, Table, Tag } from 'antd';
import type { Agent, SimulationEvent } from '@ican/contracts';
import type { SimulationTickRead, SimulationRobotTickRead, SimulationTaskTickRead } from '@/api/dtos/backend';
import type { SimulationConnectionState } from '@/hooks/useSimulationStream';
import type { AgvData, ChargerData, StationData, Task } from '@/components/SimView3D/types';
import { EditableFieldList, InlineEditable } from '@/components/EditableFieldList';
import {
  AGENTS_PAGE_FIELDS,
  AGV_ROW_FIELDS,
  ALERT_ROW_FIELDS,
  ALERTS_PAGE_FIELDS,
  DASHBOARD_PAGE_FIELDS,
  DEVICES_PAGE_FIELDS,
  ORDER_ROW_FIELDS,
  ORDERS_PAGE_FIELDS,
  SETTINGS_PAGE_FIELDS,
  TASKS_PAGE_FIELDS,
  TASK_ROW_FIELDS,
  type RowFieldBundle,
} from './editableFieldConfigs';
import './RuntimeSubView.css';

interface CargoRow {
  id: string;
  sku: string;
  type: 'tote' | 'carton' | 'pallet';
  quantity: number;
  weight: number;
  status: string;
  locationId: string;
  orderId?: string;
}

interface RuntimeSubViewProps {
  view: string;
  simulationId: string;
  status: 'idle' | 'running' | 'paused' | 'injected';
  connectionState: SimulationConnectionState;
  lastReceivedAt: string | null;
  config: Record<string, unknown>;
  tick: SimulationTickRead | null;
  agvs: AgvData[];
  tasks: Task[];
  stations: StationData[];
  chargers: ChargerData[];
  cargos: CargoRow[];
  agents: Agent[];
  events: SimulationEvent[];
  speed: number;
  busy: boolean;
  canControl: boolean;
  onSpeedChange: (value: number) => void;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onInject: () => void;
  onReconnect: () => void;
  onTaskReassign: (taskId: string) => void;
  onRobotCharge: (robotId: string) => void;
  onCreateOrder: (kind: 'inbound' | 'outbound') => void;
}

const titles: Record<string, { eyebrow: string; title: string; description: string }> = {
  tasks: { eyebrow: 'TASK RUNTIME', title: '任务管理', description: '追踪任务分配、执行进度、预计完成时间和关联设备。' },
  devices: { eyebrow: 'DEVICE FLEET', title: '设备管理', description: '统一查看 AGV、工作站与充电桩的实时运行状态。' },
  orders: { eyebrow: 'ORDER FLOW', title: '订单管理', description: '按货物生命周期观察入库、搬运、上架和出库进度。' },
  agents: { eyebrow: 'AGENT CONTROL', title: '智能体', description: '监控运行智能体的负载、成功率、延迟和职责。' },
  alerts: { eyebrow: 'ALERT CENTER', title: '告警中心', description: '集中查看异常事件，并在运行中执行可控异常注入。' },
  dashboard: { eyebrow: 'LIVE ANALYTICS', title: '数据看板', description: '展示由实时流更新的订单、利用率、拥堵和能源指标。' },
  settings: { eyebrow: 'RUN SETTINGS', title: '运行设置', description: '查看本次运行配置并控制仿真速度和生命周期。' },
};

function statusTag(status: RuntimeSubViewProps['status']) {
  const meta = status === 'running'
    ? { color: 'success', text: '运行中' }
    : status === 'paused'
      ? { color: 'warning', text: '已暂停' }
      : status === 'injected'
        ? { color: 'error', text: '异常处理中' }
        : { color: 'default', text: '待运行' };
  return <Tag color={meta.color}>{meta.text}</Tag>;
}

function connectionTag(state: SimulationConnectionState) {
  if (state === 'connected') return <Tag color="cyan" icon={<WifiOutlined />}>实时流已连接</Tag>;
  if (state === 'reconnecting') return <Tag color="warning">重连中</Tag>;
  if (state === 'error') return <Tag color="error">连接异常</Tag>;
  return <Tag>连接中</Tag>;
}

/**
 * 由行级字段配置生成「点击即编辑」列，插入表格（操作列之前）。
 * 每个字段独立持久化（storageKey::rowId::fieldKey），刷新后保留。
 */
function editableRowColumns(bundle: RowFieldBundle, storageKeyBase: string) {
  return bundle.fields.map((field) => ({
    title: field.label,
    key: `edit-${field.key}`,
    width: field.type === 'textarea' ? 170 : field.type === 'select' ? 124 : 132,
    render: (_: unknown, row: { id: string }) => (
      <InlineEditable
        storageKey={storageKeyBase}
        rowId={row.id}
        fieldKey={field.key}
        type={field.type}
        options={field.options}
        placeholder={field.placeholder}
        fallback={bundle.initial[field.key] ?? ''}
      />
    ),
  }));
}

export function RuntimeSubView(props: RuntimeSubViewProps) {
  const meta = titles[props.view] ?? titles.dashboard;
  return (
    <div className="runtime-page">
      <header className="runtime-header">
        <div>
          <div className="runtime-eyebrow">{meta.eyebrow} · {props.simulationId.slice(0, 8)}</div>
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
        </div>
        <div className="runtime-header-actions">
          {statusTag(props.status)}
          {connectionTag(props.connectionState)}
          {props.status === 'running'
            ? <Button icon={<PauseOutlined />} disabled={!props.canControl} loading={props.busy} onClick={props.onPause}>暂停</Button>
            : <Button type="primary" icon={<CaretRightOutlined />} disabled={!props.canControl} loading={props.busy} onClick={props.onStart}>开始</Button>}
          <Button icon={<ReloadOutlined />} disabled={!props.canControl} loading={props.busy} onClick={props.onStop}>停止并重置</Button>
        </div>
      </header>

      {props.connectionState !== 'connected' && (
        <Alert
          type="warning"
          showIcon
          message="实时数据暂时不可用"
          description="页面保留最后一次快照，连接恢复后会自动刷新运行、设备和事件数据。"
          action={<Button onClick={props.onReconnect}>立即重连</Button>}
        />
      )}

      {props.view === 'tasks' && <TasksView tasks={props.tasks} tick={props.tick} onReassign={props.onTaskReassign} canControl={props.canControl} />}
      {props.view === 'devices' && <DevicesView agvs={props.agvs} stations={props.stations} chargers={props.chargers} onCharge={props.onRobotCharge} canControl={props.canControl} />}
      {props.view === 'orders' && <OrdersView cargos={props.cargos} tick={props.tick} onCreate={props.onCreateOrder} canControl={props.canControl} />}
      {props.view === 'agents' && <AgentsView agents={props.agents} />}
      {props.view === 'alerts' && <AlertsView events={props.events} running={props.status === 'running' && props.canControl} onInject={props.onInject} />}
      {props.view === 'dashboard' && <DashboardView tick={props.tick} events={props.events} />}
      {props.view === 'settings' && (
        <SettingsView
          config={props.config}
          speed={props.speed}
          lastReceivedAt={props.lastReceivedAt}
          onSpeedChange={props.onSpeedChange}
        />
      )}
    </div>
  );
}

function TasksView({ tasks, tick, onReassign, canControl }: { tasks: Task[]; tick: SimulationTickRead | null; onReassign: (taskId: string) => void; canControl: boolean }) {
  const columns = [
    { title: '任务 ID', dataIndex: 'id', key: 'id', render: (value: string) => <b>{value}</b> },
    { title: '类型', dataIndex: 'type', key: 'type', render: (value: string) => <Tag>{value}</Tag> },
    { title: '优先级', dataIndex: 'priority', key: 'priority', render: (value: string) => <Tag color={value === 'high' ? 'red' : value === 'low' ? 'default' : 'blue'}>{value}</Tag> },
    { title: '设备', dataIndex: 'assignedAgvId', key: 'assignedAgvId', render: (value?: string) => value || '待分配' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (value: string) => <Tag color={value === 'completed' ? 'success' : value === 'failed' ? 'error' : value === 'running' ? 'processing' : 'default'}>{value}</Tag> },
    { title: '进度', dataIndex: 'progress', key: 'progress', width: 180, render: (value: number) => <Progress percent={Math.round(value * 100)} size="small" /> },
    { title: 'ETA', dataIndex: 'etaSeconds', key: 'etaSeconds', render: (value: number) => `${value.toFixed(1)}s` },
    ...editableRowColumns(TASK_ROW_FIELDS, 'simulation::tasks::row'),
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      render: (_: unknown, task: Task) => (
        <Button size="small" disabled={!canControl || task.status === 'completed'} onClick={() => onReassign(task.id)}>重新分配</Button>
      ),
    },
  ];
  return (
    <div className="runtime-stack">
      <EditableFieldList
        storageKey={TASKS_PAGE_FIELDS.storageKey}
        fields={TASKS_PAGE_FIELDS.fields}
        initial={TASKS_PAGE_FIELDS.initial}
        title={TASKS_PAGE_FIELDS.title}
        eyebrow={TASKS_PAGE_FIELDS.eyebrow}
        description={TASKS_PAGE_FIELDS.description}
      />
      <Card className="runtime-card" title="实时任务队列" extra={<Tag color="blue">完成 {tick?.tasks.completed ?? tasks.filter((task) => task.status === 'completed').length} / {tick?.tasks.total ?? tasks.length}</Tag>}>
        <Table rowKey="id" size="middle" dataSource={tasks} columns={columns} pagination={{ pageSize: 10, hideOnSinglePage: true }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="启动仿真后生成任务" /> }} />
      </Card>
    </div>
  );
}

function DevicesView({ agvs, stations, chargers, onCharge, canControl }: { agvs: AgvData[]; stations: StationData[]; chargers: ChargerData[]; onCharge: (robotId: string) => void; canControl: boolean }) {
  const agvColumns = [
    { title: '设备', dataIndex: 'name', key: 'name', render: (value: string, row: AgvData) => <b>{value || row.id}</b> },
    { title: '类型', dataIndex: 'type', key: 'type', render: (value?: string) => value === 'pallet_amr' ? '托盘 AMR' : '料箱 AMR' },
    { title: '状态', dataIndex: 'state', key: 'state', render: (value: string) => <Tag color={value === 'fault' || value === 'blocked' ? 'error' : value === 'idle' ? 'default' : 'processing'}>{value}</Tag> },
    { title: '电量', dataIndex: 'battery', key: 'battery', width: 180, render: (value: number) => <Progress percent={Math.round(value)} size="small" status={value <= 15 ? 'exception' : 'normal'} /> },
    { title: '载荷', dataIndex: 'loadStatus', key: 'loadStatus', render: (value: string) => value === 'loaded' ? '已载货' : '空载' },
    { title: '当前任务', dataIndex: 'taskId', key: 'taskId', render: (value?: string) => value || '—' },
    { title: '完成任务', dataIndex: 'completedTasks', key: 'completedTasks' },
    ...editableRowColumns(AGV_ROW_FIELDS, 'simulation::devices::row'),
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      render: (_: unknown, row: AgvData) => (
        <Button size="small" disabled={!canControl || Boolean(row.taskId)} onClick={() => onCharge(row.id)}>充电</Button>
      ),
    },
  ];
  return (
    <div className="runtime-stack">
      <EditableFieldList
        storageKey={DEVICES_PAGE_FIELDS.storageKey}
        fields={DEVICES_PAGE_FIELDS.fields}
        initial={DEVICES_PAGE_FIELDS.initial}
        title={DEVICES_PAGE_FIELDS.title}
        eyebrow={DEVICES_PAGE_FIELDS.eyebrow}
        description={DEVICES_PAGE_FIELDS.description}
      />
      <Card className="runtime-card" title="AGV 车队" extra={<Tag color="blue">{agvs.length} 台</Tag>}>
        <Table rowKey="id" size="middle" dataSource={agvs} columns={agvColumns} pagination={{ pageSize: 10, hideOnSinglePage: true }} />
      </Card>
      <div className="runtime-two-column">
        <Card className="runtime-card" title="工作站">
          {stations.map((station) => <div className="runtime-list-row" key={station.id}><div><b>{station.name}</b><small>队列 {station.queueLength} · 已处理 {station.totalProcessed}</small></div><Tag color={station.state === 'blocked' ? 'error' : station.state === 'working' ? 'success' : 'default'}>{station.state}</Tag></div>)}
        </Card>
        <Card className="runtime-card" title="充电桩">
          {chargers.map((charger) => <div className="runtime-list-row" key={charger.id}><div><b>{charger.name}</b><small>等待队列 {charger.queue.length}</small></div><Tag color={charger.occupiedBy ? 'warning' : 'success'}>{charger.occupiedBy || '空闲'}</Tag></div>)}
        </Card>
      </div>
    </div>
  );
}

function OrdersView({ cargos, tick, onCreate, canControl }: { cargos: CargoRow[]; tick: SimulationTickRead | null; onCreate: (kind: 'inbound' | 'outbound') => void; canControl: boolean }) {
  const columns = [
    { title: '订单/货物', key: 'order', render: (_: unknown, row: CargoRow) => <div><b>{row.orderId || '即时订单'}</b><small className="runtime-cell-sub">{row.id}</small></div> },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: '包装', dataIndex: 'type', key: 'type', render: (value: string) => <Tag>{value}</Tag> },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '重量', dataIndex: 'weight', key: 'weight', render: (value: number) => `${value} kg` },
    { title: '状态', dataIndex: 'status', key: 'status', render: (value: string) => <Tag color={value === 'shipped' ? 'success' : value === 'on_agv' ? 'processing' : 'default'}>{value}</Tag> },
    { title: '当前位置', dataIndex: 'locationId', key: 'locationId' },
    ...editableRowColumns(ORDER_ROW_FIELDS, 'simulation::orders::row'),
  ];
  return (
    <div className="runtime-stack">
      <EditableFieldList
        storageKey={ORDERS_PAGE_FIELDS.storageKey}
        fields={ORDERS_PAGE_FIELDS.fields}
        initial={ORDERS_PAGE_FIELDS.initial}
        title={ORDERS_PAGE_FIELDS.title}
        eyebrow={ORDERS_PAGE_FIELDS.eyebrow}
        description={ORDERS_PAGE_FIELDS.description}
      />
      <Card className="runtime-card" title="订单与货物追踪" extra={<span><Button size="small" disabled={!canControl} onClick={() => onCreate('inbound')}>新增入库</Button><Button size="small" style={{ marginLeft: 8 }} disabled={!canControl} onClick={() => onCreate('outbound')}>新增出库</Button><Tag color="green" style={{ marginLeft: 8 }}>已完成 {tick?.tasks.completed ?? cargos.filter((cargo) => cargo.status === 'shipped').length}</Tag></span>}>
        <Table rowKey="id" size="middle" dataSource={cargos} columns={columns} pagination={{ pageSize: 10, hideOnSinglePage: true }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="运行后将显示真实货物流转" /> }} />
      </Card>
    </div>
  );
}

function AgentsView({ agents }: { agents: Agent[] }) {
  if (!agents.length) {
    return (
      <div className="runtime-stack">
        <EditableFieldList
          storageKey={AGENTS_PAGE_FIELDS.storageKey}
          fields={AGENTS_PAGE_FIELDS.fields}
          initial={AGENTS_PAGE_FIELDS.initial}
          title={AGENTS_PAGE_FIELDS.title}
          eyebrow={AGENTS_PAGE_FIELDS.eyebrow}
          description={AGENTS_PAGE_FIELDS.description}
        />
        <Card className="runtime-card"><Empty description="暂无智能体数据" /></Card>
      </div>
    );
  }
  return (
    <div className="runtime-stack">
      <EditableFieldList
        storageKey={AGENTS_PAGE_FIELDS.storageKey}
        fields={AGENTS_PAGE_FIELDS.fields}
        initial={AGENTS_PAGE_FIELDS.initial}
        title={AGENTS_PAGE_FIELDS.title}
        eyebrow={AGENTS_PAGE_FIELDS.eyebrow}
        description={AGENTS_PAGE_FIELDS.description}
      />
      <div className="runtime-agent-grid">
        {agents.map((agent) => (
          <Card key={agent.id} className="runtime-agent-card">
            <div className="agent-title">
              <div><span className={`agent-state ${agent.status}`} /><b>{agent.name}</b></div>
              <Tag color={agent.status === 'running' ? 'success' : agent.status === 'fault' ? 'error' : 'default'}>{agent.status}</Tag>
            </div>
            <Progress percent={agent.load} strokeColor="#2563eb" />
            <div className="agent-metrics">
              <span>成功率 <b>{agent.successRate}%</b></span>
              <span>延迟 <b>{agent.latency}ms</b></span>
            </div>
            {agent.details.map((item) => (
              <div className="runtime-list-row compact" key={item.label}>
                <span>{item.label}</span>
                <b>{item.value}{item.unit}</b>
              </div>
            ))}
            <div className="runtime-agent-footer">
              <div className="agent-edit-row"><span>别名</span><InlineEditable storageKey="simulation::agents::row" rowId={agent.id} fieldKey="alias" type="text" placeholder="如：排程主脑" label="智能体别名" /></div>
              <div className="agent-edit-row"><span>角色</span><InlineEditable storageKey="simulation::agents::row" rowId={agent.id} fieldKey="custom_role" type="text" placeholder="如：异常兜底" label="业务角色" /></div>
              <div className="agent-edit-row"><span>备注</span><InlineEditable storageKey="simulation::agents::row" rowId={agent.id} fieldKey="note" type="text" placeholder="备注" label="备注" /></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AlertsView({ events, running, onInject }: { events: SimulationEvent[]; running: boolean; onInject: () => void }) {
  const alerts = events.filter((event) => event.level === 'warn' || event.level === 'error');
  return (
    <div className="runtime-stack">
      <EditableFieldList
        storageKey={ALERTS_PAGE_FIELDS.storageKey}
        fields={ALERTS_PAGE_FIELDS.fields}
        initial={ALERTS_PAGE_FIELDS.initial}
        title={ALERTS_PAGE_FIELDS.title}
        eyebrow={ALERTS_PAGE_FIELDS.eyebrow}
        description={ALERTS_PAGE_FIELDS.description}
      />
      <Card className="runtime-card" title="异常与告警记录" extra={<Button danger icon={<AlertOutlined />} disabled={!running} onClick={onInject}>注入异常</Button>}>
        {alerts.length ? alerts.map((event) => (
          <div className="alert-record" key={event.id}>
            <span className={`alert-severity ${event.level}`} />
            <time>{event.time}</time>
            <div><b>{event.source || (event.level === 'error' ? '错误' : '告警')}</b><p>{event.message}</p></div>
            <div className="runtime-alert-actions">
              <Tag color={event.level === 'error' ? 'error' : 'warning'}>{event.level}</Tag>
              <InlineEditable storageKey="simulation::alerts::row" rowId={event.id} fieldKey="severity_override" type="select" options={ALERT_ROW_FIELDS.fields[0].options} label="严重度调整" />
              <InlineEditable storageKey="simulation::alerts::row" rowId={event.id} fieldKey="ack_note" type="text" placeholder="确认/处理备注" label="确认处理备注" />
            </div>
          </div>
        )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前运行没有告警" />}
      </Card>
    </div>
  );
}

function DashboardView({ tick, events }: { tick: SimulationTickRead | null; events: SimulationEvent[] }) {
  // 数据看板定位为「诊断 / 拆解」视角，与数字孪生驾驶舱（实时 KPI + 3D）区分：
  // 这里呈现任务生命周期分布、效率阈值诊断、单设备效能排行与异常聚焦，
  // 而非简单复制驾驶舱的汇总指标。
  const metrics = tick?.metrics ?? {};
  const robots = (tick?.robots ?? []) as SimulationRobotTickRead[];
  // 后端 tick 的 tasks 是聚合对象 { total, completed }，逐条明细在 task_items 数组里
  const taskItems = (tick?.task_items ?? []) as SimulationTaskTickRead[];
  const taskAgg = (tick?.tasks ?? {}) as { completed?: number; total?: number; running?: number; pending?: number };
  const totalTasks = (taskAgg.total ?? taskItems.length) || 1;
  const completedTasks = taskAgg.completed ?? taskItems.filter((t) => t.status === 'completed').length;
  const runningTasks = taskItems.filter((t) => t.status === 'active').length;
  const pendingTasks = taskItems.filter((t) => t.status === 'pending').length;
  const completionRate = Number(metrics.completion_rate ?? completedTasks / totalTasks);
  const avgWait = Number(metrics.average_wait_seconds ?? 0);
  const avgDuration = Number(metrics.average_duration ?? 0);
  const utilization = Number(metrics.device_utilization ?? 0);
  const congestion = Number(metrics.congestion_count ?? 0);
  const energy = Number(metrics.energy ?? 0);
  const hasRuntime = Number(metrics.has_runtime ?? 0) > 0;

  // 单设备效能排行：按已完成任务数排序，以 wait_ticks 作为排队诊断维度
  const robotRank = [...robots]
    .map((r) => ({ id: r.id, name: r.name ?? r.id, battery: r.battery, completed: r.completed_tasks ?? 0, wait: r.wait_ticks ?? 0, state: r.state }))
    .sort((a, b) => b.completed - a.completed);
  const maxCompleted = Math.max(1, ...robotRank.map((r) => r.completed));
  const alerts = events.filter((e) => e.level === 'warn' || e.level === 'error');

  const completionColor = completionRate >= 0.8 ? '#22c55e' : completionRate >= 0.5 ? '#f59e0b' : '#ef4444';
  const waitColor = avgWait <= 3 ? '#22c55e' : avgWait <= 8 ? '#f59e0b' : '#ef4444';

  return (
    <div className="runtime-stack">
      <EditableFieldList
        storageKey={DASHBOARD_PAGE_FIELDS.storageKey}
        fields={DASHBOARD_PAGE_FIELDS.fields}
        initial={DASHBOARD_PAGE_FIELDS.initial}
        title={DASHBOARD_PAGE_FIELDS.title}
        eyebrow={DASHBOARD_PAGE_FIELDS.eyebrow}
        description={DASHBOARD_PAGE_FIELDS.description}
      />
      <div className="runtime-dashboard">
        <Card className="runtime-card dash-card" title="任务生命周期分布">
        <div className="dash-dist">
          <div className="dash-dist-bar">
            <span className="seg seg-done" style={{ width: `${(completedTasks / totalTasks) * 100}%` }} />
            <span className="seg seg-run" style={{ width: `${(runningTasks / totalTasks) * 100}%` }} />
            <span className="seg seg-pending" style={{ width: `${(pendingTasks / totalTasks) * 100}%` }} />
          </div>
          <div className="dash-dist-legend">
            <span><i className="dot done" />已完成 {completedTasks}</span>
            <span><i className="dot run" />进行中 {runningTasks}</span>
            <span><i className="dot pending" />待处理 {pendingTasks}</span>
          </div>
          <div className="dash-hint">共 {taskItems.length} 个任务 · 完成率 {hasRuntime ? `${(completionRate * 100).toFixed(0)}%` : '—'}</div>
        </div>
      </Card>

      <Card className="runtime-card dash-card" title="运行效率诊断">
        <div className="dash-metrics">
          <div className="dash-metric"><span className="dash-metric-label">完成率</span><b className="dash-metric-value" style={{ color: completionColor }}>{hasRuntime ? `${(completionRate * 100).toFixed(1)}%` : '—'}</b></div>
          <div className="dash-metric"><span className="dash-metric-label">平均等待</span><b className="dash-metric-value" style={{ color: waitColor }}>{avgWait.toFixed(1)}s</b></div>
          <div className="dash-metric"><span className="dash-metric-label">平均处理</span><b className="dash-metric-value">{avgDuration.toFixed(1)}s</b></div>
          <div className="dash-metric"><span className="dash-metric-label">设备利用率</span><b className="dash-metric-value">{hasRuntime ? `${(utilization * 100).toFixed(0)}%` : '—'}</b></div>
        </div>
        <div className="dash-hint">累计能耗 {energy.toFixed(2)} kWh · 拥堵 {congestion} 次</div>
      </Card>

      <Card className="runtime-card dash-card" title="设备效能排行" extra={<Tag color="blue">按已完成排序</Tag>}>
        <div className="dash-robot-list">
          {robotRank.length ? robotRank.map((r) => (
            <div className="dash-robot-row" key={r.id}>
              <span className="dash-robot-name">{r.name.toUpperCase()}</span>
              <div className="dash-robot-bar"><span style={{ width: `${(r.completed / maxCompleted) * 100}%` }} /></div>
              <span className="dash-robot-val">{r.completed} 单</span>
              <span className={`dash-robot-wait ${r.wait > 5 ? 'high' : ''}`}>排队 {r.wait}</span>
              <div className="dash-robot-battery"><span style={{ width: `${r.battery}%` }} /></div>
            </div>
          )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无设备数据" />}
        </div>
      </Card>

      <Card className="runtime-card dash-card" title="异常与拥堵" extra={<Tag color={congestion > 0 ? 'warning' : 'success'}>拥堵 {congestion}</Tag>}>
        {alerts.length ? alerts.slice(0, 8).map((e) => (
          <div className="alert-record" key={e.id}><span className={`alert-severity ${e.level}`} /><time>{e.time}</time><div><b>{e.source || (e.level === 'error' ? '错误' : '告警')}</b><p>{e.message}</p></div><Tag color={e.level === 'error' ? 'error' : 'warning'}>{e.level}</Tag></div>
        )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前运行无异常" />}
      </Card>
      </div>
    </div>
  );
}

function SettingsView({ config, speed, lastReceivedAt, onSpeedChange }: { config: Record<string, unknown>; speed: number; lastReceivedAt: string | null; onSpeedChange: (value: number) => void }) {
  return (
    <div className="runtime-stack">
      <EditableFieldList
        storageKey={SETTINGS_PAGE_FIELDS.storageKey}
        fields={SETTINGS_PAGE_FIELDS.fields}
        initial={SETTINGS_PAGE_FIELDS.initial}
        title={SETTINGS_PAGE_FIELDS.title}
        eyebrow={SETTINGS_PAGE_FIELDS.eyebrow}
        description={SETTINGS_PAGE_FIELDS.description}
      />
      <div className="runtime-two-column settings-grid">
        <Card className="runtime-card" title="运行参数">
          <div className="settings-value"><span>AGV 数量</span><b>{Number(config.robot_count ?? 0)}</b></div>
          <div className="settings-value"><span>订单数量</span><b>{Number(config.order_count ?? 0)}</b></div>
          <div className="settings-value"><span>随机种子</span><b>{Number(config.random_seed ?? 2026)}</b></div>
          <div className="settings-value"><span>运行标识</span><b>由后端分配</b></div>
          <Alert type="info" showIcon message="运行规模在创建仿真时冻结；若需修改，请返回编辑器创建新的仿真运行。" />
        </Card>
        <Card className="runtime-card" title="显示与播放">
          <label className="runtime-setting-field"><span>本地动画速度</span><Select value={speed} onChange={onSpeedChange} options={[0.5, 1, 2, 4].map((value) => ({ value, label: `${value.toFixed(1)}x` }))} /></label>
          <div className="settings-value"><span>最后实时数据</span><b>{lastReceivedAt ? new Date(lastReceivedAt).toLocaleString() : '等待连接'}</b></div>
          <div className="settings-value"><span>数据原则</span><b>后端状态优先</b></div>
        </Card>
      </div>
    </div>
  );
}
