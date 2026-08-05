/**
 * 任务编排 API
 */

import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';

import type { Agent, Task } from '@ican/contracts';
import type { AgentFlowEdge, AgentFlowNode } from '@/api/modules/orchestrationTypes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OrchestrationStrategyParams = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OrchestrationTaskGoal = Record<string, any>;
export type OrchestrationAbnormalBranch = { title: string };

export async function getOrchestrationAgents(): Promise<Agent[]> {
  return request({ url: apiUrl('/orchestration/agents') });
}
export async function getOrchestrationQueue(): Promise<Task[]> {
  return request({ url: apiUrl('/orchestration/queue') });
}
export async function getOrchestrationFlowNodes(): Promise<AgentFlowNode[]> {
  return request({ url: apiUrl('/orchestration/flow-nodes') });
}
export async function getOrchestrationFlowEdges(): Promise<AgentFlowEdge[]> {
  return request({ url: apiUrl('/orchestration/flow-edges') });
}
export async function getOrchestrationStrategy(): Promise<OrchestrationStrategyParams> {
  return request({ url: apiUrl('/orchestration/strategy') });
}
export async function getOrchestrationGoal(): Promise<OrchestrationTaskGoal> {
  return request({ url: apiUrl('/orchestration/goal') });
}
export async function getOrchestrationBranches(): Promise<OrchestrationAbnormalBranch[]> {
  return request({ url: apiUrl('/orchestration/branches') });
}
export async function executeOrchestration(payload: Record<string, unknown>): Promise<{ status: string; started_at: string }> {
  return request({ url: apiUrl('/orchestration/execute'), method: 'POST', data: payload });
}

export function useOrchestrationAgents(): UseQueryResult<Agent[]> {
  return useQuery({ queryKey: ['orch', 'agents'], queryFn: getOrchestrationAgents });
}
export function useOrchestrationQueue(): UseQueryResult<Task[]> {
  return useQuery({ queryKey: ['orch', 'queue'], queryFn: getOrchestrationQueue });
}
export function useOrchestrationFlowNodes(): UseQueryResult<AgentFlowNode[]> {
  return useQuery({ queryKey: ['orch', 'nodes'], queryFn: getOrchestrationFlowNodes });
}
export function useOrchestrationFlowEdges(): UseQueryResult<AgentFlowEdge[]> {
  return useQuery({ queryKey: ['orch', 'edges'], queryFn: getOrchestrationFlowEdges });
}
export function useOrchestrationStrategy(): UseQueryResult<OrchestrationStrategyParams> {
  return useQuery({ queryKey: ['orch', 'strategy'], queryFn: getOrchestrationStrategy });
}
export function useOrchestrationGoal(): UseQueryResult<OrchestrationTaskGoal> {
  return useQuery({ queryKey: ['orch', 'goal'], queryFn: getOrchestrationGoal });
}
export function useOrchestrationBranches(): UseQueryResult<OrchestrationAbnormalBranch[]> {
  return useQuery({ queryKey: ['orch', 'branches'], queryFn: getOrchestrationBranches });
}
export function useExecuteOrchestration(): UseMutationResult<{ status: string; started_at: string }, Error, Record<string, unknown>> {
  return useMutation({ mutationFn: executeOrchestration });
}
