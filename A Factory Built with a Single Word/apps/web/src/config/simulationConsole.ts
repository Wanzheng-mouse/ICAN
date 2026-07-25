import type { KpiCardData } from '@ican/contracts';

/** Empty-state descriptors only. Runtime values always come from a simulation snapshot. */
export const simulationKpiDescriptors: KpiCardData[] = [
  { title: 'AGV 总数/在线', value: 0, delta: 0, deltaLabel: '活跃率', trend: 'flat', iconColor: '#3b82f6' },
  { title: '当前订单/完成', value: 0, delta: 0, deltaLabel: '已完成', trend: 'flat', iconColor: '#06b6d4' },
  { title: '平均等待时间', value: 0, unit: 's', delta: 0, deltaLabel: '当前', trend: 'flat', iconColor: '#22c55e' },
  { title: '拥堵指数', value: 0, delta: 0, deltaLabel: '%', trend: 'flat', iconColor: '#f59e0b' },
  { title: '任务完成率', value: 0, unit: '%', delta: 0, deltaLabel: '已完成', trend: 'flat', iconColor: '#a855f7' },
  { title: '设备利用率', value: 0, unit: '%', delta: 0, deltaLabel: '综合', trend: 'flat', iconColor: '#10b981' },
];

export const defaultSimulationSceneName = '当前无人仓仿真场景';
