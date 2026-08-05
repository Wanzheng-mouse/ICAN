/**
 * 任务编排相关类型 - 统一从 @ican/contracts 引用
 *
 * 此文件保留作为本地聚合入口，便于 orchestrationApi 单独引用，
 * 同时避免外部调用者直接依赖 contracts 包路径。
 */
export type { AgentFlowNode, AgentFlowEdge } from '@ican/contracts';
