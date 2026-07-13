/**
 * 后端 FastAPI 原始响应 DTO
 * 严格对应 services/api/app/main.py 的 Pydantic models。
 * 非预期字段在此删除，前端不虚构后端不存在的字段。
 */

// ===== Project =====
export interface ProjectRead {
  id: string;
  name: string;
  requirement: string;     // 后端用 requirement 而非 description
  status: string;          // 'active' | 'archived'
  owner: string;           // user.id
  created_at: string;      // ISO 8601
}

export interface ProjectCreate {
  name: string;
  requirement?: string;
}

// ===== Scenario =====
export interface ScenarioRead {
  id: string;
  project_id: string;
  name: string;
  data: Record<string, unknown>;  // 嵌套 JSON
}

export interface ScenarioData {
  components: unknown[];
  canvas: { width: number; height: number; scale: number };
  schema_version: string;
}

export interface ScenarioCreate {
  project_id: string;
  name: string;
  data: ScenarioData;
}

export interface ScenarioUpdate {
  data: ScenarioData;
}

// ===== Simulation =====
export interface SimulationRead {
  id: string;
  project_id: string;
  scenario_id: string;
  status: 'created' | 'running' | 'paused' | 'finished' | 'failed';
  metrics: SimulationMetrics | null;
  config: SimulationConfig;
  events: SimulationStreamEvent[];
  created_at: string;
}

export interface SimulationMetrics {
  completion_rate: number;
  average_duration: number;
  congestion_count: number;
}

export interface SimulationConfig {
  robot_count: number;
  order_count: number;
  speed: number;
}

export interface SimulationStreamEvent {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  time: string;
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

export interface AnomalyInject {
  type: string;
}

// ===== Evolution =====
export interface EvolutionRead {
  id: string;
  simulation_id: string;
  diagnosis: EvolutionDiagnosis[];
  baseline_metrics: SimulationMetrics;
  optimized_metrics: SimulationMetrics;
  created_at: string;
}

export interface EvolutionDiagnosis {
  level: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

export interface EvolutionCreate {
  simulation_id: string;
}

// ===== Report =====
export interface ReportPdfResponse {
  url: string;
}
