import type { SimulationRead } from '@/api/dtos/backend';
import type { SimulationRun } from '@ican/contracts';

export function simulationReadToRun(read: SimulationRead): SimulationRun {
  return {
    id: read.id,
    projectId: read.project_id,
    scenarioId: read.scenario_id,
    status: read.status as SimulationRun['status'],
    startTime: read.created_at,
    endTime: '',
    speed: 1,
    randomSeed: read.config.random_seed,
    version: '1.0',
    strategy: '',
    totalOrders: (read.config?.order_count as number) ?? 0,
    completedOrders: 0,
  };
}
