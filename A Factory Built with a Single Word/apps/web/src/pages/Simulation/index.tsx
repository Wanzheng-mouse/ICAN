/**
 * Simulation page — backend-snapshot-driven rendering.
 *
 * Production mode: all runtime data comes from WebSocket stream (useSimulationStream).
 * Production data flow: scenario snapshot drives 3D layout; WebSocket delivers
 * live ticks.  No local engine — the backend owns all simulation state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOutlined,
  CaretRightOutlined,
  FullscreenOutlined,
  PauseOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Card, Empty, Modal, Select, Skeleton, Space, Statistic, Tag } from 'antd';
import gsap from 'gsap';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ProjectContextBar, SimView3D } from '@/components';
import type { SimView3DProps, Agv3D } from '@/components/SimView3D';
import { formatSimTime, safeDeltaSeconds } from '@/utils/simTime';
import {
  createEvolution,
  chargeSimulationRobot,
  createSimulationOrder,
  reassignSimulationTask,
  useControlSimulation,
  useInjectAnomaly,
  useProjects,
  useProjectSimulations,
  useScenario,
  useSimulationAgents,
  useSimulationDetail,
} from '@/api/modules';
import { getApiErrorMessage } from '@/api/errorMessage';
import { useSimulationStream } from '@/hooks/useSimulationStream';
import { useAppStore } from '@/stores/useAppStore';
import type { SimulationEvent } from '@ican/contracts';
import type { AnomalyCreate } from '@/api/dtos/backend';
import { simulationKpiDescriptors } from '@/config/simulationConsole';
// Production path: no local engine dependency.
import type { AgvData, SimulationSnapshot, Task } from '@/components/SimView3D/types';
import { AGV_STATE_COLORS, AGV_PATH_STRATEGY_COLORS, AGV_PATH_STRATEGY_LABELS } from '@/components/SimView3D/types';
import type { WarehouseConfig } from '@/components/SimView3D/digitalTwin';
import { scenarioToWarehouseConfig } from '@/components/SimView3D/scenarioMapper';
import type { ScenarioSnapshotData } from '@/components/SimView3D/scenarioMapper';
import { RuntimeSubView } from './RuntimeSubView';
import { useCan } from '@/utils/roleGuard';
import './index.css';

type SimStatus = 'idle' | 'running' | 'paused' | 'injected';

const levelIcon: Record<string, React.ReactNode> = {
  warn: <WarningOutlined style={{ color: '#f59e0b' }} />,
  info: <i className="event-dot info" />,
  success: <i className="event-dot success" />,
  error: <i className="event-dot error" />,
};

const ANOMALY_TYPES = [
  { key: 'road_closed', label: '道路封锁', color: '#ef4444' },
  { key: 'low_battery', label: '低电量', color: '#f59e0b' },
  { key: 'order_surge', label: '订单激增', color: '#a855f7' },
  { key: 'station_down', label: '工位停机', color: '#3b82f6' },
];

// AGV 状态中文展示
const AGV_STATE_BADGES: Record<string, { label: string; cls: string }> = {
  idle:        { label: '待机',    cls: 'badge-gray' },
  to_pickup:   { label: '取货中',  cls: 'badge-blue' },
  loading:     { label: '装载中',  cls: 'badge-amber' },
  to_dropoff:  { label: '送货中',  cls: 'badge-cyan' },
  unloading:   { label: '卸货中',  cls: 'badge-amber' },
  returning:   { label: '返航中',  cls: 'badge-indigo' },
  charging:    { label: '充电中',  cls: 'badge-green' },
  fault:       { label: '故障',    cls: 'badge-red' },
};

// Convert warehouse zones to SimView3D zone format
function warehouseZonesTo3D(wc: WarehouseConfig): SimView3DProps['zones'] {
  return wc.zones.map((z) => ({
    x: z.bounds.x,
    y: z.bounds.y,
    w: z.bounds.w,
    h: z.bounds.h,
    color: z.color,
    label: z.name,
  }));
}

// Convert shelf zones to SimView3D shelf format
function warehouseShelfZonesTo3D(wc: WarehouseConfig): SimView3DProps['shelves'] {
  const shelves: SimView3DProps['shelves'] = [];
  for (const sz of wc.shelfZones) {
    const zone = wc.zones.find((item) => item.id === sz.zoneId);
    if (!zone) continue;
    const sidePadding = 18;
    const aisleGap = 14;
    const availableWidth = zone.bounds.w - sidePadding * 2 - aisleGap * (sz.aisles.length - 1);
    const aisleWidth = availableWidth / sz.aisles.length;
    sz.aisles.forEach((aisle, aisleIndex) => {
      shelves.push({
        id: aisle.aisleId,
        x: zone.bounds.x + sidePadding + aisleIndex * (aisleWidth + aisleGap),
        y: zone.bounds.y + 42,
        w: aisleWidth,
        h: zone.bounds.h - 84,
        color: sz.zoneId === 'ZONE-HBA' ? '#3b82f6' : '#10b981',
        levels: aisle.levels.length,
      });
    });
  }
  return shelves;
}

export default function Simulation() {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const { message } = App.useApp();
  const navigate = useNavigate();
  const canRun = useCan('run_simulation');
  const canEvolve = useCan('trigger_evolution');
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const storedProjectId = useAppStore((state) => state.currentProjectId);
  const storedScenarioId = useAppStore((state) => state.currentScenarioId);
  const storedSimulationId = useAppStore((state) => state.currentSimulationId);
  const setProjectContext = useAppStore((state) => state.setProjectContext);
  const setSimulationConnectionState = useAppStore((state) => state.setSimulationConnectionState);
  const projectId = searchParams.get('projectId') ?? storedProjectId;
  const scenarioId = searchParams.get('scenarioId') ?? storedScenarioId;
  const requestedSimulationId = searchParams.get('simulationId') ?? storedSimulationId;
  const [status, setStatus] = useState<SimStatus>('idle');
  const [speed, setSpeed] = useState(1);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [simTime, setSimTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedAgvId, setSelectedAgvId] = useState<string | null>(null);
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [showAnomalyModal, setShowAnomalyModal] = useState(false);
  const [pendingAnomaly, setPendingAnomaly] = useState<string>('road_closed');
  const simulationId = requestedSimulationId;
  const [evolving, setEvolving] = useState(false);

  // In production, the backend tick IS the source of truth. No local engine.
  // The backend owns all simulation state — no local engine is needed.
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);

  const controlMutation = useControlSimulation();
  const injectMutation = useInjectAnomaly();
  const projectSimsQuery = useProjectSimulations(!simulationId && projectId ? projectId : null);
  const detailQuery = useSimulationDetail(simulationId);

  // 自动加载已存在的仿真运行：当进入仿真空间时有项目但没有指定 simulationId，自动选择最后一次运行
  useEffect(() => {
    if (simulationId || !projectId) return;
    const sims = projectSimsQuery.data;
    if (!sims || sims.length === 0) return;
    const latest = sims[0];
    setProjectContext({ projectId, scenarioId: latest.scenario_id, simulationId: latest.id });
    navigate(`/simulation?projectId=${encodeURIComponent(projectId)}&scenarioId=${encodeURIComponent(latest.scenario_id)}&simulationId=${encodeURIComponent(latest.id)}`, { replace: true });
  }, [simulationId, projectId, projectSimsQuery.data, navigate, setProjectContext, scenarioId]);

  // Derive 3D warehouse layout from the scenario snapshot stored in the
  // simulation run config. When the editor saved a scene with real components,
  // the 3D view mirrors that exact layout. Empty scenes degrade to the fixed
  // factory with a fallback flag.
  const scenarioSnapshot = (detailQuery.data?.config as Record<string, unknown> | undefined)
    ?.scenario_snapshot as ScenarioSnapshotData | undefined;
  const scenarioResult = useMemo(
    () => scenarioToWarehouseConfig(scenarioSnapshot),
    [scenarioSnapshot],
  );
  const warehouseConfig = scenarioResult.config;
  const sceneFallback = scenarioResult.fallback;
  const sceneStats = scenarioResult.stats;
  const sceneComponents = scenarioSnapshot?.components ?? [];
  const usesSavedSceneLayout = !sceneFallback && sceneComponents.length > 0;

  const agentsQuery = useSimulationAgents(simulationId);
  const refreshRuntime = useCallback(() => {
    void Promise.all([detailQuery.refetch(), agentsQuery.refetch()]);
  }, [agentsQuery, detailQuery]);
  const stream = useSimulationStream(simulationId, Boolean(detailQuery.data), refreshRuntime);
  const backendTick = stream.tick;
  const backendConnected = stream.connectionState === 'connected';

  // 获取项目/场景真实名称用于 hero 头部展示
  const projectsQuery = useProjects();
  const scenarioQuery = useScenario(scenarioId ?? '');
  const currentProject = projectsQuery.data?.find((p) => p.id === projectId);
  const currentScenario = scenarioQuery.data;

  // Mirror the live connection state into the global zustand store so the
  // sidebar / mini overview can render it.  The previous implementation
  // returned a cleanup that hard-reset the state to 'idle' on every dep
  // change, which fired between `'connecting' → 'connected'` and left the
  // sidebar stuck on "建立连接中" forever.  Now we only sync forward, and
  // the page-level unmount path clears the store when leaving the route.
  const lastSyncedRef = useRef<typeof stream.connectionState>('idle');
  useEffect(() => {
    if (lastSyncedRef.current === stream.connectionState) return;
    lastSyncedRef.current = stream.connectionState;
    setSimulationConnectionState(stream.connectionState);
  }, [setSimulationConnectionState, stream.connectionState]);
  useEffect(() => {
    return () => {
      lastSyncedRef.current = 'idle';
      setSimulationConnectionState('idle');
    };
  }, [setSimulationConnectionState]);

  // Initialize local engine ONLY for mock/demo mode. In production, the
  // A real stream tick unlocks rendering immediately. Mutable runtime is no
  // longer embedded in SimulationRead.config, so WebSocket is the sole
  // production source of robot poses and live KPIs.
  useEffect(() => {
    if (!backendTick) return;
    setSimTime(backendTick.time);
    setSnapshot((previous) => ({
      currentTime: backendTick.time,
      agvs: previous?.agvs ?? [],
      stations: previous?.stations ?? [],
      chargers: previous?.chargers ?? [],
      zones: previous?.zones ?? [],
      buffers: previous?.buffers ?? [],
      arms: previous?.arms ?? [],
      tasks: previous?.tasks ?? [],
      congestion: previous?.congestion ?? [],
      metrics: {
        completedTasks: backendTick.tasks.completed,
        averageWaitSeconds: backendTick.metrics.average_queue_wait_seconds ?? backendTick.metrics.average_wait_seconds ?? 0,
        utilization: backendTick.robots.length
          ? backendTick.robots.filter((robot) => !['idle', 'charging', 'fault'].includes(robot.state)).length / backendTick.robots.length * 100
          : 0,
        congestionScore: backendTick.metrics.congestion_count,
        totalOrdersGenerated: backendTick.tasks.total,
        activeChargers: backendTick.robots.filter((robot) => robot.state === 'charging').length,
        faultCount: backendTick.robots.filter((robot) => robot.state === 'fault').length,
      },
      timeline: previous?.timeline ?? [],
      cargos: previous?.cargos ?? [],
    }));
  }, [backendTick]);

  useEffect(() => {
    if (!pageRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        '.kpi-card',
        { opacity: 0, y: 18, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.055, ease: 'power3.out' },
      );
      gsap.fromTo(
        '.sim-canvas-card',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.72, delay: 0.16, ease: 'power3.out' },
      );
    }, pageRef);
    return () => context.revert();
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  // Events are populated only from real backend data (REST history +
  // WebSocket stream).  No placeholder / synthetic event is shown here so the
  // "实时事件" panel always reflects genuine runtime activity.

  const addEvent = useCallback(
    (level: 'info' | 'warn' | 'success' | 'error', messageText: string) => {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setEvents((prev) =>
        [{ id: `e-${Date.now()}`, level, time, message: messageText }, ...prev].slice(0, 30),
      );
    },
    [],
  );

  useEffect(() => {
    const run = detailQuery.data;
    if (!run) return;
    const nextStatus: SimStatus = run.status === 'running'
      ? 'running'
      : run.status === 'paused'
        ? 'paused'
        : 'idle';
    setStatus(nextStatus);
    setProjectContext({
      projectId: run.project_id,
      scenarioId: run.scenario_id,
      simulationId: run.id,
    });
  }, [detailQuery.data, setProjectContext]);

  useEffect(() => {
    if (!backendTick?.events.length) return;
    setEvents((current) => {
      const received = backendTick.events.map((event, index) => ({
        id: `stream-${event.type}-${event.description}-${index}`,
        level: event.severity === 'error' ? 'error' as const : 'warn' as const,
        time: new Date(backendTick.generated_at ?? Date.now()).toLocaleTimeString('zh-CN', { hour12: false }),
        message: event.description || event.type,
        source: event.type,
      }));
      const merged = [...received, ...current];
      return merged.filter((event, index) =>
        merged.findIndex((candidate) => candidate.id === event.id) === index,
      ).slice(0, 50);
    });
  }, [backendTick]);

  useEffect(() => {
    if (stream.connectionState === 'connected') {
      addEvent('success', stream.reconnectCount ? '实时连接已恢复，数据同步正常' : '已建立实时状态连接');
    } else if (stream.connectionState === 'reconnecting') {
      addEvent('warn', '实时连接中断，正在自动重连');
    }
  }, [addEvent, stream.connectionState, stream.reconnectCount]);

  const handleStart = useCallback(async () => {
    if (!canRun) {
      message.warning('当前用户为只读角色，无法启动仿真');
      return;
    }
    if (status === 'running') {
      message.warning('仿真已经运行中');
      return;
    }
    if (!simulationId) {
      message.warning('缺少仿真 ID，请先从编辑器启动仿真');
      return;
    }
    try {
      await controlMutation.mutateAsync({ action: 'start', simulationId });
      setStatus('running');
      addEvent('success', '仿真开始运行');
      message.success('仿真开始运行');
    } catch (error) {
      message.error(getApiErrorMessage(error, '启动仿真失败'));
    }
  }, [status, addEvent, message, controlMutation, simulationId, canRun]);

  const handlePause = useCallback(async () => {
    if (!canRun) {
      message.warning('当前用户为只读角色，无法控制仿真');
      return;
    }
    if (status !== 'running') {
      message.warning('仿真未运行');
      return;
    }
    if (!simulationId) {
      message.warning('仿真服务未创建');
      return;
    }
    try {
      await controlMutation.mutateAsync({ action: 'pause', simulationId });
      setStatus('paused');
      addEvent('warn', '仿真已暂停');
      message.info('仿真已暂停');
    } catch (error) {
      message.error(getApiErrorMessage(error, '暂停仿真失败'));
    }
  }, [status, addEvent, message, controlMutation, simulationId, canRun]);

  const handleStop = useCallback(async () => {
    if (!canRun) {
      message.warning('当前用户为只读角色，无法停止仿真');
      return;
    }
    if (!simulationId) {
      message.warning('仿真服务未创建');
      return;
    }
    try {
      await controlMutation.mutateAsync({ action: 'stop', simulationId });
      setStatus('idle');
      setSimTime(0);
      // Refresh from backend after stop
      await detailQuery.refetch();
      addEvent('info', '仿真已停止并保存');
      message.info('仿真已停止');
    } catch (error) {
      message.error(getApiErrorMessage(error, '停止仿真失败'));
    }
  }, [addEvent, message, controlMutation, simulationId, canRun, detailQuery]);

  const handleAnomalyClick = useCallback(() => {
    if (!canRun) {
      message.warning('当前用户为只读角色，无法注入异常');
      return;
    }
    if (status !== 'running') {
      message.warning('仿真未运行');
      return;
    }
    setShowAnomalyModal(true);
  }, [status, message, canRun]);

  const handleConfirmAnomaly = useCallback(async () => {
    if (!canRun) {
      message.warning('当前用户为只读角色，无法注入异常');
      return;
    }
    if (!simulationId) {
      message.warning('仿真服务未创建');
      return;
    }
    const anomaly = ANOMALY_TYPES.find((a) => a.key === pendingAnomaly);
    if (!anomaly) return;

    try {
      await injectMutation.mutateAsync({
        type: pendingAnomaly as AnomalyCreate['type'],
        simulationId,
        description: anomaly.label,
      });
      addEvent('warn', `注入异常：${anomaly.label}`);
    } catch (error) {
      message.error(getApiErrorMessage(error, '异常注入失败'));
      return;
    }

    setStatus('injected');
    message.success(`异常已注入：${anomaly.label}`);
    setShowAnomalyModal(false);
    setTimeout(() => setStatus('running'), 1500);
  }, [pendingAnomaly, addEvent, message, injectMutation, simulationId, canRun]);

  const handleEvolution = useCallback(async () => {
    if (!canEvolve) {
      message.warning('当前用户为只读角色，无法执行进化优化');
      return;
    }
    if (!simulationId) {
      message.warning('请先运行一次仿真后再进化');
      return;
    }
    setEvolving(true);
    try {
      const evolution = await createEvolution({ simulation_id: simulationId });
      setProjectContext({ simulationId, evolutionId: evolution.id });
      message.success('进化分析已启动');
      navigate(`/evolution?evolutionId=${evolution.id}`);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '进化分析失败');
    } finally {
      setEvolving(false);
    }
  }, [simulationId, setProjectContext, message, navigate, canEvolve]);

  const handleTaskReassign = useCallback(async (taskId: string) => {
    if (!simulationId) return;
    try {
      await reassignSimulationTask(simulationId, taskId);
      message.success('任务已重新分配给更合适的调度器');
      refreshRuntime();
    } catch (error) {
      message.error(getApiErrorMessage(error, '任务重新分配失败'));
    }
  }, [message, refreshRuntime, simulationId]);

  const handleRobotCharge = useCallback(async (robotId: string) => {
    if (!simulationId) return;
    try {
      await chargeSimulationRobot(simulationId, robotId);
      message.success('已标记 AGV 前往充电桩');
      refreshRuntime();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'AGV 充电指令发送失败'));
    }
  }, [message, refreshRuntime, simulationId]);

  const handleCreateOrder = useCallback(async (kind: 'inbound' | 'outbound') => {
    if (!simulationId) return;
    try {
      await createSimulationOrder(simulationId, kind);
      message.success(kind === 'inbound' ? '已创建入库订单' : '已创建出库订单');
      refreshRuntime();
    } catch (error) {
      message.error(getApiErrorMessage(error, '创建订单失败'));
    }
  }, [message, refreshRuntime, simulationId]);

  // Simulation loop: in production, backend WebSocket drives updates.
  // Production: backend tick is authoritative, just update simTime.
  useEffect(() => {
    if (status !== 'running' || !backendConnected) return;
    if (backendTick) setSimTime(backendTick.time);
  }, [backendConnected, backendTick?.time, speed, status]);

  const displayAgvs = useMemo<AgvData[]>(() => {
    if (!snapshot) return [];
    const savedAgvs = usesSavedSceneLayout
      ? sceneComponents.filter((component) => component.type === 'agv')
      : [];

    // Production mode: use backendTick robots as primary data source
    if (backendTick?.robots.length) {
      return backendTick.robots.map((robot, index) => {
        const saved = savedAgvs[index];
        const hasPosition = typeof robot.x === 'number' && typeof robot.y === 'number';
        const state = robot.state === 'idle'
          ? 'idle' as const
          : robot.state === 'fault'
            ? 'fault' as const
            : robot.state === 'charging'
              ? 'charging' as const
              : robot.state === 'to_pickup'
                ? 'to_pickup' as const
                : robot.state === 'to_dropoff'
                  ? 'to_dropoff' as const
              : 'idle' as const;
        return {
          id: robot.id,
          name: robot.id.toUpperCase(),
          battery: robot.battery,
          state,
          position: hasPosition
            ? { x: robot.x!, y: robot.y! }
            : saved
              ? { x: saved.x + saved.width / 2, y: saved.y + saved.height / 2 }
              : { x: 0, y: 0 },
          route: robot.route?.map((point) => [point.x, point.y] as [number, number]) ?? [],
          loadStatus: robot.load_status ?? 'empty',
          taskId: robot.task_id ?? undefined,
          remainingSeconds: 0,
          speed: 1.2,
          isBlocked: false,
          completedTasks: 0,
          totalDistance: 0,
          type: String(saved?.properties.agv_type ?? 'tote_amr') as 'tote_amr' | 'pallet_amr',
        };
      });
    }

    // Fallback: use local snapshot (mock mode or no backend data)
    return snapshot.agvs.map((agv, index) => {
      const backendRobot = backendTick?.robots[index];
      const saved = savedAgvs[index];
      if (!backendRobot) {
        return saved
          ? {
              ...agv,
              position: { x: saved.x + saved.width / 2, y: saved.y + saved.height / 2 },
              type: String(saved.properties.agv_type ?? 'tote_amr') as 'tote_amr' | 'pallet_amr',
            }
          : agv;
      }
      return {
        ...agv,
        position: saved
          ? { x: saved.x + saved.width / 2, y: saved.y + saved.height / 2 }
          : agv.position,
        type: String(saved?.properties.agv_type ?? (agv as { type?: string }).type ?? 'tote_amr') as 'tote_amr' | 'pallet_amr',
        battery: backendRobot.battery,
        state: backendRobot.state === 'idle'
          ? 'idle' as const
          : agv.state === 'idle'
            ? 'to_pickup' as const
            : agv.state,
      } as AgvData;
    });
  }, [backendTick, sceneComponents, snapshot, usesSavedSceneLayout]);

  // Convert snapshot to SimView3D props
  const sim3DProps: SimView3DProps = useMemo(() => {
    // 视窗高度根据场景画布面积等比缩放（基准 1200×800 → 520px）
    const viewArea = warehouseConfig.width * warehouseConfig.height;
    const refArea = 1200 * 800;
    const viewHeight = Math.round(Math.min(800, Math.max(400, 520 * Math.sqrt(viewArea / refArea))));
    const zones3D = warehouseZonesTo3D(warehouseConfig);
    // Render explicit editor components verbatim. The older shelf-zone and
    // engine defaults remain only for legacy runs without a scene snapshot.
    const shelves3D = usesSavedSceneLayout
      ? sceneComponents.filter((component) => component.type === 'shelf').map((component) => ({
          id: component.id,
          x: component.x,
          y: component.y,
          w: component.width,
          h: component.height,
          color: String(component.properties.color ?? '#3b82f6'),
          levels: Number(component.properties.levels ?? 3),
        }))
      : warehouseShelfZonesTo3D(warehouseConfig);

    if (!snapshot) {
      return {
        layout: { width: warehouseConfig.width, height: warehouseConfig.height },
        warehouseConfig,
        height: viewHeight,
        agvs: [],
        zones: zones3D,
        stations: [],
        congestion: [],
        shelves: shelves3D,
        robotArms: [],
        buffers: [],
        running: status === 'running',
        selectedRobotId: selectedAgvId,
        onSelectRobot: setSelectedAgvId,
        selectedShelfId,
        onSelectShelf: setSelectedShelfId,
      };
    }

    // Convert AGVs
    const agvs: Agv3D[] = displayAgvs.map((a) => {
      const tickRobot = backendTick?.robots?.find((r) => r.id === a.id);
      const strategy = (tickRobot?.path_strategy as Agv3D['pathStrategy']) ?? 'balanced';
      return {
        id: a.id,
        name: a.name,
        position: a.position,
        route: a.route,
        progress: 0,
        color: AGV_STATE_COLORS[a.state as keyof typeof AGV_STATE_COLORS] || '#06b6d4',
        state: a.state,
        battery: Math.round(a.battery * 10) / 10,
        loadStatus: a.loadStatus,
        taskId: a.taskId,
        pickupStationId: a.pickupStationId,
        targetStationId: a.targetStationId,
        targetChargerId: a.targetChargerId,
        remainingSeconds: a.remainingSeconds,
        completedTasks: a.completedTasks,
        totalDistance: a.totalDistance,
        type: a.type ?? 'tote_amr',
        pathStrategy: strategy,
        stationWaitSeconds: Number(tickRobot?.station_queue_wait_seconds ?? 0),
      };
    });

    // Explicit station/charger/arm components from the saved editor snapshot
    // take precedence over simulation-engine defaults.
    const stations = usesSavedSceneLayout
      ? sceneComponents.filter((component) => component.type === 'station').map((component) => {
          const type = String(component.properties.station_type ?? 'pick');
          return {
            x: component.x + component.width / 2,
            y: component.y + component.height / 2,
            label: component.name,
            type: (['pick', 'pack', 'sort', 'inbound', 'outbound'].includes(type) ? type : 'pick') as SimView3DProps['stations'][0]['type'],
            color: String(component.properties.color ?? '#22c55e'),
          };
        })
      : snapshot.stations.map((s) => ({
        x: s.position.x,
        y: s.position.y,
        label: s.name,
        type: s.type as SimView3DProps['stations'][0]['type'],
        color: s.state === 'working' ? '#22c55e' : s.state === 'blocked' ? '#ef4444' : '#64748b',
      }));

    // Chargers
    const chargers = usesSavedSceneLayout
      ? sceneComponents.filter((component) => component.type === 'charger').map((component) => ({
          x: component.x + component.width / 2,
          y: component.y + component.height / 2,
          label: component.name,
          type: 'charge' as const,
          color: String(component.properties.color ?? '#10b981'),
        }))
      : snapshot.chargers.map((c) => ({
      x: c.position.x,
      y: c.position.y,
      label: c.name,
      type: 'charge' as const,
      color: c.occupiedBy ? '#f59e0b' : '#10b981',
      }));

    // Robotic arms
    // Arms — drive each arm's state from the live backend arm_states
    // stream when available, so AGV arrival at the station lights up the
    // pick / place animation in real time.  Falls back to idle when the
    // editor did not place a matching station or no arm_states payload
    // is present yet.
    const armStateById = new Map<string, 'idle' | 'working'>();
    (backendTick?.arm_states ?? []).forEach((arm) => armStateById.set(arm.id, arm.state));
    const arms = usesSavedSceneLayout
      ? sceneComponents.filter((component) => component.type === 'arm').map((component) => ({
          id: component.id,
          x: component.x + component.width / 2,
          y: component.y + component.height / 2,
          state: armStateById.get(component.id) ?? 'idle' as 'idle' | 'working',
          stationId: String(component.properties.station_id ?? ''),
        }))
      : snapshot.arms.map((a) => ({
      id: a.id,
      x: a.position.x,
      y: a.position.y,
      state: a.state,
      stationId: a.stationId,
      }));

    // Congestion
    const persistedCongestion = snapshot.congestion.map((c) => ({
      x: c.x,
      y: c.y,
      radius: c.radius,
      intensity: c.intensity,
      avgWaitSeconds: c.avgWaitSeconds,
    }));
    const liveCongestion = (backendTick?.robots ?? [])
      .filter((robot) => (robot.waiting_seconds ?? 0) >= 2 && typeof robot.x === 'number' && typeof robot.y === 'number')
      .map((robot) => ({
        x: robot.x as number,
        y: robot.y as number,
        radius: Math.min(120, 38 + (robot.waiting_seconds ?? 0) * 2),
        intensity: Math.min(1, (robot.waiting_seconds ?? 0) / 20),
        avgWaitSeconds: robot.waiting_seconds ?? 0,
      }));
    const congestion = [...persistedCongestion, ...liveCongestion];

    // Buffers
    const buffers = snapshot.buffers.map((b) => ({
      id: b.id,
      name: b.name,
      x: b.position.x - b.w / 2,
      y: b.position.y - b.h / 2,
      w: b.w,
      h: b.h,
    }));

    return {
      layout: { width: warehouseConfig.width, height: warehouseConfig.height },
      warehouseConfig,
      height: viewHeight,
      agvs,
      zones: zones3D,
      stations: [...stations, ...chargers],
      congestion,
      shelves: shelves3D,
      robotArms: arms,
      buffers,
      running: status === 'running',
      selectedRobotId: selectedAgvId,
      onSelectRobot: setSelectedAgvId,
      selectedShelfId,
      onSelectShelf: setSelectedShelfId,
    };
  }, [backendTick, displayAgvs, sceneComponents, selectedAgvId, selectedShelfId, snapshot, status, usesSavedSceneLayout, warehouseConfig]);

  // KPI computation
  const kpis = useMemo(() => {
    if (!snapshot) {
      return simulationKpiDescriptors;
    }

    const activeAgvs = backendTick
      ? backendTick.robots.filter((robot) => robot.state !== 'idle' && robot.state !== 'fault')
          .length
      : displayAgvs.filter((a) => a.state !== 'idle' && a.state !== 'fault').length;
    const totalAgvs = backendTick?.robots.length ?? displayAgvs.length;
    const completedTasks = backendTick?.tasks.completed ?? snapshot.metrics.completedTasks;
    const totalTasks = backendTick?.tasks.total ?? snapshot.metrics.totalOrdersGenerated;
    const completionRate =
      backendTick?.metrics.completion_rate ?? (totalTasks > 0 ? completedTasks / totalTasks : 0);
    const congestionScore = backendTick
      ? Math.min(1, backendTick.metrics.congestion_count / Math.max(totalAgvs, 1))
      : snapshot.metrics.congestionScore;
    // Real utilization comes from backend runtime — it sums each robot's
    // active_seconds against its total tracked time.  Only meaningful when
    // the engine has actually advanced (has_runtime).  We deliberately
    // avoid the cheap "active / total" ratio because it reports 100% the
    // moment a robot is dispatched, even if it never moved.
    const hasRuntime = Number(backendTick?.metrics?.has_runtime ?? 0) > 0;
    const realUtilization = typeof backendTick?.metrics?.device_utilization === 'number'
      ? backendTick.metrics.device_utilization
      : null;
    const completionValueText = completedTasks === 0
      ? '—'
      : `${(completionRate * 100).toFixed(1)}`;
    const utilizationValueText = realUtilization === null
      ? '—'
      : `${Math.round(realUtilization * 100)}`;

    return [
      {
        title: 'AGV 总数/活跃',
        value: `${totalAgvs}`,
        delta: totalAgvs > 0 ? Math.round((activeAgvs / totalAgvs) * 100) : 0,
        deltaLabel: '活跃率',
        trend: 'flat' as const,
        iconColor: '#3b82f6',
      },
      {
        title: '当前任务/完成',
        value: totalTasks,
        delta: completedTasks,
        deltaLabel: completedTasks === 0 ? '尚无完成' : '已完成',
        trend: 'up' as const,
        iconColor: '#06b6d4',
      },
      {
        // 真正有意义的"等待" = 工位排队等待 (station_queue_wait_seconds):
        // AGV 到达工位后等待资源(站位/机械臂)空闲的时长，而非装卸服务本身。
        // 派单等待(pending_wait_seconds)与站端服务耗时(station_wait_seconds)
        // 作为副标题并列展示，三者口径已分离。
        title: '工位排队等待',
        value: backendTick
          ? (backendTick.metrics.average_queue_wait_seconds ?? backendTick.metrics.average_wait_seconds ?? 0).toFixed(1)
          : snapshot.metrics.averageWaitSeconds.toFixed(1),
        unit: 's',
        delta: backendTick ? Math.round(backendTick.metrics.p95_queue_wait_seconds ?? backendTick.metrics.max_queue_wait_seconds ?? 0) : 0,
        deltaLabel: backendTick && typeof backendTick.metrics.pending_wait_seconds === 'number'
          ? `派单 ${backendTick.metrics.pending_wait_seconds.toFixed(1)}s / 服务 ${(backendTick.metrics.average_wait_seconds ?? 0).toFixed(1)}s`
          : '派单/服务(s)',
        trend: 'flat' as const,
        iconColor: '#22c55e',
      },
      {
        title: '拥堵指数',
        value: Math.round(congestionScore * 100),
        delta: 0,
        deltaLabel: '%',
        trend: congestionScore > 0.5 ? ('down' as const) : ('flat' as const),
        iconColor: congestionScore > 0.5 ? '#ef4444' : '#f59e0b',
      },
      {
        title: '任务完成率',
        value: completionValueText,
        unit: completedTasks === 0 ? '' : '%',
        delta: completedTasks,
        deltaLabel: completedTasks === 0 ? '尚未有任务完成' : '完成数',
        trend: 'up' as const,
        iconColor: '#22c55e',
      },
      {
        title: '设备利用率',
        value: utilizationValueText,
        unit: realUtilization === null ? '' : '%',
        delta: 0,
        deltaLabel: hasRuntime ? '基于运行时间' : '尚未运行',
        trend: 'flat' as const,
        iconColor: '#ec4899',
      },
    ];
  }, [backendTick, displayAgvs, snapshot]);

  // Selected AGV info
  const selectedAgv = displayAgvs.find((a) => a.id === selectedAgvId) ?? null;
  const selectedShelf = sim3DProps.shelves?.find((shelf) => shelf.id === selectedShelfId) ?? null;
  // The server tick is the runtime authority. The local snapshot supplies
  // only static editor geometry (shelves, stations and walls).
  const runtimeTasks = useMemo<Task[]>(() => backendTick?.task_items?.map((task) => {
    const priority = task.priority ?? 0;
    return {
    id: task.id,
    type: (task.kind ?? 'inbound') as Task['type'],
    status: task.status === 'active' ? 'running' : task.status === 'completed' ? 'completed' : 'pending',
    assignedAgvId: task.assigned_robot ?? undefined,
    pickupStationId: task.source,
    toStationId: task.destination,
    priority: priority >= 4 ? 'high' : priority <= 1 ? 'low' : 'normal',
    progress: task.status === 'completed' ? 1 : task.status === 'active' ? 0.5 : 0,
    etaSeconds: task.status === 'completed' ? 0 : Math.max(0, Number(task.waiting_seconds ?? 0)),
    createdAt: Number(task.created_at ?? 0),
    startedAt: task.started_at ?? undefined,
    completedAt: task.completed_at ?? undefined,
    };
  }) ?? snapshot?.tasks ?? [], [backendTick?.task_items, snapshot?.tasks]);
  const cargoList = backendTick?.cargos?.map((cargo) => ({
    id: cargo.id, sku: cargo.sku ?? '', type: (cargo.type ?? 'tote') as 'tote' | 'carton' | 'pallet',
    quantity: cargo.quantity ?? 0, weight: cargo.weight ?? 0, status: cargo.status ?? '',
    locationId: cargo.location_id ?? '', orderId: cargo.order_id,
  })) ?? snapshot?.cargos ?? [];
  const shippedCount = cargoList.filter((c) => c.status === 'shipped').length;
  const onShelfCount = cargoList.filter((c) => c.status === 'on_shelf').length;
  const onAgvCount = cargoList.filter((c) => c.status === 'on_agv').length;

  const simTimeStr = useMemo(() => formatSimTime(simTime), [simTime]);
  const runtimeView = location.pathname.split('/')[2] || 'overview';

  if (!simulationId) {
    const editorUrl = projectId && scenarioId
      ? `/editor?projectId=${encodeURIComponent(projectId)}&scenarioId=${encodeURIComponent(scenarioId)}`
      : '/projects';
    return (
      <Card style={{ margin: 24, textAlign: 'center', padding: '40px 0' }}>
        <Empty description="尚未创建仿真环境">
          <p style={{ marginBottom: 16, color: '#64748b' }}>请在场景编辑器中配置设备与布局，然后点击启动。</p>
          <Button type="primary" onClick={() => navigate(editorUrl)}>
            {projectId && scenarioId ? '返回场景编辑器' : '前往项目管理'}
          </Button>
        </Empty>
      </Card>
    );
  }

  if (detailQuery.isLoading && !detailQuery.data) {
    return <div className="simulation-state-card"><Skeleton active paragraph={{ rows: 12 }} /></div>;
  }

  if (detailQuery.isError && !detailQuery.data) {
    return (
      <div className="simulation-state-card">
        <Alert
          type="error"
          showIcon
          message="仿真服务加载失败"
          description={`${getApiErrorMessage(detailQuery.error, '服务不存在、无权限或网络异常')}。ID: ${simulationId}。`}
          action={<Space direction="vertical"><Button onClick={() => void detailQuery.refetch()}>刷新</Button><Button onClick={() => navigate('/projects')}>返回项目列表</Button></Space>}
        />
      </div>
    );
  }

  if (runtimeView !== 'overview' && runtimeView !== 'simulation' && runtimeView !== 'live') {
    return (<>
      <ProjectContextBar
        projectId={projectId ?? ''}
        scenarioId={scenarioId ?? undefined}
        simulationId={simulationId}
        simulationStatus={status}
      />
      <RuntimeSubView
        view={runtimeView}
        simulationId={simulationId}
        status={status}
        connectionState={stream.connectionState}
        lastReceivedAt={stream.lastReceivedAt}
        config={detailQuery.data?.config ?? {}}
        tick={backendTick}
        agvs={displayAgvs}
        tasks={runtimeTasks}
        stations={snapshot?.stations ?? []}
        chargers={snapshot?.chargers ?? []}
        cargos={cargoList}
        agents={agentsQuery.data ?? []}
        events={events}
        speed={speed}
        busy={controlMutation.isPending || injectMutation.isPending}
        canControl={canRun}
        onSpeedChange={setSpeed}
        onStart={() => void handleStart()}
        onPause={() => void handlePause()}
        onStop={() => void handleStop()}
        onInject={handleAnomalyClick}
        onReconnect={stream.reconnect}
        onTaskReassign={(taskId) => void handleTaskReassign(taskId)}
        onRobotCharge={(robotId) => void handleRobotCharge(robotId)}
        onCreateOrder={(kind) => void handleCreateOrder(kind)}
      />
    </>);
  }

  return (
    <div className="simulation-page" ref={pageRef}>
      {stream.connectionState !== 'connected' && (
        <Alert
          type={stream.connectionState === 'error' ? 'error' : 'warning'}
          showIcon
          message={stream.connectionState === 'reconnecting' ? '实时连接已断开，正在自动恢复' : '尚未连接到仿真实时流'}
          description={stream.error || '连接恢复前页面将保留最后读取的状态，设备与事件数据在重连期间保持暂停。'}
          action={<Button size="small" onClick={stream.reconnect}>重新连接</Button>}
        />
      )}
      <ProjectContextBar
        projectId={projectId ?? ''}
        scenarioId={scenarioId ?? undefined}
        simulationId={simulationId}
        simulationStatus={status}
      />

      {/* 项目名称 Hero 头部 — 紧凑展示，避免占满整行 */}
      <div className="sim-hero">
        <div className="sim-hero-left">
          <h2 className="sim-hero-name" title={currentProject?.name}>
            {currentProject?.name ?? '暂无项目'}
          </h2>
          <div className="sim-hero-breadcrumb">
            <span>{currentScenario?.name ?? '—'}</span>
          </div>
        </div>
        <div className="sim-hero-right">
          <div className={`sim-hero-status ${status === 'running' ? 'is-running' : status === 'paused' ? 'is-paused' : ''}`}>
            <span className="live-dot" />
            <span>
              {status === 'running' ? '运行中' : status === 'paused' ? '已暂停' : '未启动'}
            </span>
          </div>
        </div>
      </div>

      <div className="kpi-row">
        {kpis.map((kpi) => (
          <Card className="kpi-card" key={kpi.title} variant="borderless">
            <Statistic title={kpi.title} value={kpi.value} suffix={kpi.unit} valueStyle={{ color: kpi.iconColor, fontWeight: 700 }} />
            <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>{kpi.deltaLabel}: {kpi.delta}</div>
          </Card>
        ))}
      </div>

      <div className="sim-grid">
        <div className="sim-main">
          <Card
            className="sim-canvas-card"
            title="数字孪生三维视图"
            extra={<Space><Tag color={backendConnected ? 'cyan' : 'default'}>{backendConnected ? `后端实时流 · ${safeDeltaSeconds(Date.now() - new Date(stream.lastReceivedAt ?? 0).getTime(), 1)}s` : '等待连接'}</Tag><span className="num-font">{simTimeStr}</span><Button type="text" icon={<FullscreenOutlined />} onClick={() => setIsFullscreen(true)}>全屏</Button></Space>}
          >
            <div className={isFullscreen ? 'canvas-with-legend canvas-fullscreen' : 'canvas-with-legend'} style={{ height: sim3DProps.height ?? 520 }}>
              <div className="canvas-area">
                <SimView3D {...sim3DProps} />
                <div className="scene-hud scene-hud-bottom" aria-label="设备状态图例">
                  {(Object.entries(AGV_STATE_BADGES).slice(0, 5)).map(([name, info]) => <span className="scene-legend-chip" key={name}><i style={{ background: AGV_STATE_COLORS[name as keyof typeof AGV_STATE_COLORS] || '#3b82f6' }} />{info.label}</span>)}
                </div>
              </div>
            </div>
          </Card>

          <div className="sim-control-bar">
            <Space wrap>
              <Button type="primary" icon={status === 'running' ? <PauseOutlined /> : <CaretRightOutlined />} onClick={() => void (status === 'running' ? handlePause() : handleStart())} loading={controlMutation.isPending} disabled={!canRun}>{status === 'running' ? '暂停仿真' : '开始仿真'}</Button>
              <Button icon={<ReloadOutlined />} onClick={() => void handleStop()} disabled={!canRun}>重置</Button>
              <Button danger icon={<AlertOutlined />} onClick={handleAnomalyClick} disabled={!canRun || status !== 'running'}>注入异常</Button>
              <Button icon={<ThunderboltOutlined />} onClick={() => void handleEvolution()} loading={evolving} disabled={!canEvolve}>进化引擎</Button>
            </Space>
            <div className="sim-speed"><span className="speed-label">仿真速度</span><Select value={speed} onChange={setSpeed} options={[{ value: 1, label: '1.0x' }, { value: 2, label: '2.0x' }, { value: 4, label: '4.0x' }]} /></div>
          </div>

          <div className="sim-info-grid">
            <Card title="实时任务日志" size="small"><div className="event-list">{events.length ? events.slice(0, 6).map((event) => <div className="event-row" key={event.id}><span className="event-time num-font">{event.time}</span><span className="event-level">{levelIcon[event.level]}</span><span className="event-msg">{event.message}</span></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无运行事件" />}</div></Card>
            <Card title="仿真信息" size="small"><div className="info-table"><div className="info-row"><span>场景来源</span><b>{usesSavedSceneLayout ? '已保存编辑器场景' : '默认场景'}</b></div><div className="info-row"><span>布局组件</span><b>{sceneStats.shelves + sceneStats.agvs + sceneStats.arms + sceneStats.stations + sceneStats.chargers}</b></div><div className="info-row"><span>已发货货物</span><b>{shippedCount}</b></div><div className="info-row"><span>货架中 / 运输中</span><b>{onShelfCount} / {onAgvCount}</b></div></div></Card>
          </div>
        </div>

        <aside className="sim-aside">
          <Card title="AGV 状态与详情" size="small">
            <div className="agent-list">
              {displayAgvs.map((agv) => {
                const st = agv.state || 'idle';
                const badgeInfo = AGV_STATE_BADGES[st] ?? { label: st, cls: 'badge-gray' };
                const battery = agv.battery;
                const isLow = battery < 25;
                const tickRobot = backendTick?.robots?.find((r) => r.id === agv.id);
                const strategy = (tickRobot?.path_strategy as keyof typeof AGV_PATH_STRATEGY_LABELS) ?? 'balanced';
                const strategyLabel = AGV_PATH_STRATEGY_LABELS[strategy] ?? '均衡调度';
                const strategyColor = AGV_PATH_STRATEGY_COLORS[strategy] ?? '#22c55e';
                const stationWait = Number(tickRobot?.station_wait_seconds ?? 0);
                return (
                  <button
                    type="button"
                    className={`agent-card state-${st} ${selectedAgvId === agv.id ? 'is-selected' : ''}`}
                    key={agv.id}
                    onClick={() => setSelectedAgvId(agv.id)}
                  >
                    <div className="agent-row1">
                      <span className="agent-id">
                        <span className="status-dot" />
                        {agv.name}
                      </span>
                      <span className={`state-badge ${badgeInfo.cls}`}>{badgeInfo.label}</span>
                    </div>
                    <div className="agent-row1 agent-strategy-row">
                      <span className="agent-strategy-label">路径策略</span>
                      <span className="agent-strategy-pill" style={{ borderColor: strategyColor, color: strategyColor }}>
                        <i style={{ background: strategyColor }} />
                        {strategyLabel}
                      </span>
                    </div>
                    <div className={`battery-bar ${isLow ? 'low' : ''}`} style={{ '--battery-pct': `${battery}%` } as React.CSSProperties} />
                    <div className="agent-stats-line">
                      <span>电量</span>
                      <span className={`battery-pct ${isLow ? 'low' : ''}`}>{battery.toFixed(0)}%</span>
                      <span className="agent-wait">站端 {stationWait.toFixed(1)}s</span>
                    </div>
                    <div className="agent-row2">
                      <span className={`load-badge ${agv.loadStatus === 'loaded' ? 'loaded' : ''}`}>
                        <i /> {agv.loadStatus === 'loaded' ? '载货中' : '空载'}
                      </span>
                      {agv.taskId && <span style={{ color: '#64748b' }}>任务 {agv.taskId}</span>}
                      {!agv.taskId && st === 'idle' && <span style={{ color: '#94a3b8' }}>待命中</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedAgv && (() => {
              const st = selectedAgv.state || 'idle';
              const badgeInfo = AGV_STATE_BADGES[st] ?? { label: st, cls: 'badge-gray' };
              return (
                <div className="selected-agv-detail">
                  <div className="detail-title">
                    <i>{selectedAgv.name.replace(/^agv-/i, '')}</i>
                    <span>{selectedAgv.name}</span>
                    <span className={`state-badge ${badgeInfo.cls}`} style={{ marginLeft: 'auto' }}>{badgeInfo.label}</span>
                  </div>
                  <div className="detail-grid">
                    <div className="detail-cell">
                      <span className="detail-cell-label">当前任务</span>
                      <span className="detail-cell-value">{selectedAgv.taskId ?? '待命'}</span>
                    </div>
                    <div className="detail-cell">
                      <span className="detail-cell-label">电量</span>
                      <span className="detail-cell-value">{selectedAgv.battery.toFixed(0)}%</span>
                    </div>
                    <div className="detail-cell">
                      <span className="detail-cell-label">负载状态</span>
                      <span className="detail-cell-value">{selectedAgv.loadStatus === 'loaded' ? '载货中' : '空载'}</span>
                    </div>
                    <div className="detail-cell">
                      <span className="detail-cell-label">坐标</span>
                      <span className="detail-cell-value">{selectedAgv.position.x.toFixed(0)}, {selectedAgv.position.y.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            {selectedShelf && (
              <div className="selected-agv-detail">
                <div className="detail-title">
                  <i>📦</i>
                  <span>货架 {selectedShelf.id}</span>
                </div>
                <div className="detail-grid">
                  <div className="detail-cell">
                    <span className="detail-cell-label">层数</span>
                    <span className="detail-cell-value">{selectedShelf.levels ?? 1}</span>
                  </div>
                  <div className="detail-cell">
                    <span className="detail-cell-label">占地 (宽×高)</span>
                    <span className="detail-cell-value">{selectedShelf.w.toFixed(0)} × {selectedShelf.h.toFixed(0)}</span>
                  </div>
                  <div className="detail-cell">
                    <span className="detail-cell-label">坐标</span>
                    <span className="detail-cell-value">{selectedShelf.x.toFixed(0)}, {selectedShelf.y.toFixed(0)}</span>
                  </div>
                  <div className="detail-cell">
                    <span className="detail-cell-label">颜色</span>
                    <span className="detail-cell-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: selectedShelf.color ?? '#94a3b8', display: 'inline-block' }} />
                      {selectedShelf.color ?? '默认'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </aside>
      </div>

      <Modal title="注入异常" open={showAnomalyModal} onCancel={() => setShowAnomalyModal(false)} onOk={() => void handleConfirmAnomaly()} okText="确认注入" cancelText="取消" confirmLoading={injectMutation.isPending}>
        <Select value={pendingAnomaly} onChange={setPendingAnomaly} style={{ width: '100%' }} options={ANOMALY_TYPES.map((item) => ({ value: item.key, label: item.label }))} />
      </Modal>
    </div>
  );
}
