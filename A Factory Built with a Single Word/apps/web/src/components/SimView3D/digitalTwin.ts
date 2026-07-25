/**
 * 无人仓数字孪生 — 统一仓库语义模型
 *
 * 建立完整的领域模型：
 * - 仓库布局 (墙体、门、路网、区域)
 * - 货架系统 (区域、巷道、层、格口)
 * - 设备 (AGV、机械臂、堆垛机、充电桩)
 * - 货物与库存
 * - 功能区 (收货月台、质检区、缓冲区、存储区、拣选区、打包区、出库区)
 */

// ============================================================
// 枚举定义
// ============================================================

export enum CargoType {
  TOTE = 'tote',        // 料箱
  CARTON = 'carton',    // 纸箱
  PALLET = 'pallet',    // 托盘
}

export enum CargoStatus {
  ON_SHELF = 'on_shelf',
  ON_AGV = 'on_agv',
  AT_STATION = 'at_station',
  IN_BUFFER = 'in_buffer',
  SHIPPED = 'shipped',
  RECEIVING = 'receiving',
  QUALITY_CHECK = 'quality_check',
}

export enum EquipmentType {
  TOTE_AMR = 'tote_amr',
  PALLET_AMR = 'pallet_amr',
  PICK_ARM = 'pick_arm',
  PACK_ARM = 'pack_arm',
  PALLETIZING_ARM = 'palletizing_arm',
  STACKER_CRANE = 'stacker_crane',
  SHUTTLE_CAR = 'shuttle_car',
  CHARGER = 'charger',
  CONVEYOR = 'conveyor',
}

// AGV type literal (used in AGV interface extends)
export type AgvType = 'tote_amr' | 'pallet_amr';
export type ArmType = 'pick_arm' | 'pack_arm' | 'palletizing_arm';
export type CraneType = 'stacker_crane';
export type ShuttleType = 'shuttle_car';
export type ChargerType = 'charger';
export type ConveyorType = 'conveyor';

export enum ZoneType {
  RECV_DOCK = 'recv_dock',
  QC_AREA = 'qc_area',
  INBOUND_BUFFER = 'inbound_buffer',
  HIGH_BAY_STORAGE = 'high_bay_storage',
  PICK_ZONE = 'pick_zone',
  SORTING_ZONE = 'sorting_zone',
  PACK_ZONE = 'pack_zone',
  OUTBOUND_BUFFER = 'outbound_buffer',
  SHIP_DOCK = 'ship_dock',
  CHARGE_ZONE = 'charge_zone',
  MAINTENANCE = 'maintenance',
}

export enum RoadDirection {
  BIDIRECTIONAL = 'bidirectional',
  ONE_WAY_A_TO_B = 'one_way_a_to_b',
  ONE_WAY_B_TO_A = 'one_way_b_to_a',
}

export enum WallType {
  EXTERIOR = 'exterior',
  INTERIOR = 'interior',
  FIRE_EXIT = 'fire_exit',
  PERSONNEL_GATE = 'personnel_gate',
}

export enum DoorType {
  ROLLING_SHUTTER = 'rolling_shutter',
  PERSONNEL = 'personnel',
  FIRE_EXIT = 'fire_exit',
}

// ============================================================
// 货物实体
// ============================================================

export interface Cargo {
  id: string;
  sku: string;
  type: CargoType;
  quantity: number;
  weight: number;       // kg
  dimensions: { w: number; h: number; d: number }; // cm
  status: CargoStatus;
  locationId: string;   // 当前所在货位/区域/AGV ID
  originOrderId?: string;
  destinationOrderId?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

// ============================================================
// 库存
// ============================================================

export interface InventorySlot {
  slotId: string;
  shelfZoneId: string;
  aisleId: string;
  level: number;
  position: number;     // 巷道内位置
  cargoId?: string;
  occupancy: number;    // 0-1
  maxCapacity: number;
}

export interface Inventory {
  slots: Map<string, InventorySlot>;
  totalSlots: number;
  occupiedSlots: number;
  utilization: number;
}

// ============================================================
// 仓库布局
// ============================================================

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect2D {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WallSegment {
  id: string;
  type: WallType;
  start: Point2D;
  end: Point2D;
  height: number;      // 墙高
  color?: string;
}

export interface Door {
  id: string;
  type: DoorType;
  position: Point2D;
  width: number;
  isOpen: boolean;
  relatedZoneId?: string;
}

// ============================================================
// 路网模型
// ============================================================

export interface RoadNode {
  id: string;
  position: Point2D;
  type: 'intersection' | 'junction' | 'station_entry' | 'charger_entry' | 'buffer_entry';
  reservationTable: ReservationEntry[];
}

export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  direction: RoadDirection;
  length: number;
  speedLimit: number;  // m/s
  capacity: number;    // 最大同时容纳车辆数
  currentOccupants: string[];  // 当前占用车辆ID
  isBlocked: boolean;
  blockReason?: string;
}

export interface Column {
  id: string;
  position: Point2D;
  size: number;
  height: number;
}

export interface Beam {
  id: string;
  start: Point2D;
  end: Point2D;
  height: number;
}

export interface ReservationEntry {
  edgeId: string;
  vehicleId: string;
  enterTime: number;
  exitTime: number;
}

export interface RoadNetwork {
  nodes: Map<string, RoadNode>;
  edges: Map<string, RoadEdge>;
  adjacency: Map<string, string[]>;  // node_id → neighbor_ids
}

// ============================================================
// 区域
// ============================================================

export interface WarehouseZone {
  id: string;
  name: string;
  type: ZoneType;
  bounds: Rect2D;
  color: string;
  capacity?: number;
  currentLoad?: number;
}

// ============================================================
// 货架系统
// ============================================================

export interface ShelfLevel {
  level: number;
  height: number;     // 离地高度 (m)
  slots: ShelfSlot[];
}

export interface ShelfSlot {
  slotId: string;
  position: number;   // 巷道内位置
  cargoId?: string;
  occupancy: number;  // 0-1
  maxWeight: number;  // kg
}

export interface ShelfAisle {
  aisleId: string;
  zoneId: string;
  levels: ShelfLevel[];
  length: number;
  width: number;
}

export interface ShelfZone {
  zoneId: string;
  name: string;
  type: 'high-bay' | 'low-pick' | 'pallet';
  aisles: ShelfAisle[];
  position: Point2D;
  dimensions: { w: number; h: number; d: number };
}

// ============================================================
// 设备
// ============================================================

export interface EquipmentBase {
  id: string;
  name: string;
  type: string;  // Use string to allow subclasses to override
  position: Point2D;
  state: 'idle' | 'working' | 'fault' | 'maintenance';
  activeTaskId?: string;
}

// --- AGV ---

export interface AGV extends EquipmentBase {
  type: 'tote_amr' | 'pallet_amr';
  battery: number;
  maxSpeed: number;       // m/s
  acceleration: number;   // m/s²
  turningRadius: number;  // m
  loadCapacity: number;   // kg
  currentLoad?: Cargo[];
  route: Point2D[];
  currentEdge?: string;
  nextReservationTime?: number;
}

// --- 机械臂 ---

export interface RoboticArm extends EquipmentBase {
  type: 'pick_arm' | 'pack_arm' | 'palletizing_arm';
  reachRadius: number;    // 工作半径 (m)
  maxReachHeight: number; // 最大伸高度 (m)
  minReachHeight: number; // 最低工作高度 (m)
  gripperWidth: number;   // 夹爪宽度 (m)
  currentPhase: ArmPhase;
  activeCargoId?: string;
  targetStationId?: string;
}

export type ArmPhase =
  | 'idle'
  | 'receiving_task'
  | 'move_to_pre_grasp'
  | 'descend'
  | 'grasp_close'
  | 'lift_with_cargo'
  | 'move_to_placement'
  | 'descend_for_placement'
  | 'release'
  | 'return_safe';

// --- 堆垛机 ---

export interface StackerCrane extends EquipmentBase {
  type: 'stacker_crane';
  aisleId: string;
  currentLevel: number;
  maxLevel: number;
  currentPosition: number;  // 巷道内位置
  liftSpeed: number;        // m/s
  travelSpeed: number;      // m/s
  maxLoad: number;          // kg
  currentLoad?: Cargo;
}

// --- 穿梭车 ---

export interface ShuttleCar extends EquipmentBase {
  type: 'shuttle_car';
  zoneId: string;
  currentLevel: number;
  currentPosition: number;
  maxLoad: number;
  currentLoad?: Cargo;
}

// --- 充电桩 ---

export interface Charger extends EquipmentBase {
  type: 'charger';
  powerRating: number;    // kW
  chargingRate: number;   // %/s
  currentAgvId?: string;
  queue: string[];
}

// --- 输送线 ---

export interface Conveyor extends EquipmentBase {
  type: 'conveyor';
  speed: number;          // m/s
  length: number;
  currentItems: string[]; // 当前在输送线上的货物ID
}

// ============================================================
// 任务
// ============================================================

export interface Task {
  id: string;
  type: 'inbound' | 'outbound' | 'relocate' | 'charge' | 'maintenance';
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  assignedEquipmentId?: string;
  cargoIds?: string[];
  fromLocation?: string;
  toLocation?: string;
  priority: 'high' | 'normal' | 'low';
  steps: TaskStep[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TaskStep {
  id: string;
  equipmentId: string;
  action: string;
  status: 'pending' | 'running' | 'completed';
  startTime?: number;
  endTime?: number;
  duration?: number;
}

// ============================================================
// 仿真快照 (完整)
// ============================================================

export interface DigitalTwinSnapshot {
  timestamp: number;
  // 路网
  roadNetwork: RoadNetwork;
  // 区域
  zones: WarehouseZone[];
  // 货架
  shelfZones: ShelfZone[];
  // 库存
  inventory: Inventory;
  // 货物
  cargos: Cargo[];
  // 设备
  agvs: AGV[];
  arms: RoboticArm[];
  stackerCrane: StackerCrane[];
  shuttleCars: ShuttleCar[];
  chargers: Charger[];
  conveyors: Conveyor[];
  // 任务
  tasks: Task[];
  // 指标
  metrics: SimulationMetrics;
  // 告警
  alerts: Alert[];
  // 时间线
  timeline: TimelineEntry[];
}

export interface SimulationMetrics {
  completedTasks: number;
  activeTasks: number;
  averageWaitSeconds: number;
  utilization: number;
  congestionScore: number;
  totalOrdersGenerated: number;
  activeChargers: number;
  faultCount: number;
  totalDistance: number;
  energyConsumption: number;
}

export interface Alert {
  id: string;
  type: 'collision_risk' | 'deadlock' | 'low_battery' | 'equipment_fault' | 'congestion' | 'queue_overflow';
  severity: 'info' | 'warn' | 'critical';
  message: string;
  relatedIds: string[];
  timestamp: number;
}

export interface TimelineEntry {
  time: number;
  event: string;
  type: 'order' | 'assign' | 'arrive' | 'handle' | 'charge' | 'fault' | 'recover' | 'complete' | 'reservation' | 'collision_avoidance';
  equipmentId?: string;
  taskId?: string;
  cargoId?: string;
}

// ============================================================
// 仓库配置
// ============================================================

export interface WarehouseConfig {
  width: number;
  height: number;
  ceilingHeight: number;
  wallThickness: number;
  zones: WarehouseZone[];
  shelfZones: ShelfZone[];
  roadNetwork: RoadNetwork;
  doors: Door[];
  walls: WallSegment[];
  safetyAreas: Rect2D[];
  columns: Column[];
  beams: Beam[];
}

export interface SimulationConfig {
  orderIntervalMin: number;
  orderIntervalMax: number;
  agvCount: { tote_amr: number; pallet_amr: number };
  chargerCount: number;
  armCount: { pick: number; pack: number; palletizing: number };
  craneCount: number;
  shuttleCount: number;
  batteryThreshold: number;
  batteryTarget: number;
  chargeRate: number;
  minSafetyDistance: number;  // 最小安全距离 (m)
  intersectionReservationWindow: number;  // 路口预约时间窗 (s)
  deadlockTimeout: number;    // 死锁超时 (s)
  maxRerouteAttempts: number; // 最大重规划次数
}
