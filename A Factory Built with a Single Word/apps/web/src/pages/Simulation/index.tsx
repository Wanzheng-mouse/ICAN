import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertOutlined, CaretRightOutlined, PauseOutlined, ReloadOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, App, Button, Empty, Modal, Select, Skeleton, Space, Tag } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KpiCard, SectionCard } from '@/components';
import { formatSimTime } from '@/utils/simTime';
import {
  useControlSimulation, useInjectAnomaly, useSimulationAgents, useSimulationEvents,
  useSimulationSnapshot, useSimulationStream,
} from '@/api/modules';
import type { SimulationEventRead, SimulationRead } from '@/api/dtos/backend';
import { useAppStore } from '@/stores/useAppStore';
import './index.css';

const anomalyOptions: Array<{ value: 'road_closed' | 'low_battery' | 'order_surge' | 'station_down'; label: string }> = [
  { value: 'road_closed', label: '道路封闭' },
  { value: 'low_battery', label: '低电量' },
  { value: 'order_surge', label: '订单激增' },
  { value: 'station_down', label: '站点故障' },
];

const tagColor: Record<string, string> = { running: 'success', paused: 'warning', stopped: 'default', finished: 'blue', created: 'default' };
const statusText: Record<string, string> = { running: '运行中', paused: '已暂停', stopped: '已停止', finished: '已完成', created: '待启动' };

function statusEventIcon(level: string) {
  return level === 'warn' ? <WarningOutlined style={{ color: '#f59e0b' }} /> : level === 'success' ? <span className="event-dot success" /> : <span className="event-dot info" />;
}

export default function Simulation() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const storedSimulationId = useAppStore((state) => state.currentSimulationId);
  const storedProjectId = useAppStore((state) => state.currentProjectId);
  const storedScenarioId = useAppStore((state) => state.currentScenarioId);
  const setProjectContext = useAppStore((state) => state.setProjectContext);
  const simulationId = searchParams.get('simulationId') ?? storedSimulationId ?? undefined;
  const projectId = searchParams.get('projectId') ?? storedProjectId ?? undefined;
  const scenarioId = searchParams.get('scenarioId') ?? storedScenarioId ?? undefined;
  const [live, setLive] = useState<SimulationRead | null>(null);
  const [showAnomaly, setShowAnomaly] = useState(false);
  const [anomaly, setAnomaly] = useState<'road_closed' | 'low_battery' | 'order_surge' | 'station_down'>('road_closed');

  const snapshot = useSimulationSnapshot(simulationId);
  const agents = useSimulationAgents(simulationId);
  const history = useSimulationEvents(simulationId);
  const control = useControlSimulation(simulationId);
  const inject = useInjectAnomaly(simulationId);

  useEffect(() => {
    if (snapshot.data) setLive(snapshot.data);
  }, [snapshot.data]);
  useEffect(() => {
    if (simulationId) setProjectContext({ projectId, scenarioId, simulationId });
  }, [projectId, scenarioId, simulationId, setProjectContext]);

  const streamHandlers = useMemo(() => ({
    onTick: (tick: { time: number; robots: SimulationRead['robots']; tasks: SimulationRead['tasks']; events: SimulationEventRead[]; metrics: Record<string, number> }) => {
      setLive((previous) => previous ? { ...previous, sim_time: tick.time, robots: tick.robots, tasks: tick.tasks, events: tick.events, metrics: tick.metrics } : previous);
    },
    onEvent: (event: SimulationEventRead) => {
      setLive((previous) => previous ? { ...previous, events: [...previous.events.filter((item) => item.id !== event.id), event].slice(-100) } : previous);
    },
    onCompleted: () => {
      setLive((previous) => previous ? { ...previous, status: 'finished' } : previous);
      message.success('仿真已完成');
    },
  }), [message]);
  const connection = useSimulationStream(simulationId, streamHandlers);
  const run = live ?? snapshot.data;
  const events = run?.events.length ? [...run.events].reverse() : (history.data ?? []).slice().reverse();

  const kpis = useMemo(() => {
    if (!run) return [];
    const metrics = run.metrics;
    return [
      { title: 'AGV 在线数', value: `${run.robots.filter((robot) => robot.state !== 'idle').length} / ${run.robots.length}`, iconColor: '#3b82f6' },
      { title: '任务完成率', value: Number((metrics.completion_rate * 100).toFixed(1)), unit: '%', iconColor: '#22c55e' },
      { title: '平均任务时长', value: metrics.average_duration.toFixed(1), unit: 'tick', iconColor: '#06b6d4' },
      { title: '拥堵次数', value: metrics.congestion_count, unit: '次', iconColor: '#ef4444' },
      { title: '累计能耗', value: metrics.energy.toFixed(2), unit: 'kWh', iconColor: '#a855f7' },
      { title: '充电调度', value: metrics.charging_count, unit: '次', iconColor: '#f59e0b' },
    ];
  }, [run]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !run) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      const width = rect.width; const height = rect.height;
      context.fillStyle = '#f1f5f9'; context.fillRect(0, 0, width, height);
      context.strokeStyle = 'rgba(11,23,51,.08)'; context.lineWidth = 1;
      for (let x = 0; x < width; x += 24) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y < height; y += 24) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
      context.strokeStyle = '#94a3b8'; context.lineWidth = 2; context.strokeRect(18, 18, width - 36, height - 36);
      run.robots.forEach((robot, index) => {
        const path = robot.path;
        if (path.length > 1) {
          context.strokeStyle = 'rgba(59,130,246,.35)'; context.setLineDash([5, 4]); context.beginPath();
          path.forEach((item, pathIndex) => { const x = item.x / 1200 * width; const y = item.y / 800 * height; if (pathIndex === 0) context.moveTo(x, y); else context.lineTo(x, y); });
          context.stroke(); context.setLineDash([]);
        }
        const x = robot.position.x / 1200 * width; const y = robot.position.y / 800 * height;
        const color = robot.state === 'charging' || robot.state === 'moving_to_charge' ? '#10b981' : robot.state === 'moving' ? '#06b6d4' : '#94a3b8';
        context.fillStyle = color; context.fillRect(x - 9, y - 7, 18, 14);
        context.strokeStyle = '#fff'; context.strokeRect(x - 9, y - 7, 18, 14);
        context.fillStyle = '#1f2937'; context.font = '11px sans-serif'; context.fillText(robot.id, x + 11, y - 6);
        context.fillStyle = robot.battery <= 20 ? '#ef4444' : '#22c55e'; context.fillText(`${Math.round(robot.battery)}%`, x + 11, y + 8);
        if (index === 0) { context.fillStyle = '#64748b'; context.fillText('实时 AGV 路径', 32, 40); }
      });
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [run]);

  if (!simulationId) {
    return <Empty description="缺少 simulationId，请先在场景编辑器创建仿真"><Button type="primary" onClick={() => navigate('/editor')}>返回编辑器</Button></Empty>;
  }
  if (snapshot.isLoading && !run) return <Skeleton active paragraph={{ rows: 12 }} />;
  if (snapshot.isError || !run) return <Alert type="error" showIcon message="无法加载仿真运行" description="请检查 simulationId 是否存在，或返回编辑器重新创建。" action={<Button onClick={() => navigate('/editor')}>返回编辑器</Button>} />;

  const runAction = (action: 'start' | 'pause' | 'stop') => control.mutate(action, { onSuccess: (result) => { setLive(result); message.success(statusText[result.status] ?? '操作成功'); }, onError: () => message.error('仿真控制失败') });
  const confirmAnomaly = () => inject.mutate(anomaly, { onSuccess: (result) => { setLive(result); setShowAnomaly(false); message.success('异常已注入并写入事件历史'); }, onError: () => message.error('异常注入失败，请先启动仿真') });

  return <div className="simulation-page">
    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Space><Tag color={tagColor[run.status]}>{statusText[run.status]}</Tag><Tag>{connection === 'connected' ? '实时流已连接' : connection === 'reconnecting' ? '正在重连' : connection}</Tag><span className="num-font">运行 ID：{simulationId}</span></Space>
      <span className="num-font">仿真时间 {formatSimTime(run.sim_time)}</span>
    </div>
    <div className="kpi-row">{kpis.map((item) => <KpiCard key={item.title} data={item} />)}</div>
    <div className="sim-grid">
      <div className="sim-main">
        <SectionCard title="仿真视图（实时）" bodyHeight={500} className="sim-canvas-card"><div className="canvas-area"><canvas ref={canvasRef} className="sim-canvas" /></div></SectionCard>
        <div className="sim-control-bar"><Space>
          {run.status === 'running' ? <Button type="primary" icon={<PauseOutlined />} loading={control.isPending} onClick={() => runAction('pause')}>暂停仿真</Button> : <Button type="primary" icon={<CaretRightOutlined />} loading={control.isPending} disabled={run.status === 'finished'} onClick={() => runAction('start')}>启动仿真</Button>}
          <Button icon={<ReloadOutlined />} loading={control.isPending} onClick={() => runAction('stop')}>停止并重置</Button>
          <Button danger icon={<AlertOutlined />} disabled={run.status !== 'running'} onClick={() => setShowAnomaly(true)}>注入异常</Button>
          <Button icon={<ThunderboltOutlined />} disabled={run.status !== 'finished'} onClick={() => message.info('仿真完成后可在方案进化页创建进化任务')}>运行进化</Button>
        </Space></div>
        <div className="sim-info-grid">
          <SectionCard title="实时任务日志" bodyHeight={230}><div className="event-list">{events.length ? events.map((event) => <div key={event.id} className="event-row"><span className="event-time num-font">{event.time}</span><span className="event-level">{statusEventIcon(event.level)}</span><span className="event-msg">{event.message}</span></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无事件" />}</div></SectionCard>
          <SectionCard title="运行信息" bodyHeight={230}><div className="info-table">
            <div className="info-row"><span className="info-label">项目 ID</span><span className="info-val">{run.project_id}</span></div>
            <div className="info-row"><span className="info-label">场景 ID</span><span className="info-val">{run.scenario_id}</span></div>
            <div className="info-row"><span className="info-label">AGV / 订单</span><span className="info-val">{run.config.robot_count} / {run.metrics.total_orders}</span></div>
            <div className="info-row"><span className="info-label">随机种子</span><span className="info-val">{run.config.random_seed}</span></div>
            <div className="info-row"><span className="info-label">引擎版本</span><span className="info-val">{run.config.engine_version ?? '—'}</span></div>
          </div></SectionCard>
        </div>
      </div>
      <div className="sim-aside"><SectionCard title="多智能体状态" bodyHeight={850}><div className="agent-list">{agents.isLoading ? <Skeleton active /> : (agents.data ?? []).map((agent) => <div key={agent.id} className="agent-card"><div className="agent-header"><span className="name-text">{agent.name}</span><Tag color={run.status === 'running' ? 'success' : 'default'}>{agent.status}</Tag></div><div className="agent-stats">{agent.details.map((detail) => <div key={String(detail.label)} className="agent-stat"><div className="stat-label">{String(detail.label)}</div><div className="stat-value num-font">{String(detail.value)} {detail.unit ? String(detail.unit) : ''}</div></div>)}</div></div>)}</div></SectionCard></div>
    </div>
    <Modal title="注入异常" open={showAnomaly} onCancel={() => setShowAnomaly(false)} onOk={confirmAnomaly} confirmLoading={inject.isPending} okText="确认注入">
      <Select value={anomaly} onChange={setAnomaly} style={{ width: '100%' }} options={anomalyOptions} />
      <Alert style={{ marginTop: 12 }} type="warning" showIcon message="异常会同步写入事件历史和实时指标" />
    </Modal>
  </div>;
}
