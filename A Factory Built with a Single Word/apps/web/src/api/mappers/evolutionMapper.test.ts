import { describe, expect, it } from 'vitest';
import { evolutionReadToReport } from './evolutionMapper';

describe('进化结果映射', () => {
  it('使用后端基线和优化指标生成真实前后对比', () => {
    const report = evolutionReadToReport({
      id: 'evolution-1',
      simulation_id: 'simulation-1',
      diagnosis: [{ type: 'congestion', message: '通道存在拥堵' }],
      baseline_metrics: {
        completion_rate: 0.72,
        average_duration: 120,
        congestion_count: 10,
        energy: 20,
      },
      optimized_metrics: {
        completion_rate: 0.9,
        average_duration: 96,
        congestion_count: 6,
        energy: 17,
      },
      created_at: '2026-07-18T12:00:00Z',
    });

    expect(report.id).toBe('evolution-1');
    expect(report.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: '订单完成率', before: 72, after: 90, isImprovement: true }),
      expect.objectContaining({ metric: '拥堵次数', before: 10, after: 6, isImprovement: true }),
      expect.objectContaining({ metric: '能耗', before: 20, after: 17, isImprovement: true }),
    ]));
    expect(report.issues[0].description).toBe('通道存在拥堵');
    expect(report.actions[0].applied).toBe(false);

    const applied = evolutionReadToReport({
      id: 'evolution-1',
      simulation_id: 'simulation-1',
      diagnosis: [{ type: 'congestion', message: '通道存在拥堵' }],
      baseline_metrics: { completion_rate: 0.72 },
      optimized_metrics: { completion_rate: 0.9 },
      applied_scenario_id: 'scenario-v2',
      created_at: '2026-07-18T12:00:00Z',
    });
    expect(applied.actions[0].applied).toBe(true);
  });
});
