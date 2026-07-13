/**
 * 项目 / 模板 API（带 React Hooks 封装）
 *
 * 阶段 1：以 mock 数据为主
 * 阶段 2：将 USE_MOCK=false 时改为调用真实后端
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import {
  scenarioTemplates as mockTemplates,
  templateCards as mockCards,
  featureItems as mockFeatures,
  generationSteps as mockSteps,
  uploadItems as mockUploadItems,
} from '@ican/mock-data';

import type {
  FeatureItem,
  GenerationStep,
  SceneTemplate,
  TemplateCard,
  UploadItem,
} from '@ican/contracts';

// ===== 纯数据函数 =====

export async function getTemplates(_category?: string): Promise<SceneTemplate[]> {
  if (USE_MOCK) {
    return _category ? mockTemplates.filter((t) => t.category === _category) : mockTemplates;
  }
  return request({ url: '/api/templates', params: _category ? { category: _category } : {} });
}

export async function getTemplateById(id: string): Promise<SceneTemplate | null> {
  if (USE_MOCK) return mockTemplates.find((t) => t.id === id) ?? null;
  return request({ url: `/api/templates/${id}` });
}

// ===== React Hooks =====

/** 获取模板列表（带缓存） */
export function useTemplates(category?: string): UseQueryResult<SceneTemplate[]> {
  return useQuery({
    queryKey: ['templates', category ?? 'all'],
    queryFn: () => getTemplates(category),
    staleTime: 5 * 60 * 1000,
  });
}

/** 首页静态数据（步骤/上传/特性/卡片）—— 仍为同步常量 */
export const homeStaticData = {
  cards: (): TemplateCard[] => mockCards,
  features: (): FeatureItem[] => mockFeatures,
  steps: (): GenerationStep[] => mockSteps,
  uploadItems: (): UploadItem[] => mockUploadItems,
};
