/**
 * 无人仓全周期仿真 — 统一类型定义
 * 同时导出 3D 可视化类型 和 仿真引擎类型
 */

import type { WarehouseConfig } from './digitalTwin';

// ============================================================
// 3D 可视化基础类型 (SimView3DProps 消费)
// ============================================================

export interface WarehouseLayout3D {
  width: number;
  height: number;
}

export interface Zone3D {
  x: number; y: number; w: number; h: number;
  color: string; label: string;
}

export interface Congestion3D {
  x: number; y: number;
  radius: number;
  intensity: number;
  avgWaitSeconds?: number;
}

export interface Shelf3D {
  id: string;
  x: number; y: number; w: number; h: number;
  color: string;
  levels?: number;
}

export interface Station3D {
  x: number; y: number;
  label: string;
  type: 'pick' | 'pack' | 'charge' | 'inbound' | 'outbound' | 'sort' | 'recv' | 'ship';
  color: string;
}

export interface RobotArm3D {
  id: string;
  x: number; y: number;
  state?: 'idle' | 'working';
  stationId?: string;
}

export interface BufferZone3D {
  id: string;
  name: string;
  x: number; y: number; w: number; h: number;
}

// ============================================================
// AGV 完整状态机 (14 种状态)
// ============================================================

export type AgvState =
  | 'idle'
  | 'to_pickup'
  | 'waiting_pickup'
  | 'loading'
  | 'to_dropoff'
  | 'waiting_dropoff'
  | 'unloading'
  | 'to_charge'
  | 'waiting_charge'
  | 'charging'
  | 'returning'
  | 'blocked'
  | 'fault'
  | 'to_buffer_in'
  | 'to_buffer_out'
  | 'rerouting';

/** 状态对应的视觉颜色 */
export const AGV_STATE_COLORS: Record<AgvState, string> = {
  idle: '#94a3b8',
  to_pickup: '#22c55e',
  waiting_pickup: '#eab308',
  loading: '#3b82f6',
  to_dropoff: '#22c55e',
  waiting_dropoff: '#eab308',
  unloading: '#3b82f6',
  to_charge: '#f97316',
  waiting_charge: '#f59e0b',
  charging: '#f59e0b',
  returning: '#06b6d4',
  blocked: '#ef4444',
  fault: '#dc2626',
  to_buffer_in: '#22c55e',
  to_buffer_out: '#22c55e',
  rerouting: '#f97316',
};

/** 状态环发光颜色 */
export const AGV_STATE_GLOW: Record<AgvState, string> = {
  idle: '#64748b',
  to_pickup: '#22c55e',
  waiting_pickup: '#eab308',
  loading: '#3b82f6',
  to_dropoff: '#22c55e',
  waiting_dropoff: '#eab308',
  unloading: '#3b82f6',
  to_charge: '#f97316',
  waiting_charge: '#f59e0b',
  charging: '#f59e0b',
  returning: '#06b6d4',
  blocked: '#ef4444',
  fault: '#dc2626',
  to_buffer_in: '#22c55e',
  to_buffer_out: '#22c55e',
  rerouting: '#f97316',
};

// ============================================================
// 电量模型
// ============================================================

export interface BatteryConfig {
  idleDrainPerSecond: number;
  movingDrainPerSecond: number;
  handlingDrainPerSecond: number;
  chargeRatePerSecond: number;
  chargeThreshold: number;
  chargeTarget: number;
}

export const DEFAULT_BATTERY_CONFIG: BatteryConfig = {
  idleDrainPerSecond: 0.01,
  movingDrainPerSecond: 0.08,
  handlingDrainPerSecond: 0.03,
  chargeRatePerSecond: 2.5,
  chargeThreshold: 25,
  chargeTarget: 80,
};

// ============================================================
// 任务
// ============================================================

export type TaskType = 'inbound' | 'outbound' | 'charge' | 'return';

export interface Task {
  id: string;
  type: TaskType;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  assignedAgvId?: string;
  fromShelfId?: string;
  pickupStationId?: string;
  toStationId?: string;
  toChargerId?: string;
  priority: 'high' | 'normal' | 'low';
  progress: number;
  etaSeconds: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

// ============================================================
// AGV 完整数据 (仿真引擎 → 前端)
// ============================================================

export interface AgvData {
  id: string;
  name: string;
  position: { x: number; y: number };
  /** Dedicated bay; prevents idle/returning vehicles from stacking together. */
  homePosition?: { x: number; y: number };
  route: Array<[number, number]>;
  state: AgvState;
  battery: number;
  taskId?: string;
  taskType?: TaskType;
  pickupStationId?: string;
  targetStationId?: string;
  targetChargerId?: string;
  remainingSeconds: number;
  loadStatus: 'empty' | 'loaded';
  speed: number;
  faultRecoverySeconds?: number;
  isBlocked: boolean;
  /** State to resume after a short traffic-yield pause. */
  resumeState?: Exclude<AgvState, 'blocked' | 'fault'>;
  completedTasks: number;
  totalDistance: number;
  /** AGV type: tote_amr or pallet_amr */
  type?: 'tote_amr' | 'pallet_amr';
}

// 前端 3D 可视化用 AGV 数据 (简化)
export interface Agv3D {
  id: string;
  name?: string;
  type?: 'tote_amr' | 'pallet_amr';
  position: { x: number; y: number };
  route: Array<[number, number]>;
  progress: number;
  color?: string;
  state: AgvState;
  battery: number;
  loadStatus: 'empty' | 'loaded';
  cargoIds?: string[];
  taskId?: string;
  pickupStationId?: string;
  targetStationId?: string;
  targetChargerId?: string;
  remainingSeconds: number;
  completedTasks?: number;
  totalDistance?: number;
  yieldCount?: number;
  etSeconds?: number;
}

// ============================================================
// 工位
// ============================================================

export type StationType = 'pick' | 'pack' | 'inbound' | 'outbound';
export type StationState = 'idle' | 'working' | 'blocked';

export interface StationData {
  id: string;
  name: string;
  type: StationType;
  position: { x: number; y: number };
  state: StationState;
  queueLength: number;
  activeAgvId?: string;
  activeTaskId?: string;
  processingTime: number;
  elapsedProcessing: number;
  avgProcessingTime: number;
  totalProcessed: number;
}

// ============================================================
// 充电桩
// ============================================================

export interface ChargerData {
  id: string;
  name: string;
  position: { x: number; y: number };
  occupiedBy?: string;
  queue: string[];
  chargingProgress: number;
  remainingSeconds: number;
}

// ============================================================
// 货架区
// ============================================================

export interface ShelfZone {
  id: string;
  name: string;
  type: 'high-turnover' | 'normal';
  x: number; y: number; w: number; h: number;
  color: string;
  shelves: Array<{ id: string; occupancy: number }>;
}

// ============================================================
// 缓冲区
// ============================================================

export interface BufferZone {
  id: string;
  name: string;
  type: 'inbound' | 'outbound';
  position: { x: number; y: number };
  w: number; h: number;
  capacity: number;
  currentCount: number;
}

// ============================================================
// 机械臂
// ============================================================

export interface RobotArmData {
  id: string;
  name: string;
  position: { x: number; y: number };
  stationId: string;
  state: 'idle' | 'working';
  activeTaskId?: string;
}

// ============================================================
// 拥堵检测
// ============================================================

export interface CongestionZone {
  x: number; y: number;
  radius: number;
  intensity: number;
  avgWaitSeconds: number;
}

// ============================================================
// 仿真快照
// ============================================================

export interface SimulationSnapshot {
  currentTime: number;
  agvs: AgvData[];
  stations: StationData[];
  chargers: ChargerData[];
  zones: ShelfZone[];
  buffers: BufferZone[];
  arms: RobotArmData[];
  tasks: Task[];
  congestion: CongestionZone[];
  metrics: SimulationMetrics;
  timeline: TimelineEntry[];
  /** Tracked cargo entities (last 30) */
  cargos?: Array<{
    id: string; sku: string; type: 'tote' | 'carton' | 'pallet';
    quantity: number; weight: number; status: string; locationId: string; orderId?: string;
  }>;
}

export interface SimulationMetrics {
  completedTasks: number;
  averageWaitSeconds: number;
  utilization: number;
  congestionScore: number;
  totalOrdersGenerated: number;
  activeChargers: number;
  faultCount: number;
}

export interface TimelineEntry {
  time: number;
  event: string;
  type: 'order' | 'assign' | 'arrive' | 'handle' | 'charge' | 'fault' | 'recover' | 'complete';
  agvId?: string;
  taskId?: string;
  cargoId?: string;
}

// ============================================================
// 仿真配置
// ============================================================

export interface SimulationConfig {
  orderIntervalMin: number;
  orderIntervalMax: number;
  agvCount: number;
  emptySpeed: number;
  loadedSpeed: number;
  pickDuration: number;
  packDuration: number;
  loadUnloadDuration: number;
  stationWaitThreshold: number;
  faultRecoveryDuration: number;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  orderIntervalMin: 8,
  orderIntervalMax: 20,
  agvCount: 8,
  emptySpeed: 1.2,
  loadedSpeed: 0.9,
  pickDuration: 6,
  packDuration: 9,
  loadUnloadDuration: 3,
  stationWaitThreshold: 15,
  faultRecoveryDuration: 15,
};

// ============================================================
// SimView3D Props (组合以上所有类型)
// ============================================================

export interface SimView3DProps {
  layout: WarehouseLayout3D;
  /** Exact world config used by the running simulation engine. */
  warehouseConfig: WarehouseConfig;
  agvs?: Agv3D[];
  /** 旧版 robots 兼容 */
  robots?: Array<{
    id: string; path: Array<[number, number]>; progress: number;
    color: string; state: 'idle' | 'moving' | 'charging' | 'picking'; loop?: boolean;
  }>;
  zones: Zone3D[];
  stations: Station3D[];
  congestion: Congestion3D[];
  shelves?: Shelf3D[];
  robotArms?: RobotArm3D[];
  buffers?: BufferZone3D[];
  running?: boolean;
  onSelectRobot?: (id: string) => void;
  selectedRobotId?: string | null;
  onSelectShelf?: (id: string) => void;
  selectedShelfId?: string | null;
  width?: number;
  height?: number;
}
