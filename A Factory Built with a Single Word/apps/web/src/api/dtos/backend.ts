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
  status: 'created' | 'running' | 'paused' | 'stopped' | 'finished';
  config: { robot_count: number; order_count: number; random_seed: number; engine_version?: string };
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
}

export interface SimulationEventMessage {
  type: 'simulation_event';
  run_id: string;
  event: SimulationEventRead;
}

export interface SimulationCreate {
  project_id: string;
  scenario_id: string;
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
  created_at: string;
}

export interface EvolutionCreate {
  simulation_id: string;
}
