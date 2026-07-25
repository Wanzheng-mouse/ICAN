import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import { isMockEnabled } from '@/api/mockConfig';
import { apiUrl } from '@/utils/apiUrl';

const USE_MOCK = isMockEnabled('dashboard');

export interface DashboardKpis {
  projects: number;
  scenarios: number;
  simulations: number;
  active_simulations: number;
  average_completion_rate: number;
  average_energy: number;
  recent_runs: Array<{ id: string; status: string; completion_rate: number; created_at: string }>;
}

const MOCK_PROJECTS_KEY = 'ican-mock-project-workspaces-v1';

interface MockProjectRecord {
  project: { id: string; name: string; status: string; created_at: string };
  scenarios: Array<{ id: string; name: string; updated_at: string }>;
}

const SEED_PROJECTS = [
  { id: 'proj-seed-ecom', name: '电商华南枢纽二期', status: 'active', created_at: '2026-07-20T08:00:00Z' },
  { id: 'proj-seed-coldchain', name: '冷链华东中心', status: 'active', created_at: '2026-07-18T10:30:00Z' },
  { id: 'proj-seed-3c', name: '3C 电子制造北区', status: 'draft', created_at: '2026-07-22T14:00:00Z' },
];

const SEED_SCENARIOS: Record<string, Array<{ id: string; name: string; updated_at: string }>> = {
  'proj-seed-ecom': [
    { id: 'scn-seed-ecom-v1', name: '电商中型仓-双波次拣选', updated_at: '2026-07-21T09:00:00Z' },
    { id: 'scn-seed-ecom-v2', name: '电商大型仓-四波次拣选', updated_at: '2026-07-22T11:00:00Z' },
  ],
  'proj-seed-coldchain': [
    { id: 'scn-seed-cold-v1', name: '冷链双温区模板', updated_at: '2026-07-19T14:00:00Z' },
  ],
  'proj-seed-3c': [],
};

function ensureSeedData(): MockProjectRecord[] {
  try {
    const raw = localStorage.getItem(MOCK_PROJECTS_KEY);
    if (raw && JSON.parse(raw).length > 0) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const seed: MockProjectRecord[] = SEED_PROJECTS.map((p) => ({
    project: p,
    scenarios: SEED_SCENARIOS[p.id] ?? [],
    files: [],
  }));
  localStorage.setItem(MOCK_PROJECTS_KEY, JSON.stringify(seed));
  return seed;
}

function computeDashboardKpis(): DashboardKpis {
  const records = ensureSeedData();
  const allScenarios = records.flatMap((r) => r.scenarios);
  return {
    projects: records.length,
    scenarios: allScenarios.length,
    simulations: Math.max(records.length * 2, 5),
    active_simulations: records.filter((r) => r.project.status === 'active').length,
    average_completion_rate: 0.87,
    average_energy: 142.5,
    recent_runs: [
      { id: `${records[0]?.project.id ?? 'proj'}-run-1`, status: 'completed', completion_rate: 0.96, created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: `${records[0]?.project.id ?? 'proj'}-run-2`, status: 'running', completion_rate: 0.72, created_at: new Date().toISOString() },
    ],
  };
}

export function getDashboardKpis(): Promise<DashboardKpis> {
  if (USE_MOCK) return Promise.resolve(computeDashboardKpis());
  return request({ url: apiUrl('/dashboard/kpis') });
}

export function useDashboardKpis() {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: getDashboardKpis,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
