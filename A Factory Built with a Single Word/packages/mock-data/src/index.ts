export * from './home';
export * from './simulation';
export * from './evolution';
export * from './report';
export * from './orchestration';
export * from './editor';

import type { SimulationTick } from '@ican/contracts';

/** 仿真 tick 生成器（用于仿真空间 + 任务编排演示） */
export function createMockSimulationTick(runId: string, time: number): SimulationTick {
  const completion = Math.min(0.99, 0.5 + time / 10000);
  const congestion = Math.max(0, 8 - time / 1500);
  return {
    type: 'simulation_tick',
    runId,
    time,
    robots: [
      { id: 'AGV-001', name: 'AGV-001', type: 'AGV', status: 'moving', battery: 78, position: { x: 200 + time % 400, y: 200 } },
      { id: 'AGV-002', name: 'AGV-002', type: 'AGV', status: 'moving', battery: 65, position: { x: 400, y: 300 + (time / 2) % 200 } },
      { id: 'AGV-003', name: 'AGV-003', type: 'AGV', status: 'charging', battery: 24, position: { x: 540, y: 580 } },
      { id: 'AGV-004', name: 'AGV-004', type: 'AGV', status: 'idle', battery: 92, position: { x: 800, y: 400 } },
    ],
    tasks: [],
    events: [
      { id: `e-${time}`, level: 'info', time: new Date().toISOString(), message: `Tick ${time}` },
    ],
    metrics: {
      completionRate: Number(completion.toFixed(3)),
      averageDuration: 120 + Math.random() * 10,
      congestionCount: Math.round(congestion),
      emptyRate: 0.18,
      energy: 26.2,
      robotUtilization: 0.78,
      faultRecoveryRate: 0.96,
    },
  };
}
