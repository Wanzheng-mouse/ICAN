/**
 * 项目 / 模板 API（带 React Hooks 封装）
 *
 * 路径统一通过 apiUrl() 生成：
 * - 模板静态数据走 /api/templates
 * - 项目创建走 /api/v1/projects
 * - 文件上传走 /api/v1/projects/{id}/files
 *
 * Mock 模式：直接返回本地 mock 数据
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import {
  scenarioTemplates as mockTemplates,
  templateCards as mockCards,
  featureItems as mockFeatures,
  generationSteps as mockSteps,
  uploadItems as mockUploadItems,
} from '@ican/mock-data';

import type { FeatureItem, GenerationStep, SceneTemplate, TemplateCard, UploadItem } from '@ican/contracts';
import type { ProjectCreate, ProjectRead } from '@/api/dtos/backend';

// ===== 纯数据函数 =====

export async function getTemplates(category?: string): Promise<SceneTemplate[]> {
  if (USE_MOCK) return category ? mockTemplates.filter((t) => t.category === category) : mockTemplates;
  return request({ url: apiUrl('/templates'), params: category ? { category } : {} });
}

export async function getTemplateById(id: string): Promise<SceneTemplate | null> {
  if (USE_MOCK) return mockTemplates.find((t) => t.id === id) ?? null;
  return request({ url: apiUrl(`/templates/${id}`) });
}

export async function createProject(params: ProjectCreate): Promise<ProjectRead> {
  if (USE_MOCK) return { id: `proj-${Date.now()}`, name: params.name, requirement: params.requirement ?? '', status: 'active', owner: '', created_at: new Date().toISOString() };
  return request({ url: apiUrl('/projects'), method: 'POST', data: params });
}

// ===== React Hooks =====

export function useTemplates(category?: string): UseQueryResult<SceneTemplate[]> {
  return useQuery({
    queryKey: ['templates', category ?? 'all'],
    queryFn: () => getTemplates(category),
    staleTime: 5 * 60 * 1000,
  });
}

/** 首页静态数据 —— 仍为同步常量 */
export const homeStaticData = {
  cards: (): TemplateCard[] => mockCards,
  features: (): FeatureItem[] => mockFeatures,
  steps: (): GenerationStep[] => mockSteps,
  uploadItems: (): UploadItem[] => mockUploadItems,
};
