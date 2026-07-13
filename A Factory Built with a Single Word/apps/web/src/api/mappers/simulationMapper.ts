import type { SimulationRead, SimulationMetrics } from '@/api/dtos/backend';
import type { SimulationRun } from '@ican/contracts';

export function simulationReadToRun(read: SimulationRead): SimulationRun {
  return {
    id: read.id,
    projectId: read.project_id,
    scenarioId: read.scenario_id,
    status: read.status,
    startTime: read.created_at,
    endTime: '',
    speed: read.config?.speed ?? 1,
    randomSeed: 0,
    version: '1.0',
    strategy: '',
    totalOrders: read.config?.order_count ?? 0,
    completedOrders: 0,
  };
}

export function metricsToKpiValues(metrics: SimulationMetrics) {
  return {
    completionRate: metrics.completion_rate * 100,
    averageDuration: metrics.average_duration,
    congestionCount: metrics.congestion_count,
    emptyRate: 0,
    energy: 0,
    robotUtilization: 0,
    faultRecoveryRate: 0,
  };
}
