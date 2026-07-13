import type { EvolutionReport, KpiCardData } from '@ican/contracts';

export const evolutionReport: EvolutionReport = {
  id: 'ev-20250520-001',
  title: '方案进化报告：电商仓-中型场景-v2',
  status: 'completed',
  generatedAt: '2025-05-20 14:32:08',
  scenarioType: 'ecom',
  scale: '中型（3C 货位区）',
  goal: '提升效率、降低拥堵与能耗',
  metrics: [
    { metric: '完成时长', before: 142.6, after: 96.3, unit: '分钟', delta: 32.5, isPercent: true, isImprovement: true },
    { metric: '空驶率', before: 18.7, after: 9.8, unit: '%', delta: 47.6, isPercent: true, isImprovement: false },
    { metric: '拥堵次数', before: 12.3, after: 4.1, unit: '次/小时', delta: 66.7, isPercent: true, isImprovement: false },
    { metric: '能耗', before: 38.6, after: 26.2, unit: 'kWh/小时', delta: 32.1, isPercent: true, isImprovement: false },
    { metric: '机械臂利用率', before: 61.3, after: 78.9, unit: '%', delta: 17.6, isPercent: true, isImprovement: true },
    { metric: '订单完成率', before: 92.1, after: 98.6, unit: '%', delta: 7.1, isPercent: true, isImprovement: true },
  ],
  issues: [
    { level: 'high', title: '通道死锁风险', description: '主通道 T3 与支通道相交存在死锁可能，影响通行效率。', foundIn: 'v1.0' },
    { level: 'high', title: '任务分配不均', description: '区域 C 任务负载过高，部分机器人等待时间过长。', foundIn: 'v1.0' },
    { level: 'medium', title: '充电策略滞后', description: '充电桩使用率低，部分机器人电量不足时才充电。', foundIn: 'v1.0' },
    { level: 'medium', title: '站点 B 积压', description: '站点 B 出库任务积压，影响整体吞吐。', foundIn: 'v1.1' },
  ],
  actions: [
    { title: '单向通行设置', description: '将 T3 主通道改为单向通行，消除死锁风险。', applied: true, version: 'v1.0' },
    { title: '订单重分配', description: '基于区域负载动态重分配订单，平衡各区压力。', applied: true, version: 'v1.0' },
    { title: '充电优先级调整', description: '按电量阈值与任务优先级调整充电策略。', applied: true, version: 'v1.0' },
    { title: '备用站点启用', description: '启用站点 C 作为备用出库站点，分担 B 区压力。', applied: true, version: 'v1.1' },
    { title: '路径等待点优化', description: '优化拐点与等待点配置，减少路径冲突。', applied: true, version: 'v1.2' },
  ],
  versions: [
    { version: 'v1.0', label: '初始方案', time: '2025-05-19 10:21', description: '基于用户需求生成初始布局与调度策略' },
    { version: 'v1.1', label: '路径优化', time: '2025-05-19 14:05', description: '优化路径规划，减少拥堵与冲突' },
    { version: 'v1.2', label: '调度优化', time: '2025-05-19 18:47', description: '优化任务分配与充电策略，提升资源利用率' },
    { version: 'v2.0', label: '综合进化', time: '2025-05-20 14:32', description: '综合优化各维度指标，达成进化目标', isCurrent: true },
  ],
};

export const evolutionTrend = [
  { version: 'v1.0', completion: 92.1, emptyRate: 18.7, congestion: 12.3, energy: 38.6 },
  { version: 'v1.1', completion: 97.1, emptyRate: 14.2, congestion: 7.6, energy: 32.1 },
  { version: 'v1.2', completion: 98.6, emptyRate: 10.5, congestion: 5.0, energy: 28.4 },
  { version: 'v2.0', completion: 98.6, emptyRate: 9.8, congestion: 4.1, energy: 26.2 },
];

export const evolutionExportOptions = [
  { key: 'pdf', label: 'PDF 报告', description: '完整优化报告，含图表与对比', icon: 'FilePdfOutlined', color: '#ef4444' },
  { key: 'ppt', label: 'PPT 汇报', description: '面向汇报展示，关键数据提炼', icon: 'FilePptOutlined', color: '#f97316' },
  { key: 'mp4', label: '仿真录屏', description: '仿真动画录制，运行过程回放', icon: 'PlayCircleOutlined', color: '#3b82f6' },
  { key: 'zip', label: '配置文件', description: '场景与参数配置，可复用与对比', icon: 'FileZipOutlined', color: '#8b5cf6' },
  { key: 'json', label: 'JSON 策略包', description: '策略参数与规则，便于集成调用', icon: 'CodeOutlined', color: '#10b981' },
];

export const evolutionKpis: KpiCardData[] = [
  { title: '完成时长', value: 96.3, unit: '分钟', delta: 32.5, trend: 'down', iconColor: '#3b82f6' },
  { title: '拥堵次数', value: 4.1, unit: '次/小时', delta: 66.7, trend: 'down', iconColor: '#ef4444' },
  { title: '能耗', value: 26.2, unit: 'kWh/小时', delta: 32.1, trend: 'down', iconColor: '#f59e0b' },
  { title: '订单完成率', value: 98.6, unit: '%', delta: 7.1, trend: 'up', iconColor: '#22c55e' },
];
