import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';

export interface DashboardKpis {
  projects: number;
  scenarios: number;
  simulations: number;
  active_simulations: number;
  average_completion_rate: number;
  average_energy: number;
  recent_runs: Array<{ id: string; status: string; completion_rate: number; created_at: string }>;
}

export function getDashboardKpis(): Promise<DashboardKpis> {
  // Always call the real backend so the dashboard reflects actual database
  // state rather than hardcoded seed data.  When the backend is unavailable
  // the react-query error handler surfaces a zero-state (which is correct).
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
