import { describe, expect, it } from 'vitest';
import type { SimulationRead } from '@/api/dtos/backend';
import { simulationReadToRun } from './simulationMapper';

describe('第四阶段仿真 Mapper', () => {
  it('映射真实运行 ID、配置、状态和完成订单', () => {
    const read: SimulationRead = {
      id: 'sim-1',
      project_id: 'project-1',
      scenario_id: 'scenario-1',
      status: 'running',
      config: { order_count: 20, robot_count: 10, random_seed: 42, speed: 2 },
      metrics: { completion_rate: 0.45 },
      events: [],
      created_at: '2026-07-18T12:00:00Z',
    };
    expect(simulationReadToRun(read)).toMatchObject({
      id: 'sim-1',
      projectId: 'project-1',
      scenarioId: 'scenario-1',
      status: 'running',
      speed: 2,
      randomSeed: 42,
      totalOrders: 20,
      completedOrders: 9,
    });
  });

  it('把后端 stopped/completed 状态归一为前端 finished', () => {
    const base: SimulationRead = {
      id: 'sim-2', project_id: 'p', scenario_id: 's', status: 'stopped',
      config: {}, metrics: {}, events: [], created_at: '',
    };
    expect(simulationReadToRun(base).status).toBe('finished');
    expect(simulationReadToRun({ ...base, status: 'completed' }).status).toBe('finished');
  });
});
