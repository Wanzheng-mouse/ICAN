import type { FeatureItem, GenerationStep, UploadItem } from '@ican/contracts';

/** Stable product copy. This is configuration, never a mock business-data source. */
export const homeHero = {
  title: '用自然语言，\n生成并进化无人仓方案',
  subtitle: '从需求输入、场景生成到仿真验证与持续优化，一站式完成。',
};

export const requirementPlaceholder =
  '根据仓库平面图和今日订单，自动创建无人仓仿真方案，并优化拥堵、充电策略和任务分配效率。';

export const sampleRequirements = [
  '根据仓库平面图和今日订单，自动创建无人仓仿真方案，并优化拥堵、充电策略和任务分配效率。',
  '冷链多温区场景：双温区分离，AGV 优先处理高优先级订单，确保电池电量不低于 20%。',
  '3C 高峰订单场景：模拟日均 8000 单的拣选与发货，重点关注高密度货架的并发调度。',
] as const;

export const uploadSlots: UploadItem[] = [
  { slot: 'floorplan', title: '仓库平面图', description: 'JPG / PNG / CAD', accept: '.jpg,.png,.jpeg,.dwg,.dxf', iconColor: '#3b82f6', iconName: 'PictureOutlined' },
  { slot: 'orders', title: '订单表', description: 'Excel / CSV', accept: '.xlsx,.xls,.csv', iconColor: '#22c55e', iconName: 'FileExcelOutlined' },
  { slot: 'robot', title: '机器人参数', description: 'YAML / JSON', accept: '.yaml,.yml,.json', iconColor: '#a855f7', iconName: 'CodeOutlined' },
  { slot: 'rules', title: '约束规则', description: 'TXT / YAML', accept: '.txt,.yaml,.yml', iconColor: '#f97316', iconName: 'FileTextOutlined' },
];

export const generationPipeline: GenerationStep[] = [
  { index: 1, title: '需求理解', description: '理解自然语言需求，提取关键要素' },
  { index: 2, title: '场景生成', description: '生成仓库场景与资源配置' },
  { index: 3, title: '任务编排', description: '订单处理与机器人任务编排' },
  { index: 4, title: '仿真运行', description: '多智能体协同仿真运行' },
  { index: 5, title: '问题诊断', description: '识别拥堵、冲突与性能瓶颈' },
  { index: 6, title: '自主进化', description: '比较候选策略并生成优化方案' },
  { index: 7, title: '报告交付', description: '生成可视化报告与方案交付' },
];

export const productFeatures: FeatureItem[] = [
  { iconColor: '#3b82f6', iconName: 'CommentOutlined', title: '自然语言驱动', description: '用自然语言描述需求，降低门槛，让方案生成更简单高效。' },
  { iconColor: '#06b6d4', iconName: 'TeamOutlined', title: '多智能体协同', description: '支持多类型机器人与设备协同，呈现复杂作业环境。' },
  { iconColor: '#8b5cf6', iconName: 'DatabaseOutlined', title: '可复现仿真', description: '基于固定随机种子和持久化离散事件快照，结果可复核。' },
  { iconColor: '#22c55e', iconName: 'RiseOutlined', title: '多策略进化', description: '通过多随机种子候选仿真比较策略，持续优化关键指标。' },
  { iconColor: '#10b981', iconName: 'LinkOutlined', title: '全链路闭环', description: '从需求到报告闭环交付，打通规划、验证与决策全流程。' },
];
