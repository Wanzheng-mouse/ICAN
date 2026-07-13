import type {
  Agent,
  AgentFlowEdge,
  AgentFlowNode,
  KpiCardData,
  Task,
} from '@ican/contracts';

export const orchestrationTaskGoal = {
  userRequirement:
    '请在今晚完成 A 区 3C 物料的拣选与出库，优先处理高优先级订单，并确保 AGV 电量不低于 20%。',
  parsedResult: {
    coreGoal: '完成 A 区 3C 物料拣选与出库',
    constraints: ['优先处理高优先级订单', 'AGV 电量不低于 20%'],
    priority: 'high' as const,
    expectedFinish: '今晚 23:00 前',
  },
  uploadedFiles: [
    { name: 'A区3C库存清单_20250520.xlsx', size: '12.4 KB' },
    { name: '出库规则说明_v2.1.pdf', size: '284.7 KB' },
  ],
};

export const orchestrationFlowNodes: AgentFlowNode[] = [
  { id: 'n1', label: '需求解析', index: 1, status: 'completed', x: 80, y: 80, description: '需求理解与目标提取' },
  { id: 'n2', label: '订单拆解', index: 2, status: 'completed', x: 320, y: 80, description: '订单分解与任务粒度化' },
  { id: 'n3', label: '场景校验', index: 3, status: 'completed', x: 560, y: 80, description: '可行性校验与资源检查' },
  { id: 'n4', label: 'AGV 任务分配', index: 4, status: 'running', x: 800, y: 80, description: 'AGV 路径与任务分配' },
  { id: 'n5', label: '机械臂作业编排', index: 5, status: 'running', x: 80, y: 280, description: '拣选路径与动作编排' },
  { id: 'n6', label: '充电调度', index: 6, status: 'pending', x: 320, y: 280, description: '电量监控与充电安排' },
  { id: 'n7', label: '异常处理', index: 7, status: 'abnormal', x: 560, y: 280, description: '异常检测与策略处置' },
  { id: 'n8', label: '仿真验证', index: 8, status: 'pending', x: 800, y: 280, description: '数字孪生验证与优化' },
  { id: 'n9', label: '报告生成', index: 9, status: 'pending', x: 800, y: 480, description: '任务汇总与分析报告' },
];

export const orchestrationFlowEdges: AgentFlowEdge[] = [
  { from: 'n1', to: 'n2' },
  { from: 'n2', to: 'n3' },
  { from: 'n3', to: 'n4' },
  { from: 'n4', to: 'n5' },
  { from: 'n5', to: 'n6' },
  { from: 'n6', to: 'n7' },
  { from: 'n7', to: 'n5', dashed: true, isAbnormal: true },
  { from: 'n5', to: 'n8' },
  { from: 'n8', to: 'n9' },
];

export const orchestrationAbnormalBranches = [
  { title: '设备故障' },
  { title: '路径阻塞' },
  { title: '低电量预警' },
  { title: '任务超时' },
];

export const orchestrationAgents: Agent[] = [
  {
    id: 'a1',
    name: '总调度智能体',
    role: 'dispatch',
    status: 'running',
    isPrimary: true,
    load: 42,
    latency: 210,
    successRate: 99.2,
    sparkline: [38, 40, 42, 41, 43, 42, 41, 42, 43, 42, 41, 42, 42],
    details: [
      { label: '负载', value: '42%' },
      { label: '延迟', value: '210ms' },
      { label: '成功率', value: '99.2%' },
    ],
  },
  {
    id: 'a2',
    name: '导航智能体',
    role: 'navigation',
    status: 'running',
    load: 36,
    latency: 180,
    successRate: 98.7,
    sparkline: [30, 32, 35, 33, 36, 34, 35, 36, 35, 36, 36, 36, 36],
    details: [
      { label: '负载', value: '36%' },
      { label: '延迟', value: '180ms' },
      { label: '成功率', value: '98.7%' },
    ],
  },
  {
    id: 'a3',
    name: '操作智能体',
    role: 'operation',
    status: 'running',
    load: 58,
    latency: 240,
    successRate: 98.9,
    sparkline: [50, 55, 58, 56, 60, 58, 57, 58, 59, 58, 58, 58, 58],
    details: [
      { label: '负载', value: '58%' },
      { label: '延迟', value: '240ms' },
      { label: '成功率', value: '98.9%' },
    ],
  },
  {
    id: 'a4',
    name: '能源智能体',
    role: 'energy',
    status: 'running',
    load: 28,
    latency: 160,
    successRate: 99.4,
    sparkline: [25, 26, 28, 27, 29, 28, 27, 28, 28, 28, 28, 28, 28],
    details: [
      { label: '负载', value: '28%' },
      { label: '延迟', value: '160ms' },
      { label: '成功率', value: '99.4%' },
    ],
  },
  {
    id: 'a5',
    name: '安全智能体',
    role: 'safety',
    status: 'running',
    load: 18,
    latency: 150,
    successRate: 99.5,
    sparkline: [15, 17, 18, 18, 19, 18, 18, 18, 18, 18, 18, 18, 18],
    details: [
      { label: '负载', value: '18%' },
      { label: '延迟', value: '150ms' },
      { label: '成功率', value: '99.5%' },
    ],
  },
  {
    id: 'a6',
    name: '报告智能体',
    role: 'report',
    status: 'running',
    load: 22,
    latency: 170,
    successRate: 99.1,
    sparkline: [20, 21, 22, 22, 23, 22, 22, 22, 22, 22, 22, 22, 22],
    details: [
      { label: '负载', value: '22%' },
      { label: '延迟', value: '170ms' },
      { label: '成功率', value: '99.1%' },
    ],
  },
];

export const orchestrationTaskQueue: Task[] = [
  {
    id: 'TSK20250520-001',
    type: 'pick',
    fromStationId: 'A-3C-01',
    status: 'running',
    assignedRobotId: 'AGV-028, MP-12',
    priority: 'high',
    progress: 62,
    eta: '22:15',
    createdAt: '2025-05-20 21:30',
  },
  {
    id: 'TSK20250520-002',
    type: 'pack',
    fromStationId: 'A-3C-02',
    status: 'pending',
    assignedRobotId: 'AGV-031',
    priority: 'high',
    progress: 0,
    eta: '22:40',
    createdAt: '2025-05-20 21:32',
  },
  {
    id: 'TSK20250520-003',
    type: 'move',
    fromStationId: 'A-3C-03',
    status: 'pending',
    assignedRobotId: 'AGV-015',
    priority: 'normal',
    progress: 0,
    eta: '22:55',
    createdAt: '2025-05-20 21:35',
  },
  {
    id: 'TSK20250520-004',
    type: 'pick',
    fromStationId: 'A-3C-01',
    status: 'abnormal',
    assignedRobotId: 'AGV-028',
    priority: 'high',
    progress: 38,
    eta: '—',
    createdAt: '2025-05-20 21:36',
  },
  {
    id: 'TSK20250520-005',
    type: 'charge',
    toStationId: '充电桩-05',
    status: 'running',
    assignedRobotId: 'AGV-028',
    priority: 'normal',
    progress: 85,
    eta: '21:40',
    createdAt: '2025-05-20 21:25',
  },
];

export const orchestrationStrategyParams = {
  taskAllocation: '负载均衡（综合最优）',
  congestionFactor: 1.25,
  chargeThreshold: 20,
  priorityRule: '高优先级优先',
  retryCount: 3,
  timeoutSec: 30,
};

export const orchestrationKpis: KpiCardData[] = [
  { title: '任务总数', value: 286, trend: 'flat', iconColor: '#3b82f6' },
  { title: '运行中', value: 142, trend: 'up', iconColor: '#22c55e' },
  { title: '已完成', value: 138, trend: 'up', iconColor: '#10b981' },
  { title: '异常', value: 6, trend: 'down', iconColor: '#ef4444' },
];
