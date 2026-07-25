import { describe, expect, it } from 'vitest';
import { isSimulationTick, resolveSimulationWsUrl } from './useSimulationStream';

describe('第四阶段仿真实时流', () => {
  it('只接受符合后端契约的 simulation_tick', () => {
    expect(isSimulationTick({
      type: 'simulation_tick',
      run_id: 'sim-1',
      time: 8,
      robots: [],
      tasks: { total: 20, completed: 4 },
      events: [],
      metrics: { completion_rate: 0.2, average_duration: 100, congestion_count: 0, energy: 3 },
      generated_at: new Date().toISOString(),
    })).toBe(true);
    expect(isSimulationTick({ type: 'simulation_tick', time: '8' })).toBe(false);
    expect(isSimulationTick({ type: 'unknown' })).toBe(false);
  });

  it('WebSocket 地址包含真实 simulationId', () => {
    const url = resolveSimulationWsUrl('sim-real-123', 'token with spaces');
    expect(url).toContain('/api/v1/simulations/sim-real-123/stream');
    expect(url).toContain('token=token%20with%20spaces');
  });
});
