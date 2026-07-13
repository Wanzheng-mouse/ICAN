import type {
  GenerationStep,
  FeatureItem,
  TemplateCard,
  UploadItem,
  SceneTemplate,
  LearningPathStep,
} from '@ican/contracts';

export const heroBanner = {
  title: '用自然语言，\n生成并进化无人仓方案',
  subtitle: '从需求输入、场景生成到仿真验证与持续优化，一站式完成。',
};

export const requirementPlaceholder =
  '根据仓库平面图和今日订单，自动创建无人仓仿真方案，并优化拥堵、充电策略和任务分配效率。';

export const uploadItems: UploadItem[] = [
  {
    slot: 'floorplan',
    title: '仓库平面图',
    description: 'JPG / PNG / CAD',
    accept: '.jpg,.png,.jpeg,.dwg,.dxf',
    iconColor: '#3b82f6',
    iconName: 'PictureOutlined',
  },
  {
    slot: 'orders',
    title: '订单表',
    description: 'Excel / CSV',
    accept: '.xlsx,.xls,.csv',
    iconColor: '#22c55e',
    iconName: 'FileExcelOutlined',
  },
  {
    slot: 'robot',
    title: '机器人参数',
    description: 'YAML / JSON',
    accept: '.yaml,.yml,.json',
    iconColor: '#a855f7',
    iconName: 'CodeOutlined',
  },
  {
    slot: 'rules',
    title: '约束规则',
    description: 'TXT / YAML',
    accept: '.txt,.yaml,.yml',
    iconColor: '#f97316',
    iconName: 'FileTextOutlined',
  },
];

export const generationSteps: GenerationStep[] = [
  { index: 1, title: '需求理解', description: '理解自然语言需求，提取关键要素' },
  { index: 2, title: '场景生成', description: '生成仓库场景与资源配置' },
  { index: 3, title: '任务编排', description: '订单处理与机器人任务编排' },
  { index: 4, title: '仿真运行', description: '多智能体协同仿真运行' },
  { index: 5, title: '问题诊断', description: '识别拥堵、冲突与性能瓶颈' },
  { index: 6, title: '自主进化', description: '优化策略与参数，迭代进化方案' },
  { index: 7, title: '报告交付', description: '生成可视化报告与方案交付' },
];

export const templateCards: TemplateCard[] = [
  {
    title: '电商中型仓',
    description: '适用于日均订单 1-5 万单的电商中型仓库场景',
    cover: 'ecom',
    tag: '快速体验',
  },
  {
    title: '冷链多温区',
    description: '多温区管理，保障冷链作业效率与温控合规',
    cover: 'coldchain',
    tag: '快速体验',
  },
  {
    title: '3C 高峰订单',
    description: '高峰订单波动场景，提升拣选与发货效率',
    cover: '3c',
    tag: '快速体验',
  },
  {
    title: '医药合规仓',
    description: '满足 GSP 合规要求的医药行业仓储场景',
    cover: 'medical',
    tag: '快速体验',
  },
];

export const featureItems: FeatureItem[] = [
  {
    iconColor: '#3b82f6',
    iconName: 'CommentOutlined',
    title: '自然语言驱动',
    description: '用自然语言描述需求，降低门槛，让方案生成更简单高效。',
  },
  {
    iconColor: '#06b6d4',
    iconName: 'TeamOutlined',
    title: '多智能体协同',
    description: '支持多类型机器人与设备协同，真实还原复杂作业环境。',
  },
  {
    iconColor: '#8b5cf6',
    iconName: 'DatabaseOutlined',
    title: '高保真仿真',
    description: '物理级仿真引擎，高精度建模，结果更可信。',
  },
  {
    iconColor: '#22c55e',
    iconName: 'RiseOutlined',
    title: '持续进化优化',
    description: '基于数据反馈与强化学习，自动迭代、持续提升绩效。',
  },
  {
    iconColor: '#10b981',
    iconName: 'LinkOutlined',
    title: '全链路闭环',
    description: '从需求到报告闭环交付，打通规划、验证与决策全流程。',
  },
];

export const scenarioTemplates: SceneTemplate[] = [
  {
    id: 'tpl-1',
    category: 'scene',
    title: '电商中型仓模板',
    description: '适用于日均单量 1-5 万单的电商中型仓场景，含标准货架与设备配置。',
    cover: 'ecom',
    industry: '电商',
    difficulty: 'easy',
    downloads: 1200,
    views: 356,
    updatedAt: '2024-05-20',
    downloadsLabel: '1.2k',
    viewsLabel: '356',
  },
  {
    id: 'tpl-2',
    category: 'scene',
    title: '冷链双温区模板',
    description: '双温区冷链仓库场景，支持温区隔离、温控策略与专用设备配置。',
    cover: 'coldchain',
    industry: '冷链',
    difficulty: 'medium',
    downloads: 987,
    views: 298,
    updatedAt: '2024-05-18',
    downloadsLabel: '987',
    viewsLabel: '298',
  },
  {
    id: 'tpl-3',
    category: 'strategy',
    title: 'AGV 拥堵优化策略',
    description: '基于路径重规划与分区调度的拥堵优化策略，提升通行效率。',
    cover: 'strategy',
    industry: '通用',
    difficulty: 'medium',
    downloads: 2300,
    views: 512,
    updatedAt: '2024-05-15',
    downloadsLabel: '2.3k',
    viewsLabel: '512',
  },
  {
    id: 'tpl-4',
    category: 'report',
    title: '医药合规报告模板',
    description: '符合 GSP/GDP 要求的合规报告模板，自动生成关键指标与审计日志。',
    cover: 'report',
    industry: '医药',
    difficulty: 'hard',
    downloads: 1100,
    views: 277,
    updatedAt: '2024-05-12',
    downloadsLabel: '1.1k',
    viewsLabel: '277',
  },
  {
    id: 'tpl-5',
    category: 'device',
    title: '机械臂分拣配置包',
    description: '机械臂分拣工作站完整配置包，包含设备参数与动作流程。',
    cover: 'arm',
    industry: '通用',
    difficulty: 'medium',
    downloads: 843,
    views: 231,
    updatedAt: '2024-05-10',
    downloadsLabel: '843',
    viewsLabel: '231',
  },
  {
    id: 'tpl-6',
    category: 'scene',
    title: '3C 行业小件仓模板',
    description: '适用于 3C 小件的高密度仓储场景，优化拣选路径与货位策略。',
    cover: '3c',
    industry: '3C',
    difficulty: 'easy',
    downloads: 1600,
    views: 403,
    updatedAt: '2024-05-08',
    downloadsLabel: '1.6k',
    viewsLabel: '403',
  },
  {
    id: 'tpl-7',
    category: 'strategy',
    title: '多 AGV 调度示例',
    description: '多 AGV 协同调度示例，支持优先级、任务分配与动态平衡。',
    cover: 'multi-agv',
    industry: '通用',
    difficulty: 'hard',
    downloads: 1900,
    views: 468,
    updatedAt: '2024-05-06',
    downloadsLabel: '1.9k',
    viewsLabel: '468',
  },
  {
    id: 'tpl-8',
    category: 'device',
    title: '提升机配置示例',
    description: '提升机设备参数、联动逻辑与安全策略示例配置包。',
    cover: 'lift',
    industry: '通用',
    difficulty: 'medium',
    downloads: 765,
    views: 198,
    updatedAt: '2024-05-05',
    downloadsLabel: '765',
    viewsLabel: '198',
  },
];

export const learningPath: LearningPathStep[] = [
  {
    index: 1,
    title: '新手入门',
    description: '了解平台基础能力与核心概念',
    duration: '预计 20 分钟',
    resourceCount: 4,
  },
  {
    index: 2,
    title: '场景搭建',
    description: '通过模板快速搭建并进行场景',
    duration: '预计 45 分钟',
    resourceCount: 6,
  },
  {
    index: 3,
    title: '优化进阶',
    description: '学习优化策略与高阶应用技巧',
    duration: '预计 60 分钟',
    resourceCount: 7,
  },
];

export const hotResources = [
  { rank: 1, name: '电商中型仓模板', downloads: '1.2k', views: 356 },
  { rank: 2, name: '冷链双温区模板', downloads: '987', views: 298 },
  { rank: 3, name: 'AGV 拥堵优化策略', downloads: '2.3k', views: 512 },
  { rank: 4, name: '多 AGV 调度示例', downloads: '1.9k', views: 468 },
  { rank: 5, name: '医药合规报告模板', downloads: '1.1k', views: 277 },
];

export const featuredCases = [
  {
    title: '某电商仓智能化升级项目',
    description: '通过路径优化与多 AGV 协同，实现仓储效率全面提升。',
    efficiency: '+38%',
    manpower: '-32%',
    roi: '6.2 个月',
    cover: 'ecom-after',
  },
  {
    title: '某冷链物流中心建设案例',
    description: '双温区隔离与温控策略优化，保障货品安全与时效。',
    energy: '-18%',
    temperature: '↓ 40%',
    complaint: '-62%',
    cover: 'coldchain-after',
  },
  {
    title: '某医药企业合规改造项目',
    description: '合规流程自动化与数据追溯，满足审计与监管要求。',
    audit: '↑ 70%',
    risk: '↓ 90%',
    time: '↓ 60%',
    cover: 'medical-after',
  },
];

export const resourceCategories: Array<{ key: string; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'scene', label: '场景模板' },
  { key: 'strategy', label: '策略模板' },
  { key: 'report', label: '报告模板' },
  { key: 'device', label: '设备配置' },
  { key: 'case', label: '案例库' },
  { key: 'doc', label: '教程文档' },
];
