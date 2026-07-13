export interface SearchResult {
  id: string;
  type: 'project' | 'scene' | 'report' | 'template';
  title: string;
  description: string;
  url: string;
}

const MOCK_INDEX: SearchResult[] = [
  { id: 'p1', type: 'project', title: '电商华南枢纽二期', description: '华南区电商仓储智能化升级项目', url: '/simulation?simulationId=sim-001' },
  { id: 'p2', type: 'project', title: '冷链华东中心', description: '华东冷链物流中心建设项目', url: '/simulation?simulationId=sim-002' },
  { id: 's1', type: 'scene', title: '电商中型仓-双波次拣选', description: '适用于日均 1-5 万单的电商中型仓库', url: '/editor?projectId=p1&scenarioId=s1' },
  { id: 's2', type: 'scene', title: '冷链双温区模板', description: '双温区隔离与温控策略配置', url: '/editor?projectId=p2&scenarioId=s2' },
  { id: 'r1', type: 'report', title: '2026 年第 28 周运行报告', description: '电商华南枢纽二期周报', url: '/report?simulationId=sim-001' },
  { id: 'r2', type: 'report', title: '方案进化报告：电商仓 v2.0', description: '方案进化对比与优化指标', url: '/evolution?evolutionId=ev-001' },
  { id: 't1', type: 'template', title: 'AGV 拥堵优化策略', description: '基于路径重规划与分区调度', url: '/resource' },
  { id: 't2', type: 'template', title: '多 AGV 调度示例', description: '多 AGV 协同调度策略', url: '/resource' },
];

export function searchIndex(query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return MOCK_INDEX.filter(
    (item) => item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
  );
}
