import type { EvolutionRead } from '@/api/dtos/backend';
import type { EvolutionReport } from '@ican/contracts';

export function evolutionReadToReport(read: EvolutionRead): EvolutionReport {
  const baseline = read.baseline_metrics ?? {};
  const optimized = read.optimized_metrics ?? {};
  const metricDefinitions = [
    { key: 'completion_rate', label: '订单完成率', unit: '%', percent: true, higherIsBetter: true },
    { key: 'average_duration', label: '平均完成时长', unit: 's', percent: false, higherIsBetter: false },
    { key: 'congestion_count', label: '拥堵次数', unit: '次', percent: false, higherIsBetter: false },
    { key: 'energy', label: '能耗', unit: 'kWh', percent: false, higherIsBetter: false },
    { key: 'device_utilization', label: '设备利用率', unit: '%', percent: true, higherIsBetter: true },
  ] as const;
  const metrics = metricDefinitions.flatMap((definition) => {
    const beforeRaw = baseline[definition.key];
    const afterRaw = optimized[definition.key];
    if (typeof beforeRaw !== 'number' || typeof afterRaw !== 'number') return [];
    const before = definition.percent ? beforeRaw * 100 : beforeRaw;
    const after = definition.percent ? afterRaw * 100 : afterRaw;
    return [{
      metric: definition.label,
      before: Number(before.toFixed(2)),
      after: Number(after.toFixed(2)),
      unit: definition.unit,
      delta: Number((after - before).toFixed(2)),
      isPercent: definition.percent,
      isImprovement: definition.higherIsBetter ? after >= before : after <= before,
    }];
  });
  return {
    id: read.id,
    title: '方案进化报告',
    status: 'completed',
    generatedAt: read.created_at,
    scenarioType: 'ecom',
    scale: '—',
    goal: '—',
    metrics,
    issues: (read.diagnosis ?? []).map((d) => ({
      level: d.type === 'congestion' ? 'high' : d.type === 'energy' ? 'medium' : 'low',
      title: d.type,
      description: d.message,
      foundIn: read.created_at,
    })),
    actions: metrics.map((metric) => ({
      title: `${metric.metric}优化`,
      description: `${metric.before}${metric.unit} → ${metric.after}${metric.unit}`,
      applied: Boolean(read.applied_scenario_id),
      version: read.applied_scenario_id ? 'v2.0' : '待应用',
    })),
    versions: [
      { version: 'v1.0', label: '初始方案', time: read.created_at, description: '基于用户需求生成' },
      { version: 'v2.0', label: '综合进化', time: read.created_at, description: '综合优化各维度指标', isCurrent: true },
    ],
  };
}
