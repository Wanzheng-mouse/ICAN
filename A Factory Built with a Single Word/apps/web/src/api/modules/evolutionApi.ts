/**
 * 方案进化 API
 * 去掉 /api/evolutions/current 硬编码，改用 ID 参数。
 */

import { request } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import { evolutionReadToReport } from '@/api/mappers/evolutionMapper';

import type { EvolutionReport } from '@ican/contracts';
import type { EvolutionApplyRead, EvolutionRead, EvolutionCreate } from '@/api/dtos/backend';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EvolutionTrendPoint = any;

export async function createEvolution(params: EvolutionCreate): Promise<EvolutionRead> {
  return request({ url: apiUrl('/evolutions'), method: 'POST', data: params });
}

export async function getEvolutionReport(id: string): Promise<EvolutionReport> {
  const read: EvolutionRead = await request({ url: apiUrl(`/evolutions/${id}`) });
  return evolutionReadToReport(read);
}

export async function getEvolutionTrend(id: string): Promise<EvolutionTrendPoint[]> {
  return request({ url: apiUrl(`/evolutions/${id}/versions`) });
}

// ===== React Hooks =====
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

export function useEvolutionReport(id?: string): UseQueryResult<EvolutionReport> {
  return useQuery({ queryKey: ['evolution', id], queryFn: () => getEvolutionReport(id!), enabled: Boolean(id) });
}
export function useEvolutionTrend(id?: string): UseQueryResult<EvolutionTrendPoint[]> {
  return useQuery({ queryKey: ['evolution', id, 'trend'], queryFn: () => getEvolutionTrend(id!), enabled: Boolean(id) });
}

export async function getEvolution(id: string): Promise<EvolutionRead> {
  return request({ url: apiUrl(`/evolutions/${id}`) });
}

export async function applyEvolution(id: string): Promise<EvolutionApplyRead> {
  return request({ url: apiUrl(`/evolutions/${id}/apply`), method: 'POST' });
}

export function useEvolution(id?: string): UseQueryResult<EvolutionRead> {
  return useQuery({ queryKey: ['evolution', id], queryFn: () => getEvolution(id!), enabled: Boolean(id) });
}
