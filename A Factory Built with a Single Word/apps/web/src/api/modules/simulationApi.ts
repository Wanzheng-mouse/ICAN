/**
 * 仿真运行 API
 * 使用 apiUrl() 生成路径，去掉 /api/current 硬编码。
 *
 * Mock 模式：直接返回本地数据
 * 真实模式：向后端 /api/v1/simulations 发起 REST 请求
 */

import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import { consoleAgents as mockAgents, consoleEvents as mockEvents, consoleRun as mockRun } from '@ican/mock-data';

import type { Agent, SimulationEvent, SimulationRun } from '@ican/contracts';
import type { SimulationCreate, SimulationControl, AnomalyInject, SimulationRead } from '@/api/dtos/backend';
import { simulationReadToRun } from '@/api/mappers/simulationMapper';

export async function createSimulation(params: SimulationCreate): Promise<SimulationRead> {
  if (USE_MOCK) return { id: `sim-${Date.now()}`, project_id: params.project_id, scenario_id: params.scenario_id, status: 'created', metrics: null, config: { robot_count: params.robot_count ?? 10, order_count: params.order_count ?? 20, speed: 1 }, events: [], created_at: new Date().toISOString() };
  return request({ url: apiUrl('/simulations'), method: 'POST', data: params });
}

export async function getSimulation(id: string): Promise<SimulationRun> {
  if (USE_MOCK) return mockRun;
  const read: SimulationRead = await request({ url: apiUrl(`/simulations/${id}`) });
  return simulationReadToRun(read);
}

export async function controlSimulation(simulationId: string, action: SimulationControl['action']): Promise<void> {
  if (USE_MOCK) return;
  return request({ url: apiUrl(`/simulations/${simulationId}/control`), method: 'POST', data: { action } as SimulationControl });
}

export async function injectAnomaly(simulationId: string, type: string): Promise<void> {
  if (USE_MOCK) return;
  return request({ url: apiUrl(`/simulations/${simulationId}/anomalies`), method: 'POST', data: { type } as AnomalyInject });
}

export async function getSimulationAgents(simulationId: string): Promise<Agent[]> {
  if (USE_MOCK) return mockAgents;
  return request({ url: apiUrl(`/simulations/${simulationId}/agents`) });
}

export async function getSimulationEvents(simulationId: string): Promise<SimulationEvent[]> {
  if (USE_MOCK) return mockEvents;
  return request({ url: apiUrl(`/simulations/${simulationId}/events`) });
}

// ===== React Hooks =====
import { useMutation, useQuery, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';

export function useSimulationAgents(id?: string): UseQueryResult<Agent[]> {
  return useQuery({ queryKey: ['sim', id ?? 'mock', 'agents'], queryFn: () => getSimulationAgents(id ?? 'mock') });
}
export function useSimulationEvents(id?: string): UseQueryResult<SimulationEvent[]> {
  return useQuery({ queryKey: ['sim', id ?? 'mock', 'events'], queryFn: () => getSimulationEvents(id ?? 'mock') });
}
export function useSimulationRun(id?: string): UseQueryResult<SimulationRun> {
  return useQuery({ queryKey: ['sim', id ?? 'mock', 'run'], queryFn: () => getSimulation(id ?? 'mock') });
}

/** 兼容写法：模拟阶段可不传 simulationId */
export function useControlSimulation(): UseMutationResult<void, Error, { action: SimulationControl['action']; simulationId?: string }> {
  return useMutation({ mutationFn: ({ action, simulationId }) => controlSimulation(simulationId ?? 'mock', action) });
}

export function useInjectAnomaly(): UseMutationResult<void, Error, { type: string; simulationId?: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, simulationId }) => injectAnomaly(simulationId ?? 'mock', type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sim'] }),
  });
}
