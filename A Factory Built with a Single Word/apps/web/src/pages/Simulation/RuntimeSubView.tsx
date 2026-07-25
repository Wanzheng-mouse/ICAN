import {
  AlertOutlined,
  CaretRightOutlined,
  PauseOutlined,
  ReloadOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Empty, Progress, Select, Statistic, Table, Tag } from 'antd';
import type { Agent, SimulationEvent } from '@ican/contracts';
import type { SimulationTickRead } from '@/api/dtos/backend';
import type { SimulationConnectionState } from '@/hooks/useSimulationStream';
import type { AgvData, ChargerData, StationData, Task } from '@/components/SimView3D/types';
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
      {props.view === 'dashboard' && <DashboardView tick={props.tick} agvs={props.agvs} events={props.events} />}
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
    { title: '操作', key: 'action', render: (_: unknown, task: Task) => <Button size="small" disabled={!canControl || task.status === 'completed'} onClick={() => onReassign(task.id)}>重新分配</Button> },
  ];
  return (
    <Card className="runtime-card" title="实时任务队列" extra={<Tag color="blue">完成 {tick?.tasks.completed ?? tasks.filter((task) => task.status === 'completed').length} / {tick?.tasks.total ?? tasks.length}</Tag>}>
      <Table rowKey="id" size="middle" dataSource={tasks} columns={columns} pagination={{ pageSize: 10, hideOnSinglePage: true }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="启动仿真后生成任务" /> }} />
    </Card>
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
    { title: '操作', key: 'action', render: (_: unknown, row: AgvData) => <Button size="small" disabled={!canControl || Boolean(row.taskId)} onClick={() => onCharge(row.id)}>充电</Button> },
  ];
  return (
    <div className="runtime-stack">
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
  ];
  return (
    <Card className="runtime-card" title="订单与货物追踪" extra={<span><Button size="small" disabled={!canControl} onClick={() => onCreate('inbound')}>新增入库</Button><Button size="small" style={{ marginLeft: 8 }} disabled={!canControl} onClick={() => onCreate('outbound')}>新增出库</Button><Tag color="green" style={{ marginLeft: 8 }}>已完成 {tick?.tasks.completed ?? cargos.filter((cargo) => cargo.status === 'shipped').length}</Tag></span>}>
      <Table rowKey="id" size="middle" dataSource={cargos} columns={columns} pagination={{ pageSize: 10, hideOnSinglePage: true }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="运行后将显示真实货物流转" /> }} />
    </Card>
  );
}

function AgentsView({ agents }: { agents: Agent[] }) {
  if (!agents.length) return <Card className="runtime-card"><Empty description="暂无智能体数据" /></Card>;
  return <div className="runtime-agent-grid">{agents.map((agent) => <Card key={agent.id} className="runtime-agent-card"><div className="agent-title"><div><span className={`agent-state ${agent.status}`} /><b>{agent.name}</b></div><Tag color={agent.status === 'running' ? 'success' : agent.status === 'fault' ? 'error' : 'default'}>{agent.status}</Tag></div><Progress percent={agent.load} strokeColor="#2563eb" /><div className="agent-metrics"><span>成功率 <b>{agent.successRate}%</b></span><span>延迟 <b>{agent.latency}ms</b></span></div>{agent.details.map((item) => <div className="runtime-list-row compact" key={item.label}><span>{item.label}</span><b>{item.value}{item.unit}</b></div>)}</Card>)}</div>;
}

function AlertsView({ events, running, onInject }: { events: SimulationEvent[]; running: boolean; onInject: () => void }) {
  const alerts = events.filter((event) => event.level === 'warn' || event.level === 'error');
  return (
    <Card className="runtime-card" title="异常与告警记录" extra={<Button danger icon={<AlertOutlined />} disabled={!running} onClick={onInject}>注入异常</Button>}>
      {alerts.length ? alerts.map((event) => <div className="alert-record" key={event.id}><span className={`alert-severity ${event.level}`} /><time>{event.time}</time><div><b>{event.source || (event.level === 'error' ? '错误' : '告警')}</b><p>{event.message}</p></div><Tag color={event.level === 'error' ? 'error' : 'warning'}>{event.level}</Tag></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前运行没有告警" />}
    </Card>
  );
}

function DashboardView({ tick, agvs, events }: { tick: SimulationTickRead | null; agvs: AgvData[]; events: SimulationEvent[] }) {
  const active = agvs.filter((agv) => agv.state !== 'idle' && agv.state !== 'fault').length;
  const values = [
    { title: '任务完成率', value: (tick?.metrics.completion_rate ?? 0) * 100, suffix: '%' },
    { title: '平均处理时长', value: tick?.metrics.average_duration ?? 0, suffix: 's' },
    { title: '设备利用率', value: agvs.length ? active / agvs.length * 100 : 0, suffix: '%' },
    { title: '累计能耗', value: tick?.metrics.energy ?? 0, suffix: 'kWh' },
    { title: '拥堵次数', value: tick?.metrics.congestion_count ?? 0, suffix: '次' },
    { title: '异常事件', value: events.filter((event) => event.level === 'warn' || event.level === 'error').length, suffix: '条' },
  ];
  return <div className="runtime-dashboard">{values.map((item) => <Card key={item.title} className="runtime-metric-card"><Statistic title={item.title} value={Number(item.value.toFixed(1))} suffix={item.suffix} /><Progress percent={item.suffix === '%' ? Math.min(100, Math.round(item.value)) : Math.min(100, Math.round(item.value))} showInfo={false} strokeColor="#2563eb" /></Card>)}</div>;
}

function SettingsView({ config, speed, lastReceivedAt, onSpeedChange }: { config: Record<string, unknown>; speed: number; lastReceivedAt: string | null; onSpeedChange: (value: number) => void }) {
  return (
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
  );
}
