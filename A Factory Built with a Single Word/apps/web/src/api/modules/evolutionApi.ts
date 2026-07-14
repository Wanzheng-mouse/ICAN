/**
 * 方案进化 API
 * 去掉 /api/evolutions/current 硬编码，改用 ID 参数。
 *
 * Mock 模式：直接返回本地数据
 */

import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import { evolutionReport as mockReport, evolutionTrend as mockTrend } from '@ican/mock-data';
import { evolutionReadToReport } from '@/api/mappers/evolutionMapper';

import type { EvolutionReport } from '@ican/contracts';
import type { EvolutionRead, EvolutionCreate } from '@/api/dtos/backend';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EvolutionTrendPoint = any;

export async function createEvolution(params: EvolutionCreate): Promise<EvolutionRead> {
  if (USE_MOCK) return { id: `ev-${Date.now()}`, simulation_id: params.simulation_id, diagnosis: [], baseline_metrics: {}, optimized_metrics: {}, created_at: new Date().toISOString() };
  return request({ url: apiUrl('/evolutions'), method: 'POST', data: params });
}

export async function getEvolutionReport(id: string): Promise<EvolutionReport> {
  if (USE_MOCK) return mockReport;
  const read: EvolutionRead = await request({ url: apiUrl(`/evolutions/${id}`) });
  return evolutionReadToReport(read);
}

export async function getEvolutionTrend(id: string): Promise<EvolutionTrendPoint[]> {
  if (USE_MOCK) return mockTrend;
  return request({ url: apiUrl(`/evolutions/${id}/versions`) });
}

// ===== React Hooks =====
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

export function useEvolutionReport(id?: string): UseQueryResult<EvolutionReport> {
  return useQuery({ queryKey: ['evolution', id ?? 'mock'], queryFn: () => getEvolutionReport(id ?? 'mock') });
}
export function useEvolutionTrend(id?: string): UseQueryResult<EvolutionTrendPoint[]> {
  return useQuery({ queryKey: ['evolution', id ?? 'mock', 'trend'], queryFn: () => getEvolutionTrend(id ?? 'mock') });
}
