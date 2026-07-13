/**
 * 任务编排 API（带 React Hooks 封装）
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import {
  orchestrationAgents as mockAgents,
  orchestrationTaskQueue as mockQueue,
  orchestrationAbnormalBranches as mockBranches,
  orchestrationStrategyParams as mockParams,
  orchestrationTaskGoal as mockGoal,
  orchestrationFlowNodes as mockFlowNodes,
  orchestrationFlowEdges as mockFlowEdges,
} from '@ican/mock-data';

import type { Agent, Task } from '@ican/contracts';
import type { AgentFlowEdge, AgentFlowNode } from '@/api/modules/orchestrationTypes';

export type OrchestrationStrategyParams = typeof mockParams;
export type OrchestrationTaskGoal = typeof mockGoal;
export type OrchestrationAbnormalBranch = { title: string };

export async function getOrchestrationAgents(): Promise<Agent[]> {
  if (USE_MOCK) return mockAgents;
  return request({ url: '/api/orchestration/agents' });
}
export async function getOrchestrationQueue(): Promise<Task[]> {
  if (USE_MOCK) return mockQueue;
  return request({ url: '/api/orchestration/queue' });
}
export async function getOrchestrationFlowNodes(): Promise<AgentFlowNode[]> {
  if (USE_MOCK) return mockFlowNodes;
  return request({ url: '/api/orchestration/flow-nodes' });
}
export async function getOrchestrationFlowEdges(): Promise<AgentFlowEdge[]> {
  if (USE_MOCK) return mockFlowEdges;
  return request({ url: '/api/orchestration/flow-edges' });
}
export async function getOrchestrationStrategy(): Promise<OrchestrationStrategyParams> {
  if (USE_MOCK) return mockParams;
  return request({ url: '/api/orchestration/strategy' });
}
export async function getOrchestrationGoal(): Promise<OrchestrationTaskGoal> {
  if (USE_MOCK) return mockGoal;
  return request({ url: '/api/orchestration/goal' });
}
export async function getOrchestrationBranches(): Promise<OrchestrationAbnormalBranch[]> {
  if (USE_MOCK) return mockBranches;
  return request({ url: '/api/orchestration/branches' });
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
