/**
 * 仿真运行 API（带 React Hooks 封装）
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import {
  consoleAgents as mockAgents,
  consoleEvents as mockEvents,
  consoleRun as mockRun,
} from '@ican/mock-data';

import type { Agent, SimulationEvent, SimulationRun } from '@ican/contracts';

export async function getSimulationAgents(): Promise<Agent[]> {
  if (USE_MOCK) return mockAgents;
  return request({ url: '/api/simulations/current/agents' });
}

export async function getSimulationEvents(): Promise<SimulationEvent[]> {
  if (USE_MOCK) return mockEvents;
  return request({ url: '/api/simulations/current/events' });
}

export async function getSimulationRun(): Promise<SimulationRun> {
  if (USE_MOCK) return mockRun;
  return request({ url: '/api/simulations/current' });
}

export async function controlSimulation(
  action: 'start' | 'pause' | 'stop',
  runId?: string,
): Promise<void> {
  if (USE_MOCK) return;
  return request({ url: `/api/simulations/${runId ?? mockRun.id}/control`, method: 'POST', data: { action } });
}

export async function injectAnomaly(type: string, runId?: string): Promise<void> {
  if (USE_MOCK) return;
  return request({ url: `/api/simulations/${runId ?? mockRun.id}/anomalies`, method: 'POST', data: { type } });
}

// ===== React Hooks =====

const SIM_KEY = ['sim', 'current'] as const;

export function useSimulationAgents(): UseQueryResult<Agent[]> {
  return useQuery({ queryKey: [...SIM_KEY, 'agents'], queryFn: getSimulationAgents });
}

export function useSimulationEvents(): UseQueryResult<SimulationEvent[]> {
  return useQuery({ queryKey: [...SIM_KEY, 'events'], queryFn: getSimulationEvents });
}

export function useSimulationRun(): UseQueryResult<SimulationRun> {
  return useQuery({ queryKey: [...SIM_KEY, 'run'], queryFn: getSimulationRun });
}

export function useControlSimulation(): UseMutationResult<void, Error, { action: 'start' | 'pause' | 'stop'; runId?: string }> {
  return useMutation({
    mutationFn: ({ action, runId }) => controlSimulation(action, runId),
  });
}

export function useInjectAnomaly(): UseMutationResult<void, Error, { type: string; runId?: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, runId }) => injectAnomaly(type, runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...SIM_KEY, 'events'] });
    },
  });
}
