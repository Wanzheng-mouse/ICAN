/**
 * 领域 API 模块 · 按 VITE_USE_MOCK 切换数据源
 *
 * 用法：
 *   import { useTemplates } from '@/api/modules';
 *   const { data } = useTemplates();   // mock / 真实 API 自动切换
 *
 * 阶段 1：以 mock 数据为主
 * 阶段 2：将 USE_MOCK=false 时改为调用真实后端
 *
 * 数据契约以 packages/contracts 为准，
 * 后端 FastAPI / OpenAPI 为接口事实来源。
 */

export * from './projectApi';
export * from './scenarioApi';
export * from './simulationApi';
export * from './evolutionApi';
export * from './reportApi';
export * from './orchestrationApi';
export * from './orchestrationTypes';
export * from './resourceApi';

