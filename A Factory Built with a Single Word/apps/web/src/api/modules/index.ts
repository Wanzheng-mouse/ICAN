/**
 * 领域 API 模块 · 按 VITE_USE_MOCK 切换数据源
 *
 * 用法：
 *   import { useTemplates } from '@/api/modules';
 *   const { data } = useTemplates();
 *
 * 路径统一通过 apiUrl() 生成：dev 环境自动使用 VITE_API_PREFIX (/api/v1)
 */

export * from './projectApi';
export * from './scenarioApi';
export * from './simulationApi';
export * from './evolutionApi';
export * from './reportApi';
export * from './orchestrationApi';
export * from './orchestrationTypes';
export * from './resourceApi';
export * from './authApi';
export * from './searchApi';
export * from './notificationApi';
export * from './auditApi';
export * from './dashboardApi';
export * from './generationApi';
