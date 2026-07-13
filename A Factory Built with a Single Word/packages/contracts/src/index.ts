/**
 * 共享类型契约 - 前后端共用
 * 任何字段变更需要走 PR 评审，并升级 schema_version
 */

export const SCHEMA_VERSION = '1.0';

// ============================================================
// 基础枚举
// ============================================================

export type RobotStatus = 'idle' | 'moving' | 'picking' | 'charging' | 'fault';
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'abnormal';
export type RunStatus = 'created' | 'running' | 'paused' | 'finished' | 'failed';
export type AnomalyType = 'road_closed' | 'low_battery' | 'order_surge' | 'station_down';
export type RiskLevel = 'high' | 'medium' | 'low';
export type ScenarioType = 'ecom' | 'coldchain' | '3c' | 'medical';
export type SceneTemplateCategory = 'scene' | 'strategy' | 'report' | 'device' | 'case' | 'doc';

// ============================================================
// 项目 / 场景
// ============================================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  scenarioId?: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

export interface SceneTemplate {
  id: string;
  category: SceneTemplateCategory;
  title: string;
  description: string;
  cover: string;
  industry: string;
  difficulty: 'easy' | 'medium' | 'hard';
  downloads: number;
  views: number;
  updatedAt: string;
  downloadsLabel?: string;
  viewsLabel?: string;
}

export interface Scenario {
  schema_version: string;
  scenarioId: string;
  name: string;
  type: ScenarioType;
  canvas: { width: number; height: number; scale: number };
  shelves: Shelf[];
  stations: Station[];
  chargingStations: ChargingStation[];
  robots: Robot[];
  nodes: PathNode[];
  edges: PathEdge[];
  restrictedAreas: RestrictedArea[];
}

export interface Shelf {
  id: string;
  name: string;
  zone: 'A' | 'B' | 'C' | 'D' | string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  capacity: number;
  doubleSided: boolean;
}

export interface Station {
  id: string;
  name: string;
  type: 'pick' | 'pack' | 'sort';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChargingStation {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface PathNode {
  id: string;
  x: number;
  y: number;
}

export interface PathEdge {
  from: string;
  to: string;
  bidirectional: boolean;
  weight?: number;
}

export interface RestrictedArea {
  id: string;
  shape: 'rect' | 'polygon';
  points: Array<{ x: number; y: number }>;
  reason?: string;
}

// ============================================================
// 机器人 / 任务
// ============================================================

export interface Robot {
  id: string;
  name: string;
  type: 'AGV' | 'arm' | 'conveyor';
  status: RobotStatus;
  battery: number;
  position: { x: number; y: number };
  currentTaskId?: string;
  loadKg?: number;
  mileage?: number;
}

export interface Task {
  id: string;
  type: 'pick' | 'pack' | 'charge' | 'move';
  fromStationId?: string;
  toStationId?: string;
  status: TaskStatus;
  assignedRobotId?: string;
  priority: 'high' | 'normal' | 'low';
  progress: number;
  eta: string;
  createdAt: string;
}

// ============================================================
// 仿真运行
// ============================================================

export interface SimulationRun {
  id: string;
  projectId: string;
  scenarioId: string;
  status: RunStatus;
  startTime: string;
  endTime?: string;
  speed: number;
  randomSeed: number;
  version: string;
  strategy: string;
  totalOrders: number;
  completedOrders: number;
}

export interface SimulationMetrics {
  completionRate: number;
  averageDuration: number;
  congestionCount: number;
  emptyRate: number;
  energy: number;
  robotUtilization: number;
  faultRecoveryRate: number;
}

export interface SimulationTick {
  type: 'simulation_tick';
  runId: string;
  time: number;
  robots: Robot[];
  tasks: Task[];
  events: SimulationEvent[];
  metrics: SimulationMetrics;
}

export interface SimulationEvent {
  id: string;
  level: 'info' | 'warn' | 'error' | 'success';
  time: string;
  message: string;
  source?: string;
}

// ============================================================
// 智能体
// ============================================================

export interface Agent {
  id: string;
  name: string;
  role: 'dispatch' | 'navigation' | 'operation' | 'energy' | 'safety' | 'evaluation' | 'report';
  status: 'running' | 'paused' | 'fault';
  load: number;
  latency: number;
  successRate: number;
  isPrimary?: boolean;
  details: Array<{ label: string; value: string | number; unit?: string }>;
  sparkline: number[];
}

export interface AgentFlowNode {
  id: string;
  label: string;
  index: number;
  status: 'completed' | 'running' | 'pending' | 'abnormal' | 'monitoring';
  x: number;
  y: number;
  description: string;
}

export interface AgentFlowEdge {
  from: string;
  to: string;
  dashed?: boolean;
  isAbnormal?: boolean;
}

// ============================================================
// 方案进化
// ============================================================

export interface EvolutionVersion {
  version: string;
  label: string;
  time: string;
  description: string;
  isCurrent?: boolean;
}

export interface EvolutionIssue {
  level: RiskLevel;
  title: string;
  description: string;
  foundIn: string;
}

export interface EvolutionAction {
  title: string;
  description: string;
  applied: boolean;
  version: string;
}

export interface EvolutionMetricDiff {
  metric: string;
  before: number;
  after: number;
  unit: string;
  delta: number;
  isPercent: boolean;
  isImprovement: boolean;
}

export interface EvolutionReport {
  id: string;
  title: string;
  status: 'evolving' | 'completed' | 'failed';
  generatedAt: string;
  scenarioType: ScenarioType;
  scale: string;
  goal: string;
  metrics: EvolutionMetricDiff[];
  issues: EvolutionIssue[];
  actions: EvolutionAction[];
  versions: EvolutionVersion[];
}

// ============================================================
// 报告 / KPI
// ============================================================

export interface KpiCardData {
  title: string;
  value: string | number;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  trend?: 'up' | 'down' | 'flat';
  iconColor?: string;
}

export interface ReportTrendPoint {
  date: string;
  completionRate: number;
  congestionRate: number;
  energy: number;
}

export interface ReportAnomalyBucket {
  type: string;
  count: number;
  percent: number;
  color: string;
}

export interface ReportSceneRanking {
  rank: number;
  scene: string;
  completionRate: number;
  congestionRate: number;
  energy: number;
}

export interface FulfillmentDay {
  date: string;
  onTime: number;
  delayed: number;
  unfinished: number;
  fulfillmentRate: number;
}

export interface DeviceUsage {
  deviceId: string;
  type: 'AGV' | 'arm';
  utilization: number;
  mileage: number;
  tasks: number;
  faults: number;
}

// ============================================================
// 上传文件
// ============================================================

export type UploadSlot = 'floorplan' | 'orders' | 'robot' | 'rules';

export interface UploadItem {
  slot: UploadSlot;
  title: string;
  description: string;
  accept: string;
  iconColor: string;
  iconName: string;
}

export interface UploadedFile {
  slot: UploadSlot;
  filename: string;
  size: number;
  uploadedAt: string;
}

export interface GenerationStep {
  index: number;
  title: string;
  description: string;
}

export interface FeatureItem {
  iconColor: string;
  iconName: string;
  title: string;
  description: string;
}

export interface TemplateCard {
  title: string;
  description: string;
  cover: string;
  tag: string;
}

export interface LearningPathStep {
  index: number;
  title: string;
  description: string;
  duration: string;
  resourceCount: number;
}

export interface HotResource {
  rank: number;
  name: string;
  downloads: string;
  views: number;
}

export interface FeaturedCase {
  title: string;
  description: string;
  efficiency?: string;
  manpower?: string;
  roi?: string;
  energy?: string;
  temperature?: string;
  complaint?: string;
  audit?: string;
  risk?: string;
  time?: string;
  cover: string;
}

export interface ResourceCategory {
  key: string;
  label: string;
}

// ============================================================
// 场景编辑器
// ============================================================

export interface ComponentLibraryItem {
  category: 'shelf' | 'agv' | 'arm' | 'conveyor' | 'station' | 'charger' | 'obstacle';
  name: string;
  spec: string;
  count: number;
  size?: { width: number; depth: number; height: number };
  iconColor: string;
}

export interface SceneComponent {
  id: string;
  type: ComponentLibraryItem['category'];
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  properties: Record<string, string | number | boolean>;
}

export interface OperationLog {
  time: string;
  user: string;
  action: string;
  target?: string;
  details?: string;
}

export interface SceneOverviewStats {
  shelves: number;
  agvs: number;
  arms: number;
  stations: number;
  totalArea: number;
  passableRate: number;
  shelvesArea: number;
  agvOnlines: number;
  agvOffline: number;
  stationTypes: string;
  canvasSize: string;
  passableArea: number;
}
