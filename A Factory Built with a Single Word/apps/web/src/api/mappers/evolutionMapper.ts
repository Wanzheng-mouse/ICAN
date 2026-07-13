import type { EvolutionRead } from '@/api/dtos/backend';
import type { EvolutionReport } from '@ican/contracts';

export function evolutionReadToReport(read: EvolutionRead): EvolutionReport {
  return {
    id: read.id,
    title: '方案进化报告',
    status: 'completed',
    generatedAt: read.created_at,
    scenarioType: 'ecom',
    scale: '—',
    goal: '—',
    metrics: [],
    issues: (read.diagnosis ?? []).map((d) => ({
      level: d.level,
      title: d.title,
      description: d.description,
      foundIn: read.created_at,
    })),
    actions: [],
    versions: [
      { version: 'v1.0', label: '初始方案', time: read.created_at, description: '基于用户需求生成' },
      { version: 'v2.0', label: '综合进化', time: read.created_at, description: '综合优化各维度指标', isCurrent: true },
    ],
  };
}
