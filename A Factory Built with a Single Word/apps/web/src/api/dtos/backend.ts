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
export interface SimulationRead {
  id: string;
  project_id: string;
  scenario_id: string;
  status: string;
  config: Record<string, unknown>;   // { robot_count, order_count }
  metrics: Record<string, unknown>;  // { completion_rate, average_duration, congestion_count, energy }
  events: Array<Record<string, unknown>>;  // [{ type, description, severity }]
  created_at: string;
}

export interface SimulationCreate {
  project_id: string;
  scenario_id: string;
  robot_count?: number;
  order_count?: number;
}

export interface SimulationControl {
  action: 'start' | 'pause' | 'stop';
}

export interface AnomalyCreate {
  type: 'road_closed' | 'low_battery' | 'order_surge';
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
