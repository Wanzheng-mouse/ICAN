import type { TaskStatus } from '@ican/contracts';

export type AgentFlowNodeStatus = 'completed' | 'running' | 'pending' | 'abnormal' | 'monitoring';

export interface AgentFlowNode {
  id: string;
  label: string;
  index: number;
  status: AgentFlowNodeStatus;
  x: number;
  y: number;
  description: string;
}

export interface AgentFlowEdge {
  from: string;
  to: string;
  dashed?: boolean;
  isAbnormal?: boolean;
}

export type { TaskStatus };
