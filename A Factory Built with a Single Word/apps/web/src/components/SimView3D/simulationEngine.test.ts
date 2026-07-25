import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from './simulationEngine';

describe('SimulationEngine traffic geometry', () => {
  it('dispatches at least one AGV out of its dedicated parking bay', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new SimulationEngine({ orderIntervalMin: 2, orderIntervalMax: 2 });
    let snapshot = engine.tick(0.1);

    // The first tick creates work; subsequent ticks dispatch and advance it.
    for (let index = 0; index < 240; index += 1) snapshot = engine.tick(0.1);

    const active = snapshot.agvs.filter((agv) => agv.state !== 'idle' && agv.state !== 'fault');
    expect(snapshot.agvs.some((agv) => agv.totalDistance > 1)).toBe(true);
    expect(active.length).toBeGreaterThan(0);
    expect(active.length).toBeLessThanOrEqual(3);
    random.mockRestore();
  });

  it('keeps long-running routes clear of walls and physical overlap', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new SimulationEngine({ orderIntervalMin: 2, orderIntervalMax: 2 });
    const wallBlocks = new Set<string>();
    let minimumMovingDistance = Number.POSITIVE_INFINITY;
    let snapshot = engine.tick(0.1);

    for (let index = 0; index < 1_200; index += 1) {
      snapshot = engine.tick(0.1);
      for (const entry of snapshot.timeline) {
        if (entry.event.includes('路径被') || entry.event.includes('阻挡')) wallBlocks.add(entry.event);
      }
      const traffic = snapshot.agvs.filter((agv) => agv.state !== 'fault');
      for (let left = 0; left < traffic.length; left += 1) {
        for (let right = left + 1; right < traffic.length; right += 1) {
          const dx = traffic[left].position.x - traffic[right].position.x;
          const dy = traffic[left].position.y - traffic[right].position.y;
          minimumMovingDistance = Math.min(minimumMovingDistance, Math.hypot(dx, dy));
        }
      }
    }

    expect([...wallBlocks]).toEqual([]);
    expect(minimumMovingDistance).toBeGreaterThanOrEqual(72);
    expect(snapshot.metrics.completedTasks).toBeGreaterThan(0);
    random.mockRestore();
  });

  it('stays collision-free under mixed inbound/outbound surge traffic', () => {
    let seed = 0x1a2b3c4d;
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed / 0x1_0000_0000;
    });
    const engine = new SimulationEngine({ orderIntervalMin: 1.5, orderIntervalMax: 3 });
    engine.injectOrderSurge();
    const wallBlocks = new Set<string>();
    let minimumDistance = Number.POSITIVE_INFINITY;
    let snapshot = engine.tick(0.1);

    for (let index = 0; index < 3_000; index += 1) {
      snapshot = engine.tick(0.1);
      for (const entry of snapshot.timeline) {
        if (entry.event.includes('路径被') || entry.event.includes('阻挡')) wallBlocks.add(entry.event);
      }
      for (let left = 0; left < snapshot.agvs.length; left += 1) {
        for (let right = left + 1; right < snapshot.agvs.length; right += 1) {
          const a = snapshot.agvs[left].position;
          const b = snapshot.agvs[right].position;
          minimumDistance = Math.min(minimumDistance, Math.hypot(a.x - b.x, a.y - b.y));
        }
      }
    }

    expect([...wallBlocks]).toEqual([]);
    expect(minimumDistance).toBeGreaterThanOrEqual(72);
    expect(snapshot.metrics.totalOrdersGenerated).toBeGreaterThan(20);
    expect(snapshot.metrics.completedTasks).toBeGreaterThan(0);
    expect(snapshot.agvs.some((agv) => agv.totalDistance > 100)).toBe(true);
    random.mockRestore();
  });
});
