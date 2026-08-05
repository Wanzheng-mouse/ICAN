import type { SimulationRead } from '@/api/dtos/backend';
import type { SimulationRun, RunStatus } from '@ican/contracts';

// 后端 SimulationRead.status 为自由字符串，此处归一为前端 RunStatus。
const RUN_STATUS_MAP: Record<string, RunStatus> = {
  created: 'created',
  running: 'running',
  paused: 'paused',
  stopped: 'finished',
  completed: 'finished',
  finished: 'finished',
  failed: 'failed',
};

export function simulationReadToRun(read: SimulationRead): SimulationRun {
  const status = RUN_STATUS_MAP[read.status] ?? 'finished';
  const completionRate = Number(read.metrics?.completion_rate ?? 0);
  const totalOrders = (read.config?.order_count as number) ?? 0;
  const completedOrders = completionRate > 0 ? Math.round(completionRate * totalOrders) : 0;
  return {
    id: read.id,
    projectId: read.project_id,
    scenarioId: read.scenario_id,
    status,
    startTime: read.created_at,
    endTime: '',
    speed: 1,
    randomSeed: read.config?.random_seed ?? 0,
    version: '1.0',
    strategy: '',
    totalOrders,
    completedOrders,
  };
}
