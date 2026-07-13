/**
 * 方案进化 API（带 React Hooks 封装）
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import { evolutionReport as mockReport, evolutionTrend as mockTrend } from '@ican/mock-data';

import type { EvolutionReport } from '@ican/contracts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EvolutionTrendPoint = any;

export async function getEvolutionReport(): Promise<EvolutionReport> {
  if (USE_MOCK) return mockReport;
  return request({ url: '/api/evolutions/current' });
}

export async function getEvolutionTrend(): Promise<EvolutionTrendPoint[]> {
  if (USE_MOCK) return mockTrend;
  return request({ url: '/api/evolutions/current/versions' });
}

export function useEvolutionReport(): UseQueryResult<EvolutionReport> {
  return useQuery({ queryKey: ['evolution', 'current'], queryFn: getEvolutionReport });
}

export function useEvolutionTrend(): UseQueryResult<EvolutionTrendPoint[]> {
  return useQuery({ queryKey: ['evolution', 'trend'], queryFn: getEvolutionTrend });
}
