/**
 * 第四周仿真运行 API：真实 simulationId、快照恢复和 WebSocket 实时流。
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { request, USE_MOCK } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import { WsClient } from '@/api/ws';
import { consoleAgents, consoleEvents, consoleRun } from '@ican/mock-data';
import { simulationReadToRun } from '@/api/mappers/simulationMapper';
import type { Agent, SimulationRun } from '@ican/contracts';
import type {
  AnomalyCreate, SimulationControl, SimulationCreate, SimulationEventMessage,
  SimulationEventRead, SimulationRead, SimulationTickMessage,
} from '@/api/dtos/backend';

const USE_SIMULATION_MOCK = import.meta.env.VITE_USE_SIMULATION_MOCK === 'true'
  || (import.meta.env.VITE_USE_SIMULATION_MOCK !== 'false' && USE_MOCK);

function mockSnapshot(id: string, params: Partial<SimulationCreate> = {}): SimulationRead {
  return {
    id, project_id: params.project_id ?? 'mock-project', scenario_id: params.scenario_id ?? 'mock-scenario',
    status: 'created',
    config: { robot_count: params.robot_count ?? 10, order_count: params.order_count ?? 20, random_seed: params.random_seed ?? 20260717 },
    metrics: { completion_rate: 0, average_duration: 0, congestion_count: 0, energy: 0, robot_utilization: 0, charging_count: 0, completed_orders: 0, total_orders: params.order_count ?? 20 },
    events: [], robots: [], tasks: [], sim_time: 0, created_at: new Date().toISOString(),
  };
}

export async function createSimulation(params: SimulationCreate): Promise<SimulationRead> {
  if (USE_SIMULATION_MOCK) return mockSnapshot(`sim-${Date.now()}`, params);
  return request({ url: apiUrl('/simulations'), method: 'POST', data: params });
}

export async function getSimulationSnapshot(id: string): Promise<SimulationRead> {
  if (USE_SIMULATION_MOCK) return mockSnapshot(id);
  return request({ url: apiUrl(`/simulations/${id}`) });
}

export async function getSimulation(id: string): Promise<SimulationRun> {
  if (USE_SIMULATION_MOCK) return consoleRun;
  return simulationReadToRun(await getSimulationSnapshot(id));
}

export async function controlSimulation(id: string, action: SimulationControl['action']): Promise<SimulationRead> {
  if (USE_SIMULATION_MOCK) return { ...mockSnapshot(id), status: action === 'start' ? 'running' : action === 'pause' ? 'paused' : 'stopped' };
  return request({ url: apiUrl(`/simulations/${id}/control`), method: 'POST', data: { action } });
}

export async function injectAnomaly(id: string, type: AnomalyCreate['type']): Promise<SimulationRead> {
  if (USE_SIMULATION_MOCK) return mockSnapshot(id);
  return request({ url: apiUrl(`/simulations/${id}/anomalies`), method: 'POST', data: { type } });
}

export async function getSimulationAgents(id: string): Promise<Agent[]> {
  if (USE_SIMULATION_MOCK) return consoleAgents;
  return request({ url: apiUrl(`/simulations/${id}/agents`) });
}

export async function getSimulationEvents(id: string): Promise<SimulationEventRead[]> {
  if (USE_SIMULATION_MOCK) return consoleEvents as unknown as SimulationEventRead[];
  return request({ url: apiUrl(`/simulations/${id}/events`) });
}

export function simulationStreamUrl(id: string): string {
  const configured = import.meta.env.VITE_WS_URL || import.meta.env.VITE_BACKEND_URL;
  const origin = configured
    ? configured.replace(/^http/, 'ws').replace(/\/$/, '')
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
  return `${origin}/api/v1/simulations/${id}/stream`;
}

export function useSimulationSnapshot(id?: string): UseQueryResult<SimulationRead> {
  return useQuery({ queryKey: ['simulation', id], queryFn: () => getSimulationSnapshot(id!), enabled: Boolean(id), staleTime: 10_000 });
}
export function useSimulationRun(id?: string): UseQueryResult<SimulationRun> {
  return useQuery({ queryKey: ['simulation-run', id], queryFn: () => getSimulation(id!), enabled: Boolean(id) });
}
export function useSimulationAgents(id?: string): UseQueryResult<Agent[]> {
  return useQuery({ queryKey: ['simulation', id, 'agents'], queryFn: () => getSimulationAgents(id!), enabled: Boolean(id) });
}
export function useSimulationEvents(id?: string): UseQueryResult<SimulationEventRead[]> {
  return useQuery({ queryKey: ['simulation', id, 'events'], queryFn: () => getSimulationEvents(id!), enabled: Boolean(id) });
}
export function useControlSimulation(id?: string): UseMutationResult<SimulationRead, Error, SimulationControl['action']> {
  const client = useQueryClient();
  return useMutation({ mutationFn: (action) => controlSimulation(id!, action), onSuccess: (run) => client.setQueryData(['simulation', id], run) });
}
export function useInjectAnomaly(id?: string): UseMutationResult<SimulationRead, Error, AnomalyCreate['type']> {
  const client = useQueryClient();
  return useMutation({ mutationFn: (type) => injectAnomaly(id!, type), onSuccess: (run) => { client.setQueryData(['simulation', id], run); client.invalidateQueries({ queryKey: ['simulation', id, 'events'] }); } });
}

export type SimulationConnection = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export function useSimulationStream(
  id: string | undefined,
  handlers: { onTick?: (tick: SimulationTickMessage) => void; onEvent?: (event: SimulationEventRead) => void; onCompleted?: (metrics: Record<string, number>) => void } = {},
): SimulationConnection {
  const [connection, setConnection] = useState<SimulationConnection>('idle');
  const client = useQueryClient();
  useEffect(() => {
    if (!id || USE_SIMULATION_MOCK) return;
    setConnection('connecting');
    const stream = new WsClient({
      url: simulationStreamUrl(id),
      onOpen: () => { setConnection('connected'); client.invalidateQueries({ queryKey: ['simulation', id] }); },
      onClose: () => setConnection('reconnecting'),
      onError: () => setConnection('error'),
      onMessage: (raw) => {
        const message = raw as SimulationTickMessage | SimulationEventMessage | { type: string; metrics?: Record<string, number> };
        if (message.type === 'simulation_tick') handlers.onTick?.(message as SimulationTickMessage);
        if (message.type === 'simulation_event') handlers.onEvent?.((message as SimulationEventMessage).event);
        if (message.type === 'simulation_completed') handlers.onCompleted?.(message.metrics ?? {});
      },
    });
    stream.connect();
    return () => stream.close();
  }, [id, client, handlers]);
  return connection;
}
