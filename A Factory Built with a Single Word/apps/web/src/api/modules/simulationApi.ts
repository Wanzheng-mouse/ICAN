/** 第四阶段仿真运行 API：创建、查询、控制、异常、设备与事件。 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { request } from '@/api/client';
import { isMockEnabled } from '@/api/mockConfig';

const USE_MOCK = isMockEnabled('simulation');
import { apiUrl } from '@/utils/apiUrl';
import { consoleAgents as mockAgents, consoleEvents as mockEvents, consoleRun as mockRun } from '@ican/mock-data';
import type { Agent, SimulationEvent, SimulationRun } from '@ican/contracts';
import type {
  AnomalyCreate,
  SimulationAgentRead,
  SimulationControl,
  SimulationCreate,
  SimulationEventRead,
  SimulationRead,
} from '@/api/dtos/backend';
import { simulationReadToRun } from '@/api/mappers/simulationMapper';

const mockRuns = new Map<string, SimulationRead>();

function mockRead(id: string): SimulationRead {
  const existing = mockRuns.get(id);
  if (existing) return structuredClone(existing);
  const read: SimulationRead = {
    id,
    project_id: mockRun.projectId,
    scenario_id: mockRun.scenarioId,
    status: mockRun.status,
    config: { robot_count: 10, order_count: mockRun.totalOrders || 20 },
    metrics: {
      completion_rate: mockRun.totalOrders ? mockRun.completedOrders / mockRun.totalOrders : 0,
      average_duration: 0,
      congestion_count: 0,
      energy: 0,
    },
    events: [],
    created_at: mockRun.startTime,
  };
  mockRuns.set(id, read);
  return structuredClone(read);
}

function eventLevel(level: string): SimulationEvent['level'] {
  if (level === 'warning' || level === 'warn') return 'warn';
  if (level === 'error' || level === 'success') return level;
  return 'info';
}

function eventReadToEvent(event: SimulationEventRead): SimulationEvent {
  return {
    id: event.id,
    level: eventLevel(event.level),
    time: event.time,
    message: event.description || event.title,
    source: event.type,
  };
}

function agentReadToAgent(agent: SimulationAgentRead): Agent {
  const latency = Number.parseFloat(agent.responseTime) || 0;
  return {
    id: agent.id,
    name: agent.name,
    role: 'operation',
    status: agent.status === 'running' ? 'running' : agent.status === 'fault' ? 'fault' : 'paused',
    load: agent.load,
    latency,
    successRate: agent.successRate,
    details: [
      { label: '职责', value: agent.role },
      { label: '任务数', value: agent.taskCount },
      { label: '响应时间', value: latency, unit: 'ms' },
    ],
    sparkline: [agent.load, Math.max(0, agent.load - 5), Math.min(100, agent.load + 3)],
  };
}

export async function createSimulation(params: SimulationCreate): Promise<SimulationRead> {
  if (USE_MOCK) {
    const id = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const run: SimulationRead = {
      id,
      project_id: params.project_id,
      scenario_id: params.scenario_id,
      status: 'created',
      config: { robot_count: params.robot_count ?? 10, order_count: params.order_count ?? 20 },
      metrics: { completion_rate: 0, average_duration: 0, congestion_count: 0, energy: 0 },
      events: [],
      created_at: new Date().toISOString(),
    };
    mockRuns.set(id, run);
    return structuredClone(run);
  }
  return request({ url: apiUrl('/simulations'), method: 'POST', data: params });
}

export async function getSimulationDetail(id: string): Promise<SimulationRead> {
  if (USE_MOCK) return mockRead(id);
  return request({ url: apiUrl(`/simulations/${id}`) });
}

export async function getProjectSimulations(projectId: string): Promise<SimulationRead[]> {
  return request({ url: apiUrl(`/projects/${projectId}/simulations`) });
}

export async function getSimulation(id: string): Promise<SimulationRun> {
  return simulationReadToRun(await getSimulationDetail(id));
}

export async function controlSimulation(
  simulationId: string,
  action: SimulationControl['action'],
): Promise<SimulationRead> {
  if (USE_MOCK) {
    const run = mockRead(simulationId);
    run.status = { start: 'running', pause: 'paused', stop: 'stopped' }[action];
    mockRuns.set(simulationId, run);
    return structuredClone(run);
  }
  return request({
    url: apiUrl(`/simulations/${simulationId}/control`),
    method: 'POST',
    data: { action } as SimulationControl,
  });
}

export async function injectAnomaly(
  simulationId: string,
  type: AnomalyCreate['type'],
  description?: string,
): Promise<SimulationRead> {
  if (USE_MOCK) {
    const run = mockRead(simulationId);
    run.events = [
      ...run.events,
      { type, description: description || type, severity: 'warning' },
    ];
    mockRuns.set(simulationId, run);
    return structuredClone(run);
  }
  return request({
    url: apiUrl(`/simulations/${simulationId}/anomalies`),
    method: 'POST',
    data: { type, description } as AnomalyCreate,
  });
}

export async function reassignSimulationTask(simulationId: string, taskId: string, robotId?: string, priority?: number): Promise<SimulationRead> {
  if (USE_MOCK) return mockRead(simulationId);
  return request({
    url: apiUrl(`/simulations/${simulationId}/tasks/${taskId}/reassign`), method: 'POST',
    data: { robot_id: robotId, priority },
  });
}

export async function chargeSimulationRobot(simulationId: string, robotId: string): Promise<SimulationRead> {
  if (USE_MOCK) return mockRead(simulationId);
  return request({ url: apiUrl(`/simulations/${simulationId}/devices/${robotId}/charge`), method: 'POST' });
}

export async function createSimulationOrder(simulationId: string, kind: 'inbound' | 'outbound', priority = 3): Promise<SimulationRead> {
  if (USE_MOCK) return mockRead(simulationId);
  return request({ url: apiUrl(`/simulations/${simulationId}/orders`), method: 'POST', data: { kind, priority } });
}

export async function getSimulationAgents(simulationId: string): Promise<Agent[]> {
  if (USE_MOCK) return mockAgents;
  const agents: SimulationAgentRead[] = await request({
    url: apiUrl(`/simulations/${simulationId}/agents`),
  });
  return agents.map(agentReadToAgent);
}

export async function getSimulationEvents(simulationId: string): Promise<SimulationEvent[]> {
  if (USE_MOCK) return mockEvents;
  const events: SimulationEventRead[] = await request({
    url: apiUrl(`/simulations/${simulationId}/events`),
  });
  return events.map(eventReadToEvent);
}

export function useCreateSimulation(): UseMutationResult<SimulationRead, Error, SimulationCreate> {
  return useMutation({ mutationFn: createSimulation });
}

export function useSimulationDetail(id?: string | null): UseQueryResult<SimulationRead> {
  return useQuery({
    queryKey: ['simulation', id, 'detail'],
    queryFn: () => getSimulationDetail(id!),
    enabled: Boolean(id),
    refetchOnWindowFocus: false,
  });
}

export function useProjectSimulations(projectId?: string | null): UseQueryResult<SimulationRead[]> {
  return useQuery({
    queryKey: ['project', projectId, 'simulations'],
    queryFn: () => getProjectSimulations(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useSimulationAgents(id?: string | null): UseQueryResult<Agent[]> {
  return useQuery({
    queryKey: ['simulation', id, 'agents'],
    queryFn: () => getSimulationAgents(id!),
    enabled: Boolean(id),
  });
}

export function useSimulationEvents(id?: string | null): UseQueryResult<SimulationEvent[]> {
  return useQuery({
    queryKey: ['simulation', id, 'events'],
    queryFn: () => getSimulationEvents(id!),
    enabled: Boolean(id),
  });
}

export function useSimulationRun(id?: string | null): UseQueryResult<SimulationRun> {
  return useQuery({
    queryKey: ['simulation', id, 'run'],
    queryFn: () => getSimulation(id!),
    enabled: Boolean(id),
  });
}

export function useControlSimulation(): UseMutationResult<
  SimulationRead,
  Error,
  { action: SimulationControl['action']; simulationId: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, simulationId }) => controlSimulation(simulationId, action),
    onSuccess: (run) => {
      queryClient.setQueryData(['simulation', run.id, 'detail'], run);
      queryClient.setQueryData(['simulation', run.id, 'run'], simulationReadToRun(run));
      queryClient.invalidateQueries({ queryKey: ['simulation', run.id, 'agents'] });
    },
  });
}

export function useInjectAnomaly(): UseMutationResult<
  SimulationRead,
  Error,
  { type: AnomalyCreate['type']; simulationId: string; description?: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, simulationId, description }) =>
      injectAnomaly(simulationId, type, description),
    onSuccess: (run) => {
      queryClient.setQueryData(['simulation', run.id, 'detail'], run);
      queryClient.invalidateQueries({ queryKey: ['simulation', run.id, 'events'] });
    },
  });
}
