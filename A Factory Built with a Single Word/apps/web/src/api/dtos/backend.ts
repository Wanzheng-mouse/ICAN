/**
 * 后端 FastAPI 原始响应 DTO
 *
 * 严格对应 services/api/app/main.py 的 Pydantic models。
 * 2026-07-15 与 main.py 第三周场景契约逐字段对齐。
 */

import type { SceneComponent } from '@ican/contracts';

// ===== Project =====
export interface ProjectRead {
  id: string;
  name: string;
  requirement: string;
  status: string;          // 'draft' | 'active'
  created_at: string;
}

export interface ProjectCreate {
  name: string;
  requirement?: string;
}

// ===== Template =====
export interface TemplateRead {
  id: string;
  category: string;
  title: string;
  description: string;
  cover: string;
  industry: string;
  difficulty: string;
  downloads: number;
  views: number;
  updatedAt: string;       // serialization_alias
}

export interface ScenarioData {
  components: SceneComponent[];
  canvas: { width: number; height: number; scale: number };
  schema_version: string;
}

export interface TemplateDetailRead extends TemplateRead {
  data: ScenarioData;
}

export interface TemplateApplyCreate {
  project_id: string;
  name?: string;
}

// ===== Scenario =====
export interface ScenarioRead {
  id: string;
  project_id: string;
  name: string;
  data: ScenarioData;
  version: number;
  updated_at: string;
}

export interface ScenarioCreate {
  project_id: string;
  name: string;
  data?: ScenarioData;
}

export interface ScenarioUpdate {
  name?: string;
  data: ScenarioData;
  expected_version?: number;
}

export interface ScenarioValidationIssue {
  code: string;
  message: string;
  component_ids: string[];
  field?: string;
}

export interface ScenarioValidationRead {
  valid: boolean;
  errors: ScenarioValidationIssue[];
  warnings: ScenarioValidationIssue[];
}

export interface ScenarioAutoLayoutRead {
  data: ScenarioData;
  validation: ScenarioValidationRead;
}

export interface ScenarioVersionRead {
  id: string;
  scenario_id: string;
  version: number;
  name: string;
  data: ScenarioData;
  created_at: string;
}
// ===== Simulation =====
export interface SimulationRobotRead {
  id: string;
  name: string;
  state: 'idle' | 'moving' | 'moving_to_charge' | 'charging';
  battery: number;
  position: { x: number; y: number };
  path: Array<{ x: number; y: number }>;
  path_index: number;
  current_task_id?: string | null;
  completed_tasks: number;
  wait_ticks: number;
}

export interface SimulationTaskRead {
  id: string;
  status: 'pending' | 'running' | 'completed';
  priority: 'high' | 'normal' | 'low';
  pickup: { x: number; y: number };
  dropoff: { x: number; y: number };
  assigned_robot_id?: string | null;
  progress: number;
}

export interface SimulationEventRead {
  id: string;
  type: string;
  level: 'info' | 'warn' | 'error' | 'success';
  time: string;
  message: string;
  source: string;
  data: Record<string, unknown>;
}

export interface SimulationRead {
  id: string;
  project_id: string;
  scenario_id: string;
  // 后端 schema 中 status 为自由字符串（str），此处以 string 接收，
  // 由 simulationReadToRun 归一为前端 RunStatus 联合类型。
  status: string;
  config: {
    robot_count: number;
    order_count: number;
    random_seed: number;
    engine_version?: string;
    // 后端 run.config 实际存储的字段（见 services/api 仿真持久化）
    scenario_snapshot?: unknown;
    scenario_version?: number;
    scenario_hash?: string;
    scene_robot_count?: number;
    fallback?: boolean;
  };
  metrics: Record<string, number>;
  events: SimulationEventRead[];
  robots: SimulationRobotRead[];
  tasks: SimulationTaskRead[];
  sim_time: number;
  created_at: string;
}

export interface SimulationTickMessage {
  type: 'simulation_tick';
  run_id: string;
  time: number;
  robots: SimulationRobotRead[];
  tasks: SimulationTaskRead[];
  events: SimulationEventRead[];
  metrics: Record<string, number>;
  generated_at?: string;
}

/**
 * 后端 WebSocket 实时帧的真实形状（与 SimulationTickMessage 不同）。
 *
 * 关键约定：
 * - `tasks` 是**聚合对象** `{ total, completed }`，不是数组 —— 不要对其调用
 *   数组方法（这正是此前 RuntimeSubView 崩溃的根因）。
 * - 逐条任务明细在 `task_items` 数组中。
 * - 下列 `Simulation*TickRead` 为实时帧逐元素形状，取代此前的 `any[]`，
 *   与 REST DTO（Simulation*Read）字段不同，由各自的消费组件负责映射。
 */
export interface SimulationRobotTickRead {
  id: string;
  name?: string;
  battery: number;
  state: 'idle' | 'charging' | 'to_pickup' | 'loading' | 'to_dropoff' | 'unloading' | 'returning' | 'blocked' | 'fault';
  x?: number;
  y?: number;
  route?: Array<{ x: number; y: number }>;
  load_status?: 'empty' | 'loaded';
  task_id?: string | null;
  completed_tasks?: number;
  wait_ticks?: number;
  lane?: number;
  path_strategy?: string;
  station_wait_seconds?: number;
  station_queue_wait_seconds?: number;
  waiting_seconds?: number;
}

export interface SimulationTaskTickRead {
  id: string;
  kind?: string;
  status: 'pending' | 'active' | 'completed';
  assigned_robot?: string | null;
  source?: string;
  destination?: string;
  priority?: number;
  waiting_seconds?: number;
  created_at?: number;
  started_at?: number;
  completed_at?: number;
}

export interface SimulationCargoTickRead {
  id: string;
  sku?: string;
  type?: string;
  quantity?: number;
  weight?: number;
  status?: string;
  location_id?: string;
  order_id?: string;
}

export interface ArmStateRead {
  id: string;
  station_id: string;
  state: 'idle' | 'working';
}

export interface SimulationEventTickRead {
  id?: string;
  type: string;
  description?: string;
  severity?: 'info' | 'warn' | 'error' | 'success';
  [key: string]: unknown;
}

export interface SimulationTickRead {
  type: 'simulation_tick';
  run_id: string;
  time: number;
  robots: SimulationRobotTickRead[];
  tasks: { total: number; completed: number; running?: number; pending?: number };
  task_items: SimulationTaskTickRead[];
  cargos: SimulationCargoTickRead[];
  stations: Record<string, unknown>;
  events: SimulationEventTickRead[];
  metrics: Record<string, number>;
  generated_at?: string;
  /** Per-arm live state from the backend (loading ↔ arm `working`). */
  arm_states?: ArmStateRead[];
}

export interface SimulationEventMessage {
  type: 'simulation_event';
  run_id: string;
  event: SimulationEventRead;
}

export interface SimulationCreate {
  project_id: string;
  scenario_id: string;
  scenario_version?: number;
  robot_count?: number;
  order_count?: number;
  random_seed?: number;
}

export interface SimulationControl {
  action: 'start' | 'pause' | 'stop';
}

export interface AnomalyCreate {
  type: 'road_closed' | 'low_battery' | 'order_surge' | 'station_down';
  description?: string;
}

// ===== Evolution =====
export interface EvolutionRead {
  id: string;
  simulation_id: string;
  diagnosis: Array<{ type: string; message: string }>;
  baseline_metrics: Record<string, unknown>;
  optimized_metrics: Record<string, unknown>;
  applied_scenario_id?: string | null;
  created_at: string;
}

export interface EvolutionCreate {
  simulation_id: string;
}

// ============================================================
// ===== P0-1 契约补齐全量 DTO（对齐 services/api/app/schemas.py）=====
//
// 此前这些 DTO 缺失导出，导致 generationApi / projectApi / simulationApi /
// Home 等模块 typecheck 失败。字段严格对应后端 Pydantic schema。
// 注意：SimulationAgentRead 的前端消费端 (agentReadToAgent) 读取的是
// AI-agent 语义字段，而后端 list_simulation_agents 实际返回运营遥测
// (battery/position/completed_tasks)，二者存在运行时契约偏差，已记录待修。
// ============================================================

// ----- Project -----
export interface ProjectUpdate {
  name?: string | null;
  requirement?: string | null;
  status?: 'draft' | 'active' | 'archived' | null;
}

export interface ProjectMemberUpsert {
  identity: string;
  role?: 'operator' | 'viewer';
}

export interface ProjectMemberRead {
  user_id: string;
  login_name: string;
  name: string;
  email: string;
  role: string;
}

export interface ProjectFileRead {
  id: string;
  project_id: string;
  filename: string;
  content_type: string;
  size: number;
  kind: string;
  created_at: string;
  download_url: string;
}

export interface ProjectWorkspaceRead {
  project: ProjectRead;
  scenarios: ScenarioRead[];
  files: ProjectFileRead[];
}

// ----- Requirement analysis -----
export interface RequirementAnalyzeCreate {
  requirement: string;
  project_id?: string | null;
  sources?: Array<{ kind: 'floorplan' | 'orders' | 'robot' | 'rules' | 'other'; name: string }>;
}

export interface RequirementAnalysisRead {
  job_id: string;
  status: string;
  summary?: string;
  analysis_method?: string;
  profile: Record<string, unknown>;
  assumptions: string[];
  questions: string[];
  risks: string[];
  confidence?: number;
  source_summary?: string[];
  operational_design?: Record<string, string>;
}

// ----- Generation -----
export interface GenerationCandidateRead {
  id: string;
  title: string;
  strategy: string;
  description: string;
  template_id?: string | null;
  suitability?: number;
  reasons?: string[];
  cautions?: string[];
  expected_metrics?: Record<string, number>;
  data: ScenarioData;
}

export interface GenerationCandidatesRead {
  job_id: string;
  status: string;
  candidates: GenerationCandidateRead[];
}

// ----- Simulation agents -----
// 前端消费端 agentReadToAgent 期望 AI-agent 语义字段；后端实际返回运营遥测字段
// （见下方可选字段），运行时需进一步统一。
export interface SimulationAgentRead {
  id: string;
  name: string;
  status: string;
  role: string;
  load: number;
  successRate: number;
  taskCount: number;
  responseTime: string;
  // 后端 list_simulation_agents 实际返回字段（运营遥测），与上方语义字段并存待统一
  battery?: number;
  position?: { x: number; y: number };
  task_id?: string | null;
  completed_tasks?: number;
  total_distance?: number;
}

// ----- Evolution -----
export interface EvolutionApplyRead {
  evolution_id: string;
  project_id: string;
  scenario: ScenarioRead;
  changes: string[];
}
